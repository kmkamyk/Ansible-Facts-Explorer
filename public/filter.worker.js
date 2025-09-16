// public/filter.worker.js

// This function is a direct copy from FactBrowser.tsx
const matchSingleTerm = (fact, term) => {
    const trimmedTerm = term.trim();
    if (!trimmedTerm) return false;

    const operatorRegex = /^(.*?)\s*(!=|>=|<=|>|<|=)\s*(.*)$/;
    const match = trimmedTerm.match(operatorRegex);

    if (match) {
        let [, key, operator, value] = match.map(s => s ? s.trim() : '');
        if (key && value) {
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }
            const lowerKey = key.toLowerCase();
            const lowerValue = value.toLowerCase();

            if (lowerKey === 'host' || lowerKey === 'hostname') {
                const hostValue = fact.host.toLowerCase();
                switch (operator) {
                    case '=': return hostValue === lowerValue;
                    case '!=': return hostValue !== lowerValue;
                    default: return false;
                }
            }

            if (!fact.factPath.toLowerCase().endsWith(lowerKey)) {
                return false;
            }

            const factValue = fact.value;
            switch (operator) {
                case '=': return String(factValue).toLowerCase() === lowerValue;
                case '!=': return String(factValue).toLowerCase() !== lowerValue;
                case '>': case '<': case '>=': case '<=':
                    const numericFactValue = parseFloat(String(factValue));
                    const numericSearchValue = parseFloat(value);
                    if (isNaN(numericFactValue) || isNaN(numericSearchValue)) return false;
                    if (operator === '>') return numericFactValue > numericSearchValue;
                    if (operator === '<') return numericFactValue < numericSearchValue;
                    if (operator === '>=') return numericFactValue >= numericSearchValue;
                    if (operator === '<=') return numericFactValue <= numericSearchValue;
                    return false;
                default: return false;
            }
        }
    }

    if (trimmedTerm.startsWith('"') && trimmedTerm.endsWith('"')) {
        const exactTerm = trimmedTerm.substring(1, trimmedTerm.length - 1).toLowerCase();
        return (
            fact.host.toLowerCase() === exactTerm ||
            fact.factPath.toLowerCase() === exactTerm ||
            String(fact.value).toLowerCase() === exactTerm
        );
    }
    
    try {
        const regex = new RegExp(trimmedTerm, 'i');
        return (
            regex.test(fact.host) ||
            regex.test(fact.factPath) ||
            regex.test(String(fact.value)) ||
            (fact.modified ? regex.test(String(fact.modified)) : false)
        );
    } catch (e) {
        const lowercasedFilter = trimmedTerm.toLowerCase();
        return (
            fact.host.toLowerCase().includes(lowercasedFilter) ||
            fact.factPath.toLowerCase().includes(lowercasedFilter) ||
            String(fact.value).toLowerCase().includes(lowercasedFilter) ||
            (fact.modified ? String(fact.modified).toLowerCase().includes(lowercasedFilter) : false)
        );
    }
};

// This function is a direct copy from FactBrowser.tsx
const matchesPill = (fact, pill) => {
    const trimmedPill = pill.trim();
    if (!trimmedPill) return true;
    const orTerms = trimmedPill.split('|');
    return orTerms.some(term => matchSingleTerm(fact, term));
};

// Listen for messages from the main thread
self.onmessage = (event) => {
  const { allFacts, allFilters } = event.data;

  if (!allFacts || !allFilters) {
    // Post back an empty array if data is invalid
    self.postMessage([]);
    return;
  }
  
  // Perform the expensive filtering operation
  const filtered = allFacts.filter(fact => {
    return allFilters.every(filter => matchesPill(fact, filter));
  });

  // Send the result back to the main thread
  self.postMessage(filtered);
};
