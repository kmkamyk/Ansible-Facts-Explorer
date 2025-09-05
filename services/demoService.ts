import { AllHostFacts } from '../types';

export const demoService = {
  fetchFacts: async (): Promise<AllHostFacts> => {
    // Simulate a short network delay to make the loading state visible
    await new Promise(resolve => setTimeout(resolve, 300));
    try {
      // Fetch the demo data from the public root.
      // This is more compatible with browsers' native ES module support
      // than directly importing JSON, which can cause type errors.
      const response = await fetch('/dane.json');
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
      }
      const data = await response.json();
      return data as AllHostFacts;
    } catch (error) {
      console.error("Failed to fetch demo data:", error);
      throw new Error("Could not load demo data. Make sure dane.json is accessible at the root of the server.");
    }
  },
};
