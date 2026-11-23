import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/admin.js';
import { alertUnrecognizedDevice } from '$lib/server/notifications.js';

export async function POST({ request, locals, getClientAddress }) {
  const { user, profile } = await locals.safeGetSession();
  if (!user || !profile || !profile.is_active || profile.role !== 'karyawan') {
    return json({ success: false, message: 'Akses tidak sah atau sesi berakhir.' }, { status: 401 });
  }

  try {
    const { deviceId, deviceName, browser, os } = await request.json();
    if (!deviceId) {
      return json({ success: false, message: 'Device ID wajib diisi.' }, { status: 400 });
    }

    const now = new Date();
    let ipAddress = '127.0.0.1';
    try {
      ipAddress = getClientAddress();
    } catch {
      ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    }
    const userAgent = request.headers.get('user-agent') || '';

    // Cari seluruh perangkat yang pernah terdaftar untuk akun karyawan ini
    const { data: userDevices } = await supabaseAdmin
      .from('user_devices')
      .select('*')
      .eq('user_id', user.id)
      .order('registered_at', { ascending: true });

    const devices = userDevices || [];
    const matched = devices.find((d) => d.device_id === deviceId);
    const primaryDevice = devices.find((d) => d.is_trusted);

    if (devices.length === 0) {
      // Perangkat pertama kali: daftarkan langsung sebagai Perangkat Utama
      const { data: newDevice, error: insErr } = await supabaseAdmin
        .from('user_devices')
        .insert({
          user_id: user.id,
          device_id: deviceId,
          device_name: deviceName || 'Perangkat Utama',
          user_agent: userAgent,
          browser: browser || 'Unknown',
          os: os || 'Unknown',
          ip_address: ipAddress,
          is_trusted: true,
          registered_at: now.toISOString(),
          last_used_at: now.toISOString()
        })
        .select()
        .single();

      if (insErr) {
        console.error('Gagal menyimpan perangkat utama:', insErr);
      }

      return json({
        success: true,
        isRegistered: true,
        isTrusted: true,
        isNewDevice: false,
        device: newDevice,
        status: 'primary',
        message: 'Perangkat ini berhasil terdaftar sebagai Perangkat Utama Anda.'
      });
    }

    if (matched) {
      // Perangkat sudah pernah tercatat di DB
      await supabaseAdmin
        .from('user_devices')
        .update({
          last_used_at: now.toISOString(),
          ip_address: ipAddress,
          device_name: deviceName || matched.device_name
        })
        .eq('id', matched.id);

      return json({
        success: true,
        isRegistered: true,
        isTrusted: matched.is_trusted,
        isNewDevice: false,
        device: matched,
        primaryDevice: primaryDevice || null,
        status: matched.is_trusted ? 'primary' : 'unrecognized',
        message: matched.is_trusted
          ? 'Perangkat Utama Terverifikasi'
          : `Perangkat ini tercatat sebagai Perangkat Berbeda (Utama: ${primaryDevice?.device_name || 'Perangkat Lain'}).`
      });
    }

    // Perangkat berbeda / ke-2 yang BELUM PERNAH dicatat sebelumnya:
    // Simpan ke tabel user_devices dengan is_trusted = false
    const { data: createdDevice, error: createErr } = await supabaseAdmin
      .from('user_devices')
      .insert({
        user_id: user.id,
        device_id: deviceId,
        device_name: deviceName || 'Perangkat Tambahan',
        user_agent: userAgent,
        browser: browser || 'Unknown',
        os: os || 'Unknown',
        ip_address: ipAddress,
        is_trusted: false,
        registered_at: now.toISOString(),
        last_used_at: now.toISOString()
      })
      .select()
      .single();

    if (createErr) {
      console.error('Gagal mencatat perangkat berbeda:', createErr);
    }

    // Picu notifikasi deteksi perangkat berbeda ke HR dan karyawan
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
    const timeFormatted = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);

    try {
      await alertUnrecognizedDevice({
        user,
        profile,
        deviceId,
        deviceName: deviceName || 'Perangkat Berbeda',
        browser: browser || 'Unknown',
        os: os || 'Unknown',
        ip: ipAddress,
        timeStr: timeFormatted,
        dateStr: today
      });
    } catch (notifErr) {
      console.warn('Gagal mengirim peringatan notifikasi perangkat:', notifErr);
    }

    return json({
      success: true,
      isRegistered: true,
      isTrusted: false,
      isNewDevice: true,
      device: createdDevice,
      primaryDevice: primaryDevice || null,
      status: 'unrecognized',
      message: `Perangkat Berbeda Terdeteksi! Akun Anda terdaftar di ${primaryDevice?.device_name || 'perangkat lain'}.`
    });
  } catch (err) {
    console.error('Device sync error:', err);
    return json({ success: false, message: 'Gagal menyinkronkan data perangkat.' }, { status: 500 });
  }
}
