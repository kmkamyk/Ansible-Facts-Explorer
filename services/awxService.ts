import { AllHostFacts, HostFactData } from '../types';

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface Host {
  id: number;
  name: string;
  ansible_facts_modified?: string;
  related: {
    ansible_facts: string;
  };
}

const getApiHeaders = (token: string) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
});

// This service now makes live fetch calls to the AWX API.
export const awxService = {
  fetchFacts: async (
    baseUrl: string,
    token: string,
    onProgress: (progress: { loaded: number; total: number }) => void
  ): Promise<AllHostFacts> => {
    const headers = getApiHeaders(token);
    const allHosts: Host[] = [];
    let currentUrl: string | null = new URL('/api/v2/hosts/?page_size=100', baseUrl).href;

    // 1. Fetch all hosts, handling pagination
    while (currentUrl) {
      const response = await fetch(currentUrl, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch hosts list: ${response.statusText} (${response.status})`);
      }
      const data: PaginatedResponse<Host> = await response.json();
      allHosts.push(...data.results);
      currentUrl = data.next ? new URL(data.next, baseUrl).href : null;
    }
    
    const totalHosts = allHosts.length;
    onProgress({ loaded: 0, total: totalHosts });
    let loadedHosts = 0;

    // 2. Fetch facts for each host with a concurrency limit
    const allHostFacts: AllHostFacts = {};
    const concurrencyLimit = 100; // Limit to 100 concurrent requests
    const queue = [...allHosts];
    const hostMap = new Map(allHosts.map(h => [h.name, h]));

    const processQueue = async () => {
      while (queue.length > 0) {
        const host = queue.shift();
        if (!host) continue;
        
        const hostWithMeta = hostMap.get(host.name);

        try {
          const factsUrl = new URL(host.related.ansible_facts, baseUrl).href;
          const factsResponse = await fetch(factsUrl, { headers });
          
          if (factsResponse.status === 404) {
            allHostFacts[host.name] = {};
          } else if (!factsResponse.ok) {
            console.error(`Failed to fetch facts for ${host.name}: ${factsResponse.statusText}`);
            allHostFacts[host.name] = { error: `Failed to fetch facts (${factsResponse.statusText})` };
          } else {
            const facts = await factsResponse.json();
            // Attach the modified timestamp to the facts object using a special key
            if (hostWithMeta?.ansible_facts_modified) {
                facts.__awx_facts_modified_timestamp = hostWithMeta.ansible_facts_modified;
            }
            allHostFacts[host.name] = facts;
          }
        } catch (error) {
          console.error(`Error processing facts for ${host.name}:`, error);
          allHostFacts[host.name] = { error: 'Network or parsing error while fetching facts.' };
        } finally {
            loadedHosts++;
            onProgress({ loaded: loadedHosts, total: totalHosts });
        }
      }
    };

    const workers = Array(concurrencyLimit).fill(null).map(() => processQueue());
    await Promise.all(workers);

    return allHostFacts;
  },

  /**
   * Pings the AWX API to verify the URL and token are valid.
   */
  testConnection: async (baseUrl: string, token: string): Promise<void> => {
    try {
      const pingUrl = new URL('/api/v2/ping/', baseUrl).href;
      const response = await fetch(pingUrl, { headers: getApiHeaders(token) });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please check your AWX Token.');
        }
        if (response.status === 404) {
          throw new Error('Connection failed. Please check your AWX URL.');
        }
        throw new Error(`Connection failed: ${response.statusText} (${response.status})`);
      }

      const data = await response.json();
      if (!data.instances || data.instances.length === 0) {
        throw new Error('Could not find any active AWX instance nodes.');
      }
    } catch (error) {
      if (error instanceof TypeError) { // Catches network errors like invalid URL format
          throw new Error('Invalid AWX URL format or network error.');
      }
      // Re-throw custom errors from above
      throw error;
    }
  },
};