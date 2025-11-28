import React from 'react';
import { Printer } from '../types';
import { Printer as PrinterIcon, Check, AlertCircle } from 'lucide-react';

interface PrinterListProps {
  printers: Printer[];
  isLoading: boolean;
  onRefresh: () => void;
}

const PrinterList: React.FC<PrinterListProps> = ({ printers, isLoading, onRefresh }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Connected Printers</h2>
        <button 
          onClick={onRefresh}
          disabled={isLoading}
          className={`px-4 py-2 rounded-md transition-colors ${
            isLoading 
              ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isLoading ? 'Scanning...' : 'Refresh Printers'}
        </button>
      </div>

      {printers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {printers.map((printer, index) => (
            <div 
              key={index}
              className={`${
                printer.default 
                  ? 'border-blue-500 dark:border-blue-600' 
                  : 'border-gray-200 dark:border-gray-700'
              } border-2 rounded-lg p-4 relative transition-all hover:shadow-md`}
            >
              {printer.default && (
                <span className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                  Default
                </span>
              )}
              <div className="flex items-center mb-2">
                <PrinterIcon className="h-8 w-8 text-blue-600 dark:text-blue-400 mr-2" />
                <h3 className="text-lg font-semibold">{printer.name}</h3>
              </div>
              <div className="flex items-center mt-2">
                <span className={`flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  printer.status === 'Ready'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                }`}>
                  {printer.status === 'Ready' ? (
                    <Check className="h-3 w-3 mr-1" />
                  ) : (
                    <AlertCircle className="h-3 w-3 mr-1" />
                  )}
                  {printer.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          {isLoading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p>Scanning for printers...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <PrinterIcon className="h-12 w-12 mb-4 text-gray-400" />
              <p>No printers found. Click "Refresh Printers" to scan again.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PrinterList;