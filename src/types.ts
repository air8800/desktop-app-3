// Types for the application

// Recipe types for PDF transformations from web app
export interface RecipeTransforms {
  crop: { x: number; y: number; width: number; height: number } | null;
  rotation: 0 | 90 | 180 | 270;
  scale: number; // percentage (100 = 100%)
  offsetX?: number;
  offsetY?: number;
}

export interface RecipePage {
  pageNumber: number; // 1-indexed
  originalDimensions: { width: number; height: number };
  transforms: RecipeTransforms;
  hasEdits: boolean;
  isCropped: boolean;
  fitCropToPage: boolean;
}

export interface Recipe {
  version: string;
  type: string;
  generatedAt: string;
  source: {
    fileName: string;
    fileSize: number;
    totalPages: number;
  };
  print: {
    paperSize: string;
    colorMode: 'color' | 'BW';
    duplex: boolean;
    copies: number;
    pagesPerSheet: 1 | 2;
    quality: string;
  };
  pages: RecipePage[];
  destination: { shopId: string | null };
}

// Print job type - Updated to match Supabase database schema
export interface PrintJob {
  id: string;
  shop_id: string;
  filename: string;
  file_url: string;
  copies: number;
  paper_size: string;
  color_mode: 'Color' | 'BW';
  print_type: 'Single' | 'Double';
  pages_per_sheet: number;
  nup_orientation: 'portrait' | 'landscape';
  customer_name?: string | null;
  customer_email?: string;
  customer_phone?: string;
  shop_order_number?: number | null;
  order_identification?: 'ON_PAGE' | 'SEPARATE_SLIP' | string | null;
  total_cost: number;
  payment_status: 'pending' | 'paid' | 'failed';
  job_status: 'pending' | 'printing' | 'completed' | 'cancelled';
  notes?: string;
  estimated_completion?: string;
  created_at: string;
  updated_at: string;
  // Recipe-based processing fields
  has_edits?: boolean;
  recipe?: Recipe | null;
  total_pages?: number;
  selected_pages?: number[];
  // Processed file URL (after recipe applied)
  processed_file_url?: string; // Data URL for preview
  processed_file_path?: string; // Local path for printing in main process

  // History fields
  processing_time_seconds?: number;
  completed_at?: string;
}

// Printer type
export interface Printer {
  name: string;
  status: string;
  default: boolean;
  supportedSizes?: PaperSize[];
  supportsColor?: boolean;
}

// Paper size type
export type PaperSize = 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal' | 'Executive';

// Printer configuration for a paper size
export interface PrinterConfigItem {
  paperSize: PaperSize;
  printers: string[]; // Array of printer names in priority order
}

// Cost tier for bulk pricing
export interface CostTier {
  id: string;
  minQuantity: number;
  maxQuantity: number | null; // null means unlimited
  pricePerPage: number;
  name: string;
}

// Cost configuration for a paper size
export interface CostConfigItem {
  paperSize: PaperSize;
  colorMode: 'Color' | 'BW';
  printType: 'Single' | 'Double';
  basePricePerPage: number;
  tiers: CostTier[];
}

// Settings type
export interface Settings {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopEmail: string;
  paymentQR: string | null;
  darkMode: boolean;
  printerConfigs: PrinterConfigItem[];
  costConfigs: CostConfigItem[];
}

// Filter type
export interface JobFilters {
  status: string;
  paymentStatus: string;
  searchQuery: string;
}

// Print Status
export interface PrintStatus {
  jobId: string;
  printer: string;
  status: 'Printing' | 'Completed' | 'Failed' | 'Stuck';
  startTime: number;
  error?: string;
}