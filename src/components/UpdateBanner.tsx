import React, { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, CheckCircle, AlertCircle, X, Zap } from 'lucide-react';

type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; version: string }
  | { status: 'downloading'; percent: number; version?: string }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string }
  | { status: 'up-to-date'; version: string }
  | { status: 'completed' };

interface UpdateBannerProps {
  isOpen?: boolean;
}

const UpdateBanner: React.FC<UpdateBannerProps> = ({ isOpen = true }) => {
  const [state, setState] = useState<UpdateState>({ status: 'idle' });
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');
  const [shrinkReadyState, setShrinkReadyState] = useState(false);

  // Fetch current app version on mount and check if we just updated
  useEffect(() => {
    if (window.electron?.getAppVersion) {
      window.electron.getAppVersion().then((res: any) => {
        if (res?.version) setAppVersion(res.version);
      }).catch(() => {});
    }
    
    // Check if we just completed an update
    if (window.electron?.getUpdateCompletedStatus) {
      window.electron.getUpdateCompletedStatus().then((completed: boolean) => {
        if (completed) {
          setState({ status: 'completed' });
          setDismissed(false);
          // Hide it automatically after a few seconds
          setTimeout(() => setState(prev => prev.status === 'completed' ? { status: 'idle' } : prev), 6000);
          window.electron.clearUpdateCompletedStatus?.();
        }
      }).catch(() => {});
    }
  }, []);

  const handleUpdaterEvent = useCallback((data: any) => {
    switch (data.event) {
      case 'checking':
        setState(prev => {
          // Don't overwrite a 'downloaded' state with 'checking'
          if (prev.status === 'downloaded') return prev;
          return { status: 'checking' };
        });
        setDismissed(false);
        break;
      case 'available':
        setState(prev => {
          if (prev.status === 'downloaded') return prev;
          return { status: 'available', version: data.version };
        });
        setDismissed(false);
        break;
      case 'not-available':
        // Only show "up to date" briefly if user manually checked
        setState(prev => {
          if (prev.status === 'downloaded') return prev;
          return { status: 'up-to-date', version: data.version };
        });
        setTimeout(() => setState(prev => prev.status === 'up-to-date' ? { status: 'idle' } : prev), 4000);
        break;
      case 'progress':
        setState(prev => {
          if (prev.status === 'downloaded') return prev;
          return {
            status: 'downloading',
            percent: data.percent,
            version: prev.status === 'available' ? (prev as any).version : undefined,
          };
        });
        setDismissed(false);
        break;
      case 'downloaded':
        setState({ status: 'downloaded', version: data.version });
        setShrinkReadyState(false);
        setDismissed(false);
        setTimeout(() => setShrinkReadyState(true), 8000);
        break;
      case 'error':
        // Don't show trivial network errors — only show if meaningful
        // Also don't overwrite a 'downloaded' state with an error
        if (
          !data.message?.includes('net::ERR_') &&
          !data.message?.includes('ENOTFOUND')
        ) {
          setState(prev => {
            if (prev.status === 'downloaded') return prev;
            return { status: 'error', message: data.message };
          });
        }
        break;
    }
  }, []);

  useEffect(() => {
    if (!window.electron?.onUpdaterEvent) return;
    const unsub = window.electron.onUpdaterEvent(handleUpdaterEvent);
    return unsub;
  }, [handleUpdaterEvent]);

  const handleInstall = async () => {
    if (!window.electron?.installUpdate) return;
    setInstalling(true);
    await window.electron.installUpdate();
  };

  const handleManualCheck = () => {
    if (!window.electron?.checkForUpdates) return;
    setDismissed(false);
    setState({ status: 'checking' });
    window.electron.checkForUpdates().catch(() => {});
  };

  // Remove early return to show the permanent check button

  const renderContent = () => {
    switch (state.status) {
      case 'idle':
        return (
          <button 
            onClick={handleManualCheck}
            className={`flex items-center gap-2 w-full text-left group ${!isOpen && 'justify-center'}`}
            title="Check for updates"
          >
            <RefreshCw className="h-4 w-4 text-gray-500 group-hover:text-gray-300 transition-colors" />
            {isOpen && <span className="text-xs font-medium text-gray-500 group-hover:text-gray-300 transition-colors">Check for updates</span>}
          </button>
        );
      case 'checking':
        return (
          <div className="flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-400" />
            <span className="text-xs font-medium text-gray-300">Checking for updates...</span>
          </div>
        );

      case 'available':
        return (
          <div className="flex items-center justify-center w-5 h-5" title="Downloading update...">
            <Download className="h-4 w-4 text-blue-400 animate-bounce" />
          </div>
        );

      case 'downloading':
        return (
          <div className="flex items-center justify-center relative w-5 h-5" title={`Downloading update... ${state.percent}%`}>
             <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
               <path
                 className="text-gray-700"
                 stroke="currentColor"
                 strokeWidth="3"
                 fill="none"
                 d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
               />
               <path
                 className="text-blue-500 transition-all duration-300"
                 strokeDasharray={`${state.percent}, 100`}
                 stroke="currentColor"
                 strokeWidth="3"
                 fill="none"
                 d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
               />
             </svg>
             <Download className="absolute inset-0 m-auto h-2.5 w-2.5 text-blue-400" />
          </div>
        );

      case 'downloaded':
        if (shrinkReadyState) {
          return (
            <div 
              className="flex items-center justify-center w-5 h-5 cursor-pointer" 
              title="Update ready to install. Click to expand."
              onClick={() => setShrinkReadyState(false)}
            >
              <Zap className="h-4 w-4 text-emerald-400 animate-pulse" />
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-gray-200">
              <span className="text-emerald-300 font-semibold">v{state.version}</span> ready to install
            </span>
            <button
              onClick={handleInstall}
              disabled={installing}
              className="ml-1 px-2.5 py-1 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-700 text-white rounded-md transition-all duration-150 shadow-sm flex items-center gap-1"
            >
              {installing ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Restarting...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3" />
                  Restart to install update
                </>
              )}
            </button>
          </div>
        );

      case 'completed':
        return (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-100">
              Update completed successfully! You are now on v{appVersion}
            </span>
          </div>
        );

      case 'up-to-date':
        return (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-gray-300">
              You're up to date <span className="text-emerald-300">v{state.version}</span>
            </span>
          </div>
        );

      case 'error':
        return (
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-xs font-medium text-red-200">
              Update failed. <button onClick={handleManualCheck} className="underline text-red-300 hover:text-red-200">Retry</button>
            </span>
          </div>
        );

      default:
        return null;
    }
  };

  const isDismissable = state.status !== 'downloading' && state.status !== 'checking';
  const isImportant = state.status === 'downloaded';

  const isDownloading = state.status === 'available' || state.status === 'downloading';
  const isShrunk = isDownloading || (state.status === 'downloaded' && shrinkReadyState);

  return (
    <div
      className={`
        flex items-center gap-2 text-sm
        border transition-all duration-300 select-none
        ${isImportant && !shrinkReadyState
          ? 'bg-emerald-950/80 border-emerald-700/60 shadow-[0_0_12px_rgba(16,185,129,0.15)] px-3 py-1.5 rounded-lg'
          : isShrunk
          ? 'bg-gray-900/80 border-gray-700/50 p-1.5 rounded-full aspect-square justify-center mx-auto'
          : state.status === 'idle'
          ? 'bg-transparent border-transparent px-2 py-1.5 hover:bg-gray-800/50 rounded-lg w-full'
          : 'bg-gray-900/80 border-gray-700/50 px-3 py-1.5 rounded-lg w-full'
        }
        backdrop-blur-sm
      `}
    >
      {renderContent()}

      {/* Dismiss button */}
      {isDismissable && state.status !== 'up-to-date' && state.status !== 'idle' && (
        <button
          onClick={() => {
            setDismissed(true);
            setState({ status: 'idle' });
          }}
          className="ml-auto p-0.5 rounded text-gray-500 hover:text-gray-300 transition-colors"
          title="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

export default UpdateBanner;
