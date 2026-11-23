import { supabaseAdmin } from '$lib/server/admin.js';
import { sendTelegramAlert } from '$lib/server/telegram.js';

export async function createNotification({ userId = null, targetRole = null, title, message, type = 'device_mismatch', payload = {} }) {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        target_role: targetRole,
        title,
        message,
        type,
        payload,
        is_read: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating in-app notification:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Failed to create notification:', err);
    return null;
  }
}

export async function alertUnrecognizedDevice({
  user,
  profile,
  deviceId,
  deviceName,
  browser,
  os,
  ip,
  timeStr,
  dateStr,
  context = 'presensi'
}) {
  const isLoginContext = context === 'login';
  const alertTitle = isLoginContext
    ? '[Peringatan] Login dari Perangkat Tidak Dikenal'
    : '[Peringatan] Presensi dari Perangkat Tidak Dikenal';
  const employeeName = profile?.full_name || 'Karyawan';
  const nip = profile?.nip || '-';
  const dept = profile?.department?.name || profile?.department_name || '-';

  const userMsg = isLoginContext
    ? `Akun Anda login pada ${dateStr} pukul ${timeStr} WIB menggunakan perangkat berbeda / belum terdaftar (${deviceName || browser || 'Perangkat Baru'}). Jika bukan Anda, segera hubungi HR/Administrator.`
    : `Presensi Anda pada ${dateStr} pukul ${timeStr} WIB terdeteksi menggunakan perangkat baru / belum terdaftar (${deviceName || browser || 'Perangkat Baru'}). Aktivitas ini telah dicatat untuk peninjauan HR.`;
  await createNotification({
    userId: user.id,
    title: isLoginContext ? 'Pemberitahuan Login Perangkat Berbeda' : 'Pemberitahuan Perangkat Presensi',
    message: userMsg,
    type: 'device_mismatch',
    payload: { deviceId, deviceName, browser, os, dateStr, timeStr, context }
  });

  const hrMsg = isLoginContext
    ? `Karyawan ${employeeName} (NIP: ${nip}) login dari perangkat tidak terdaftar (${deviceName || browser || 'Unknown'} - ${os || ''}).`
    : `Karyawan ${employeeName} (NIP: ${nip}) melakukan presensi dari perangkat tidak terdaftar (${deviceName || browser || 'Unknown'} - ${os || ''}).`;
  await createNotification({
    targetRole: 'admin_hr',
    title: alertTitle,
    message: hrMsg,
    type: 'device_mismatch',
    payload: { userId: user.id, nip, employeeName, deviceId, deviceName, browser, os, ip, dateStr, timeStr, context }
  });

  const telegramHeader = isLoginContext
    ? '[PERINGATAN LOGIN PERANGKAT BERBEDA]'
    : '[PERINGATAN DETEKSI PERANGKAT PRESENSI]';
  const telegramStatus = isLoginContext
    ? 'Login dilanjutkan setelah peringatan perangkat berbeda (Flagged)'
    : 'Presensi diizinkan dengan penandaan (Flagged)';

  const telegramMsg = `<b>${telegramHeader}</b>
━━━━━━━━━━━━━━━━━━
Karyawan: <b>${employeeName}</b>
NIP: <b>${nip}</b>
Departemen: <b>${dept}</b>
Waktu: <b>${dateStr} ${timeStr} WIB</b>
Perangkat: <b>${deviceName || 'Tidak Dikenal'}</b>
Browser/OS: <b>${browser || '-'} / ${os || '-'}</b>
Status: <b>${telegramStatus}</b>
━━━━━━━━━━━━━━━━━━
<i>Pemberitahuan otomatis sistem Anti-Joki Presensi Web</i>`;

  await sendTelegramAlert(telegramMsg);
}
