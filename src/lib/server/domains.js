const DEFAULT_EMPLOYEE_ORIGIN = 'https://presensi.trisulaprimaagung.my.id';
const DEFAULT_ADMIN_ORIGIN = 'https://admin.trisulaprimaagung.my.id';

function configuredOrigin(value, fallback) {
  const origin = new URL(value || fallback);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('Portal origin must contain only protocol and hostname.');
  }
  return origin.origin;
}

export function portalConfig(env, nodeEnv = 'production') {
  const employeeOrigin = configuredOrigin(env.EMPLOYEE_ORIGIN, DEFAULT_EMPLOYEE_ORIGIN);
  const adminOrigin = configuredOrigin(env.ADMIN_ORIGIN, DEFAULT_ADMIN_ORIGIN);
  const internalHosts = new Set(
    String(env.INTERNAL_HOSTS || '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );

  if (nodeEnv !== 'production') {
    internalHosts.add('localhost');
    internalHosts.add('127.0.0.1');
  }

  return {
    employeeOrigin,
    adminOrigin,
    employeeHost: new URL(employeeOrigin).hostname.toLowerCase(),
    adminHost: new URL(adminOrigin).hostname.toLowerCase(),
    internalHosts
  };
}

export function portalForHost(hostname, config) {
  const host = hostname.toLowerCase();
  if (host === config.employeeHost) return 'employee';
  if (host === config.adminHost) return 'admin';
  if (config.internalHosts.has(host)) return 'development';
  return null;
}

export function portalUrl(origin, pathname = '/', search = '') {
  const target = new URL(pathname, origin);
  target.search = search;
  return target.toString();
}
