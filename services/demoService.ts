import { AllHostFacts } from '../types';
import demoData from '../dane.json';

export const demoService = {
  fetchFacts: async (): Promise<AllHostFacts> => {
    // Simulate a short network delay to make the loading state visible
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      // By importing the JSON directly, we ensure it's included in the build
      // and available without a separate network request in production.
      if (demoData) {
        return demoData as AllHostFacts;
      } else {
        // This is a fallback in case the import somehow fails, which is unlikely.
        console.error("Demo data could not be imported.");
        throw new Error("Could not load the demo data file because it was not bundled correctly.");
      }
    } catch (error) {
      console.error("Error loading demo data:", error);
      throw new Error("Could not load the demo data file.");
    }
  },
};
