import { AllHostFacts } from '../types';

export const demoService = {
  fetchFacts: async (): Promise<AllHostFacts> => {
    // Simulate a short network delay to make the loading state visible
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Fetch the JSON data from the server instead of using a static import,
    // which is more compatible with native browser ES modules and avoids type errors.
    const response = await fetch('/dane.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch demo data: ${response.status} ${response.statusText}`);
    }
    const demoData: AllHostFacts = await response.json();
    return demoData;
  },
};
