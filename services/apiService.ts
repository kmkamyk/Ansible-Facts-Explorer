
import { AllHostFacts } from '../types';

const API_BASE_URL = 'http://localhost:4000/api';

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
};
