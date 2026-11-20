const net = require('node:net');

// Build-time validation only. Connectivity and OTP delivery need separate tests.
function validateSaudiReleaseConfig(config, env) {
  if (env.EAS_BUILD_PROFILE !== 'production') return;
  const value = env.EXPO_PUBLIC_SAUDI_API_URL;
  let url;
  try { url = new URL(value); } catch {
    throw Error('Set EXPO_PUBLIC_SAUDI_API_URL to the dedicated Saudi HTTPS origin before a production build.');
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash || url.port ||
      !host.includes('.') || net.isIP(host) || host.startsWith('[') ||
      /(^|\.)(localhost|local|internal|test|example|invalid)$/.test(host) ||
      /(^|\.)example\.(com|net|org)$/.test(host) ||
      /go[-_]?bharat|gg[-_]?done/i.test(host)) {
    throw Error('Production requires a public, dedicated Saudi HTTPS origin without a path, credentials or port.');
  }
  if (env.EXPO_PUBLIC_API_URL || env.EXPO_PUBLIC_DOMAIN || env.EXPO_PUBLIC_DEV_MODE === 'true')
    throw Error('Remove inherited API settings and disable development mode for the Saudi release.');
  if (config.android?.package !== 'com.aasaa.gosaudi' ||
      config.ios?.bundleIdentifier !== 'com.aasaa.gosaudi')
    throw Error('Saudi release application identifiers do not match.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(config.extra?.eas?.projectId || ''))
    throw Error('Link the owner Go Saudi EAS project before a production build.');
}
module.exports = { validateSaudiReleaseConfig };
