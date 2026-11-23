import { fail, redirect } from '@sveltejs/kit';
import { createAuditLog } from '$lib/server/audit.js';
import { supabaseAdmin } from '$lib/server/admin.js';
import {
  extractClientIp,
  getPrimaryDevice,
  recordUnrecognizedDevice,
  registerPrimaryDevice
} from '$lib/server/device-auth.js';

export const load = async ({ locals }) => {
  const { user, profile } = await locals.safeGetSession();
  if (!user || !profile) {
    throw redirect(303, '/login');
  }

  const isKaryawan = profile.role === 'karyawan';
  let primaryDevice = null;

  if (isKaryawan) {
    const { data: userDevices } = await supabaseAdmin
      .from('user_devices')
      .select('id, device_id, device_name, browser, os, is_trusted, registered_at')
      .eq('user_id', user.id)
      .order('registered_at', { ascending: true });

    primaryDevice = getPrimaryDevice(userDevices || []);
  }

  return {
    profile,
    isKaryawan,
    mustChange: profile.must_change_password,
    needConsent: !profile.consent_accepted_at,
    needDeviceRegistration: isKaryawan && !primaryDevice,
    primaryDevice
  };
};

export const actions = {
  default: async ({ request, locals, getClientAddress }) => {
    const { user, profile } = await locals.safeGetSession();
    if (!user || !profile) {
      throw redirect(303, '/login');
    }

    const formData = await request.formData();
    const newPassword = String(formData.get('newPassword') || '');
    const confirmPassword = String(formData.get('confirmPassword') || '');
    const consent = formData.get('consent') === 'on';
    const confirmDevice = formData.get('confirm_device') === 'on' || formData.get('confirm_device') === 'true';
    const deviceId = String(formData.get('device_id') || '').trim();
    const deviceName = String(formData.get('device_name') || '').trim() || 'Perangkat Utama';
    const browser = String(formData.get('browser') || '').trim() || 'Unknown';
    const os = String(formData.get('os') || '').trim() || 'Unknown';

    if (!profile.consent_accepted_at && !consent) {
      return fail(400, {
        error: 'Anda wajib menyetujui kebijakan privasi dan pengumpulan data presensi.'
      });
    }

    if (profile.must_change_password) {
      if (!newPassword || newPassword.length < 8) {
        return fail(400, {
          error: 'Kata sandi baru minimal 8 karakter.'
        });
      }
      if (newPassword !== confirmPassword) {
        return fail(400, {
          error: 'Konfirmasi kata sandi tidak cocok.'
        });
      }
    }

    const isKaryawan = profile.role === 'karyawan';
    let userDevices = [];
    let existingPrimary = null;

    if (isKaryawan) {
      const { data: fetchedDevices } = await supabaseAdmin
        .from('user_devices')
        .select('*')
        .eq('user_id', user.id)
        .order('registered_at', { ascending: true });

      userDevices = fetchedDevices || [];
      existingPrimary = getPrimaryDevice(userDevices);

      if (!existingPrimary) {
        if (!confirmDevice) {
          return fail(400, {
            error: 'Anda wajib mengonfirmasi bahwa Anda ingin mendaftar dengan perangkat ini sebagai Perangkat Utama.'
          });
        }
        if (!deviceId) {
          return fail(400, {
            error: 'Identitas perangkat tidak terdeteksi. Pastikan penyimpanan browser aktif lalu coba lagi.'
          });
        }
      }
    }

    const now = new Date();
    const ipAddress = extractClientIp(request, getClientAddress);
    const userAgent = request.headers.get('user-agent') || '';

    // Daftarkan perangkat utama lebih dulu jika belum terdaftar agar mencegah race condition lintas perangkat
    if (isKaryawan && !existingPrimary) {
      const regResult = await registerPrimaryDevice({
        supabaseAdmin,
        userId: user.id,
        deviceId,
        deviceName,
        browser,
        os,
        userAgent,
        ipAddress,
        now
      });

      if (regResult.conflict) {
        return fail(409, {
          error: `Akun ini baru saja didaftarkan pada perangkat lain (${regResult.primaryDevice?.device_name || 'Perangkat Utama'}). Silakan login dari perangkat utama tersebut atau hubungi HR.`
        });
      }

      if (!regResult.registered) {
        return fail(500, {
          error: regResult.error || 'Gagal mendaftarkan perangkat utama. Silakan coba lagi.'
        });
      }

      await createAuditLog({
        actorId: user.id,
        action: 'register_primary_device',
        targetType: 'user_devices',
        targetId: regResult.device?.id || user.id,
        detail: { deviceId, deviceName, browser, os, ipAddress }
      });
    } else if (isKaryawan && existingPrimary && deviceId && existingPrimary.device_id !== deviceId) {
      // Admin reset password saja (perangkat utama sudah ada), namun user mengganti sandi dari perangkat berbeda
      await recordUnrecognizedDevice({
        supabaseAdmin,
        user,
        profile,
        devices: userDevices,
        deviceId,
        deviceName,
        browser,
        os,
        userAgent,
        ipAddress,
        now,
        context: 'login'
      });
    }

    if (profile.must_change_password) {
      // Update password via Auth Admin API agar tidak terbentur sesi lama
      const { error: pwdErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: newPassword
      });

      if (pwdErr) {
        return fail(500, {
          error: 'Gagal memperbarui kata sandi. Silakan coba lagi.'
        });
      }
    }

    // Update profil di database bila ada perubahan password/consent
    if (profile.must_change_password || !profile.consent_accepted_at) {
      const updateData = {
        must_change_password: false,
        updated_at: now.toISOString()
      };

      if (!profile.consent_accepted_at) {
        updateData.consent_accepted_at = now.toISOString();
        updateData.consent_version = 'v1.0';
      }

      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (profileErr) {
        return fail(500, {
          error: 'Gagal memperbarui data profil akun.'
        });
      }

      await createAuditLog({
        actorId: user.id,
        action: 'change_initial_password_and_consent',
        targetType: 'profiles',
        targetId: user.id,
        detail: isKaryawan ? { deviceId: deviceId || null, deviceName } : undefined
      });
    }

    if (profile.role === 'karyawan') {
      throw redirect(303, '/presensi');
    } else {
      throw redirect(303, '/admin/dashboard');
    }
  }
};
