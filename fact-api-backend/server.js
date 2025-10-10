// server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const http = require('http');
const https = require('https');
const fs = require('fs');

const { dbConfig, awxConfig, sslConfig, ollamaConfig } = require('./config');

const app = express();
const PORT = 4000;

// Middleware
app.use(cors());
// Increase the body limit to handle potentially large fact context payloads for AI chat
app.use(express.json({ limit: '10mb' }));

// --- Database Helper ---
let pool;
function getDbClient() {
    if (!pool) {
        if (!dbConfig.host || !dbConfig.user || !dbConfig.database) {
            console.warn('Database is not configured. Skipping pool creation.');
            return null;
        }
        pool = new Pool(dbConfig);
        pool.on('error', (err, client) => {
            console.error('Unexpected error on idle PostgreSQL client', err);
            process.exit(-1);
        });
    }
    return pool;
}

// --- Generic Fetch Helper with Timeout ---
async function fetchWithTimeout(url, options = {}, timeout = awxConfig.requestTimeout) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeout / 1000} seconds`);
        }
        throw error;
    }
}


// --- AWX API Helpers ---
/**
 * Fetches paginated results from the AWX API.
 * @param {string} endpoint The API endpoint to fetch (e.g., '/api/v2/hosts/').
 * @returns {Promise<Array<any>>} A promise that resolves to an array of all results.
 */
async function fetchAwxApi(endpoint) {
    let results = [];
    let nextUrl = `${awxConfig.url}${endpoint}`;
    const headers = { 'Authorization': `Bearer ${awxConfig.token}` };

    while (nextUrl) {
        try {
            const response = await fetchWithTimeout(nextUrl, { headers });
            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`AWX API Error (${response.status}): ${errorBody}`);
                throw new Error(`AWX API request failed for ${nextUrl} with status ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            results = results.concat(data.results);
            nextUrl = data.next ? `${awxConfig.url}${data.next}` : null;
        } catch (error) {
            console.error(`Failed to fetch from AWX API endpoint ${nextUrl}:`, error);
            throw error; // Re-throw to be caught by the route handler
        }
    }
    return results;
}

// --- Ollama API Helper ---
async function callOllamaApi(systemPrompt, userMessages) {
    if (!ollamaConfig.url) {
        throw new Error('Ollama URL is not configured.');
    }

    const messages = [
        { role: 'system', content: systemPrompt },
        ...userMessages
    ];

    let body;
    let endpoint = ollamaConfig.url;

    if (ollamaConfig.apiFormat === 'openai') {
        // OpenAI-compatible endpoint (like llama-cpp-python)
        endpoint += '/v1/chat/completions';
        body = JSON.stringify({
            model: ollamaConfig.model,
            messages: messages,
            response_format: { type: 'json_object' }
        });
    } else {
        // Default to Ollama's native API
        endpoint += '/api/chat';
        const lastMessage = messages.pop(); // Ollama puts the last prompt in a separate field
        body = JSON.stringify({
            model: ollamaConfig.model,
            messages: messages,
            prompt: lastMessage ? lastMessage.content : '',
            format: 'json',
            stream: false
        });
    }
    
    try {
        const response = await fetchWithTimeout(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body,
        }, 60000); // 60-second timeout for AI responses

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Ollama API request failed with status ${response.status}: ${errorBody}`);
        }
        
        const data = await response.json();
        
        let content;
        if (ollamaConfig.apiFormat === 'openai') {
            content = data.choices?.[0]?.message?.content;
        } else {
            content = data.message?.content;
        }
        
        if (!content) {
            throw new Error('Received an empty or invalid response from the Ollama API.');
        }

        return content;
    } catch (error) {
        console.error('Error calling Ollama API:', error);
        throw error;
    }
}


// --- Context Building Helper for RAG ---
/**
 * Builds a smaller, relevant context object based on a list of fact paths.
 * @param {string[]} factPaths - An array of dot-notation fact paths (e.g., ['ansible_distribution', 'services.nginx.version']).
 * @param {object} allFacts - The complete facts object for all hosts.
 * @returns {object} A new facts object containing only the data for the specified paths.
 */
function buildRelevantContext(factPaths, allFacts) {
    const relevantContext = {};
    if (!factPaths || factPaths.length === 0) {
        return relevantContext;
    }

    for (const host in allFacts) {
        relevantContext[host] = {};
        const hostFacts = allFacts[host];

        for (const path of factPaths) {
            const keys = path.split('.');
            let currentAllFactsLevel = hostFacts;
            let currentRelevantContextLevel = relevantContext[host];
            let found = true;

            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (currentAllFactsLevel && typeof currentAllFactsLevel === 'object' && key in currentAllFactsLevel) {
                    currentAllFactsLevel = currentAllFactsLevel[key];
                    if (i === keys.length - 1) { // Last key in path
                        currentRelevantContextLevel[key] = currentAllFactsLevel;
                    } else {
                        if (!currentRelevantContextLevel[key]) {
                            currentRelevantContextLevel[key] = {};
                        }
                        currentRelevantContextLevel = currentRelevantContextLevel[key];
                    }
                } else {
                    found = false;
                    break;
                }
            }
        }
         // If a host had no matching facts, remove it from the context to keep it clean.
        if (Object.keys(relevantContext[host]).length === 0) {
            delete relevantContext[host];
        }
    }

    return relevantContext;
}

// --- API Endpoints ---

// GET /api/status
app.get('/api/status', (req, res) => {
    const awxConfigured = !!(awxConfig.url && awxConfig.token);
    const dbConfigured = !!(dbConfig.host && dbConfig.user && dbConfig.database);
    res.json({
        awx: { configured: awxConfigured },
        db: { configured: dbConfigured },
        ai: { enabled: ollamaConfig.useAiSearch }
    });
});

// GET /api/facts
app.get('/api/facts', async (req, res) => {
    const { source } = req.query;

    if (source === 'db') {
        try {
            const dbPool = getDbClient();
            if (!dbPool) {
                return res.status(500).json({ error: 'Database is not configured on the backend.' });
            }
            const result = await dbPool.query('SELECT hostname, data, modified_at FROM facts');
            const allHostFacts = result.rows.reduce((acc, row) => {
                acc[row.hostname] = {
                    ...row.data,
                    __awx_facts_modified_timestamp: row.modified_at,
                };
                return acc;
            }, {});
            res.json(allHostFacts);
        } catch (error) {
            console.error('Error fetching facts from database:', error);
            res.status(500).json({ error: 'Failed to fetch facts from database.' });
        }
    } else if (source === 'awx') {
        try {
            console.log("Fetching hosts from AWX...");
            const hosts = await fetchAwxApi('/api/v2/hosts/?page_size=100');
            console.log(`Found ${hosts.length} hosts. Fetching facts for each...`);

            // Use dynamic import for p-limit
            const { default: pLimit } = await import('p-limit');
            const limit = pLimit(awxConfig.concurrencyLimit);

            const factPromises = hosts.map(host => limit(async () => {
                const factsUrl = host.related.ansible_facts;
                if (!factsUrl) {
                    console.warn(`Host ${host.name} has no facts URL.`);
                    return [host.name, {}];
                }
                try {
                    const response = await fetchWithTimeout(`${awxConfig.url}${factsUrl}`, {
                        headers: { 'Authorization': `Bearer ${awxConfig.token}` }
                    });
                    if (!response.ok) {
                         // If facts are not found (404), treat it as empty facts, not an error.
                        if (response.status === 404) {
                            return [host.name, {}];
                        }
                        throw new Error(`Failed to fetch facts for ${host.name} with status ${response.status}`);
                    }
                    const factData = await response.json();
                    
                    // Fetch host modification time for consistency with DB source
                    const hostDetailsResponse = await fetchWithTimeout(`${awxConfig.url}${host.url}`, {
                        headers: { 'Authorization': `Bearer ${awxConfig.token}` }
                    });
                     if (!hostDetailsResponse.ok) {
                        throw new Error(`Failed to fetch host details for ${host.name}`);
                    }
                    const hostDetails = await hostDetailsResponse.json();

                    return [host.name, {
                        ...factData,
                        __awx_facts_modified_timestamp: hostDetails.modified,
                    }];
                } catch (factError) {
                    console.error(`Error fetching facts for host ${host.name}:`, factError.message);
                    return [host.name, {}]; // Return empty facts for this host on error
                }
            }));

            const allHostFactEntries = await Promise.all(factPromises);
            const allHostFacts = Object.fromEntries(allHostFactEntries);

            res.json(allHostFacts);

        } catch (error) {
            console.error('Error fetching facts from AWX:', error);
            res.status(500).json({ error: `Failed to fetch facts from AWX: ${error.message}` });
        }
    } else {
        res.status(400).json({ error: 'Invalid or missing "source" query parameter. Use "db" or "awx".' });
    }
});

// POST /api/ai-search
app.post('/api/ai-search', async (req, res) => {
    if (!ollamaConfig.useAiSearch) {
        return res.status(403).json({ error: 'AI search is disabled on the server.' });
    }
    const { prompt, allFactPaths } = req.body;
    if (!prompt || !allFactPaths || !Array.isArray(allFactPaths)) {
        return res.status(400).json({ error: 'Missing "prompt" or "allFactPaths" in request body.' });
    }

    try {
        const systemPrompt = ollamaConfig.systemPromptTemplate.replace(
            '${allFactPaths}',
            allFactPaths.join(', ')
        );
        const userPromptContent = ollamaConfig.userPromptTemplate.replace('${prompt}', prompt);

        const aiResponse = await callOllamaApi(systemPrompt, [{ role: 'user', content: userPromptContent }]);
        
        try {
            // The AI should return a JSON string, so we parse it.
            const filters = JSON.parse(aiResponse);
            if (!Array.isArray(filters) || !filters.every(item => typeof item === 'string')) {
                throw new Error('AI response is not a valid JSON array of strings.');
            }
            res.json(filters);
        } catch (parseError) {
            console.error('Failed to parse AI response as JSON:', parseError);
            console.error('Raw AI response:', aiResponse);
            res.status(500).json({ error: 'AI returned an invalid response format. Could not parse filters.' });
        }

    } catch (error) {
        console.error('Error during AI search:', error);
        res.status(500).json({ error: `AI search failed: ${error.message}` });
    }
});


// POST /api/ai-chat
app.post('/api/ai-chat', async (req, res) => {
    if (!ollamaConfig.useAiSearch) {
        return res.status(403).json({ error: 'AI chat is disabled on the server.' });
    }
    const { messages, factsContext, allFactPaths } = req.body;
    if (!messages || !Array.isArray(messages) || !factsContext || !allFactPaths) {
        return res.status(400).json({ error: 'Missing required fields for AI chat.' });
    }

    try {
        const lastUserMessage = messages[messages.length - 1]?.content;
        if (!lastUserMessage) {
            return res.status(400).json({ error: "Cannot process empty user message." });
        }
        
        // --- RAG Stage 1: Retrieval ---
        console.log("AI Chat - Stage 1: Retrieving relevant fact paths...");
        const retrievalSystemPrompt = ollamaConfig.retrievalSystemPromptTemplate.replace('${allFactPaths}', allFactPaths.join('\n'));
        const retrievalResponse = await callOllamaApi(retrievalSystemPrompt, [{ role: 'user', content: lastUserMessage }]);
        let relevantFactPaths = [];
        try {
            relevantFactPaths = JSON.parse(retrievalResponse);
             console.log("AI Chat - Retrieved paths:", relevantFactPaths);
        } catch (e) {
            console.warn("AI Chat - Could not parse retrieval response, defaulting to no specific paths. Raw response:", retrievalResponse);
        }
        
        // --- RAG Stage 2: Generation ---
        console.log("AI Chat - Stage 2: Building context and generating response...");
        let retrievedContext = buildRelevantContext(relevantFactPaths, factsContext);
        
        // **CRITICAL FALLBACK**: If RAG retrieval yields no context (e.g., bad paths or no matches),
        // default to using the full context to prevent the AI from getting an empty input.
        if (Object.keys(retrievedContext).length === 0) {
            console.warn("AI Chat - Retrieved context was empty. Falling back to the full facts context.");
            retrievedContext = factsContext;
        }

        const chatSystemPrompt = ollamaConfig.chatSystemPromptTemplate.replace(
            '${factsContext}',
            JSON.stringify(retrievedContext, null, 2)
        );

        // For the final generation, we send the full conversation history.
        // The last user message is already included in the `messages` array.
        const chatResponse = await callOllamaApi(chatSystemPrompt, messages.map(({role, content}) => ({role, content})));
        
        res.json({ response: chatResponse, retrievedContext: retrievedContext });

    } catch (error) {
        console.error('Error during AI chat:', error);
        res.status(500).json({ error: `AI chat failed: ${error.message}` });
    }
});


// --- Server Initialization ---
const startServer = () => {
    let server;
    if (sslConfig.keyPath && sslConfig.certPath) {
        try {
            const options = {
                key: fs.readFileSync(sslConfig.keyPath),
                cert: fs.readFileSync(sslConfig.certPath),
                ...(sslConfig.caPath && { ca: fs.readFileSync(sslConfig.caPath) }),
            };
            server = https.createServer(options, app);
            server.listen(PORT, () => {
                console.log(`Backend server listening at https://localhost:${PORT}`);
            });
        } catch (error) {
            console.error('Could not start HTTPS server. Check SSL certificate paths.');
            console.error(error);
            process.exit(1);
        }
    } else {
        console.warn("SSL certs not configured. Starting in HTTP mode.");
        server = http.createServer(app);
        server.listen(PORT, () => {
            console.log(`Backend server listening at http://localhost:${PORT}`);
        });
    }

    server.on('error', (error) => {
        console.error('Server failed to start:', error);
        process.exit(1);
    });
};

startServer();
