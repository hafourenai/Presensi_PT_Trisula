import { fail, redirect } from '@sveltejs/kit';
import { createAuditLog } from '$lib/server/audit.js';
import { supabaseAdmin } from '$lib/server/admin.js';
import { portalConfig, portalForHost } from '$lib/server/domains.js';
import {
  evaluateLoginDevice,
  extractClientIp,
  recordUnrecognizedDevice
} from '$lib/server/device-auth.js';
import { env } from '$env/dynamic/private';

export const load = async ({ locals, url }) => {
  const portal = portalForHost(url.hostname, portalConfig(env, env.NODE_ENV));
  const { user, profile } = await locals.safeGetSession();
  if (user && profile) {
    if (profile.must_change_password) {
      throw redirect(303, '/ganti-password');
    }
    if (profile.role === 'karyawan') {
      throw redirect(303, '/presensi');
    }
    throw redirect(303, '/admin/dashboard');
  }

  const errorParam = url.searchParams.get('error');
  let errorMessage = '';
  if (errorParam === 'inactive') {
    errorMessage = 'Akun Anda telah dinonaktifkan. Silakan hubungi Administrator.';
  } else if (errorParam === 'unauthorized_domain') {
    errorMessage = 'Akun ini tidak dapat digunakan pada portal tersebut.';
  }

  return { errorMessage, portal: portal === 'admin' ? 'admin' : 'employee' };
};

export const actions = {
  default: async ({ request, locals, url, getClientAddress }) => {
    const formData = await request.formData();
    const identifier = String(formData.get('identifier') || '').trim();
    const password = String(formData.get('password') || '');
    const deviceId = String(formData.get('device_id') || '').trim();
    const deviceName = String(formData.get('device_name') || '').trim() || 'Perangkat Web';
    const browser = String(formData.get('browser') || '').trim() || 'Unknown';
    const os = String(formData.get('os') || '').trim() || 'Unknown';
    const confirmUnrecognizedDevice = String(formData.get('confirm_unrecognized_device') || '') === 'true';

    if (!identifier || !password) {
      return fail(400, {
        error: 'NIP / Username atau Email dan kata sandi wajib diisi.',
        identifier
      });
    }

    let targetEmail = identifier.toLowerCase();

    // Jika pengguna memasukkan NIP / Username (bukan format email)
    if (!identifier.includes('@')) {
      const { data: profileByNip } = await supabaseAdmin
        .from('profiles')
        .select('email, is_active')
        .eq('nip', identifier)
        .maybeSingle();

      if (!profileByNip) {
        return fail(400, {
          error: 'NIP / Username tidak ditemukan dalam sistem.',
          identifier
        });
      }

      if (!profileByNip.is_active) {
        return fail(403, {
          error: 'Akun Anda telah dinonaktifkan. Silakan hubungi Administrator.',
          identifier
        });
      }

      targetEmail = profileByNip.email;
    }

    // Login ke Supabase Auth menggunakan email & password
    const { data, error } = await locals.supabase.auth.signInWithPassword({
      email: targetEmail,
      password
    });

    if (error || !data.user) {
      return fail(400, {
        error: 'Kata sandi atau identitas masuk salah. Silakan coba lagi.',
        identifier
      });
    }

    // Ambil profil beserta departemen untuk notifikasi perangkat
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*, department:departments(name)')
      .eq('id', data.user.id)
      .single();

    if (!profile || !profile.is_active) {
      await locals.supabase.auth.signOut();
      return fail(403, {
        error: 'Akun Anda tidak aktif atau belum terdaftar di sistem profil.',
        identifier
      });
    }

    const portal = portalForHost(url.hostname, portalConfig(env, env.NODE_ENV));
    const allowed = portal === 'admin'
      ? ['administrator', 'admin_hr'].includes(profile.role)
      : portal === 'development' || profile.role === 'karyawan';

    if (!allowed) {
      await locals.supabase.auth.signOut();
      return fail(403, {
        error: 'Akun ini tidak dapat digunakan pada portal tersebut.',
        identifier
      });
    }

    const now = new Date();
    const ipAddress = extractClientIp(request, getClientAddress);
    const userAgent = request.headers.get('user-agent') || '';

    // Verifikasi perangkat untuk karyawan
    if (profile.role === 'karyawan') {
      const { data: userDevices } = await supabaseAdmin
        .from('user_devices')
        .select('*')
        .eq('user_id', data.user.id)
        .order('registered_at', { ascending: true });

      const devices = userDevices || [];
      const deviceEval = evaluateLoginDevice({ devices, deviceId });

      if (deviceEval.status === 'mismatch') {
        const primaryDevice = deviceEval.primaryDevice;

        if (!confirmUnrecognizedDevice) {
          // Hentikan sesi sementara sampai karyawan membaca & mengonfirmasi peringatan perangkat berbeda
          await locals.supabase.auth.signOut();

          await createAuditLog({
            actorId: data.user.id,
            action: 'login_unrecognized_device_warning',
            targetType: 'auth',
            targetId: data.user.id,
            detail: {
              identifier,
              email: targetEmail,
              deviceId: deviceId || null,
              deviceName,
              browser,
              os,
              ipAddress,
              primaryDeviceId: primaryDevice?.device_id || null,
              primaryDeviceName: primaryDevice?.device_name || null
            }
          });

          return fail(409, {
            deviceMismatch: true,
            error: 'Peringatan: Akun ini sudah terdaftar pada perangkat lain.',
            identifier,
            primaryDeviceName: primaryDevice?.device_name || 'Perangkat Utama Lain',
            primaryDeviceRegisteredAt: primaryDevice?.registered_at || null,
            currentDeviceName: deviceName
          });
        }

        // Karyawan tetap melanjutkan login setelah melihat peringatan -> catat perangkat asing & laporkan ke HR
        await recordUnrecognizedDevice({
          supabaseAdmin,
          user: data.user,
          profile,
          devices,
          deviceId,
          deviceName,
          browser,
          os,
          userAgent,
          ipAddress,
          now,
          context: 'login',
          alwaysAlert: true
        });

        await supabaseAdmin
          .from('profiles')
          .update({ last_login_at: now.toISOString() })
          .eq('id', data.user.id);

        await createAuditLog({
          actorId: data.user.id,
          action: 'login_unrecognized_device',
          targetType: 'auth',
          targetId: data.user.id,
          detail: {
            identifier,
            email: targetEmail,
            deviceId: deviceId || null,
            deviceName,
            browser,
            os,
            ipAddress,
            primaryDeviceId: primaryDevice?.device_id || null,
            primaryDeviceName: primaryDevice?.device_name || null
          }
        });

        if (profile.must_change_password) {
          throw redirect(303, '/ganti-password');
        }
        throw redirect(303, '/presensi?device_warning=1');
      }

      if (deviceEval.status === 'trusted' && deviceEval.primaryDevice) {
        await supabaseAdmin
          .from('user_devices')
          .update({
            last_used_at: now.toISOString(),
            ip_address: ipAddress,
            device_name: deviceName || deviceEval.primaryDevice.device_name
          })
          .eq('id', deviceEval.primaryDevice.id);
      }

      // Catat login
      await supabaseAdmin
        .from('profiles')
        .update({ last_login_at: now.toISOString() })
        .eq('id', data.user.id);

      await createAuditLog({
        actorId: data.user.id,
        action: 'login',
        targetType: 'auth',
        targetId: data.user.id,
        detail: { identifier, email: targetEmail, deviceId: deviceId || null, deviceName, ipAddress }
      });

      // Jika belum ganti kata sandi default ATAU belum mendaftarkan perangkat utama -> wajib ke /ganti-password
      if (profile.must_change_password || deviceEval.status === 'needs_registration') {
        throw redirect(303, '/ganti-password');
      }

      throw redirect(303, '/presensi');
    }

    // Catat login untuk role admin / admin_hr
    await supabaseAdmin
      .from('profiles')
      .update({ last_login_at: now.toISOString() })
      .eq('id', data.user.id);

    await createAuditLog({
      actorId: data.user.id,
      action: 'login',
      targetType: 'auth',
      targetId: data.user.id,
      detail: { identifier, email: targetEmail }
    });

    if (profile.must_change_password) {
      throw redirect(303, '/ganti-password');
    }

    throw redirect(303, '/admin/dashboard');
  }
};
