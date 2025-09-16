import React, { useMemo, useState, useRef, useEffect } from 'react';
import { FactRow } from '../types';
import { ServerIcon, DocumentTextIcon, CpuChipIcon, MicrochipIcon, CogIcon, XSmallIcon, PlusIcon } from './icons/Icons';
import Button from './Button';

interface DashboardProps {
  facts: FactRow[];
  isVisible: boolean;
  allFactPaths: string[];
  chartFactSelections: string[];
  onChartFactSelectionChange: (newSelections: string[]) => void;
}

const StatCard: React.FC<{ icon: React.ReactNode; title: string; value: string | number; color: string; }> = ({ icon, title, value, color }) => (
    <div className="bg-slate-100 dark:bg-zinc-800/70 p-4 rounded-lg shadow-sm flex items-center gap-4 border border-slate-200 dark:border-zinc-700/80">
        <div className={`p-3 rounded-full ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm text-slate-500 dark:text-zinc-400">{title}</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-zinc-100">{value}</p>
        </div>
    </div>
);

const BarChart: React.FC<{
    title: string;
    data: { label: string; value: number }[];
    color: string;
    allFactPaths: string[];
    selectedFact: string;
    onFactChange: (newFact: string) => void;
    onRemove: () => void;
}> = ({ title, data, color, allFactPaths, selectedFact, onFactChange, onRemove }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [filter, setFilter] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const maxValue = useMemo(() => Math.max(...data.map(d => d.value), 0), [data]);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
        }
    }, [isEditing]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsEditing(false);
                setFilter('');
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const filteredPaths = useMemo(() => {
        if (!filter) return allFactPaths;
        return allFactPaths.filter(path => path.toLowerCase().includes(filter.toLowerCase()));
    }, [allFactPaths, filter]);

    return (
        <div className="bg-slate-100 dark:bg-zinc-800/70 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-zinc-700/80">
            <div className="flex justify-between items-center mb-3 h-8" ref={wrapperRef}>
                {isEditing ? (
                    <div className="relative w-full">
                        <input
                            ref={inputRef}
                            type="text"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            placeholder="Search for a fact..."
                            className="block w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-md px-3 py-1 text-sm focus:ring-1 focus:ring-violet-500 outline-none"
                        />
                         <div className="absolute top-full mt-1 w-full z-20 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {filteredPaths.map(path => (
                                <button
                                    key={path}
                                    onClick={() => { onFactChange(path); setIsEditing(false); setFilter(''); }}
                                    className="block w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-zinc-800 font-mono"
                                >
                                    {path}
                                </button>
                            ))}
                            {filteredPaths.length === 0 && <span className="block text-center px-3 py-1.5 text-sm text-slate-500">No matches</span>}
                        </div>
                    </div>
                ) : (
                    <h3 className="text-md font-semibold text-slate-800 dark:text-zinc-100 truncate pr-2" title={title}>
                        {title}
                    </h3>
                )}
                {!isEditing && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsEditing(true)} className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors flex-shrink-0" title="Configure chart">
                            <CogIcon />
                        </button>
                         <button onClick={onRemove} className="text-slate-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 transition-colors flex-shrink-0" title="Remove chart">
                            <XSmallIcon />
                        </button>
                    </div>
                )}
            </div>
            {data.length > 0 ? (
                 <div className="space-y-2">
                    {data.map(({ label, value }) => (
                        <div key={label} className="flex items-center gap-3 animate-[fadeIn_0.5s_ease-in-out]">
                            <div className="w-28 text-sm text-slate-600 dark:text-zinc-300 truncate" title={label}>{label}</div>
                            <div className="flex-1 bg-slate-200 dark:bg-zinc-700 rounded-full h-4">
                                <div
                                    className={`${color} h-4 rounded-full flex items-center justify-end px-2 text-white text-xs font-bold transition-all duration-500`}
                                    style={{ width: `${maxValue > 0 ? (value / maxValue) * 100 : 0}%` }}
                                >
                                    {value}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-4 text-sm text-slate-500 dark:text-zinc-400">
                    No categorical data found for "{selectedFact}".
                </div>
            )}
        </div>
    );
};


const Dashboard: React.FC<DashboardProps> = ({ facts, isVisible, allFactPaths, chartFactSelections, onChartFactSelectionChange }) => {
    const { stats, chartablePaths, chartDistributions } = useMemo(() => {
        if (facts.length === 0) {
            return {
                stats: { hostCount: 0, factCount: 0, totalVcpus: 0, totalMemoryGb: '0.00' },
                chartablePaths: [],
                chartDistributions: [],
            };
        }

        const hosts = new Set(facts.map(f => f.host));
        
        const totalVcpus = facts
            .filter(f => f.factPath === 'ansible_processor_vcpus')
            .reduce((acc, f) => acc + (Number(f.value) || 0), 0);
            
        const totalMemoryMb = facts
            .filter(f => f.factPath === 'ansible_memtotal_mb')
            .reduce((acc, f) => acc + (Number(f.value) || 0), 0);

        const getDistribution = (factName: string) => {
            if (!factName) return [];
            const counts: { [key: string]: number } = {};
            const hostsSeen = new Set<string>();
            facts.forEach(fact => {
                if (fact.factPath === factName && !hostsSeen.has(fact.host)) {
                    const value = String(fact.value);
                    if (value && value !== 'null' && value.trim() !== '') {
                        counts[value] = (counts[value] || 0) + 1;
                        hostsSeen.add(fact.host);
                    }
                }
            });
            return Object.entries(counts)
                .map(([label, value]) => ({ label, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5); // Top 5
        };

        const chartDistributions = chartFactSelections.map(factName => getDistribution(factName));

        // Heuristic to find good candidates for charting: non-unique, non-numeric strings.
        const potentialChartablePaths = allFactPaths.filter(path => {
            const values = facts.filter(f => f.factPath === path).map(f => f.value);
            const uniqueValues = new Set(values);
            return uniqueValues.size > 1 && uniqueValues.size < hosts.size && values.some(v => typeof v === 'string' && isNaN(Number(v)));
        }).sort();

        return {
            stats: {
                hostCount: hosts.size,
                factCount: facts.length,
                totalVcpus: totalVcpus,
                totalMemoryGb: (totalMemoryMb / 1024).toFixed(2),
            },
            chartablePaths: potentialChartablePaths.length > 0 ? potentialChartablePaths : allFactPaths,
            chartDistributions,
        };
    }, [facts, allFactPaths, chartFactSelections]);

    const chartColors = ['bg-violet-500', 'bg-fuchsia-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];

    return (
        <div className={`transition-[max-height,padding,opacity] duration-500 ease-in-out overflow-y-auto ${isVisible ? 'max-h-[70vh] py-4 opacity-100' : 'max-h-0 py-0 opacity-0'}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <StatCard icon={<ServerIcon />} title="Hosts" value={stats.hostCount.toLocaleString()} color="bg-sky-500 text-white" />
                <StatCard icon={<DocumentTextIcon />} title="Facts" value={stats.factCount.toLocaleString()} color="bg-emerald-500 text-white" />
                <StatCard icon={<CpuChipIcon />} title="Total vCPUs" value={stats.totalVcpus.toLocaleString()} color="bg-amber-500 text-white" />
                <StatCard icon={<MicrochipIcon />} title="Total Memory (GB)" value={stats.totalMemoryGb} color="bg-rose-500 text-white" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {chartFactSelections.map((selection, index) => (
                    <BarChart
                        key={index}
                        title={`Distribution of "${selection || 'Not Selected'}"`}
                        data={chartDistributions[index] || []}
                        color={chartColors[index % chartColors.length]}
                        allFactPaths={chartablePaths}
                        selectedFact={selection}
                        onFactChange={(newFact) => {
                            const newSelections = [...chartFactSelections];
                            newSelections[index] = newFact;
                            onChartFactSelectionChange(newSelections);
                        }}
                        onRemove={() => {
                           onChartFactSelectionChange(chartFactSelections.filter((_, i) => i !== index));
                        }}
                    />
                ))}
            </div>
             <div className="mt-4 flex justify-center">
                <Button 
                    onClick={() => onChartFactSelectionChange([...chartFactSelections, chartablePaths[0] || ''])}
                    variant="secondary" 
                    shape="pill"
                    density="comfortable"
                    disabled={chartablePaths.length === 0}
                >
                    <PlusIcon />
                    Add Chart
                </Button>
            </div>
        </div>
    );
};

export default Dashboard;
