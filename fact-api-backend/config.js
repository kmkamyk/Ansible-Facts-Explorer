// config.js

// All sensitive configuration is handled by the backend, loaded from environment variables.

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
  insecureSkipVerify: process.env.AWX_INSECURE_SKIP_VERIFY === 'true',
};

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