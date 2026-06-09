import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Settings, FileText, Palette, Layers, Trash2, ArrowLeft, Printer } from 'lucide-react';

export interface PrinterCombination {
    paperSize: string;
    colorMode: string;
    printType: string;
    avgTime: number;
    count: number;
}

export interface PrinterStatEntry {
    name: string;
    avg: number;
    count: number;
    combinations: Map<string, PrinterCombination> | PrinterCombination[];
}

interface PerformanceStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialPrinterName?: string | null;
    allStats: PrinterStatEntry[];
    shopAvg?: number;
    onClearHistory?: (printerName: string) => void;
}

const PerformanceStatsModal: React.FC<PerformanceStatsModalProps> = ({
    isOpen,
    onClose,
    initialPrinterName,
    allStats,
    shopAvg = 0,
    onClearHistory
}) => {
    const [mounted, setMounted] = useState(false);
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
    const [selectedPrinterName, setSelectedPrinterName] = useState<string | null>(initialPrinterName || null);

    // Synchronize selected printer if initialPrinterName changes
    useEffect(() => {
        setSelectedPrinterName(initialPrinterName || null);
    }, [initialPrinterName]);

    useEffect(() => {
        setMounted(true);
        const div = document.createElement('div');
        div.id = 'performance-stats-modal-root';
        document.body.appendChild(div);
        setPortalContainer(div);

        return () => {
            setMounted(false);
            if (document.body.contains(div)) {
                document.body.removeChild(div);
            }
        };
    }, []);

    const selectedPrinter = useMemo(() => {
        if (!selectedPrinterName) return null;
        return allStats.find(s => s.name === selectedPrinterName);
    }, [allStats, selectedPrinterName]);

    const combinations = useMemo(() => {
        if (!selectedPrinter) return [];
        if (Array.isArray(selectedPrinter.combinations)) return selectedPrinter.combinations;
        return Array.from(selectedPrinter.combinations.values());
    }, [selectedPrinter]);

    if (!isOpen || !mounted || !portalContainer) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div
                className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gradient-to-r from-blue-600/5 to-indigo-600/5 shrink-0">
                    <div className="flex items-center gap-4">
                        {selectedPrinterName && (
                            <button
                                onClick={() => setSelectedPrinterName(null)}
                                className="p-2 hover:bg-white dark:hover:bg-gray-800 rounded-xl shadow-soft transition-all"
                                title="Back to All Printers"
                            >
                                <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            </button>
                        )}
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center shadow-soft">
                            {selectedPrinterName ? (
                                <Settings className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            ) : (
                                <Printer className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                {selectedPrinterName ? selectedPrinterName : 'All Printers Performance'}
                            </h2>
                            <p className="text-sm text-gray-500 font-medium">
                                {selectedPrinterName ? 'Detailed Performance Breakdown' : 'Comparative Statistics'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors group"
                    >
                        <X className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
                    {!selectedPrinterName ? (
                        /* LIST VIEW: ALL PRINTERS */
                        <div className="grid gap-3">
                            {allStats.length === 0 ? (
                                <div className="py-10 text-center">
                                    <Clock className="h-10 w-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
                                    <p className="text-gray-500 text-sm font-medium italic">No performance data available yet.</p>
                                </div>
                            ) : (
                                allStats.map((stat, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => setSelectedPrinterName(stat.name)}
                                        className="p-3.5 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-700/50 flex items-center justify-between gap-4 cursor-pointer transition-all hover:bg-white dark:hover:bg-gray-800 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-900 group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-white dark:bg-gray-900 rounded-xl flex items-center justify-center border border-gray-100 dark:border-gray-700 shadow-sm group-hover:scale-105 transition-transform">
                                                <Printer className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{stat.name}</h3>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[9px] font-black bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md uppercase">
                                                        {stat.count} Results
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <span className="text-lg font-black text-gray-900 dark:text-white italic tracking-tighter">{stat.avg.toFixed(2)}s</span>
                                                <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest leading-none mt-0.5">Speed</p>
                                            </div>
                                            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                                <Settings className="h-4 w-4" />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        /* DETAIL VIEW: COMBINATIONS */
                        <div>
                            {combinations.length === 0 ? (
                                <div className="py-10 text-center">
                                    <Clock className="h-10 w-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
                                    <p className="text-gray-500 text-sm font-medium italic">No data available for this printer.</p>
                                </div>
                            ) : (
                                <div className="grid gap-3.5">
                                    {combinations.map((combo, idx) => (
                                        <div
                                            key={idx}
                                            className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-700/50 flex flex-wrap items-center justify-between gap-4 transition-all hover:bg-white dark:hover:bg-gray-800 hover:shadow-md group"
                                        >
                                            <div className="flex flex-wrap gap-2 items-center">
                                                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors group-hover:border-blue-100 dark:group-hover:border-blue-900/20">
                                                    <FileText className="h-3.5 w-3.5 text-gray-400" />
                                                    <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{combo.paperSize}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors group-hover:border-blue-100 dark:group-hover:border-blue-900/20">
                                                    <Palette className="h-3.5 w-3.5 text-gray-400" />
                                                    <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{combo.colorMode}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors group-hover:border-blue-100 dark:group-hover:border-blue-900/20">
                                                    <Layers className="h-3.5 w-3.5 text-gray-400" />
                                                    <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{combo.printType}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6 ml-auto">
                                                <div className="text-right border-r border-gray-200 dark:border-gray-700 pr-6">
                                                    <p className="text-[9px] uppercase font-black text-gray-400 dark:text-gray-500 tracking-wider mb-0.5">Frequency</p>
                                                    <div className="flex items-center justify-end gap-1">
                                                        <span className="text-lg font-black text-gray-800 dark:text-gray-200 tracking-tighter">{combo.count}</span>
                                                        <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase pt-0.5">Jobs</span>
                                                    </div>
                                                </div>
                                                <div className="px-5 py-2.5 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/10 flex flex-col items-center min-w-[90px] group-hover:scale-105 transition-transform">
                                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-80 mb-0.5">Speed</span>
                                                    <span className="text-lg font-black italic tracking-tighter leading-none">{combo.avgTime.toFixed(2)}s</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        {/* Left: Info */}
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Shop Baseline:</span>
                                <span className="text-sm font-black text-blue-600 dark:text-blue-400 italic">{shopAvg.toFixed(2)}s</span>
                                <span className="text-[10px] text-gray-400 font-medium italic">(Avg time per page)</span>
                            </div>
                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">Printer Avg = [Total Processing Time] / [Total Pages]</p>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2">
                            {selectedPrinterName && onClearHistory && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm(`Reset stats for ${selectedPrinterName}?`)) {
                                            onClearHistory(selectedPrinterName);
                                            setSelectedPrinterName(null);
                                        }
                                    }}
                                    className="flex items-center gap-1.5 text-red-500 hover:text-white hover:bg-red-500 font-bold uppercase text-[9px] tracking-wider transition-all bg-white dark:bg-gray-800 border border-red-100 dark:border-red-900/30 px-3 py-2 rounded-xl"
                                >
                                    <Trash2 className="h-3 w-3" />
                                    Reset
                                </button>
                            )}

                            {selectedPrinterName && (
                                <button
                                    onClick={() => setSelectedPrinterName(null)}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold uppercase text-[9px] tracking-widest rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                                >
                                    All Printers
                                </button>
                            )}

                            <button
                                onClick={onClose}
                                className="px-5 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-black uppercase text-[9px] tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-transform"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        portalContainer
    );
};

export default PerformanceStatsModal;
