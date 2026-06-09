import React from 'react';
import { Download, Pause } from 'lucide-react';

interface DownloadIndicatorProps {
    status: 'idle' | 'downloading' | 'paused' | 'completed' | 'error';
    progress: number;
    onClick: (e: React.MouseEvent) => void;
}

const DownloadIndicator: React.FC<DownloadIndicatorProps> = ({ status, progress, onClick }) => {
    const size = 28; // Smaller size for "close to symbol"
    const strokeWidth = 2;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;

    const getStatusColor = () => {
        switch (status) {
            case 'downloading': return 'text-blue-500';
            case 'paused': return 'text-blue-400';
            case 'completed': return 'text-blue-600';
            case 'error': return 'text-red-500';
            default: return 'text-gray-400';
        }
    };

    const getIcon = () => {
        switch (status) {
            case 'downloading':
                return <Download className="w-4 h-4" />;
            case 'paused':
                return <Pause className="w-4 h-4" />;
            case 'completed':
                return <Download className="w-4 h-4" />;
            default:
                return <Download className="w-4 h-4" />;
        }
    };

    // Show circle ONLY for downloading and paused states
    const showCircle = status === 'downloading' || status === 'paused';
    const circleProgress = status === 'completed' ? 100 : progress;
    const circleOffset = circumference - (circleProgress / 100) * circumference;

    return (
        <button
            onClick={onClick}
            className={`relative flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${getStatusColor()}`}
            style={{ width: size, height: size }}
            title={status === 'completed' ? 'Downloaded ✓' : status === 'downloading' ? `Downloading ${progress}%` : 'Click to manage downloads'}
        >
            {showCircle && (
                <svg
                    className="absolute -rotate-90"
                    width={size}
                    height={size}
                    style={{ left: 0, top: 0 }}
                >
                    {/* Background circle */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        opacity={0.2}
                    />
                    {/* Progress circle */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={circleOffset}
                        strokeLinecap="round"
                        className="transition-all duration-300"
                    />
                </svg>
            )}
            <div className="relative z-10">
                {getIcon()}
            </div>
        </button>
    );
};

export default DownloadIndicator;
