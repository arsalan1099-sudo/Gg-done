const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateSaudiReleaseConfig: validate } = require('./saudi-release-config.cjs');
const config = {
  android: { package: 'com.aasaa.gosaudi' },
  ios: { bundleIdentifier: 'com.aasaa.gosaudi' },
  extra: { eas: { projectId: '12345678-1234-4123-8123-123456789abc' } },
};
const env = { EAS_BUILD_PROFILE: 'production', EXPO_PUBLIC_SAUDI_API_URL: 'https://saudi-api.company.com' };
test('preview may remain offline; a configured production build passes', () => {
  assert.doesNotThrow(() => validate(config, {}));
  assert.doesNotThrow(() => validate(config, env));
});
test('production rejects missing, private, placeholder, inherited and malformed origins', () => {
  for (const value of ['', undefined, 'http://saudi.company.com', 'https://localhost',
    'https://127.0.0.1', 'https://10.0.0.1', 'https://[::1]', 'https://api.local',
    'https://api.example.com', 'https://api.invalid', 'https://go-bharat.onrender.com',
    'https://gg-done.company.com', 'https://user:pass@saudi.company.com',
    'https://saudi.company.com/api', 'https://saudi.company.com?x=1',
    'https://saudi.company.com#x', 'https://saudi.company.com:5000'])
    assert.throws(() => validate(config, { ...env, EXPO_PUBLIC_SAUDI_API_URL: value }));
});
test('production requires correct identity, linked project and no inherited settings', () => {
  assert.throws(() => validate({ ...config, extra: {} }, env));
  assert.throws(() => validate({ ...config, android: { package: 'other.app' } }, env));
  for (const [key, value] of Object.entries({ EXPO_PUBLIC_DEV_MODE: 'true',
    EXPO_PUBLIC_API_URL: 'https://other.company.com', EXPO_PUBLIC_DOMAIN: 'other.company.com' }))
    assert.throws(() => validate(config, { ...env, [key]: value }));
});
