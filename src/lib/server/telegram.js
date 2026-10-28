import { supabaseAdmin } from '$lib/server/admin.js';

export async function sendTelegramAlert(messageText) {
  try {
    const { data: settings } = await supabaseAdmin
      .from('settings')
      .select('telegram_bot_token, telegram_chat_id, telegram_alerts_enabled')
      .eq('id', 1)
      .maybeSingle();

    const botToken = process.env.TELEGRAM_BOT_TOKEN || settings?.telegram_bot_token;
    const chatId = process.env.TELEGRAM_CHAT_ID || settings?.telegram_chat_id;
    const isEnabled = settings?.telegram_alerts_enabled ?? true;

    if (!isEnabled || !botToken || !chatId) {
      return { success: false, reason: 'Telegram alerts not configured or disabled' };
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML'
      })
    });

    const json = await res.json();
    return { success: json.ok, data: json };
  } catch (err) {
    console.error('Gagal mengirim notifikasi Telegram:', err);
    return { success: false, error: err };
  }
}
