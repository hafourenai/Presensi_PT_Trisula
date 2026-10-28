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

export async function alertUnrecognizedDevice({ user, profile, deviceId, deviceName, browser, os, ip, timeStr, dateStr }) {
  const alertTitle = '⚠️ Peringatan Presensi dari Perangkat Tidak Dikenal';
  const employeeName = profile?.full_name || 'Karyawan';
  const nip = profile?.nip || '-';
  const dept = profile?.department?.name || profile?.department_name || '-';

  const userMsg = `Presensi Anda pada ${dateStr} pukul ${timeStr} WIB terdeteksi menggunakan perangkat baru / belum terdaftar (${deviceName || browser || 'Perangkat Baru'}). Aktivitas ini telah dicatat untuk peninjauan HR.`;
  await createNotification({
    userId: user.id,
    title: 'Pemberitahuan Perangkat Presensi',
    message: userMsg,
    type: 'device_mismatch',
    payload: { deviceId, deviceName, browser, os, dateStr, timeStr }
  });

  const hrMsg = `Karyawan ${employeeName} (NIP: ${nip}) melakukan presensi dari perangkat tidak terdaftar (${deviceName || browser || 'Unknown'} - ${os || ''}).`;
  await createNotification({
    targetRole: 'hr',
    title: alertTitle,
    message: hrMsg,
    type: 'device_mismatch',
    payload: { userId: user.id, nip, employeeName, deviceId, deviceName, browser, os, ip, dateStr, timeStr }
  });

  const telegramMsg = `⚠️ <b>PERINGATAN DETEKSI PERANGKAT PRESENSI</b>
━━━━━━━━━━━━━━━━━━
👤 <b>Karyawan:</b> ${employeeName}
🆔 <b>NIP:</b> ${nip}
🏢 <b>Departemen:</b> ${dept}
⏰ <b>Waktu:</b> ${dateStr} ${timeStr} WIB
📱 <b>Perangkat:</b> ${deviceName || 'Tidak Dikenal'}
🌐 <b>Browser/OS:</b> ${browser || '-'} / ${os || '-'}
📍 <b>Status:</b> Presensi diizinkan dengan penandaan (Flagged)
━━━━━━━━━━━━━━━━━━
<i>Pemberitahuan otomatis sistem Anti-Joki Presensi Web</i>`;

  await sendTelegramAlert(telegramMsg);
}
