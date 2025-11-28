// Types for the application

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
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  total_cost: number;
  payment_status: 'pending' | 'paid' | 'failed';
  job_status: 'pending' | 'printing' | 'completed' | 'cancelled';
  notes?: string;
  estimated_completion?: string;
  created_at: string;
  updated_at: string;
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