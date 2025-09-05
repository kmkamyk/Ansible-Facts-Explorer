// config.js
// ==============================================================================
//  IMPORTANT: FOR LOCAL DEVELOPMENT ONLY
// ==============================================================================
// This file uses environment variables (e.g., from a local .env file) to
// configure the backend for development purposes.
//
// In a production environment deployed with the install.sh script, this file is
// COMPLETELY OVERWRITTEN with a static configuration file located at
// /data/afe-api/config.js.
// ==============================================================================

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'YOUR_MACOS_USERNAME', // REPLACE or set DB_USER
  password: process.env.DB_PASSWORD || '', // Set DB_PASSWORD if you have one
  database: process.env.DB_NAME || 'awx_facts',
};

const awxConfig = {
  url: process.env.AWX_URL || 'https://awx.example.com',
  token: process.env.AWX_TOKEN || 'YOUR_SECRET_AWX_TOKEN',
  concurrencyLimit: parseInt(process.env.AWX_CONCURRENCY_LIMIT || '20', 10),
  requestTimeout: parseInt(process.env.AWX_REQUEST_TIMEOUT || '30000', 10), // 30 seconds
};

// SSL config is handled explicitly by the install.sh script for production.
// This section is for advanced local HTTPS development if needed.
const sslConfig = {
  keyPath: process.env.SSL_KEY_PATH || '',
  certPath: process.env.SSL_CERT_PATH || '',
  caPath: process.env.SSL_CA_PATH || '',
};

module.exports = {
  dbConfig,
  awxConfig,
  sslConfig,
};