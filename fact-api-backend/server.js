// server.js

const express = require('express');
const https = require('https');
const fs = require('fs');
const { Pool } = require('pg');
const cors = require('cors');
const { dbConfig, awxConfig, sslConfig, ollamaConfig } = require('./config');

const app = express();
const port = 4000;

// Initialize the PostgreSQL connection pool
const pool = new Pool(dbConfig);

// Allow requests from your frontend application
app.use(cors());
// Increase the body size limit to handle large fact path lists for AI search
app.use(express.json({ limit: '16mb' }));


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
        },
        ai: {
            enabled: ollamaConfig.useAiSearch && !!ollamaConfig.url,
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


/**
 * A robust parser for handling potentially malformed JSON responses from an LLM.
 * It handles markdown code fences and extracts the first valid JSON object or array.
 * @param {string} rawContent - The raw string response from the AI model.
 * @returns {object | null} The parsed JSON object, or null if parsing fails.
 */
const parseAiJsonResponse = (rawContent) => {
    if (!rawContent || typeof rawContent !== 'string') {
        console.warn('[AI Parse] AI content is empty or not a string.');
        return null;
    }

    let content = rawContent.trim();
    
    // 1. Handle Markdown Fences (most common issue)
    const markdownMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        console.log('[AI Parse] Extracted content from Markdown code fence.');
        content = markdownMatch[1].trim();
    }

    // 2. Try direct parsing first
    try {
        return JSON.parse(content);
    } catch (e) {
        console.warn('[AI Parse] Direct JSON.parse failed. Attempting fallback extraction.');
    }

    // 3. Fallback: find the first occurrence of a JSON object or array
    const jsonRegex = /({[\s\S]*}|\[[\s\S]*\])/;
    const match = content.match(jsonRegex);
    if (match && match[0]) {
        try {
            const parsed = JSON.parse(match[0]);
            console.log('[AI Parse] Successfully extracted and parsed JSON with fallback regex.');
            return parsed;
        } catch (e) {
            console.error('[AI Parse] Fallback JSON parsing also failed after extraction.', e.message);
            return null;
        }
    }
    
    console.error('[AI Parse] All parsing attempts failed.');
    return null;
};


// --- AI Search Endpoint ---
app.post('/api/ai-search', async (req, res) => {
    if (!ollamaConfig.useAiSearch) {
        return res.status(403).json({ error: 'AI search feature is disabled by the administrator.' });
    }
    if (!ollamaConfig.url || !ollamaConfig.systemPromptTemplate) {
        return res.status(500).json({ error: 'AI service or prompt is not configured on the backend.' });
    }

    const { prompt, allFactPaths } = req.body;
    if (!prompt || !allFactPaths || !Array.isArray(allFactPaths)) {
        return res.status(400).json({ error: 'Missing or invalid "prompt" or "allFactPaths" in request body.' });
    }

    // =========================================================================
    // ** Scalability Enhancement for AI Search **
    // Instead of sending all fact paths, pre-filter them based on keywords
    // from the user's prompt. This keeps the context sent to the LLM small
    // and relevant, preventing token limit errors and improving performance.
    // =========================================================================
    let relevantFactPaths = allFactPaths;
    const MAX_FACT_PATHS_FOR_AI = 200; // Safety limit

    if (allFactPaths.length > MAX_FACT_PATHS_FOR_AI) {
        console.log(`[AI Search] Pre-filtering ${allFactPaths.length} fact paths...`);
        
        const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'with', 'for', 'of', 'in', 'on', 'at', 'all', 'show', 'me', 'find', 'get', 'list']);
        const keywords = new Set(
            prompt.toLowerCase()
                  .replace(/[^\w\s]/g, '')
                  .split(/\s+/)
                  .filter(word => word && !stopWords.has(word))
        );

        if (keywords.size > 0) {
            console.log(`[AI Search] Using keywords: ${Array.from(keywords).join(', ')}`);
            const matchedPaths = new Set();
            for (const path of allFactPaths) {
                const lowerPath = path.toLowerCase();
                for (const keyword of keywords) {
                    if (lowerPath.includes(keyword)) {
                        matchedPaths.add(path);
                        break; 
                    }
                }
            }
            
            if (matchedPaths.size > 0) {
                relevantFactPaths = Array.from(matchedPaths);
            }
        }
        
        if (relevantFactPaths.length > MAX_FACT_PATHS_FOR_AI) {
            relevantFactPaths = relevantFactPaths.slice(0, MAX_FACT_PATHS_FOR_AI);
        }

        console.log(`[AI Search] Sending ${relevantFactPaths.length} relevant fact paths to AI model.`);
    }


    const systemPrompt = ollamaConfig.systemPromptTemplate
        .replace('${allFactPaths}', relevantFactPaths.join(', '));
    
    const userPrompt = (ollamaConfig.userPromptTemplate || 'User Query: "${prompt}"\n\nYour JSON Response:')
        .replace('${prompt}', prompt);

    try {
        let aiContent;

        if (ollamaConfig.apiFormat === 'openai') {
            console.log(`[AI Search] Sending prompt to OpenAI-compatible model '${ollamaConfig.model}' at ${ollamaConfig.url}`);
            const response = await fetch(`${ollamaConfig.url}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: ollamaConfig.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    stream: false,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[AI Search] OpenAI-compatible API responded with error ${response.status}: ${errorText}`);
                throw new Error(`AI API error: ${response.statusText}`);
            }
            const data = await response.json();
            aiContent = data.choices[0]?.message?.content;

        } else {
            const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
            console.log(`[AI Search] Sending prompt to Ollama model '${ollamaConfig.model}' at ${ollamaConfig.url}`);
            const response = await fetch(`${ollamaConfig.url}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: ollamaConfig.model,
                    prompt: combinedPrompt,
                    stream: false,
                    format: 'json',
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[AI Search] Ollama API responded with error ${response.status}: ${errorText}`);
                throw new Error(`Ollama API error: ${response.statusText}`);
            }

            const data = await response.json();
            aiContent = data.response;
        }
      
        console.log('[AI Search] Raw content from model:', aiContent);
        
        const parsedContent = parseAiJsonResponse(aiContent);

        if (!parsedContent) {
            console.error(`[AI Search] Could not parse the following response from the AI model: \n---\n${aiContent}\n---`);
            throw new Error('AI returned a response that could not be understood. Please try rephrasing your query.');
        }

        if (Array.isArray(parsedContent)) {
            console.log('[AI Search] Successfully generated pills:', parsedContent);
            res.json(parsedContent);
        } else if (typeof parsedContent === 'object' && parsedContent !== null) {
            console.warn('[AI Search] Parsed content is an object, not an array. Converting to filter pills.');
            const convertedPills = Object.entries(parsedContent).map(([key, value]) => {
                if (value === null || value === '' || value === true) return key;
                return `${key}=${value}`;
            });
            console.log('[AI Search] Successfully converted object to pills:', convertedPills);
            res.json(convertedPills);
        } else {
            console.error('[AI Search] Parsed content is valid JSON but not an array or a convertible object:', parsedContent);
            throw new Error('AI did not return a valid JSON array or object.');
        }

    } catch (err) {
        console.error(`[AI Search] Error during AI request:`, err);
        res.status(500).json({ error: err.message || 'Failed to generate search pills from AI.' });
    }
});

// --- AI Chat Endpoint ---
app.post('/api/ai-chat', async (req, res) => {
    if (!ollamaConfig.useAiSearch) {
        return res.status(403).json({ error: 'AI features are disabled by the administrator.' });
    }
    if (!ollamaConfig.url || !ollamaConfig.chatSystemPromptTemplate) {
        return res.status(500).json({ error: 'AI chat service or prompt is not configured on the backend.' });
    }

    const { messages, factsContext } = req.body;
    if (!messages || !Array.isArray(messages) || !factsContext) {
        return res.status(400).json({ error: 'Missing or invalid "messages" or "factsContext" in request body.' });
    }

    const MAX_CONTEXT_CHARS = 1024 * 1024; // Increased limit to 1MB
    let factsString = JSON.stringify(factsContext, null, 2);
    let wasContextFiltered = false;

    // --- Dynamic Context Filtering for Large Datasets ---
    if (factsString.length > MAX_CONTEXT_CHARS) {
        console.warn(`[AI Chat] Facts context is too large (${(factsString.length / 1024 / 1024).toFixed(2)} MB). Attempting to filter based on conversation...`);
        wasContextFiltered = true;

        const userMessages = messages.filter(m => m.role === 'user').slice(-3).map(m => m.content);
        if (userMessages.length > 0) {
            const query = userMessages.join(' ');
            const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'with', 'for', 'of', 'in', 'on', 'at', 'all', 'show', 'me', 'find', 'get', 'list', 'what', 'who', 'about', 'how', 'many', 'tell', 'can', 'you']);
            const keywords = new Set(
                query.toLowerCase()
                     .replace(/[^\w\s.-]/g, '') // Keep dots and dashes for hostnames/paths
                     .split(/\s+/)
                     .filter(word => word && !stopWords.has(word))
            );

            if (keywords.size > 0) {
                console.log(`[AI Chat] Filtering context with keywords: ${Array.from(keywords).join(', ')}`);
                const filteredFacts = {};
                
                // Filter hosts: include a host if its name or any of its facts match the keywords
                for (const host in factsContext) {
                    let hostMatches = false;
                    const lowerHost = host.toLowerCase();

                    // Check hostname first
                    for (const keyword of keywords) {
                        if (lowerHost.includes(keyword)) {
                            hostMatches = true;
                            break;
                        }
                    }
                    if (hostMatches) {
                        filteredFacts[host] = factsContext[host];
                        continue;
                    }

                    // If hostname doesn't match, check the stringified facts for that host
                    const hostDataString = JSON.stringify(factsContext[host]).toLowerCase();
                    for (const keyword of keywords) {
                        if (hostDataString.includes(keyword)) {
                            hostMatches = true;
                            break;
                        }
                    }
                    if (hostMatches) {
                        filteredFacts[host] = factsContext[host];
                    }
                }

                factsString = JSON.stringify(filteredFacts, null, 2);
                console.log(`[AI Chat] Context size after filtering: ${(factsString.length / 1024).toFixed(2)} KB.`);
            }
        }
    }
    
    // Final check and truncation if filtering was insufficient or not possible
    if (factsString.length > MAX_CONTEXT_CHARS) {
        console.warn(`[AI Chat] Context still too large after filtering (or no keywords found). Truncating to ${MAX_CONTEXT_CHARS} characters.`);
        factsString = factsString.substring(0, MAX_CONTEXT_CHARS);
        // Ensure the truncated string is valid JSON by finding the last complete object.
        const lastBrace = factsString.lastIndexOf('},');
        if (lastBrace > 0) {
            factsString = factsString.substring(0, lastBrace + 1) + '\n  "__TRUNCATED__": "The data was too large and has been shortened."\n}';
        }
        wasContextFiltered = true;
    }


    const systemPromptTemplate = ollamaConfig.chatSystemPromptTemplate;
    let systemPrompt = systemPromptTemplate.replace('${factsContext}', factsString);

    if (wasContextFiltered) {
        systemPrompt += "\n\n**IMPORTANT NOTE:** The provided JSON data is a *filtered or truncated subset* of the full dataset, selected because the original dataset was too large for this conversation. Answer based only on this subset, and if you can't find something, it might be because it was filtered out.";
    }


    // Construct the message history for the API call
    const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.filter(m => m.role !== 'error').map(({ role, content }) => ({ role, content }))
    ];
    
    try {
        let aiContent;
        let endpointUrl, body;

        if (ollamaConfig.apiFormat === 'openai') {
            console.log(`[AI Chat] Sending prompt to OpenAI-compatible model '${ollamaConfig.model}'`);
            endpointUrl = `${ollamaConfig.url}/v1/chat/completions`;
            body = JSON.stringify({
                model: ollamaConfig.model,
                messages: apiMessages,
                stream: false,
            });
        } else { // 'ollama' format, using the modern /api/chat endpoint
            console.log(`[AI Chat] Sending prompt to Ollama model '${ollamaConfig.model}' via chat endpoint`);
            endpointUrl = `${ollamaConfig.url}/api/chat`;
            body = JSON.stringify({
                model: ollamaConfig.model,
                messages: apiMessages,
                stream: false,
            });
        }
      
        const response = await fetch(endpointUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI Chat] API responded with error ${response.status}: ${errorText}`);
            throw new Error(`AI API error: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Response structure varies between OpenAI and Ollama chat
        if (ollamaConfig.apiFormat === 'openai') {
            aiContent = data.choices[0]?.message?.content;
        } else {
            aiContent = data.message?.content;
        }

        if (!aiContent) {
            console.error('[AI Chat] Could not extract AI content from response:', data);
            throw new Error('AI returned a response in an unexpected format.');
        }

        console.log('[AI Chat] Raw response from model:', aiContent);
        res.json({ response: aiContent.trim() });

    } catch (err) {
        console.error(`[AI Chat] Error during AI request:`, err);
        res.status(500).json({ error: err.message || 'Failed to get a response from the AI model.' });
    }
});


// Start the server
if (sslConfig.keyPath && sslConfig.certPath) {
    try {
        const options = {
            key: fs.readFileSync(sslConfig.keyPath),
            cert: fs.readFileSync(sslConfig.certPath),
        };
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