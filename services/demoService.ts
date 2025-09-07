import { AllHostFacts } from '../types';
import demoData from '../dane.json';

export const demoService = {
  fetchFacts: async (): Promise<AllHostFacts> => {
    // Simulate a short network delay to make the loading state visible
    await new Promise(resolve => setTimeout(resolve, 300));

    // The demo data is now imported directly as a JSON module.
    return demoData as AllHostFacts;
  },
};
