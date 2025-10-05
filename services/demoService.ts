import { AllHostFacts } from '../types';

// Demo data is now embedded directly in the module to avoid JSON import issues
// in some environments, ensuring it's always bundled with the application.
const demoData: AllHostFacts = {
  "demo-web-1.example.com": {
    "__awx_facts_modified_timestamp": "2024-05-20T10:00:00Z",
    "ansible_system": "Linux",
    "ansible_distribution": "Rocky Linux",
    "ansible_distribution_version": "9.3",
    "ansible_processor_vcpus": 2,
    "ansible_memtotal_mb": 4096,
    "role": "webserver",
    "environment": "production",
    "packages": {
      "nginx": "1.24.0",
      "openssl": "3.0.7"
    }
  },
  "demo-db-1.example.com": {
    "__awx_facts_modified_timestamp": "2024-05-21T11:30:00Z",
    "ansible_system": "Linux",
    "ansible_distribution": "Ubuntu",
    "ansible_distribution_version": "22.04",
    "ansible_processor_vcpus": 4,
    "ansible_memtotal_mb": 16384,
    "role": "database",
    "environment": "production",
    "services": {
      "postgresql": {
        "version": "14.5",
        "status": "running"
      }
    }
  },
  "demo-dev-1.example.com": {
    "__awx_facts_modified_timestamp": "2024-05-19T09:45:00Z",
    "ansible_system": "Linux",
    "ansible_distribution": "Fedora",
    "ansible_distribution_version": "39",
    "ansible_processor_vcpus": 8,
    "ansible_memtotal_mb": 32768,
    "role": "development",
    "environment": "staging",
    "users": ["alice", "bob", "charlie"]
  }
};


export const demoService = {
  fetchFacts: async (): Promise<AllHostFacts> => {
    // Simulate a short network delay to make the loading state visible
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      // The data is now a constant within this module.
      if (demoData) {
        return demoData;
      } else {
        // This is a fallback in case the constant is somehow empty.
        console.error("Demo data is missing.");
        throw new Error("Could not load the demo data because it is not defined correctly.");
      }
    } catch (error) {
      console.error("Error loading demo data:", error);
      throw new Error("Could not load the demo data.");
    }
  },
};
