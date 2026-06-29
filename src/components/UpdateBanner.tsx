import React, { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, Check, AlertCircle, ArrowUpRight } from 'lucide-react';

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
  const [installing, setInstalling] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');

  useEffect(() => {
    if (window.electron?.getAppVersion) {
      window.electron.getAppVersion().then((res: any) => {
        if (res?.version) setAppVersion(res.version);
      }).catch(() => {});
    }
    
    if (window.electron?.getUpdateCompletedStatus) {
      window.electron.getUpdateCompletedStatus().then((completed: boolean) => {
        if (completed) {
          setState({ status: 'completed' });
          setTimeout(() => setState(prev => prev.status === 'completed' ? { status: 'idle' } : prev), 6000);
          window.electron.clearUpdateCompletedStatus?.();
        }
      }).catch(() => {});
    }
  }, []);

  const handleUpdaterEvent = useCallback((data: any) => {
    switch (data.event) {
      case 'checking':
        setState(prev => prev.status === 'downloaded' ? prev : { status: 'checking' });
        break;
      case 'available':
        setState(prev => prev.status === 'downloaded' ? prev : { status: 'available', version: data.version });
        break;
      case 'not-available':
        setState(prev => prev.status === 'downloaded' ? prev : { status: 'up-to-date', version: data.version });
        setTimeout(() => setState(prev => prev.status === 'up-to-date' ? { status: 'idle' } : prev), 4000);
        break;
      case 'progress':
        setState(prev => prev.status === 'downloaded' ? prev : {
          status: 'downloading',
          percent: data.percent,
          version: prev.status === 'available' ? (prev as any).version : undefined,
        });
        break;
      case 'downloaded':
        setState({ status: 'downloaded', version: data.version });
        break;
      case 'error':
        if (!data.message?.includes('net::ERR_') && !data.message?.includes('ENOTFOUND')) {
          setState(prev => prev.status === 'downloaded' ? prev : { status: 'error', message: data.message });
        }
        break;
    }
  }, []);

  useEffect(() => {
    if (!window.electron?.onUpdaterEvent) return;
    return window.electron.onUpdaterEvent(handleUpdaterEvent);
  }, [handleUpdaterEvent]);

  const handleInstall = async () => {
    if (!window.electron?.installUpdate) return;
    setInstalling(true);
    await window.electron.installUpdate();
  };

  const handleManualCheck = () => {
    if (!window.electron?.checkForUpdates) return;
    setState({ status: 'checking' });
    window.electron.checkForUpdates().catch(() => {});
  };

  // Minimized state when sidebar is collapsed
  if (!isOpen) {
    let Icon = RefreshCw;
    let color = "text-gray-400";
    if (state.status === 'checking' || state.status === 'downloading') {
      Icon = RefreshCw; color = "text-blue-500";
    } else if (state.status === 'available') {
      Icon = Download; color = "text-blue-500";
    } else if (state.status === 'downloaded') {
      Icon = ArrowUpRight; color = "text-emerald-500";
    } else if (state.status === 'error') {
      Icon = AlertCircle; color = "text-red-500";
    }

    return (
      <button 
        onClick={state.status === 'downloaded' ? handleInstall : handleManualCheck} 
        className="flex justify-center items-center w-10 h-10 mx-auto hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
        title="App Updates"
      >
        <Icon className={`h-5 w-5 ${color} ${state.status === 'checking' ? 'animate-spin' : ''}`} />
      </button>
    );
  }

  // Expanded sidebar state
  return (
    <div className="flex flex-col gap-2 w-full p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.2)] transition-all duration-300">
      {state.status === 'idle' && (
        <div className="flex items-center justify-between group cursor-pointer" onClick={handleManualCheck}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-xl group-hover:bg-gray-100 dark:group-hover:bg-gray-700 transition-colors">
              <RefreshCw className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </div>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">App Updates</span>
          </div>
          <span className="text-[10px] font-medium text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-md">v{appVersion}</span>
        </div>
      )}

      {state.status === 'checking' && (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
          </div>
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Checking...</span>
        </div>
      )}

      {(state.status === 'available' || state.status === 'downloading') && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <Download className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Downloading</span>
            </div>
            {state.status === 'downloading' && (
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{state.percent}%</span>
            )}
          </div>
          {state.status === 'downloading' && (
            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${state.percent}%` }}
              />
            </div>
          )}
        </div>
      )}

      {state.status === 'downloaded' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
              <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">Update Ready</span>
              <span className="text-[10px] font-medium text-emerald-600/80 dark:text-emerald-400/80">Version {state.version}</span>
            </div>
          </div>
          <button
            onClick={handleInstall}
            disabled={installing}
            className="w-full py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400 text-white rounded-xl shadow-[0_2px_8px_rgba(16,185,129,0.25)] transition-all flex items-center justify-center gap-2"
          >
            {installing ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Install & Restart'}
          </button>
        </div>
      )}

      {state.status === 'up-to-date' && (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">You're up to date</span>
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-xs font-semibold text-red-700 dark:text-red-400">Update failed</span>
          </div>
          <button 
            onClick={handleManualCheck}
            className="text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 px-2 py-1.5 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default UpdateBanner;
