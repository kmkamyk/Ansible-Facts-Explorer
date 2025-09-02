import React, { useMemo } from 'react';
import { FactRow } from '../types';
import { ServerIcon, DocumentTextIcon, CpuChipIcon, MicrochipIcon } from './icons/Icons';

interface DashboardProps {
  facts: FactRow[];
  isVisible: boolean;
}

const StatCard: React.FC<{ icon: React.ReactNode; title: string; value: string | number; color: string; }> = ({ icon, title, value, color }) => (
    <div className="bg-slate-100 dark:bg-zinc-800/70 p-4 rounded-lg shadow-sm flex items-center gap-4 ring-1 ring-slate-200 dark:ring-zinc-700/80">
        <div className={`p-3 rounded-full ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm text-slate-500 dark:text-zinc-400">{title}</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-zinc-100">{value}</p>
        </div>
    </div>
);

const BarChart: React.FC<{ title: string; data: { label: string; value: number }[]; color: string; }> = ({ title, data, color }) => {
    const maxValue = useMemo(() => Math.max(...data.map(d => d.value), 0), [data]);
    if (data.length === 0) return null;

    return (
        <div className="bg-slate-100 dark:bg-zinc-800/70 p-4 rounded-lg shadow-sm col-span-1 md:col-span-2 ring-1 ring-slate-200 dark:ring-zinc-700/80">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-zinc-100 mb-4">{title}</h3>
            <div className="space-y-3">
                {data.map(({ label, value }) => (
                    <div key={label} className="flex items-center gap-3 animate-[fadeIn_0.5s_ease-in-out]">
                        <div className="w-32 text-sm text-slate-600 dark:text-zinc-300 truncate" title={label}>{label}</div>
                        <div className="flex-1 bg-slate-200 dark:bg-zinc-700 rounded-full h-5">
                            <div
                                className={`${color} h-5 rounded-full flex items-center justify-end px-2 text-white text-xs font-bold transition-all duration-500`}
                                style={{ width: `${maxValue > 0 ? (value / maxValue) * 100 : 0}%` }}
                            >
                                {value}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ facts, isVisible }) => {
    const stats = useMemo(() => {
        if (facts.length === 0) {
            return {
                hostCount: 0,
                factCount: 0,
                totalVcpus: 0,
                totalMemoryGb: '0.00',
                osDistribution: [],
                roleDistribution: [],
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
            const counts: { [key: string]: number } = {};
            const hostsSeen = new Set<string>();
            facts.forEach(fact => {
                if (fact.factPath === factName && !hostsSeen.has(fact.host)) {
                    const value = String(fact.value);
                    if (value && value !== 'null') {
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

        return {
            hostCount: hosts.size,
            factCount: facts.length,
            totalVcpus: totalVcpus,
            totalMemoryGb: (totalMemoryMb / 1024).toFixed(2),
            osDistribution: getDistribution('ansible_distribution'),
            roleDistribution: getDistribution('role'),
        };
    }, [facts]);

    return (
        <div className={`transition-[max-height,padding,opacity] duration-500 ease-in-out overflow-hidden ${isVisible ? 'max-h-[1000px] py-4 opacity-100' : 'max-h-0 py-0 opacity-0'}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <StatCard icon={<ServerIcon />} title="Hosts" value={stats.hostCount.toLocaleString()} color="bg-sky-500 text-white" />
                <StatCard icon={<DocumentTextIcon />} title="Facts" value={stats.factCount.toLocaleString()} color="bg-emerald-500 text-white" />
                <StatCard icon={<CpuChipIcon />} title="Total vCPUs" value={stats.totalVcpus.toLocaleString()} color="bg-amber-500 text-white" />
                <StatCard icon={<MicrochipIcon />} title="Total Memory (GB)" value={stats.totalMemoryGb} color="bg-rose-500 text-white" />
            </div>
            {(stats.osDistribution.length > 0 || stats.roleDistribution.length > 0) &&
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {stats.osDistribution.length > 0 && <BarChart title="OS Distribution" data={stats.osDistribution} color="bg-violet-500"/>}
                    {stats.roleDistribution.length > 0 && <BarChart title="Role Distribution" data={stats.roleDistribution} color="bg-fuchsia-500"/>}
                </div>
            }
        </div>
    );
};

export default Dashboard;
