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
import { DownloadIcon, PlayIcon, ExcelIcon, ClockIcon, ExpandIcon, CompressIcon, ChevronDownIcon, ChartBarIcon } from './icons/Icons';
import Dashboard from './Dashboard';

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

const matchesPill = (fact: FactRow, pill: string): boolean => {
    const trimmedPill = pill.trim();
    if (!trimmedPill) return true;

    const operatorRegex = /^(.*?)\s*(!=|>=|<=|>|<|=)\s*(.*)$/;
    const match = trimmedPill.match(operatorRegex);

    if (match) {
        const [, key, operator, value] = match.map(s => s ? s.trim() : '');
        if (key && value) {
            const lowerKey = key.toLowerCase();
            const lowerValue = value.toLowerCase();

            // For key-value searches, only match against the relevant key (factPath)
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

    if (trimmedPill.startsWith('"') && trimmedPill.endsWith('"')) {
        const exactTerm = trimmedPill.substring(1, trimmedPill.length - 1).toLowerCase();
        return (
            fact.host.toLowerCase() === exactTerm ||
            fact.factPath.toLowerCase() === exactTerm ||
            String(fact.value).toLowerCase() === exactTerm
        );
    }
    
    // Default to regex/includes search across all fields for the pill
    try {
        const regex = new RegExp(trimmedPill, 'i');
        return (
            regex.test(fact.host) ||
            regex.test(fact.factPath) ||
            regex.test(String(fact.value)) ||
            (fact.modified ? regex.test(String(fact.modified)) : false)
        );
    } catch (e) {
        const lowercasedFilter = trimmedPill.toLowerCase();
        return (
            fact.host.toLowerCase().includes(lowercasedFilter) ||
            fact.factPath.toLowerCase().includes(lowercasedFilter) ||
            String(fact.value).toLowerCase().includes(lowercasedFilter) ||
            (fact.modified ? String(fact.modified).toLowerCase().includes(lowercasedFilter) : false)
        );
    }
};

const matchesLiveSearch = (fact: FactRow, term: string): boolean => {
    const lowercasedTerm = term.toLowerCase();
    return (
        fact.host.toLowerCase().includes(lowercasedTerm) ||
        fact.factPath.toLowerCase().includes(lowercasedTerm) ||
        String(fact.value).toLowerCase().includes(lowercasedTerm)
    );
};


const FactBrowser: React.FC<FactBrowserProps> = () => {
  const [allFacts, setAllFacts] = useState<FactRow[]>([]);
  const [searchPills, setSearchPills] = useState<string[]>([]);
  const [searchInputValue, setSearchInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  // State for dashboard
  const [isDashboardVisible, setIsDashboardVisible] = useState(false);
  const [chartFactSelections, setChartFactSelections] = useState<string[]>(['ansible_distribution', 'role']);


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

  const handleCellClick = useCallback((value: string | number | boolean | null | object) => {
    const stringValue = String(value).trim();
    if (stringValue && stringValue !== '---' && stringValue !== '(No data available)') {
        const newPill = `"${stringValue}"`;
        // Add new pill, avoiding duplicates
        setSearchPills(prevPills => [...new Set([...prevPills, newPill])]);
    }
  }, []);

  const searchedFacts = useMemo(() => {
    const trimmedLiveSearch = searchInputValue.trim();
    let intermediateFacts = allFacts;

    // Apply pill filters first
    if (searchPills.length > 0) {
        intermediateFacts = allFacts.filter(fact => {
            // A fact must match ALL pills to be included (AND logic)
            return searchPills.every(pill => matchesPill(fact, pill));
        });
    }

    // Apply live search filter on top of pill results
    if (trimmedLiveSearch === '') {
        return intermediateFacts;
    }

    return intermediateFacts.filter(fact => matchesLiveSearch(fact, trimmedLiveSearch));
  }, [allFacts, searchPills, searchInputValue]);


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

  const dashboardFacts = useMemo(() => {
    const matchingHostnames = new Set(searchedFacts.map(fact => fact.host));
    if (searchPills.length > 0 || searchInputValue.trim() !== '') {
      return allFacts.filter(fact => matchingHostnames.has(fact.host));
    }
    return allFacts;
  }, [searchedFacts, allFacts, searchPills, searchInputValue]);

  const pivotViewFilteredFacts = useMemo(() => {
    if (viewMode !== 'pivot' || (searchPills.length === 0 && searchInputValue.trim() === '')) {
        return filteredFacts;
    }

    const matchingHostnames = new Set(searchedFacts.map(fact => fact.host));
    const allFactsForMatchingHosts = allFacts.filter(fact => matchingHostnames.has(fact.host));
    
    if (allFactPaths.length > 0 && visibleFactPaths.size === allFactPaths.length) {
        return allFactsForMatchingHosts;
    }
    return allFactsForMatchingHosts.filter(fact => 
        visibleFactPaths.has(fact.factPath) || fact.factPath === '---'
    );
  }, [viewMode, searchPills, searchInputValue, searchedFacts, allFacts, filteredFacts, visibleFactPaths, allFactPaths]);
  
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
        const headers = ['host', 'factPath', 'value'];
        if (showModifiedColumn) {
            headers.push('modified');
        }
        
        const data = sortedListFacts.map(fact => {
            const row: Record<string, any> = {
                host: fact.host,
                factPath: fact.factPath,
                value: fact.value,
            };
            if (showModifiedColumn) {
                row.modified = fact.modified;
            }
            return row;
        });

        return { data, headers };
    }
    
    // For pivot view, the data is already in the correct shape { data, headers }
    return sortedPivotedData;
  }, [viewMode, sortedListFacts, sortedPivotedData, showModifiedColumn]);

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
              <div className={`p-4 sm:p-6 flex flex-wrap items-start justify-between gap-x-32 gap-y-2`}>
                <div className="flex-1 min-w-[300px] sm:min-w-[400px]">
                  <SearchBar 
                    searchPills={searchPills} 
                    setSearchPills={setSearchPills}
                    searchInputValue={searchInputValue}
                    setSearchInputValue={setSearchInputValue}
                    onFilterClick={() => setIsFactFilterVisible(!isFactFilterVisible)}
                    isFilterActive={isFactFilterVisible}
                    isFilterDisabled={allFactPaths.length === 0}
                    visibleFactCount={visibleFactPaths.size}
                    totalFactCount={allFactPaths.length}
                    showModifiedColumn={showModifiedColumn}
                    onToggleModifiedColumn={() => setShowModifiedColumn(!showModifiedColumn)}
                  />
                  <p className={`text-xs text-slate-500 dark:text-zinc-400 pt-2`}>
                    Displaying {displayedItemCount.toLocaleString()} {displayedItemName} of {totalItemCount.toLocaleString()} total {totalItemName}.
                  </p>
                </div>
                <div className={`flex items-center shrink-0 gap-2`}>
                  <Button
                    onClick={() => setIsDashboardVisible(!isDashboardVisible)}
                    variant="tertiary"
                    shape="pill"
                    density={density}
                    className={`h-9 ${isDashboardVisible ? 'bg-violet-100 dark:bg-violet-900/50' : ''}`}
                    title="Toggle dashboard"
                    disabled={allFactPaths.length === 0}
                  >
                    <ChartBarIcon />
                  </Button>
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
                  <ViewSwitcher 
                    viewMode={viewMode} 
                    onViewModeChange={setViewMode}
                    className="h-9"
                  />
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

            <div className="px-4 sm:px-6">
                <Dashboard
                  facts={dashboardFacts}
                  isVisible={isDashboardVisible}
                  allFactPaths={allFactPaths}
                  chartFactSelections={chartFactSelections}
                  onChartFactSelectionChange={setChartFactSelections}
                />
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
                        onCellClick={handleCellClick}
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
                        onCellClick={handleCellClick}
                    />
                )}
            </div>
          </div>
        )}
      </main>

      {!isFullScreen && (
        <footer className="w-full text-xs text-slate-500 dark:text-zinc-500 py-1 flex items-center justify-end">
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