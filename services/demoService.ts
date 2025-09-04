import { AllHostFacts } from '../types';
import demoData from '../dane.json';

export const demoService = {
  fetchFacts: async (): Promise<AllHostFacts> => {
    // Simulate a short network delay to make the loading state visible
    await new Promise(resolve => setTimeout(resolve, 300));
    try {
      // The fetch call has been replaced with a direct import of the JSON file.
      // This bundles the demo data with the application, making it more robust
      // and removing the need for a separate network request that could fail if
      // the file isn't copied to the correct location during the build process.
      return demoData as AllHostFacts;
    } catch(error) {
        console.error("Failed to process demo data from module:", error);
        throw new Error("Failed to load demo data from imported JSON file (dane.json).");
    }
  },
};
