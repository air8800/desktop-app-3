import React from 'react';
import { Printer } from '../types';
import { Printer as PrinterIcon, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface PrinterListProps {
  printers: Printer[];
  isLoading: boolean;
  onRefresh: () => void;
}

const PrinterList: React.FC<PrinterListProps> = ({ printers, isLoading, onRefresh }) => {
  return (
    <div className="card p-6 shadow-large">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Connected printers</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Printers detected on this computer for PrintGet jobs
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="btn-primary disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Scanning…' : 'Refresh list'}
        </button>
      </div>

      {printers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {printers.map((printer, index) => (
            <div
              key={`${printer.name}-${index}`}
              className={`relative rounded-xl border p-4 transition-shadow hover:shadow-md ${
                printer.default
                  ? 'border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
              }`}
            >
              {printer.default && (
                <span className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                  Default
                </span>
              )}
              <div className="flex items-start gap-3 pr-16">
                <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shrink-0">
                  <PrinterIcon className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate" title={printer.name}>
                    {printer.name}
                  </h3>
                  <span
                    className={`inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      printer.status === 'Ready'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}
                  >
                    {printer.status === 'Ready' ? (
                      <Check className="h-3 w-3 mr-1 shrink-0" />
                    ) : (
                      <AlertCircle className="h-3 w-3 mr-1 shrink-0" />
                    )}
                    {printer.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
          {isLoading ? (
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="font-medium text-gray-700 dark:text-gray-300">Scanning for printers…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <PrinterIcon className="h-12 w-12 mb-3 text-gray-300 dark:text-gray-600" />
              <p className="font-medium text-gray-700 dark:text-gray-300">No printers found</p>
              <p className="text-sm mt-1 max-w-sm">Connect a printer to this PC, then tap Refresh list.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PrinterList;
