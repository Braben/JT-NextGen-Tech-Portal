/**
 * Production release check.
 *
 * This command validates deployment configuration and build artefacts without
 * opening the database or changing application data. Run it in the release
 * environment immediately before starting the API.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { validateRuntimeEnv } = require('../lib/env');

const failures = [];

try {
  // Force the same validation path used by `start:prod`, even when this
  // command is run from a shell that forgot to set NODE_ENV.
  process.env.NODE_ENV = 'production';
  validateRuntimeEnv();
} catch (error) {
  failures.push(error.message);
}

const frontendIndex = path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html');
if (!fs.existsSync(frontendIndex)) {
  failures.push('frontend/dist/index.html is missing; run `npm --prefix frontend run build`');
}

const uploadsDir = path.join(__dirname, '..', 'uploads');
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.accessSync(uploadsDir, fs.constants.W_OK);
} catch (error) {
  failures.push(`backend/uploads is not writable: ${error.message}`);
}

const port = Number(process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  failures.push('PORT must be an integer between 1 and 65535');
}

if (failures.length) {
  console.error('Release check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('Release check passed: production configuration, frontend build, uploads path, and port are ready.');
}
