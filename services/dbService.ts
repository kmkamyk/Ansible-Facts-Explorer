import { AllHostFacts, DbConfig } from '../types';

// This service now makes a real API call to a backend service that connects to the database.
export const dbService = {
  fetchFacts: async (config: DbConfig): Promise<AllHostFacts> => {
    // Adres URL Twojego nowego serwera backendowego
    const apiUrl = 'http://localhost:4000/api/facts';
    
    console.log(`Fetching facts from real backend API: ${apiUrl} with config:`, config);

    try {
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch data from API: ${response.statusText}`);
      }
      
      const data: AllHostFacts = await response.json();
      return data;

    } catch (error) {
      console.error("Error fetching data from backend API:", error);
      // Rzuć błąd dalej, aby komponent UI mógł go obsłużyć
      // Dodaj bardziej pomocną wiadomość, jeśli backend nie działa
      if (error instanceof TypeError) { // Zwykle błąd sieci
        throw new Error('Could not connect to the backend API. Is the server running?');
      }
      throw error;
    }
  },
};