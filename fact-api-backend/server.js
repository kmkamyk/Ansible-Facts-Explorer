// server.js

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = 4000;

// Allow requests from your frontend application
app.use(cors());

// --- Centralized Configuration ---
// All sensitive configuration is now handled by the backend, loaded from environment variables.

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
};

// Database connection pool
const pool = new Pool(dbConfig);


// --- Status Check Logic ---
const isAwxConfigured = () => {
    return !!awxConfig.url && !!awxConfig.token && awxConfig.url !== 'https://awx.example.com' && awxConfig.token !== 'YOUR_SECRET_AWX_TOKEN';
};

const checkDbConnection = async () => {
    try {
        const client = await pool.connect();
        client.release();
        return { configured: true };
    } catch (error) {
        console.error("Database connection check failed:", error.message);
        return { configured: false, error: error.message };
    }
};

// --- AWX Data Fetching Logic (moved from frontend) ---
const fetchFactsFromAwx = async () => {
  if (!isAwxConfigured()) {
    throw new Error('AWX is not configured on the backend. Please set AWX_URL and AWX_TOKEN environment variables.');
  }

  const headers = {
    'Authorization': `Bearer ${awxConfig.token}`,
    'Content-Type': 'application/json',
  };

  const allHosts = [];
  let currentUrl = new URL('/api/v2/hosts/?page_size=100', awxConfig.url).href;

  console.log('Starting to fetch hosts from AWX...');
  while (currentUrl) {
    const response = await fetch(currentUrl, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch hosts list: ${response.statusText} (${response.status})`);
    }
    const data = await response.json();
    allHosts.push(...data.results);
    currentUrl = data.next ? new URL(data.next, awxConfig.url).href : null;
  }
  console.log(`Found ${allHosts.length} hosts. Fetching facts for each...`);

  const allHostFacts = {};
  const concurrencyLimit = 100;
  const queue = [...allHosts];
  const hostMap = new Map(allHosts.map(h => [h.name, h]));

  const processQueue = async () => {
    while (queue.length > 0) {
      const host = queue.shift();
      if (!host) continue;
      
      const hostWithMeta = hostMap.get(host.name);

      try {
        const factsUrl = new URL(host.related.ansible_facts, awxConfig.url).href;
        const factsResponse = await fetch(factsUrl, { headers });
        
        if (factsResponse.status === 404) {
          allHostFacts[host.name] = {};
        } else if (!factsResponse.ok) {
          console.error(`Failed to fetch facts for ${host.name}: ${factsResponse.statusText}`);
          allHostFacts[host.name] = { error: `Failed to fetch facts (${factsResponse.statusText})` };
        } else {
          const facts = await factsResponse.json();
          if (hostWithMeta?.ansible_facts_modified) {
              facts.__awx_facts_modified_timestamp = hostWithMeta.ansible_facts_modified;
          }
          allHostFacts[host.name] = facts;
        }
      } catch (error) {
        console.error(`Error processing facts for ${host.name}:`, error);
        allHostFacts[host.name] = { error: 'Network or parsing error while fetching facts.' };
      }
    }
  };

  const workers = Array(concurrencyLimit).fill(null).map(() => processQueue());
  await Promise.all(workers);

  console.log('Finished fetching all facts from AWX.');
  return allHostFacts;
};

// --- New Service Status Endpoint ---
app.get('/api/status', async (req, res) => {
    console.log('Received request for service status...');
    const dbStatus = await checkDbConnection();
    const status = {
        awx: {
            configured: isAwxConfigured(),
        },
        db: {
            configured: dbStatus.configured,
        }
    };
    console.log('Service status:', status);
    res.json(status);
});

// --- Unified API Endpoint ---
// The frontend calls this endpoint with ?source=db or ?source=awx
app.get('/api/facts', async (req, res) => {
  const { source } = req.query;

  try {
    let data;
    if (source === 'db') {
      console.log('Received request for facts from database...');
      const result = await pool.query('SELECT hostname, data, modified_at FROM facts');
      
      const allHostFacts = {};
      for (const row of result.rows) {
          if (row.data && row.modified_at) {
              row.data.__awx_facts_modified_timestamp = row.modified_at.toISOString();
          }
          allHostFacts[row.hostname] = row.data || {};
      }
      data = allHostFacts;
      console.log(`Fetched data for ${Object.keys(data).length} hosts from DB.`);

    } else if (source === 'awx') {
      console.log('Received request for facts from AWX...');
      data = await fetchFactsFromAwx();
      console.log(`Fetched data for ${Object.keys(data).length} hosts from AWX.`);

    } else {
      return res.status(400).json({ error: 'Invalid or missing "source" query parameter. Use "db" or "awx".' });
    }
    
    res.json(data);

  } catch (err) {
    console.error(`Error during data fetch for source "${source}":`, err);
    res.status(500).json({ error: err.message || 'Failed to fetch data from the specified source.' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});