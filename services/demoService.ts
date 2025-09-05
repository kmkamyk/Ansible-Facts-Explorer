import { AllHostFacts } from '../types';
import demoData from '/dane.json';

export const demoService = {
  fetchFacts: async (): Promise<AllHostFacts> => {
    // Simulate a short network delay to make the loading state visible
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Data is now loaded via a static import at build time,
    // which is more reliable than fetching at runtime.
    return demoData as AllHostFacts;
  },
};