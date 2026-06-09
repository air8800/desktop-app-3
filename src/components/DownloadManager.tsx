import React, { useState, useEffect } from 'react';
import { Download, Pause, Play, X, Trash2, CheckCircle, FileText } from 'lucide-react';
import Modal from './Modal';

interface DownloadItem {
    jobId: string;
    filename: string;
    status: 'downloading' | 'paused' | 'completed' | 'error';
    progress: number;
    speed: number;
    loaded: number;
    total: number;
    error?: string;
}

interface DownloadedItem {
    jobId: string;
    filename: string;
    filePath: string;
    fileUrl?: string;
    size: number;
    downloadedAt: number;
    printed: boolean;
    printedAt?: number;
}

interface SimpleJob {
    id: string;
    filename: string;
    file_url: string;
    job_status: string;
}

interface DownloadManagerProps {
    isOpen: boolean;
    onClose: () => void;
    jobs: SimpleJob[];
}

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatSpeed = (bytesPerSec: number): string => {
    return formatBytes(bytesPerSec) + '/s';
};

const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
};

const DownloadManager: React.FC<DownloadManagerProps> = ({ isOpen, onClose, jobs = [] }) => {
    const [activeTab, setActiveTab] = useState<'downloading' | 'downloaded' | 'all'>('downloading');
    const [allFilesSubTab, setAllFilesSubTab] = useState<'all' | 'pending' | 'printed' | 'cancelled'>('all');
    const [downloads, setDownloads] = useState<DownloadItem[]>([]);
    const [downloadedFiles, setDownloadedFiles] = useState<DownloadedItem[]>([]);

    useEffect(() => {
        if (!window.electron?.onDownloadUpdate) return;

        const unsubscribe = window.electron.onDownloadUpdate((data: { downloading: DownloadItem[], downloaded: DownloadedItem[] }) => {
            setDownloads(data.downloading || []);
            setDownloadedFiles(data.downloaded || []);
        });

        // Initial fetch
        window.electron.downloadStatus?.().then((result: { success: boolean; downloading?: DownloadItem[]; downloaded?: DownloadedItem[] }) => {
            if (result.success) {
                setDownloads(result.downloading || []);
                setDownloadedFiles(result.downloaded || []);
            }
        });

        return () => unsubscribe?.();
    }, []);

    const handlePause = async (jobId: string) => {
        await window.electron?.downloadPause?.(jobId);
    };

    const handleResume = async (jobId: string) => {
        await window.electron?.downloadResume?.(jobId);
    };

    const handleCancel = async (jobId: string) => {
        await window.electron?.downloadCancel?.(jobId);
    };

    const handleDelete = async (jobId: string) => {
        await window.electron?.downloadDelete?.(jobId);
    };

    // Re-download a file
    const handleRedownload = async (jobId: string) => {
        const file = downloadedFiles.find(f => f.jobId === jobId);
        if (!file?.fileUrl) {
            console.error('Cannot re-download: URL not found');
            return;
        }

        // Delete valid old file info if exists
        await window.electron?.downloadDelete?.(jobId);

        // Start fresh download
        await window.electron?.downloadStart?.(jobId, file.fileUrl, file.filename);

        // Switch to downloading tab
        setActiveTab('downloading');
    };

    const handleDownload = (jobId: string, url: string, filename: string) => {
        if (!url) return;
        window.electron?.downloadStart?.(jobId, url, filename);
        // Don't switch tab, just start
    };

    const handleDownloadAll = () => {
        const jobsToDownload = jobs.filter(job =>
            !downloadedFiles.some(f => f.jobId === job.id) &&
            !downloads.some(d => d.jobId === job.id)
        );

        jobsToDownload.forEach(job => {
            if (job.file_url) {
                window.electron?.downloadStart?.(job.id, job.file_url, job.filename);
            }
        });

        if (jobsToDownload.length > 0) {
            setActiveTab('downloading');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Downloads" maxWidth="max-w-md">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 -mx-6 px-6 mb-4">
                <button
                    className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${activeTab === 'downloading'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                    onClick={() => setActiveTab('downloading')}
                >
                    Downloading ({downloads.length})
                </button>
                <button
                    className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${activeTab === 'downloaded'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                    onClick={() => setActiveTab('downloaded')}
                >
                    Downloaded ({downloadedFiles.length})
                </button>
                <button
                    className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${activeTab === 'all'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                    onClick={() => setActiveTab('all')}
                >
                    All Files
                </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[350px] -mx-6 px-6">
                {activeTab === 'downloading' && (
                    downloads.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <Download className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No active downloads</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {downloads.map((item) => (
                                <div key={item.jobId} className="py-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                {item.filename}
                                            </span>
                                        </div>
                                        <div className="flex gap-1 ml-2">
                                            {item.status === 'downloading' && (
                                                <button
                                                    onClick={() => handlePause(item.jobId)}
                                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                                    title="Pause"
                                                >
                                                    <Pause className="w-4 h-4 text-gray-500" />
                                                </button>
                                            )}
                                            {item.status === 'paused' && (
                                                <button
                                                    onClick={() => handleResume(item.jobId)}
                                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                                    title="Resume"
                                                >
                                                    <Play className="w-4 h-4 text-green-500" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleCancel(item.jobId)}
                                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                                title="Cancel"
                                            >
                                                <X className="w-4 h-4 text-red-500" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                                        <div
                                            className={`h-2 rounded-full transition-all ${item.status === 'paused' ? 'bg-blue-300' : 'bg-blue-500'
                                                }`}
                                            style={{ width: `${item.progress}%` }}
                                        />
                                    </div>

                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>
                                            {item.progress}% • {formatBytes(item.loaded)} / {formatBytes(item.total)}
                                        </span>
                                        <span>
                                            {item.status === 'downloading' ? formatSpeed(item.speed) : item.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}

                {activeTab === 'downloaded' && (
                    downloadedFiles.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No downloaded files</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {downloadedFiles.map((item) => (
                                <div key={item.jobId} className="py-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                    {item.filename}
                                                </div>
                                                <div className="text-xs text-gray-500 flex items-center gap-2">
                                                    <span>{formatBytes(item.size)}</span>
                                                    <span>•</span>
                                                    <span>{formatTimeAgo(item.downloadedAt)}</span>
                                                    {item.printed && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="flex items-center gap-1 text-green-600">
                                                                <CheckCircle className="w-3 h-3" /> Printed
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 ml-2">
                                            <button
                                                onClick={() => handleRedownload(item.jobId)}
                                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                                title="Re-download"
                                            >
                                                <Download className="w-4 h-4 text-blue-500" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.jobId)}
                                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}

                {activeTab === 'all' && (
                    <div className="space-y-3">
                        {/* Sub-tabs for filtering */}
                        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            {(['all', 'pending', 'printed', 'cancelled'] as const).map((subTab) => (
                                <button
                                    key={subTab}
                                    onClick={() => setAllFilesSubTab(subTab)}
                                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${allFilesSubTab === subTab
                                        ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                        }`}
                                >
                                    {subTab}
                                </button>
                            ))}
                        </div>

                        {/* Header with count */}
                        <div className="flex items-center px-1">
                            <span className="text-xs text-gray-500 font-medium">
                                {jobs.filter(job =>
                                    allFilesSubTab === 'all' ? true :
                                        allFilesSubTab === 'printed' ? job.job_status === 'completed' :
                                            allFilesSubTab === 'cancelled' ? job.job_status === 'cancelled' :
                                                job.job_status === 'pending'
                                ).length} Files
                            </span>
                        </div>

                        {/* Job list */}
                        <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[280px] overflow-y-auto">
                            {jobs
                                .filter(job => {
                                    if (allFilesSubTab === 'all') return true;
                                    if (allFilesSubTab === 'printed') return job.job_status === 'completed';
                                    if (allFilesSubTab === 'cancelled') return job.job_status === 'cancelled';
                                    return job.job_status === 'pending';
                                })
                                .map((job) => {
                                    const isDownloaded = downloadedFiles.some(f => f.jobId === job.id);
                                    const isDownloading = downloads.some(d => d.jobId === job.id);

                                    return (
                                        <div key={job.id} className="py-3 flex items-center justify-between">
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDownloaded ? 'bg-green-100 text-green-600' :
                                                    isDownloading ? 'bg-blue-100 text-blue-600' :
                                                        'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    {isDownloaded ? <CheckCircle className="w-4 h-4" /> :
                                                        isDownloading ? <Download className="w-4 h-4" /> :
                                                            <FileText className="w-4 h-4" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                        {job.filename}
                                                    </div>
                                                    <div className="text-xs text-gray-500 flex items-center gap-2">
                                                        <span className="capitalize">{job.job_status}</span>
                                                        {isDownloaded && (
                                                            <span className="text-green-600 font-medium">• Downloaded</span>
                                                        )}
                                                        {isDownloading && (
                                                            <span className="text-blue-600 font-medium">• Downloading...</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {!isDownloaded && !isDownloading && (
                                                <button
                                                    onClick={() => handleDownload(job.id, job.file_url, job.filename)}
                                                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                                                    title="Download"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            )}
                                            {isDownloaded && (
                                                <button
                                                    onClick={() => handleRedownload(job.id)}
                                                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                                                    title="Re-download"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default DownloadManager;
