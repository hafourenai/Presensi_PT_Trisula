export function extractClientIp(request, getClientAddress) {
  try {
    if (typeof getClientAddress === 'function') {
      const addr = getClientAddress();
      if (addr) return addr;
    }
  } catch {
    // Fallback to proxy header below
  }
  const forwarded = request?.headers?.get?.('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim() || '127.0.0.1';
  }
  return '127.0.0.1';
}

export function getPrimaryDevice(devices) {
  if (!Array.isArray(devices) || devices.length === 0) return null;
  return devices.find((d) => d.is_trusted) || null;
}

/**
 * Evaluates a karyawan device against their registered devices in user_devices.
 * Never auto-trusts a new device when none is registered; instead requires explicit confirmation.
 */
export function evaluateLoginDevice({ devices = [], deviceId = '' }) {
  const list = Array.isArray(devices) ? devices : [];
  const cleanId = String(deviceId || '').trim();
  const primaryDevice = getPrimaryDevice(list);

  if (!primaryDevice) {
    return {
      status: 'needs_registration',
      primaryDevice: null,
      matchedDevice: cleanId ? list.find((d) => d.device_id === cleanId) || null : null
    };
  }

  if (cleanId && primaryDevice.device_id === cleanId) {
    return {
      status: 'trusted',
      primaryDevice,
      matchedDevice: primaryDevice
    };
  }

  const matchedDevice = cleanId ? list.find((d) => d.device_id === cleanId) || null : null;
  return {
    status: 'mismatch',
    primaryDevice,
    matchedDevice
  };
}

/**
 * Explicitly registers the current device as the employee's sole primary (trusted) device.
 * Guards against race conditions where another device already registered as primary.
 */
export async function registerPrimaryDevice({
  supabaseAdmin,
  userId,
  deviceId,
  deviceName,
  browser,
  os,
  userAgent = '',
  ipAddress = '127.0.0.1',
  now = new Date()
}) {
  const cleanId = String(deviceId || '').trim();
  if (!cleanId) {
    return { registered: false, error: 'Identitas perangkat tidak terdeteksi.' };
  }

  const { data: userDevices, error: fetchErr } = await supabaseAdmin
    .from('user_devices')
    .select('*')
    .eq('user_id', userId)
    .order('registered_at', { ascending: true });

  if (fetchErr) {
    return { registered: false, error: 'Gagal memeriksa perangkat terdaftar.' };
  }

  const devices = userDevices || [];
  const primaryDevice = getPrimaryDevice(devices);
  const nowIso = now.toISOString();

  if (primaryDevice) {
    if (primaryDevice.device_id === cleanId) {
      await supabaseAdmin
        .from('user_devices')
        .update({
          last_used_at: nowIso,
          ip_address: ipAddress,
          device_name: deviceName || primaryDevice.device_name,
          browser: browser || primaryDevice.browser,
          os: os || primaryDevice.os
        })
        .eq('id', primaryDevice.id);

      return { registered: true, alreadyPrimary: true, conflict: false, device: primaryDevice };
    }

    return { registered: false, conflict: true, primaryDevice };
  }

  const existingUntrusted = devices.find((d) => d.device_id === cleanId);
  if (existingUntrusted) {
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('user_devices')
      .update({
        device_name: deviceName || existingUntrusted.device_name || 'Perangkat Utama',
        user_agent: userAgent,
        browser: browser || existingUntrusted.browser || 'Unknown',
        os: os || existingUntrusted.os || 'Unknown',
        ip_address: ipAddress,
        is_trusted: true,
        registered_at: nowIso,
        last_used_at: nowIso
      })
      .eq('id', existingUntrusted.id)
      .select()
      .single();

    if (updErr) {
      return { registered: false, error: 'Gagal menetapkan perangkat utama.' };
    }

    return { registered: true, alreadyPrimary: false, conflict: false, device: updated };
  }

  const { data: created, error: insErr } = await supabaseAdmin
    .from('user_devices')
    .insert({
      user_id: userId,
      device_id: cleanId,
      device_name: deviceName || 'Perangkat Utama',
      user_agent: userAgent,
      browser: browser || 'Unknown',
      os: os || 'Unknown',
      ip_address: ipAddress,
      is_trusted: true,
      registered_at: nowIso,
      last_used_at: nowIso
    })
    .select()
    .single();

  if (insErr) {
    return { registered: false, error: 'Gagal menyimpan perangkat utama.' };
  }

  return { registered: true, alreadyPrimary: false, conflict: false, device: created };
}

/**
 * Records an unrecognized (non-primary) device as is_trusted = false and triggers HR/employee alert.
 */
export async function recordUnrecognizedDevice({
  supabaseAdmin,
  user,
  profile,
  devices = [],
  deviceId,
  deviceName,
  browser,
  os,
  userAgent = '',
  ipAddress = '127.0.0.1',
  now = new Date(),
  context = 'login',
  alwaysAlert = false,
  alertFn = null
}) {
  const cleanId = String(deviceId || '').trim() || `unknown_${Date.now()}`;
  const nowIso = now.toISOString();
  const matched = (devices || []).find((d) => d.device_id === cleanId);
  let deviceRow = matched || null;
  let isNewDevice = false;

  if (matched) {
    const { data: updated } = await supabaseAdmin
      .from('user_devices')
      .update({
        last_used_at: nowIso,
        ip_address: ipAddress,
        device_name: deviceName || matched.device_name,
        browser: browser || matched.browser,
        os: os || matched.os
      })
      .eq('id', matched.id)
      .select()
      .single();
    deviceRow = updated || matched;
  } else {
    isNewDevice = true;
    const { data: created, error: createErr } = await supabaseAdmin
      .from('user_devices')
      .insert({
        user_id: user.id,
        device_id: cleanId,
        device_name: deviceName || 'Perangkat Berbeda',
        user_agent: userAgent,
        browser: browser || 'Unknown',
        os: os || 'Unknown',
        ip_address: ipAddress,
        is_trusted: false,
        registered_at: nowIso,
        last_used_at: nowIso
      })
      .select()
      .single();

    if (createErr) {
      console.error('Gagal mencatat perangkat berbeda:', createErr);
    }
    deviceRow = created || null;
  }

  if (isNewDevice || alwaysAlert) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
    const timeFormatted = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);

    try {
      const notify = alertFn || (await import('$lib/server/notifications.js')).alertUnrecognizedDevice;
      await notify({
        user,
        profile,
        deviceId: cleanId,
        deviceName: deviceName || 'Perangkat Berbeda',
        browser: browser || 'Unknown',
        os: os || 'Unknown',
        ip: ipAddress,
        timeStr: timeFormatted,
        dateStr: today,
        context
      });
    } catch (notifErr) {
      console.warn('Gagal mengirim peringatan notifikasi perangkat:', notifErr);
    }
  }

  return { device: deviceRow, isNewDevice };
}
