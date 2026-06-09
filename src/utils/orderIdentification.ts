import type { PrintJob } from '../types';

export function getPickupOrderNumber(job: Pick<PrintJob, 'shop_order_number' | 'id'>): string {
  if (job.shop_order_number != null && job.shop_order_number > 0) {
    return String(job.shop_order_number);
  }
  return job.id.slice(0, 8);
}

export function formatPickupOrderLabel(job: Pick<PrintJob, 'shop_order_number' | 'id'>): string {
  return `ID - ${getPickupOrderNumber(job)}`;
}

export function getJobDisplayLabel(job: Pick<PrintJob, 'shop_order_number' | 'id' | 'customer_name'>): string {
  return formatPickupOrderLabel(job);
}

export function jobMatchesSearch(
  job: Pick<PrintJob, 'shop_order_number' | 'id' | 'customer_name' | 'filename' | 'customer_phone'>,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const label = formatPickupOrderLabel(job).toLowerCase();
  const orderNumber = job.shop_order_number != null ? String(job.shop_order_number) : '';
  const shortId = job.id.slice(0, 8).toLowerCase();

  return (
    label.includes(q) ||
    orderNumber.includes(q) ||
    shortId.includes(q) ||
    job.filename?.toLowerCase().includes(q) ||
    job.customer_name?.toLowerCase().includes(q) ||
    job.customer_phone?.toLowerCase().includes(q)
  );
}

export type SlipBrandingPayload = {
  shopName: string;
  shopWebUrl: string;
  qrImageUrl?: string | null;
};

export type OrderMarkPayload = {
  shopOrderNumber?: number | null;
  orderIdentification?: 'ON_PAGE' | 'SEPARATE_SLIP' | string | null;
  orderUuid?: string;
  /** Used on SEPARATE_SLIP first page: shop name, web URL, optional shop QR image URL */
  slipBranding?: SlipBrandingPayload | null;
};

function readSlipBrandingFromBrowserStorage(): SlipBrandingPayload | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const shopId = localStorage.getItem('shop-id');
  if (!shopId) return null;

  let shopName = 'Shop';
  let qrImageUrl: string | undefined;
  try {
    const raw = localStorage.getItem('shop-info');
    if (raw) {
      const j = JSON.parse(raw) as { name?: string; qr_code_url?: string };
      if (j.name?.trim()) shopName = j.name.trim();
      if (j.qr_code_url?.trim()) qrImageUrl = j.qr_code_url.trim();
    }
  } catch {
    /* ignore */
  }

  const base =
    (import.meta.env.VITE_PRINTGET_API_URL as string | undefined)?.replace(/\/$/, '') || 'https://printget.in';

  return {
    shopName,
    shopWebUrl: `${base}/shop/${shopId}`,
    qrImageUrl: qrImageUrl || undefined,
  };
}

export function buildOrderMarkPayload(job: Pick<PrintJob, 'shop_order_number' | 'order_identification' | 'id'>): OrderMarkPayload {
  const orderIdentification =
    (job.order_identification as OrderMarkPayload['orderIdentification']) || 'ON_PAGE';
  return {
    shopOrderNumber: job.shop_order_number ?? null,
    orderIdentification,
    orderUuid: job.id,
    slipBranding:
      orderIdentification === 'SEPARATE_SLIP'
        ? readSlipBrandingFromBrowserStorage() ?? { shopName: 'Shop', shopWebUrl: '' }
        : undefined,
  };
}
