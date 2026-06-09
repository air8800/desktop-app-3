import React, { useState, useEffect } from 'react';
import { PrintJob } from '../types';
import { Clock, Printer, TrendingUp, Calendar, X, AlertCircle } from 'lucide-react';

interface AveragePrintTimeStatsProps {
    jobs: PrintJob[]; // Passed for trigger updates, though we read from localStorage
}

interface PrintHistoryItem {
    jobId: string;
    printer_name: string;
    duration_seconds: number;
    completed_at: string;
    settings: {
        paper_size: string;
        color_mode: string;
        print_type: string;
        copies: number;
    };
}

interface PrinterStats {
    printerName: string;
    avgTime: number;
    jobCount: number;
    combinations: {
        [key: string]: { // key: "A4 - Color - Single"
            totalTime: number;
            count: number;
            avg: number;
            details: string;
        }
    };
}

const AveragePrintTimeStats: React.FC<AveragePrintTimeStatsProps> = ({ jobs }) => {
    const [printerStats, setPrinterStats] = useState<PrinterStats[]>([]);
    const [expandedPrinter, setExpandedPrinter] = useState<string | null>(null);

    // Load and calculate stats
    useEffect(() => {
        try {
            const statsMap = new Map<string, PrinterStats>();

            // Helper to process a job entry
            const processEntry = (id: string, printerName: string, duration: number, settings: any) => {
                if (!duration) return;

                // Init printer stats
                if (!statsMap.has(printerName)) {
                    statsMap.set(printerName, {
                        printerName,
                        avgTime: 0,
                        jobCount: 0,
                        combinations: {}
                    });
                }

                const pStats = statsMap.get(printerName)!;
                pStats.jobCount++;
                // Running average for total
                pStats.avgTime = ((pStats.avgTime * (pStats.jobCount - 1)) + duration) / pStats.jobCount;

                // Combination breakdown
                const comboKey = `${settings.paper_size || 'Default'} • ${settings.color_mode || 'Default'} • ${settings.print_type || 'Default'}`;

                if (!pStats.combinations[comboKey]) {
                    pStats.combinations[comboKey] = { totalTime: 0, count: 0, avg: 0, details: comboKey };
                }

                const combo = pStats.combinations[comboKey];
                combo.count++;
                combo.totalTime += duration;
                combo.avg = combo.totalTime / combo.count;
            };

            // 1. Load Local Storage History (Primary Source for Printer Names)
            const historyJson = localStorage.getItem('printHistory');
            const history: Record<string, any> = historyJson ? JSON.parse(historyJson) : {};
            const processedJobIds = new Set<string>();

            Object.entries(history).forEach(([jobId, entry]: [string, any]) => {
                if (entry.printer_name && entry.processing_time_seconds) {
                    processEntry(jobId, entry.printer_name, entry.processing_time_seconds, entry.settings || {});
                    processedJobIds.add(jobId);
                }
            });

            // 2. Load Historical Jobs from DB (Secondary Source)
            // If job not in local history, use DB data. Printer name might be unknown.
            jobs.forEach(job => {
                if (processedJobIds.has(job.id)) return; // Already processed from local storage

                if (job.job_status === 'completed' && job.processing_time_seconds && job.processing_time_seconds > 0) {
                    // Try to find printer name if it exists on job object (even if not in type)
                    const printerName = (job as any).printer_name || 'Standard Printer';

                    processEntry(
                        job.id,
                        printerName,
                        job.processing_time_seconds,
                        {
                            paper_size: job.paper_size,
                            color_mode: job.color_mode,
                            print_type: job.print_type,
                            copies: job.copies
                        }
                    );
                }
            });

            // Convert to array and Sort
            // Filter: Show only if available time data (jobCount > 0)
            const sortedStats = Array.from(statsMap.values())
                .filter(s => s.jobCount > 0)
                .sort((a, b) => b.jobCount - a.jobCount) // Most popular first
                .slice(0, 3);

            setPrinterStats(sortedStats);

        } catch (err) {
            console.error('Failed to calculate printer stats:', err);
        }
    }, [jobs]); // Re-run when jobs change


    if (printerStats.length === 0) {
        return null; // Hide if no data
    }

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                {printerStats.map((stat, index) => (
                    <div
                        key={stat.printerName}
                        onClick={() => setExpandedPrinter(stat.printerName)}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 group"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-3 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <Printer className="h-6 w-6" />
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                                    {stat.jobCount} Jobs
                                </span>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 truncate" title={stat.printerName}>
                                {stat.printerName}
                            </h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    {stat.avgTime.toFixed(1)}s
                                </span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">avg. time</span>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" /> View Breakdown
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Detail Modal */}
            {expandedPrinter && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-scale-in">
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Printer className="h-5 w-5" />
                                    {expandedPrinter}
                                </h2>
                                <p className="text-blue-100 text-sm mt-1">Average Time Analysis</p>
                            </div>
                            <button
                                onClick={() => setExpandedPrinter(null)}
                                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            <div className="space-y-3">
                                {(() => {
                                    const stat = printerStats.find(s => s.printerName === expandedPrinter);
                                    if (!stat) return null;

                                    const combos = Object.entries(stat.combinations).sort((a, b) => b[1].count - a[1].count);

                                    return combos.map(([key, data], idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700">
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{key}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{data.count} prints</p>
                                            </div>
                                            <div className="text-right pl-4">
                                                <span className="block text-lg font-bold text-green-600 dark:text-green-400">
                                                    {data.avg.toFixed(1)}s
                                                </span>
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>

                            {printerStats.find(s => s.printerName === expandedPrinter)?.jobCount === 0 && (
                                <div className="text-center py-8 text-gray-500">
                                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p>No enough data to show breakdown yet.</p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 text-center">
                            <button
                                onClick={() => setExpandedPrinter(null)}
                                className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AveragePrintTimeStats;
