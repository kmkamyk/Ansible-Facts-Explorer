// server.js

const express = require('express');
const https = require('https'');
const fs = require('fs');
const { Pool } = require('pg');
const cors = require('cors');
const { dbConfig, awxConfig, sslConfig, ollamaConfig } = require('./config');

const app = express();
const port = 4000;

// Allow requests from your frontend application
app.use(cors());
app.use(express.json()); // Middleware to parse JSON bodies


// --- Helper function to count facts in a way that matches frontend's row count ---
const countTotalFacts = (allHostFacts) => {
  const countLeafNodes = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      return 0;
    }
    let count = 0;
    for (const key in obj) {
      if (key === '__awx_facts_modified_timestamp') continue;
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          count += countLeafNodes(value);
        } else {
          count++; // Leaf node
        }
      }
    }
    return count;
  };

  let totalFactsForFrontend = 0;
  for (const host in allHostFacts) {
    if (Object.prototype.hasOwnProperty.call(allHostFacts, host)) {
      const factCount = countLeafNodes(allHostFacts[host]);
      // The frontend creates one "no data" row for hosts with 0 facts.
      totalFactsForFrontend += Math.max(1, factCount);
    }
  }
  return totalFactsForFrontend;
};


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

// --- AWX Data Fetching Logic (Refactored for Robust Concurrency) ---
const fetchFactsFromAwx = async () => {
  if (!isAwxConfigured()) {
    throw new Error('AWX is not configured on the backend. Please set AWX_URL and AWX_TOKEN environment variables.');
  }

  console.log(`[AWX Fetch] Using AWX URL: ${awxConfig.url}`);
  console.log(`[AWX Fetch] Concurrency limit set to: ${awxConfig.concurrencyLimit}`);
  console.log(`[AWX Fetch] Request timeout set to: ${awxConfig.requestTimeout}ms`);

  const baseFetchOptions = {
    headers: {
      'Authorization': `Bearer ${awxConfig.token}`,
      'Content-Type': 'application/json',
    },
  };

  const allHosts = [];
  let currentUrl = new URL('/api/v2/hosts/?page_size=100', awxConfig.url).href;
  let pageNum = 1;

  console.log(`[AWX Fetch] Starting to fetch hosts from AWX...`);
  while (currentUrl) {
    console.log(`[AWX Fetch] Fetching hosts page ${pageNum} from: ${currentUrl}`);
    const response = await fetch(currentUrl, baseFetchOptions);
    if (!response.ok) {
      console.error(`[AWX Fetch] Error response from AWX when fetching hosts: ${response.status} ${response.statusText}`);
      const errorBody = await response.text();
      console.error(`[AWX Fetch] Error body: ${errorBody}`);
      throw new Error(`Failed to fetch hosts list: ${response.statusText} (${response.status})`);
    }
    const data = await response.json();
    allHosts.push(...data.results);
    currentUrl = data.next ? new URL(data.next, awxConfig.url).href : null;
    pageNum++;
  }
  
  const totalHosts = allHosts.length;
  console.log(`[AWX Fetch] AUDIT: Found ${totalHosts} total hosts. Sorting and fetching facts...`);
  if (totalHosts === 0) {
    return {};
  }
  
  // Sort hosts for deterministic processing order, as suggested by the user.
  allHosts.sort((a, b) => a.name.localeCompare(b.name));

  const hostMap = new Map(allHosts.map(h => [h.name, h]));
  
  // This function processes a single host and returns a result object.
  // It no longer mutates shared state, preventing race conditions.
  const processHost = async (host) => {
    if (!host) return null;
    
    const hostWithMeta = hostMap.get(host.name);
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), awxConfig.requestTimeout);
      
      try {
        const factsUrl = new URL(host.related.ansible_facts, awxConfig.url).href;
        const factsResponse = await fetch(factsUrl, { ...baseFetchOptions, signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (factsResponse.status === 404) {
          return { status: 'no_facts', hostName: host.name, facts: {} };
        } 
        
        if (!factsResponse.ok) {
          throw new Error(`HTTP error ${factsResponse.status}: ${factsResponse.statusText}`);
        }

        const facts = await factsResponse.json();
        if (hostWithMeta?.ansible_facts_modified) {
            facts.__awx_facts_modified_timestamp = hostWithMeta.ansible_facts_modified;
        }
        return { status: 'success', hostName: host.name, facts };

      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.error(`[AWX Fetch] Attempt ${attempt}/${maxRetries} for host '${host.name}' timed out.`);
        } else {
          console.error(`[AWX Fetch] Attempt ${attempt}/${maxRetries} for host '${host.name}' failed:`, error.message);
        }
        if (attempt < maxRetries) {
          await new Promise(res => setTimeout(res, 1000));
        }
      }
    }

    const errorMessage = `Failed to fetch facts after ${maxRetries} attempts.`;
    console.error(`[AWX Fetch] All ${maxRetries} attempts failed for host '${host.name}'. Skipping.`);
    return { status: 'failure', hostName: host.name, error: errorMessage, facts: { error: errorMessage } };
  };
  
  // --- Robust Concurrency Management: Process chunks concurrently, aggregate serially ---
  console.log(`[AWX Fetch] Processing hosts in chunks with a concurrency limit of ${awxConfig.concurrencyLimit}.`);
  const concurrencyLimit = awxConfig.concurrencyLimit;
  
  const allHostFacts = {};
  let processedCount = 0;
  let successCount = 0;
  let failureCount = 0;
  let noFactsCount = 0;

  for (let i = 0; i < totalHosts; i += concurrencyLimit) {
    const chunk = allHosts.slice(i, i + concurrencyLimit);
    const promises = chunk.map(host => processHost(host));
    
    const results = await Promise.all(promises);

    // Process results serially to prevent race conditions on counters and the final object.
    for (const result of results) {
        if (!result) continue;

        processedCount++;
        allHostFacts[result.hostName] = result.facts;
        
        if (result.status === 'success') successCount++;
        else if (result.status === 'failure') failureCount++;
        else if (result.status === 'no_facts') noFactsCount++;
    }
    console.log(`[AWX Fetch Progress] Processed ${processedCount}/${totalHosts} | Success: ${successCount} | Failures: ${failureCount} | No Facts: ${noFactsCount}`);
  }

  const totalIndividualFacts = countTotalFacts(allHostFacts);

  console.log('[AWX Fetch] Finished fetching all facts from AWX.');
  console.log(`[AWX Fetch Summary] Total Hosts Found: ${totalHosts} | Processed: ${processedCount} | Success: ${successCount} | Failures: ${failureCount} | No Facts: ${noFactsCount}`);
  console.log(`[AWX Fetch Summary] ===> Total facts to be imported (frontend row count): ${totalIndividualFacts.toLocaleString()}`);
  
  if (totalHosts !== processedCount) {
    console.error(`[AWX Fetch AUDIT FAILED] Mismatch between found hosts (${totalHosts}) and processed hosts (${processedCount}). This indicates a potential issue.`);
  } else {
    console.log(`[AWX Fetch AUDIT PASSED] All ${totalHosts} discovered hosts were processed.`);
  }
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
      let result;
      try {
        // First, try to fetch with the modified_at column
        result = await pool.query('SELECT hostname, data, modified_at FROM facts');
      } catch (err) {
        // Check if the error is because the column doesn't exist
        // PostgreSQL error code for "undefined column" is 42703
        if (err.code === '42703' && err.message.includes('"modified_at"')) {
          console.warn('Column "modified_at" not found in "facts" table. Fetching data without it.');
          // If it does not exist, fetch without it
          result = await pool.query('SELECT hostname, data FROM facts');
        } else {
          // For any other error, re-throw it to be handled by the main catch block
          throw err;
        }
      }
      
      const allHostFacts = {};
      for (const row of result.rows) {
          // The `row.modified_at` will exist or be undefined based on the successful query.
          // This check correctly handles both cases.
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

// --- New AI Search Endpoint ---
app.post('/api/ai-search', async (req, res) => {
    const { prompt, allFactPaths } = req.body;

    if (!ollamaConfig.url) {
        return res.status(500).json({ error: 'Ollama service is not configured on the backend.' });
    }
    if (!prompt || !allFactPaths) {
        return res.status(400).json({ error: 'Missing prompt or allFactPaths in request body.' });
    }

    const systemPrompt = `You are an AI assistant for Ansible Facts Explorer. Your task is to convert a user's natural language query into structured search filters.
The available fact paths are: ${JSON.stringify(allFactPaths)}.
The user's query is: "${prompt}".

Based on the query, generate a list of search filters. Each filter should follow one of these formats:
1. A simple string for a general search (e.g., "webserver").
2. A key-value pair with an operator (e.g., "ansible_distribution=Ubuntu", "ansible_processor_vcpus>4", "role!=database"). Use quotes for values with spaces (e.g., 'ansible_distribution="Rocky Linux"').
3. An exact match search by wrapping the value in double quotes (e.g., '"22.04"').

Only use fact paths from the provided list as keys in your filters. Prioritize creating precise key-value filters over general string searches.
Respond ONLY with a valid JSON array of strings representing the filters. For example: ["environment=production", "role=webserver", "ansible_distribution=\"Rocky Linux\""]`;

    try {
        console.log(`[AI Search] Sending prompt to Ollama model '${ollamaConfig.model}' at ${ollamaConfig.url}`);
        const ollamaResponse = await fetch(`${ollamaConfig.url}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: ollamaConfig.model,
                prompt: systemPrompt,
                stream: false, // Ensure we get a single JSON response
            }),
        });

        if (!ollamaResponse.ok) {
            const errorBody = await ollamaResponse.text();
            console.error(`[AI Search] Ollama API error: ${ollamaResponse.status} ${ollamaResponse.statusText}`, errorBody);
            throw new Error(`Ollama API returned an error: ${ollamaResponse.statusText}`);
        }

        const ollamaData = await ollamaResponse.json();
        const responseText = ollamaData.response;

        console.log('[AI Search] Raw response from Ollama:', responseText);

        // The model is instructed to return ONLY a JSON array, but let's be safe.
        // Find the start and end of the JSON array in the response string.
        const jsonStart = responseText.indexOf('[');
        const jsonEnd = responseText.lastIndexOf(']');

        if (jsonStart === -1 || jsonEnd === -1) {
            console.error('[AI Search] Could not find a JSON array in the Ollama response.');
            throw new Error('AI model did not return a valid filter format.');
        }

        const jsonString = responseText.substring(jsonStart, jsonEnd + 1);
        
        const filters = JSON.parse(jsonString);
        
        if (!Array.isArray(filters) || !filters.every(item => typeof item === 'string')) {
            throw new Error('AI model returned data that is not an array of strings.');
        }

        console.log('[AI Search] Parsed filters:', filters);
        res.json(filters);

    } catch (error) {
        console.error('[AI Search] Error processing AI search:', error.message);
        res.status(500).json({ error: error.message || 'Failed to process AI search request.' });
    }
});


// Start the server
if (sslConfig.keyPath && sslConfig.certPath) {
    try {
        const options = {
            key: fs.readFileSync(sslConfig.keyPath),
            cert: fs.readFileSync(sslConfig.certPath),
        };
        // Add CA bundle if provided
        if (sslConfig.caPath) {
            options.ca = fs.readFileSync(sslConfig.caPath);
        }
        https.createServer(options, app).listen(port, () => {
            console.log(`Backend server listening securely at https://localhost:${port}`);
        });
    } catch (err) {
        console.error("Error setting up HTTPS server. Please check your SSL configuration and file paths.", err);
        console.log("Falling back to HTTP.");
        app.listen(port, () => {
            console.log(`Backend server listening at http://localhost:${port}`);
        });
    }
} else {
    app.listen(port, () => {
        console.log(`Backend server listening at http://localhost:${port}`);
    });
}