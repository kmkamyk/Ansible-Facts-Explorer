import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { apiService } from '../services/apiService';
import { demoService } from '../services/demoService';
import { AllHostFacts, FactRow, Density, SortConfig, SortDirection, SortableKey } from '../types';
import SearchBar from './SearchBar';
import FactTable from './FactTable';
import PivotedFactTable from './PivotedFactTable';
import Button from './Button';
import Spinner from './Spinner';
import DensitySwitcher from './DensitySwitcher';
import ThemeSwitcher from './ThemeSwitcher';
import ViewSwitcher, { ViewMode } from './ViewSwitcher';
import FactFilter from './FactFilter';
import { DENSITY_THEME } from '../styles/densityTheme';
import { DownloadIcon, PlayIcon, ExcelIcon, ClockIcon, FilterIcon, ExpandIcon, CompressIcon, ChevronDownIcon } from './icons/Icons';

type Theme = 'light' | 'dark';

interface ServiceStatus {
  awx: { configured: boolean };
  db: { configured: boolean };
}

interface FactBrowserProps {}

const flattenFactsForTable = (allHostFacts: AllHostFacts): FactRow[] => {
    const rows: FactRow[] = [];

    const flatten = (obj: any, path: string[] = []): [string, any][] => {
        return Object.entries(obj)
            .filter(([key]) => key !== '__awx_facts_modified_timestamp') // Exclude special key
            .flatMap(([key, value]) => {
                const newPath = [...path, key];
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    return flatten(value, newPath);
                }
                const displayValue = (value && typeof value === 'object') ? JSON.stringify(value) : value;
                return [[newPath.join('.'), displayValue]];
            });
    };

    for (const host in allHostFacts) {
        if (Object.prototype.hasOwnProperty.call(allHostFacts, host)) {
            const hostFacts = allHostFacts[host];
            const modifiedTimestamp = hostFacts.__awx_facts_modified_timestamp;
            const flattened = flatten(hostFacts);

            if (flattened.length === 0) {
                rows.push({
                    id: `${host}-no-facts`,
                    host,
                    factPath: '---',
                    value: '(No data available)',
                    modified: modifiedTimestamp,
                });
            } else {
                flattened.forEach(([factPath, value]) => {
                    rows.push({
                        id: `${host}-${factPath}`,
                        host,
                        factPath,
                        value,
                        modified: modifiedTimestamp,
                    });
                });
            }
        }
    }
    return rows;
};

const pivotFactsForExport = (facts: FactRow[]): { data: Record<string, any>[]; headers: string[] } => {
    if (facts.length === 0) {
        return { data: [], headers: [] };
    }

    const hostsData: { [hostname: string]: { [factPath: string]: any } } = {};
    const allFactPaths = new Set<string>();

    facts.forEach(fact => {
        if (fact.factPath !== '---') { 
            if (!hostsData[fact.host]) {
                hostsData[fact.host] = { hostname: fact.host };
            }
            hostsData[fact.host][fact.factPath] = fact.value;
            allFactPaths.add(fact.factPath);
        }
    });

    const sortedFactPaths = Array.from(allFactPaths).sort();
    const dataForExport = Object.values(hostsData);
    
    return { data: dataForExport, headers: ['hostname', ...sortedFactPaths] };
};


const FactBrowser: React.FC<FactBrowserProps> = () => {
  const [allFacts, setAllFacts] = useState<FactRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegexValid, setIsRegexValid] = useState(true);
  const [showModifiedColumn, setShowModifiedColumn] = useState(false);
  
  const [dataSource, setDataSource] = useState<'awx' | 'db' | 'demo'>('demo');
  const [loadedDataSource, setLoadedDataSource] = useState<'awx' | 'db' | 'demo' | null>(null);
  const [factsLoaded, setFactsLoaded] = useState(false);
  const [density, setDensity] = useState<Density>('comfortable');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [theme, setTheme] = useState<Theme>(
    localStorage.getItem('theme') as Theme || 'light'
  );
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'host', direction: 'ascending' });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  // State for backend service availability
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({ awx: { configured: true }, db: { configured: true }});
  const [isStatusLoading, setIsStatusLoading] = useState(true);

  // State for fact filtering
  const [isFactFilterVisible, setIsFactFilterVisible] = useState(false);
  const [allFactPaths, setAllFactPaths] = useState<string[]>([]);
  const [visibleFactPaths, setVisibleFactPaths] = useState<Set<string>>(new Set());

  // Fetch service status on initial load
  useEffect(() => {
    const checkServiceStatus = async () => {
      try {
        const status = await apiService.fetchStatus();
        setServiceStatus(status);
        // If current source is now unavailable, fallback to demo
        if ((dataSource === 'awx' && !status.awx.configured) || (dataSource === 'db' && !status.db.configured)) {
          setDataSource('demo');
        }
      } catch (e: any) {
        console.error("Failed to fetch service status:", e.message);
        // Assume services are unavailable on error
        setServiceStatus({ awx: { configured: false }, db: { configured: false }});
        setDataSource('demo');
      } finally {
        setIsStatusLoading(false);
      }
    };
    checkServiceStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  useEffect(() => {
    if (viewMode === 'list') {
      setSortConfig({ key: 'host', direction: 'ascending' });
    } else {
      setSortConfig({ key: 'hostname', direction: 'ascending' });
    }
    setScrollProgress(0);
  }, [viewMode]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const handleLoadFacts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setAllFacts([]);
    setFactsLoaded(true);
    setIsFactFilterVisible(false);
    setScrollProgress(0);

    try {
        let data: AllHostFacts;
        const sourceToLoad = dataSource;
        if (sourceToLoad === 'awx') {
            data = await apiService.fetchFacts('awx');
        } else if (sourceToLoad === 'db') {
            data = await apiService.fetchFacts('db');
        } else {
            data = await demoService.fetchFacts();
        }
        const flattenedData = flattenFactsForTable(data);
        setAllFacts(flattenedData);

        const uniqueFactPaths = Array.from(new Set(flattenedData.map(f => f.factPath).filter(p => p !== '---'))).sort();
        setAllFactPaths(uniqueFactPaths);
        setVisibleFactPaths(new Set(uniqueFactPaths));

        setLoadedDataSource(sourceToLoad);
    } catch (e: any) {
        setError(e.message || 'Failed to fetch data.');
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  }, [dataSource]);

  const searchedFacts = useMemo(() => {
    const trimmedSearchTerm = searchTerm.trim();
    if (!trimmedSearchTerm) {
      return allFacts;
    }

    const operatorRegex = /^(.*?)\s*(!=|>=|<=|>|<|=)\s*(.*)$/;
    const match = trimmedSearchTerm.match(operatorRegex);

    if (match) {
        const [, key, operator, value] = match.map(s => s ? s.trim() : '');
        if (key && value) {
            const lowerKey = key.toLowerCase();
            const lowerValue = value.toLowerCase();
            
            return allFacts.filter(fact => {
                if (!fact.factPath.toLowerCase().endsWith(lowerKey)) {
                    return false;
                }

                const factValue = fact.value;

                switch (operator) {
                    case '=':
                        return String(factValue).toLowerCase() === lowerValue;
                    case '!=':
                        return String(factValue).toLowerCase() !== lowerValue;
                    case '>':
                    case '<':
                    case '>=':
                    case '<=':
                        const numericFactValue = parseFloat(String(factValue));
                        const numericSearchValue = parseFloat(value);
                        if (isNaN(numericFactValue) || isNaN(numericSearchValue)) {
                            return false;
                        }
                        if (operator === '>') return numericFactValue > numericSearchValue;
                        if (operator === '<') return numericFactValue < numericSearchValue;
                        if (operator === '>=') return numericFactValue >= numericSearchValue;
                        if (operator === '<=') return numericFactValue <= numericSearchValue;
                        return false;
                    default:
                        return false;
                }
            });
        }
        return allFacts;
    } else if (trimmedSearchTerm.startsWith('"') && trimmedSearchTerm.endsWith('"') && trimmedSearchTerm.length > 1) {
        const exactTerm = trimmedSearchTerm.substring(1, trimmedSearchTerm.length - 1);
        const lowercasedExactTerm = exactTerm.toLowerCase();
        return allFacts.filter(fact =>
            fact.host.toLowerCase() === lowercasedExactTerm ||
            fact.factPath.toLowerCase() === lowercasedExactTerm ||
            String(fact.value).toLowerCase() === lowercasedExactTerm ||
            String(fact.modified).toLowerCase() === lowercasedExactTerm
        );
    } else {
        let isCurrentlyValidRegex = true;
        try {
            new RegExp(trimmedSearchTerm);
        } catch (e) {
            isCurrentlyValidRegex = false;
        }

        if (isCurrentlyValidRegex) {
            try {
                const regex = new RegExp(trimmedSearchTerm, 'i');
                return allFacts.filter(fact =>
                    regex.test(fact.host) ||
                    regex.test(fact.factPath) ||
                    regex.test(String(fact.value)) ||
                    regex.test(String(fact.modified))
                );
            } catch (e) {
                return allFacts; // Fallback
            }
        } else {
            const lowercasedFilter = trimmedSearchTerm.toLowerCase();
            return allFacts.filter(fact =>
                fact.host.toLowerCase().includes(lowercasedFilter) ||
                fact.factPath.toLowerCase().includes(lowercasedFilter) ||
                String(fact.value).toLowerCase().includes(lowercasedFilter) ||
                String(fact.modified).toLowerCase().includes(lowercasedFilter)
            );
        }
    }
  }, [allFacts, searchTerm]);

  const filteredFacts = useMemo(() => {
    // If all facts are visible, no need to filter further
    if (allFactPaths.length > 0 && visibleFactPaths.size === allFactPaths.length) {
      return searchedFacts;
    }
    // Filter based on the visibleFactPaths set
    return searchedFacts.filter(fact => 
      visibleFactPaths.has(fact.factPath) || fact.factPath === '---'
    );
  }, [searchedFacts, visibleFactPaths, allFactPaths]);

  const pivotViewFilteredFacts = useMemo(() => {
    const trimmedSearchTerm = searchTerm.trim();
    // If not in pivot mode or no search is active, the data is the same as the list view's filtered facts.
    if (viewMode !== 'pivot' || !trimmedSearchTerm) {
        return filteredFacts;
    }

    // When in pivot view with a search term:
    // 1. Get the unique hostnames from the initial search results.
    const matchingHostnames = new Set(searchedFacts.map(fact => fact.host));

    // 2. Filter the original `allFacts` to get all facts for those matching hosts.
    const allFactsForMatchingHosts = allFacts.filter(fact => matchingHostnames.has(fact.host));
    
    // 3. Apply the column visibility filter (`visibleFactPaths`) to this complete set of facts.
    if (allFactPaths.length > 0 && visibleFactPaths.size === allFactPaths.length) {
        return allFactsForMatchingHosts;
    }
    return allFactsForMatchingHosts.filter(fact => 
        visibleFactPaths.has(fact.factPath) || fact.factPath === '---'
    );
  }, [viewMode, searchTerm, searchedFacts, allFacts, filteredFacts, visibleFactPaths, allFactPaths]);
  
  const handleRequestSort = (key: SortableKey) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedListFacts = useMemo(() => {
    if (viewMode !== 'list') return [];
    if (!sortConfig) return filteredFacts;

    const sortableItems = [...filteredFacts];
    sortableItems.sort((a, b) => {
      const valA = a[sortConfig.key as keyof FactRow];
      const valB = b[sortConfig.key as keyof FactRow];
      
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      
      let comparison = 0;

      if (sortConfig.key === 'modified') {
        const dateA = new Date(valA as string).getTime();
        const dateB = new Date(valB as string).getTime();
        comparison = (dateA || 0) - (dateB || 0);
      } else {
        comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
      }

      return sortConfig.direction === 'ascending' ? comparison : -comparison;
    });
    return sortableItems;
  }, [filteredFacts, sortConfig, viewMode]);

  const pivotedData = useMemo(() => {
    return pivotFactsForExport(pivotViewFilteredFacts);
  }, [pivotViewFilteredFacts]);

  const sortedPivotedData = useMemo(() => {
    if (viewMode !== 'pivot' || !sortConfig) return pivotedData;

    const sortedData = [...pivotedData.data].sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        
        if (valA == null && valB == null) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;
        
        const comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });

        return sortConfig.direction === 'ascending' ? comparison : -comparison;
    });

    return { ...pivotedData, data: sortedData };
  }, [pivotedData, sortConfig, viewMode]);

  const dataForExport = useMemo(() => {
    if (viewMode === 'list') {
      return pivotFactsForExport(sortedListFacts);
    }
    return sortedPivotedData;
  }, [viewMode, sortedListFacts, sortedPivotedData]);

  useEffect(() => {
    const isSpecialQuery = searchTerm.trim().match(/^(.*?)\s*(!=|>=|<=|>|<|=)\s*(.*)$/) || (searchTerm.startsWith('"') && searchTerm.endsWith('"'));
    if (!searchTerm || isSpecialQuery) {
      setIsRegexValid(true);
      return;
    }
    try {
      new RegExp(searchTerm);
      setIsRegexValid(true);
    } catch (e) {
      setIsRegexValid(false);
    }
  }, [searchTerm]);
  
  const handleExportCSV = useCallback(() => {
    const { data, headers } = dataForExport;
    if (data.length === 0) return;

    const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (/[",\n\r]/.test(str)) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => escapeCsv(row[header])).join(',')
      )
    ];
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'ansible_facts_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [dataForExport]);
  
  const handleExportXLSX = useCallback(() => {
    const { data, headers } = dataForExport;

    if (data.length === 0) {
      return;
    }
    
    const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
    
    const colWidths = headers.map(header => {
      const maxLength = Math.max(
        header.length,
        ...data.map(row => (row[header] ? String(row[header]).length : 0))
      );
      return { wch: Math.min(70, maxLength + 2) };
    });
    worksheet["!cols"] = colWidths;
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Facts');
    
    XLSX.writeFile(workbook, 'ansible_facts_export.xlsx');
  }, [dataForExport]);

  const handleRemoveFactPath = useCallback((pathToRemove: string) => {
    setVisibleFactPaths(prev => {
        const newSet = new Set(prev);
        newSet.delete(pathToRemove);
        return newSet;
    });
  }, []);

  const densityTheme = DENSITY_THEME[density];

  const totalFactCount = allFacts.length;
  const totalHostCount = useMemo(() => new Set(allFacts.map(f => f.host)).size, [allFacts]);
  const displayedItemCount = viewMode === 'list' ? sortedListFacts.length : sortedPivotedData.data.length;
  const totalItemCount = viewMode === 'list' ? totalFactCount : totalHostCount;
  const displayedItemName = viewMode === 'list' ? (displayedItemCount === 1 ? 'fact' : 'facts') : (displayedItemCount === 1 ? 'host' : 'hosts');
  const totalItemName = viewMode === 'list' ? 'facts' : 'hosts';


  return (
    <div className={`h-full flex flex-col ${isFullScreen ? 'p-4 sm:p-6 lg:p-8 relative' : 'px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 gap-2'}`}>
       {isFullScreen && (
          <div className="absolute top-4 left-4 sm:left-6 lg:left-8 z-50 pointer-events-none">
             <h1 className="text-lg font-open-sans flex items-center tracking-tight text-slate-400 dark:text-zinc-600">
                  <span className="font-bold bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent dark:from-violet-500 dark:to-fuchsia-400 opacity-70">
                      AFE
                  </span>
                  <span className="mx-2 font-light">|</span>
                  <span className="font-semibold">
                      Ansible Facts Explorer
                  </span>
              </h1>
          </div>
      )}

      {!isFullScreen && (
        <header className={`flex flex-col sm:flex-row justify-between items-start sm:items-baseline ${densityTheme.headerGap}`}>
            <div>
               <h1 className="text-3xl font-open-sans flex items-center tracking-tight">
                    <span className="font-bold bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent dark:from-violet-500 dark:to-fuchsia-400">
                        AFE
                    </span>
                    <span className="mx-3 font-light text-slate-300 dark:text-zinc-700">|</span>
                    <span className="font-semibold text-slate-800 dark:text-zinc-100">
                        Ansible Facts Explorer
                    </span>
                </h1>
            </div>
            <div className="flex flex-col items-center sm:items-end">
                <div className={`flex items-start flex-wrap justify-end ${densityTheme.headerGap}`}>
                    <div>
                        <div className="flex items-center p-0.5 bg-slate-200 dark:bg-zinc-800 rounded-full h-9">
                            <button
                              type="button"
                              onClick={() => setDataSource('awx')}
                              disabled={isLoading || isStatusLoading || !serviceStatus.awx.configured}
                              title={!serviceStatus.awx.configured ? "AWX source is not configured on the backend" : "Fetch from Live AWX"}
                              className={`px-3 py-1.5 text-sm rounded-full transition-all duration-200 ${dataSource === 'awx' ? 'bg-slate-100 dark:bg-zinc-900 shadow text-violet-600 dark:text-violet-400 font-semibold' : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              Live AWX
                            </button>
                             <button
                              type="button"
                              onClick={() => setDataSource('db')}
                              disabled={isLoading || isStatusLoading || !serviceStatus.db.configured}
                              title={!serviceStatus.db.configured ? "Database source is not configured on the backend" : "Fetch from Cached DB"}
                              className={`px-3 py-1.5 text-sm rounded-full transition-all duration-200 ${dataSource === 'db' ? 'bg-slate-100 dark:bg-zinc-900 shadow text-violet-600 dark:text-violet-400 font-semibold' : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              Cached DB
                            </button>
                            <button
                              type="button"
                              onClick={() => setDataSource('demo')}
                              disabled={isLoading}
                              className={`px-3 py-1.5 text-sm rounded-full transition-all duration-200 ${dataSource === 'demo' ? 'bg-slate-100 dark:bg-zinc-900 shadow text-violet-600 dark:text-violet-400 font-semibold' : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              Demo
                            </button>
                        </div>
                         <p className="text-slate-500 dark:text-zinc-400 text-xs w-full text-center mt-1">
                            {loadedDataSource && !isLoading && !error ? 
                                `Data source: ${loadedDataSource === 'awx' ? `Live AWX` : loadedDataSource === 'db' ? `Cached DB` : 'Demo Data'}` :
                                'Select a data source to begin.'
                            }
                        </p>
                    </div>
                    <DensitySwitcher density={density} onDensityChange={setDensity} className="h-9" />
                    <ThemeSwitcher theme={theme} onToggleTheme={toggleTheme} className="h-9 w-9" />
                    <Button onClick={handleLoadFacts} disabled={isLoading || isStatusLoading} density={density} variant="tertiary" shape="pill" className="h-9">
                        {isLoading ? <Spinner className="w-5 h-5"/> : <PlayIcon />}
                        {isLoading ? 'Loading...' : (factsLoaded ? 'Reload' : 'Load Facts')}
                    </Button>
                </div>
            </div>
        </header>
      )}

      <main className="flex-1 min-h-0 flex flex-col">
        {isLoading || isStatusLoading ? (
          <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-white to-slate-50 dark:bg-gradient-to-br dark:from-zinc-900 dark:to-zinc-950 rounded-2xl shadow-lg">
            <Spinner />
            <p className="mt-4 text-lg text-slate-600 dark:text-zinc-300">
              {isStatusLoading ? 'Checking backend status...' : (dataSource === 'awx' ? 'Fetching facts from AWX...' : dataSource === 'db' ? 'Fetching facts from Database...' : 'Loading demo data...')}
            </p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 px-4 py-3 rounded-2xl">
            <p><strong className="font-semibold">Error:</strong> {error}</p>
          </div>
        ) : !factsLoaded ? (
          <div className="text-center py-16 bg-gradient-to-br from-white to-slate-50 dark:bg-gradient-to-br dark:from-zinc-900 dark:to-zinc-950 rounded-2xl p-4 shadow-lg">
            <h3 className="text-xl font-semibold text-slate-800 dark:text-zinc-100">Ready to explore?</h3>
            <p className="mt-2 text-slate-500 dark:text-zinc-400">Select a data source and click "Load Facts" to get started.</p>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-white to-slate-50 dark:bg-gradient-to-br dark:from-zinc-900 dark:to-zinc-950 rounded-2xl shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-white dark:ring-opacity-10 overflow-hidden h-full flex flex-col">
            <div className="relative z-30">
              <div className={`p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start gap-4`}>
                <div className="w-full max-w-lg flex-shrink">
                  <SearchBar 
                    searchTerm={searchTerm} 
                    setSearchTerm={setSearchTerm}
                    isRegexValid={isRegexValid}
                    density={density}
                  />
                  <p className={`text-xs text-slate-500 dark:text-zinc-400 pt-2`}>
                    Displaying {displayedItemCount.toLocaleString()} {displayedItemName} of {totalItemCount.toLocaleString()} total {totalItemName}.
                  </p>
                </div>
                <div className={`flex items-center flex-wrap justify-start sm:justify-end gap-2`}>
                  <Button
                    onClick={() => setIsFactFilterVisible(!isFactFilterVisible)}
                    variant="tertiary"
                    shape="pill"
                    density={density}
                    className={`h-9 ${isFactFilterVisible ? 'bg-violet-100 dark:bg-violet-900/50' : ''}`}
                    title="Filter visible facts"
                    disabled={allFactPaths.length === 0}
                  >
                    <FilterIcon />
                    <span className="hidden sm:inline">Facts</span>
                    {allFactPaths.length > 0 && (
                      <span className="text-xs bg-slate-300 dark:bg-zinc-700 rounded-full px-2 py-0.5 ml-1">
                        {visibleFactPaths.size}/{allFactPaths.length}
                      </span>
                    )}
                  </Button>
                  <Button 
                    onClick={() => setShowModifiedColumn(!showModifiedColumn)} 
                    variant="tertiary" 
                    shape="pill" 
                    density={density} 
                    className={`h-9 ${showModifiedColumn ? 'bg-violet-100 dark:bg-violet-900/50' : ''}`}
                    title="Toggle modified date column"
                  >
                      <ClockIcon />
                  </Button>
                  <ViewSwitcher viewMode={viewMode} onViewModeChange={setViewMode} className="h-9" />
                  <div className="relative" ref={exportMenuRef}>
                    <Button
                      onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                      disabled={dataForExport.data.length === 0}
                      variant="tertiary"
                      shape="pill"
                      density={density}
                      className="h-9"
                      title="Export data"
                    >
                      <DownloadIcon />
                      <ChevronDownIcon />
                    </Button>
                    {isExportMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-md shadow-lg bg-white dark:bg-zinc-800 ring-1 ring-black dark:ring-zinc-700 ring-opacity-5 focus:outline-none z-50">
                        <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                          <button
                            onClick={() => { handleExportCSV(); setIsExportMenuOpen(false); }}
                            className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700"
                            role="menuitem"
                          >
                            <DownloadIcon />
                            <span>Export as CSV</span>
                          </button>
                          <button
                            onClick={() => { handleExportXLSX(); setIsExportMenuOpen(false); }}
                            className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700"
                            role="menuitem"
                          >
                            <ExcelIcon />
                            <span>Export as XLSX</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <Button 
                    onClick={() => setIsFullScreen(!isFullScreen)} 
                    variant="tertiary" 
                    shape="pill" 
                    density={density} 
                    className="h-9"
                    title={isFullScreen ? "Exit full screen" : "Enter full screen"}
                  >
                      {isFullScreen ? <CompressIcon /> : <ExpandIcon />}
                  </Button>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 w-full h-px bg-slate-200 dark:bg-zinc-800">
                <div
                    className="h-full bg-gradient-to-r from-violet-500 to-blue-500 transition-transform duration-100 ease-linear"
                    style={{ transform: `scaleX(${scrollProgress / 100})`, transformOrigin: 'left' }}
                />
              </div>
            </div>
            
            <FactFilter
                isVisible={isFactFilterVisible}
                allFactPaths={allFactPaths}
                visibleFactPaths={visibleFactPaths}
                onVisibilityChange={(path, isVisible) => {
                    setVisibleFactPaths(prev => {
                        const newSet = new Set(prev);
                        if (isVisible) {
                            newSet.add(path);
                        } else {
                            newSet.delete(path);
                        }
                        return newSet;
                    });
                }}
                onSelectAll={() => setVisibleFactPaths(new Set(allFactPaths))}
                onSelectNone={() => setVisibleFactPaths(new Set())}
            />

            <div className="flex-1 min-h-0">
                {viewMode === 'list' ? (
                    <FactTable
                        facts={sortedListFacts}
                        density={density}
                        showModifiedColumn={showModifiedColumn}
                        sortConfig={sortConfig}
                        requestSort={handleRequestSort}
                        onScrollProgress={setScrollProgress}
                    />
                ) : (
                    <PivotedFactTable
                        data={sortedPivotedData.data}
                        headers={sortedPivotedData.headers}
                        density={density}
                        sortConfig={sortConfig}
                        requestSort={handleRequestSort}
                        onRemoveFactPath={handleRemoveFactPath}
                        onScrollProgress={setScrollProgress}
                    />
                )}
            </div>
          </div>
        )}
      </main>

      {!isFullScreen && (
        <footer className="w-full text-xs text-slate-500 dark:text-zinc-500 py-1 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end">
            <div className="flex items-center gap-x-4">
                <span className="font-bold bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent dark:from-violet-500 dark:to-fuchsia-400">
                    KMK
                </span>
                <span className="border-l border-slate-300 dark:border-zinc-700 h-4"></span>
                <div className="flex items-center gap-x-3">
                  <a href="https://github.com/kmkamyk" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 dark:hover:text-zinc-300 transition-colors">
                      github
                  </a>
                  <a href="https://www.linkedin.com/in/kamil-pytli%C5%84ski-68ba44119/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 dark:hover:text-zinc-300 transition-colors">
                      linkedin
                  </a>
                </div>
                <span className="border-l border-slate-300 dark:border-zinc-700 h-4"></span>
                <span>
                    Licensed under GPLv3
                </span>
            </div>
        </footer>
      )}
    </div>
  );
};

export default FactBrowser;