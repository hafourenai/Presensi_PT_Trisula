import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/admin.js';
import {
  evaluateLoginDevice,
  extractClientIp,
  recordUnrecognizedDevice
} from '$lib/server/device-auth.js';

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
    const ipAddress = extractClientIp(request, getClientAddress);
    const userAgent = request.headers.get('user-agent') || '';

    // Cari seluruh perangkat yang pernah terdaftar untuk akun karyawan ini
    const { data: userDevices } = await supabaseAdmin
      .from('user_devices')
      .select('*')
      .eq('user_id', user.id)
      .order('registered_at', { ascending: true });

    const devices = userDevices || [];
    const evalResult = evaluateLoginDevice({ devices, deviceId });

    // Jangan pernah mendaftarkan perangkat utama secara diam-diam tanpa konfirmasi eksplisit di /ganti-password
    if (evalResult.status === 'needs_registration') {
      return json({
        success: true,
        needsRegistration: true,
        isRegistered: false,
        isTrusted: false,
        isNewDevice: false,
        device: null,
        primaryDevice: null,
        status: 'unregistered',
        message: 'Perangkat utama belum didaftarkan. Silakan lakukan konfirmasi pendaftaran perangkat terlebih dahulu.'
      });
    }

    if (evalResult.status === 'trusted' && evalResult.primaryDevice) {
      await supabaseAdmin
        .from('user_devices')
        .update({
          last_used_at: now.toISOString(),
          ip_address: ipAddress,
          device_name: deviceName || evalResult.primaryDevice.device_name
        })
        .eq('id', evalResult.primaryDevice.id);

      return json({
        success: true,
        needsRegistration: false,
        isRegistered: true,
        isTrusted: true,
        isNewDevice: false,
        device: evalResult.primaryDevice,
        primaryDevice: evalResult.primaryDevice,
        status: 'primary',
        message: 'Perangkat Utama Terverifikasi'
      });
    }

    // Perangkat berbeda / tidak dikenal -> catat dengan is_trusted = false (alert dikirim hanya jika baru terdeteksi)
    const { device: recordedDevice, isNewDevice } = await recordUnrecognizedDevice({
      supabaseAdmin,
      user,
      profile,
      devices,
      deviceId,
      deviceName: deviceName || 'Perangkat Tambahan',
      browser: browser || 'Unknown',
      os: os || 'Unknown',
      userAgent,
      ipAddress,
      now,
      context: 'presensi',
      alwaysAlert: false
    });

    return json({
      success: true,
      needsRegistration: false,
      isRegistered: true,
      isTrusted: false,
      isNewDevice,
      device: recordedDevice,
      primaryDevice: evalResult.primaryDevice || null,
      status: 'unrecognized',
      message: `Perangkat Berbeda Terdeteksi! Akun Anda terdaftar di ${evalResult.primaryDevice?.device_name || 'perangkat lain'}.`
    });
  } catch (err) {
    console.error('Device sync error:', err);
    return json({ success: false, message: 'Gagal menyinkronkan data perangkat.' }, { status: 500 });
  }
}
