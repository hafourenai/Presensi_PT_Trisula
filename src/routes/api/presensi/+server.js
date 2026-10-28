import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/admin.js';
import { calculateDistance } from '$lib/geo.js';
import { createAuditLog } from '$lib/server/audit.js';
import { alertUnrecognizedDevice } from '$lib/server/notifications.js';

export async function POST({ request, locals, getClientAddress }) {
  const { user, profile } = await locals.safeGetSession();
  if (!user || !profile || !profile.is_active) {
    return json({ success: false, message: 'Akses tidak sah atau sesi berakhir.' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const type = formData.get('type'); // 'in' atau 'out'
    const photo = formData.get('photo'); // File JPEG
    const lat = formData.get('lat') ? parseFloat(formData.get('lat')) : null;
    const lng = formData.get('lng') ? parseFloat(formData.get('lng')) : null;
    const accuracy = formData.get('accuracy') ? parseFloat(formData.get('accuracy')) : null;
    const clientTimestamp = formData.get('timestamp') ? parseInt(formData.get('timestamp'), 10) : null;
    const isMockClient = formData.get('is_mock') === 'true';
    const deviceId = formData.get('device_id') || 'unknown';
    const deviceName = formData.get('device_name') || 'Perangkat Web';
    const browser = formData.get('browser') || 'Unknown';
    const os = formData.get('os') || 'Unknown';

    const now = new Date();
    const userAgent = request.headers.get('user-agent') || '';
    let ipAddress = '127.0.0.1';
    try {
      ipAddress = getClientAddress();
    } catch {
      ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    }

    // Anti-Fake GPS / Anomaly Inspection
    const locationFlags = [];
    let isSuspicious = false;

    if (isMockClient) {
      isSuspicious = true;
      locationFlags.push('mock_provider_detected');
    }

    if (accuracy !== null) {
      if (accuracy < 1.5) {
        isSuspicious = true;
        locationFlags.push('suspicious_high_accuracy');
      } else if (accuracy > 1500) {
        locationFlags.push('low_accuracy_cell_tower');
      }
    }

    if (clientTimestamp) {
      const timeDiffSec = Math.abs(now.getTime() - clientTimestamp) / 1000;
      if (timeDiffSec > 30) {
        isSuspicious = true;
        locationFlags.push('gps_timestamp_mismatch');
      }
    }

    if (!type || !photo || (type !== 'in' && type !== 'out')) {
      return json({ success: false, message: 'Data presensi tidak lengkap.' }, { status: 400 });
    }

    // Ambil tanggal hari ini zona Jakarta WIB
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
    const timeFormatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const timeFormatted = timeFormatter.format(now);

    // Verifikasi & Bind Device
    const { data: userDevices } = await supabaseAdmin
      .from('user_devices')
      .select('*')
      .eq('user_id', user.id);

    let isUnrecognizedDevice = false;

    if (!userDevices || userDevices.length === 0) {
      // Perangkat pertama kali: daftarkan secara otomatis sebagai perangkat utama
      await supabaseAdmin.from('user_devices').insert({
        user_id: user.id,
        device_id: deviceId,
        device_name: deviceName,
        user_agent: userAgent,
        browser,
        os,
        ip_address: ipAddress,
        is_trusted: true,
        registered_at: now.toISOString(),
        last_used_at: now.toISOString()
      });
    } else {
      // Sudah ada perangkat terdaftar sebelumnya, periksa apakah deviceId ini cocok
      const matched = userDevices.find(d => d.device_id === deviceId);
      if (matched) {
        await supabaseAdmin
          .from('user_devices')
          .update({ last_used_at: now.toISOString(), ip_address: ipAddress })
          .eq('id', matched.id);
      } else {
        // Device Berbeda / Tidak Dikenal -> Tandai & Kirim Notifikasi HR & Karyawan
        isUnrecognizedDevice = true;
        locationFlags.push('unrecognized_device');

        await alertUnrecognizedDevice({
          user,
          profile,
          deviceId,
          deviceName,
          browser,
          os,
          ip: ipAddress,
          timeStr: timeFormatted,
          dateStr: today
        });
      }
    }

    // Ambil settings kantor
    const { data: settings } = await supabaseAdmin.from('settings').select('*').eq('id', 1).single();

    // Tentukan koordinat target (utamakan profil khusus karyawan, fallback ke pengaturan kantor)
    const targetLat = profile?.work_lat ?? settings?.office_lat;
    const targetLng = profile?.work_lng ?? settings?.office_lng;
    const targetRadius = profile?.work_radius_m ?? (settings?.office_radius_m || 100);

    // Hitung jarak jika GPS tersedia
    let distanceM = null;
    if (lat !== null && lng !== null && targetLat && targetLng) {
      distanceM = calculateDistance(lat, lng, targetLat, targetLng);
    }

    // Path foto: {user_id}/{yyyy-mm-dd}/{in|out}.jpg
    const photoPath = `${user.id}/${today}/${type}.jpg`;
    const photoBuffer = await photo.arrayBuffer();

    // Upload ke Supabase Storage bucket 'attendance-photos'
    const { error: uploadError } = await supabaseAdmin.storage
      .from('attendance-photos')
      .upload(photoPath, photoBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('Upload foto presensi gagal:', uploadError);
      return json({ success: false, message: 'Gagal mengunggah foto presensi ke server.' }, { status: 500 });
    }

    // Cek rekaman presensi hari ini
    const { data: existing } = await supabaseAdmin
      .from('attendances')
      .select('*')
      .eq('user_id', user.id)
      .eq('work_date', today)
      .maybeSingle();

    if (type === 'in') {
      if (existing && existing.check_in_at) {
        return json({ success: false, message: 'Anda sudah melakukan presensi masuk hari ini.' }, { status: 400 });
      }

      const [currentHour, currentMinute] = timeFormatted.split(':').map(Number);
      const currentTotalMin = currentHour * 60 + currentMinute;

      const [startHour, startMinute] = (settings?.work_start || '08:00').split(':').map(Number);
      const startTotalMin = startHour * 60 + startMinute;
      const tolerance = settings?.late_tolerance_min || 0;

      let status = 'tepat_waktu';
      let lateMinutes = 0;

      if (currentTotalMin > startTotalMin + tolerance) {
        status = 'terlambat';
        lateMinutes = currentTotalMin - startTotalMin;
      }

      const insertPayload = {
        user_id: user.id,
        work_date: today,
        check_in_at: now.toISOString(),
        check_in_photo: photoPath,
        check_in_lat: lat,
        check_in_lng: lng,
        check_in_accuracy: accuracy,
        check_in_distance_m: distanceM,
        check_in_device_id: deviceId,
        check_in_device_name: deviceName,
        is_unrecognized_device: isUnrecognizedDevice,
        status,
        late_minutes: lateMinutes,
        is_suspicious_location: isSuspicious,
        location_flags: locationFlags,
        updated_at: now.toISOString()
      };

      if (existing) {
        await supabaseAdmin.from('attendances').update(insertPayload).eq('id', existing.id);
      } else {
        await supabaseAdmin.from('attendances').insert(insertPayload);
      }

      await createAuditLog({
        actorId: user.id,
        action: 'check_in',
        targetType: 'attendances',
        detail: { status, lateMinutes, distanceM, isUnrecognizedDevice, deviceId, deviceName }
      });

      let responseMsg = status === 'tepat_waktu' ? 'Presensi Masuk Berhasil (Tepat Waktu)' : `Presensi Masuk Berhasil (Terlambat ${lateMinutes} Menit)`;
      if (isUnrecognizedDevice) {
        responseMsg += ' — Catatan: Anda menggunakan perangkat baru/berbeda. Notifikasi telah dikirimkan ke HR.';
      }

      return json({
        success: true,
        type: 'in',
        status,
        lateMinutes,
        distanceM,
        isUnrecognizedDevice,
        time: timeFormatted,
        message: responseMsg
      });
    } else {
      // type === 'out'
      if (!existing || !existing.check_in_at) {
        return json({ success: false, message: 'Anda belum melakukan presensi masuk hari ini.' }, { status: 400 });
      }

      if (existing.check_out_at) {
        return json({ success: false, message: 'Anda sudah melakukan presensi pulang hari ini.' }, { status: 400 });
      }

      const [currentHour, currentMinute] = timeFormatted.split(':').map(Number);
      const currentTotalMin = currentHour * 60 + currentMinute;

      const [endHour, endMinute] = (settings?.work_end || '16:00').split(':').map(Number);
      const endTotalMin = endHour * 60 + endMinute;

      let earlyLeaveMinutes = 0;
      if (currentTotalMin < endTotalMin) {
        earlyLeaveMinutes = endTotalMin - currentTotalMin;
      }

      const combinedFlags = Array.from(new Set([...(existing.location_flags || []), ...locationFlags]));
      const combinedSuspicious = existing.is_suspicious_location || isSuspicious;
      const finalUnrecognized = existing.is_unrecognized_device || isUnrecognizedDevice;

      await supabaseAdmin
        .from('attendances')
        .update({
          check_out_at: now.toISOString(),
          check_out_photo: photoPath,
          check_out_lat: lat,
          check_out_lng: lng,
          check_out_accuracy: accuracy,
          check_out_distance_m: distanceM,
          check_out_device_id: deviceId,
          is_unrecognized_device: finalUnrecognized,
          early_leave_minutes: earlyLeaveMinutes,
          is_suspicious_location: combinedSuspicious,
          location_flags: combinedFlags,
          updated_at: now.toISOString()
        })
        .eq('id', existing.id);

      await createAuditLog({
        actorId: user.id,
        action: 'check_out',
        targetType: 'attendances',
        detail: { earlyLeaveMinutes, distanceM, isUnrecognizedDevice }
      });

      return json({
        success: true,
        type: 'out',
        earlyLeaveMinutes,
        distanceM,
        isUnrecognizedDevice: finalUnrecognized,
        time: timeFormatted,
        message: 'Presensi Pulang Berhasil Dicatat'
      });
    }
  } catch (err) {
    console.error('Gagal mencatat presensi:', err);
    return json({ success: false, message: 'Terjadi kesalahan sistem internal.' }, { status: 500 });
  }
}
