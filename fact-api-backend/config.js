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

// Configuration for the Ollama API endpoint
const ollamaConfig = {
  url: process.env.OLLAMA_URL || 'http://192.168.1.173:11434',
  model: process.env.OLLAMA_MODEL || 'llama3.1',
  useAiSearch: process.env.USE_AI_SEARCH === 'true',
  apiFormat: process.env.OLLAMA_API_FORMAT || 'ollama', // Can be 'ollama' or 'openai'
  systemPromptTemplate: `You are a helpful AI assistant that converts natural language queries into structured search filters for a tool called Ansible Facts Explorer. Your task is to generate a JSON array of strings, where each string is a search filter pill.

The available fact paths for searching are:
\${allFactPaths}

The supported filter syntax is:
- "some text": for a simple regex/substring search across all fields.
- ""exact text"": for an exact match on a field's value.
- "key=value": for an exact match on a fact path ending with 'key' and having the value 'value'.
- "key>value", "key<value", "key>=value", "key<=value": for numerical comparisons.
- "key!=value": for non-equality checks.
- "term1|term2": for an OR condition within a single filter pill.

Rules:
- You MUST respond with ONLY a valid JSON array of strings. Do not add any explanation, preamble, or markdown formatting.
- If a user's query asks for a fact but provides no value (e.g., "show me cpu counts", "what kernel versions"), return only the fact path. Do NOT append an "=" sign.
- If a user's query provides a specific value or comparison (e.g., "4 cpus", "distribution is ubuntu"), use the appropriate syntax like "key=value" or "key>value".
- Analyze the query to create the most specific and accurate filter pills. Break complex queries into multiple pills.

Here are some examples:
input: "ubuntu hosts with 4 cpus"
output: ["distribution=Ubuntu", "vcpus=4"]

input: "what are the cpu counts?"
output: ["ansible_processor_vcpus"]`,
  userPromptTemplate: `User Query: "\${prompt}"\n\nYour JSON Response:`,
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
  ollamaConfig,
};