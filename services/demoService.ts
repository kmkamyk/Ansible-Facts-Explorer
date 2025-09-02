import { AllHostFacts } from '../types';

export const demoService = {
  fetchFacts: async (): Promise<AllHostFacts> => {
    // Simulate a short network delay to make the loading state visible
    await new Promise(resolve => setTimeout(resolve, 300));
    try {
      const response = await fetch('/dane.json');
      if (!response.ok) {
        throw new Error(`Could not load demo data: ${response.statusText}`);
      }
      const data = await response.json();
      return data as AllHostFacts;
    } catch(error) {
        console.error("Failed to fetch demo data:", error);
        throw new Error("Failed to load demo data file (dane.json).");
    }
  },
};
