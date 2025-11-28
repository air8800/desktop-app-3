import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Trash2, Eye, Download, FileText, Printer, AlertOctagon, Copy, Share2, ExternalLink, Check } from 'lucide-react';

interface ActionItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
}

interface ActionMenuProps {
  items: ActionItem[];
  position?: 'left' | 'right';
}

const ActionMenu: React.FC<ActionMenuProps> = ({ 
  items,
  position = 'right'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };
  
  const handleItemClick = (e: React.MouseEvent, onClick: () => void) => {
    e.stopPropagation();
    onClick();
    setIsOpen(false);
  };
  
  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        aria-label="More options"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      
      {isOpen && (
        <div 
          className={`fixed z-[1000] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 w-[180px] animate-scale-in`}
          style={{
            top: buttonRef.current ? buttonRef.current.getBoundingClientRect().bottom + 5 : 0,
            left: position === 'right' 
              ? (buttonRef.current ? buttonRef.current.getBoundingClientRect().right - 180 : 0)
              : (buttonRef.current ? buttonRef.current.getBoundingClientRect().left : 0),
            transformOrigin: position === 'right' ? 'top right' : 'top left'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, index) => (
            <button
              key={index}
              onClick={(e) => handleItemClick(e, item.onClick)}
              disabled={item.disabled}
              className={`w-full text-left px-4 py-2 flex items-center ${item.color || 'text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="mr-3 flex-shrink-0">{item.icon}</span>
              <span className="text-sm font-medium truncate-1-line">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Predefined action menu items
export const createViewDetailsAction = (onView: () => void): ActionItem => ({
  icon: <Eye className="h-4 w-4" />,
  label: 'View Details',
  onClick: onView
});

export const createDeleteAction = (onDelete: () => void): ActionItem => ({
  icon: <Trash2 className="h-4 w-4" />,
  label: 'Delete Job',
  onClick: onDelete,
  color: 'text-red-600 dark:text-red-400'
});

export const createDownloadAction = (onDownload: () => void): ActionItem => ({
  icon: <Download className="h-4 w-4" />,
  label: 'Download File',
  onClick: onDownload
});

export const createPrintAction = (onPrint: () => void): ActionItem => ({
  icon: <Printer className="h-4 w-4" />,
  label: 'Print Now',
  onClick: onPrint
});

export const createPreviewAction = (onPreview: () => void, isPdf: boolean): ActionItem => ({
  icon: <FileText className="h-4 w-4" />,
  label: isPdf ? 'Preview PDF' : 'View File',
  onClick: onPreview
});

export const createCancelAction = (onCancel: () => void): ActionItem => ({
  icon: <AlertOctagon className="h-4 w-4" />,
  label: 'Cancel Job',
  onClick: onCancel,
  color: 'text-orange-600 dark:text-orange-400'
});

export const createCopyAction = (onCopy: () => void, label: string = 'Copy Details'): ActionItem => ({
  icon: <Copy className="h-4 w-4" />,
  label,
  onClick: onCopy
});

export const createShareAction = (onShare: () => void): ActionItem => ({
  icon: <Share2 className="h-4 w-4" />,
  label: 'Share Job',
  onClick: onShare
});

export const createOpenFileAction = (onOpen: () => void): ActionItem => ({
  icon: <ExternalLink className="h-4 w-4" />,
  label: 'Open File',
  onClick: onOpen
});

export const createMarkCompletedAction = (onComplete: () => void): ActionItem => ({
  icon: <Check className="h-4 w-4" />,
  label: 'Mark Completed',
  onClick: onComplete,
  color: 'text-green-600 dark:text-green-400'
});

export default ActionMenu;