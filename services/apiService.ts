import { AllHostFacts } from '../types';

// The API base URL is now a relative path.
// This allows the frontend to make API calls to the same host it was served from,
// which is then handled by the Nginx reverse proxy.
// This avoids CORS issues and hardcoding URLs.
const API_BASE_URL = '/api';

interface ServiceStatus {
  awx: { configured: boolean };
  db: { configured: boolean };
  ai: { enabled: boolean };
}

export const apiService = {
  fetchFacts: async (source: 'awx' | 'db'): Promise<AllHostFacts> => {
    const apiUrl = `${API_BASE_URL}/facts?source=${source}`;
    
    console.log(`Fetching facts from backend for source: ${source}`);

    try {
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch data from API: ${response.statusText}`);
      }
      
      const data: AllHostFacts = await response.json();
      return data;

    } catch (error) {
      console.error(`Error fetching data for source "${source}" from backend API:`, error);
      if (error instanceof TypeError) { // Usually a network error
        throw new Error('Could not connect to the backend API. Is the server running?');
      }
      throw error; // Re-throw other errors (like the custom one from the response)
    }
  },

  fetchStatus: async (): Promise<ServiceStatus> => {
    const statusUrl = `${API_BASE_URL}/status`;
    console.log('Fetching service status from backend...');
    try {
      const response = await fetch(statusUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch status from API: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching service status:', error);
      if (error instanceof TypeError) {
        throw new Error('Could not connect to the backend API to check status. Is the server running?');
      }
      throw error;
    }
  },

  performAiSearch: async (prompt: string, allFactPaths: string[]): Promise<string[]> => {
    const aiUrl = `${API_BASE_URL}/ai-search`;
    console.log('Performing AI search with prompt:', prompt);
    try {
        const response = await fetch(aiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt, allFactPaths }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `AI search failed: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error during AI search API call:', error);
        if (error instanceof TypeError) {
            throw new Error('Could not connect to the backend for AI search.');
        }
        throw error;
    }
  }
};
