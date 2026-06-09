import React, { useEffect, useState } from 'react';
import { Activity, ChevronRight } from 'lucide-react';
import { PrintJob } from '../types';
import PerformanceStatsModal, { PrinterStatEntry } from './PerformanceStatsModal';

interface SidebarStatsProps {
    jobs: PrintJob[];
    isOpen: boolean;
}

const SidebarStats: React.FC<SidebarStatsProps> = ({ jobs, isOpen }) => {
    const [topStats, setTopStats] = useState<PrinterStatEntry[]>([]);
    const [allStats, setAllStats] = useState<PrinterStatEntry[]>([]);
    const [totalCompleted, setTotalCompleted] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPrinterName, setSelectedPrinterName] = useState<string | null>(null);
    const [shopAvg, setShopAvg] = useState(0);

    useEffect(() => {
        try {
            console.log('🔄 [SidebarStats] Recalculating stats...');
            const historyJson = localStorage.getItem('printHistory');
            const history: Record<string, any> = historyJson ? JSON.parse(historyJson) : {};

            const printerMapJson = localStorage.getItem('jobPrinterMap');
            const printerMap = printerMapJson ? new Map(JSON.parse(printerMapJson)) : new Map();

            const statsMap = new Map<string, PrinterStatEntry>();
            const processedIds = new Set<string>();
            let completedCount = 0;
            let shopSumTime = 0;
            let shopSumPages = 0;

            const processEntry = (id: string, printerName: string, duration: number, settings: any, totalPages: number = 1) => {
                if (!duration || duration <= 0) return;
                const pages = totalPages || 1;

                // Normalize name for grouping key but keep a display name
                const displayName = printerName || 'Unknown Printer';
                const groupKey = displayName.toLowerCase().trim();

                const paperSize = settings.paper_size || settings.paperSize || 'Default';
                const colorMode = settings.color_mode || settings.colorMode || 'Default';
                const printType = settings.print_type || settings.printType || 'Default';

                completedCount++;
                shopSumTime += duration;
                shopSumPages += pages;

                if (!statsMap.has(groupKey)) {
                    statsMap.set(groupKey, {
                        name: displayName,
                        avg: 0,
                        count: 0,
                        combinations: new Map()
                    });
                }

                const s = statsMap.get(groupKey)! as any;
                s.count++;
                s.sumTime = (s.sumTime || 0) + duration;
                s.sumPages = (s.sumPages || 0) + pages;

                const comboKey = `${paperSize} • ${colorMode} • ${printType}`;
                const combinations = s.combinations as Map<string, any>;
                if (!combinations.has(comboKey)) {
                    combinations.set(comboKey, {
                        paperSize,
                        colorMode,
                        printType,
                        avgTime: 0,
                        count: 0
                    });
                }

                const combo = combinations.get(comboKey)!;
                combo.count++;
                combo.sumTime = (combo.sumTime || 0) + duration;
                combo.sumPages = (combo.sumPages || 0) + pages;
                processedIds.add(id);
            };

            // 1. Process History
            Object.entries(history).forEach(([key, entry]: [string, any]) => {
                const time = Number(entry.processing_time_seconds);
                if (time > 0) {
                    let p = entry.printer_name;
                    let settings = entry.settings;
                    let pages = entry.total_pages || 1;

                    // Support multiple entries for the same jobId by using jobId for deduplication
                    // This ensures we count every individual print attempt in the stats
                    const jid = entry.job_id || key;

                    // Fallback to printerMap for better resolution (legacy)
                    if ((!p || !settings) && printerMap.has(jid)) {
                        const tracked = printerMap.get(jid);
                        if (!p) p = typeof tracked === 'string' ? tracked : tracked?.printerName;
                        if (!settings) settings = typeof tracked === 'object' ? tracked?.settings : undefined;
                    }

                    processEntry(jid, p || 'Unknown Printer', time, settings || {}, pages);
                }
            });

            // 2. Process Prop Jobs
            (jobs || []).forEach(job => {
                const status = job.job_status?.toLowerCase();
                if ((status === 'completed' || status === 'printed') && !processedIds.has(job.id)) {
                    const time = Number(job.processing_time_seconds);
                    if (time > 0) {
                        const historyEntry = history[job.id];
                        let p = historyEntry?.printer_name || (job as any).printer_name || 'Unknown Printer';
                        let pages = job.total_pages || historyEntry?.total_pages || 1;

                        processEntry(job.id, p, time, {
                            paper_size: job.paper_size,
                            color_mode: job.color_mode,
                            print_type: job.print_type
                        }, pages);
                    }
                }
            });

            // 3. Finalize Averages
            statsMap.forEach(s => {
                const printer = s as any;
                printer.avg = printer.sumPages > 0 ? printer.sumTime / printer.sumPages : 0;

                const combos = printer.combinations as Map<string, any>;
                combos.forEach(combo => {
                    combo.avgTime = combo.sumPages > 0 ? combo.sumTime / combo.sumPages : 0;
                });
            });

            const sortedStats = Array.from(statsMap.values())
                .sort((a, b) => b.count - a.count);

            const calculatedShopAvg = shopSumPages > 0 ? shopSumTime / shopSumPages : 0;
            setShopAvg(calculatedShopAvg);
            setTotalCompleted(completedCount);
            setAllStats(sortedStats);
            setTopStats(sortedStats.slice(0, 3));

            console.log('📊 [SidebarStats] Recalculation complete. Top 3:', sortedStats.slice(0, 3).map(s => s.name));
            console.log('🏁 [SidebarStats] Shop Average:', calculatedShopAvg.toFixed(2), 's');
        } catch (err) {
            console.error('📊 SidebarStats error:', err);
        }
    }, [jobs]);

    const handleClearHistory = (printerName: string) => {
        try {
            const historyJson = localStorage.getItem('printHistory');
            const history = historyJson ? JSON.parse(historyJson) : {};
            const newHistory: Record<string, any> = {};

            Object.entries(history).forEach(([id, entry]: [string, any]) => {
                if ((entry.printer_name || 'Unknown Printer') !== printerName) {
                    newHistory[id] = entry;
                }
            });

            localStorage.setItem('printHistory', JSON.stringify(newHistory));
            window.dispatchEvent(new Event('storage'));
            // Trigger local refresh
            const countToRemove = allStats.find(s => s.name === printerName)?.count || 0;
            setTotalCompleted(prev => Math.max(0, prev - countToRemove));
            setAllStats(prev => prev.filter(p => p.name !== printerName));
            setTopStats(prev => prev.filter(p => p.name !== printerName));
        } catch (e) {
            console.error('Failed to clear history:', e);
        }
    };

    if (!isOpen) {
        return (
            <div className="mt-4 flex flex-col items-center gap-4 py-4 border-t border-gray-100 dark:border-gray-800">
                <div onClick={() => setIsModalOpen(true)} className="relative group cursor-pointer">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${totalCompleted > 0
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'bg-gray-50 dark:bg-gray-900/20 text-gray-400'
                        }`}>
                        <Activity className={`h-5 w-5 ${totalCompleted > 0 && 'animate-pulse'}`} />
                    </div>
                    {totalCompleted > 0 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 shadow-sm">
                            {totalCompleted > 99 ? '9+' : totalCompleted}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (totalCompleted === 0) {
        return (
            <div className="mt-6 mx-3 p-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                <div className="flex flex-col items-center text-center">
                    <Activity className="h-6 w-6 text-gray-300 dark:text-gray-600 mb-2" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No Stats</span>
                    <p className="text-[9px] text-gray-400 mt-1">Print jobs to track performance</p>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-6 mx-3">
            <div className="p-4 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-800/60 dark:to-gray-900/60 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-xl backdrop-blur-md relative overflow-hidden">
                <div className="absolute -top-6 -right-6 w-12 h-12 bg-blue-500/5 rounded-full blur-2xl" />

                <div
                    className="flex justify-between items-center mb-4 cursor-pointer group/header"
                    onClick={() => {
                        setSelectedPrinterName(null);
                        setIsModalOpen(true);
                    }}
                >
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg group-hover/header:bg-blue-500/20 transition-colors">
                            <Activity className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="text-[11px] font-black uppercase tracking-tight text-gray-800 dark:text-gray-200 group-hover/header:text-blue-500 transition-colors">Performance</h3>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] font-extrabold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md">
                            {totalCompleted}
                        </span>
                        <ChevronRight className="h-3 w-3 text-gray-300 group-hover/header:text-blue-400 group-hover/header:translate-x-0.5 transition-all" />
                    </div>
                </div>

                <div className="space-y-4">
                    {topStats.map((stat, idx) => (
                        <div
                            key={idx}
                            className="relative cursor-pointer group hover:scale-[1.02] transition-transform"
                            onClick={() => {
                                setSelectedPrinterName(stat.name);
                                setIsModalOpen(true);
                            }}
                        >
                            <div className="flex justify-between items-center mb-1.5 px-0.5">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-500 uppercase tracking-tighter group-hover:text-blue-500 transition-colors truncate max-w-[80px]">
                                        {stat.name}
                                    </span>
                                    <span className="text-[9px] font-medium text-gray-400 dark:text-gray-600">
                                        {stat.count} jobs
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-0.5 shrink-0">
                                    <span className="text-sm font-black text-gray-800 dark:text-gray-100 italic">
                                        {stat.avg.toFixed(2)}
                                    </span>
                                    <span className="text-[9px] font-bold text-gray-400 uppercase">s</span>
                                </div>
                            </div>
                            <div className="h-1.5 w-full bg-gray-200/50 dark:bg-gray-700/30 rounded-full overflow-hidden p-[1.2px]">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-indigo-600 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)] transition-all duration-1000 ease-out"
                                    style={{ width: `${Math.min(100, Math.max(15, (5 / stat.avg) * 100))}%` }}
                                />
                            </div>
                        </div>
                    ))}

                    {allStats.length > 3 && (
                        <button
                            onClick={() => {
                                setSelectedPrinterName(null);
                                setIsModalOpen(true);
                            }}
                            className="w-full py-1.5 mt-1 border border-blue-100 dark:border-blue-900/20 rounded-lg text-[9px] font-black text-blue-500 uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
                        >
                            View All {allStats.length} Printers
                        </button>
                    )}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[7px] font-black text-blue-400 dark:text-blue-500 uppercase tracking-[0.2em] leading-none mb-1">Overall Baseline</span>
                            <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">Shop Avg time per page</span>
                        </div>
                        <span className="text-sm font-black text-blue-600 dark:text-blue-400 italic">
                            {shopAvg.toFixed(2)}s
                        </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                        <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">System Status</span>
                        <span className="flex items-center gap-1 text-[9px] font-bold text-green-500">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            SYNCED
                        </span>
                    </div>
                </div>
            </div>

            <PerformanceStatsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialPrinterName={selectedPrinterName}
                allStats={allStats}
                shopAvg={shopAvg}
                onClearHistory={handleClearHistory}
            />
        </div>
    );
};

export default SidebarStats;
