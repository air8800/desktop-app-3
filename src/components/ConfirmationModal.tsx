import React from 'react';
import Modal from './Modal';
import { AlertTriangle, Trash2, Check, X, AlertOctagon } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'delete' | 'warning' | 'cancel' | 'info';
  isProcessing?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  isProcessing = false
}) => {
  const getIcon = () => {
    switch (type) {
      case 'delete':
        return <Trash2 className="h-10 w-10 text-red-500 dark:text-red-400" />;
      case 'cancel':
        return <AlertOctagon className="h-10 w-10 text-orange-500 dark:text-orange-400" />;
      case 'info':
        return <Check className="h-10 w-10 text-blue-500 dark:text-blue-400" />;
      default:
        return <AlertTriangle className="h-10 w-10 text-yellow-500 dark:text-yellow-400" />;
    }
  };
  
  const getButtonColor = () => {
    switch (type) {
      case 'delete':
        return 'bg-red-600 hover:bg-red-700 text-white';
      case 'cancel':
        return 'bg-orange-600 hover:bg-orange-700 text-white';
      case 'info':
        return 'bg-blue-600 hover:bg-blue-700 text-white';
      default:
        return 'bg-yellow-600 hover:bg-yellow-700 text-white';
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
          {getIcon()}
        </div>
        
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {message}
        </p>
        
        <div className="flex justify-center gap-4">
          <button
            type="button"
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            onClick={onClose}
            disabled={isProcessing}
          >
            <X className="h-4 w-4 inline mr-1" />
            {cancelText}
          </button>
          
          <button
            type="button"
            className={`px-4 py-2 ${getButtonColor()} rounded-lg transition-colors flex items-center justify-center min-w-[100px] ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                {type === 'delete' && <Trash2 className="h-4 w-4 inline mr-1" />}
                {type === 'cancel' && <AlertOctagon className="h-4 w-4 inline mr-1" />}
                {type === 'info' && <Check className="h-4 w-4 inline mr-1" />}
                {type === 'warning' && <AlertTriangle className="h-4 w-4 inline mr-1" />}
                {confirmText}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;