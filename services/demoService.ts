import { AllHostFacts } from '../types';

export const demoService = {
  fetchFacts: async (): Promise<AllHostFacts> => {
    // Simulate a short network delay to make the loading state visible
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      // Fetch the JSON file as a static asset.
      // This works universally in dev, preview, and production builds.
      const response = await fetch('/dane.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch demo data: ${response.statusText}`);
      }
      const data = await response.json();
      return data as AllHostFacts;
    } catch (error) {
      console.error("Error fetching demo data:", error);
      // Return an empty object or re-throw to show an error message in the UI
      throw new Error("Could not load the demo data file.");
    }
  },
};