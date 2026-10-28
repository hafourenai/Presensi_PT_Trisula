export function getBrowserInfo() {
  if (typeof window === 'undefined') return { browser: 'Unknown', os: 'Unknown', deviceName: 'Unknown' };

  const ua = navigator.userAgent;
  let browser = 'Browser Lain';
  let os = 'OS Lain';

  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Macintosh')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';

  const isMobile = /Mobi|Android/i.test(ua);
  const deviceName = `${isMobile ? 'Ponsel' : 'PC/Laptop'} (${browser} di ${os})`;

  return { browser, os, deviceName, isMobile };
}

export function getOrCreateDeviceId() {
  if (typeof window === 'undefined') return '';

  const KEY = 'app_presence_device_id';
  let deviceId = localStorage.getItem(KEY);

  if (!deviceId) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      deviceId = crypto.randomUUID();
    } else {
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    }
    localStorage.setItem(KEY, deviceId);
  }

  return deviceId;
}
