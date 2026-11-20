const { validateSaudiReleaseConfig } = require('./scripts/saudi-release-config.cjs');

module.exports = ({ config }) => {
  validateSaudiReleaseConfig(config, process.env);
  return config;
};
