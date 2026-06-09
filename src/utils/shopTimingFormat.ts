import { DEFAULT_SHOP_TIMING, type ShopTiming } from './defaultShopHours';

const DAY_LABELS: Record<keyof ShopTiming, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

/** Legacy QR screen stored timing as an array — normalize to Settings shape. */
function fromLegacyArray(raw: unknown[]): ShopTiming {
  const base = { ...DEFAULT_SHOP_TIMING };
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const dayKey = String(row.day || '')
      .toLowerCase()
      .slice(0, 3) as keyof ShopTiming | string;
    const map: Record<string, keyof ShopTiming> = {
      mon: 'monday',
      tue: 'tuesday',
      wed: 'wednesday',
      thu: 'thursday',
      fri: 'friday',
      sat: 'saturday',
      sun: 'sunday',
      monday: 'monday',
      tuesday: 'tuesday',
      wednesday: 'wednesday',
      thursday: 'thursday',
      friday: 'friday',
      saturday: 'saturday',
      sunday: 'sunday',
    };
    const key = map[dayKey] || map[String(row.day || '').toLowerCase()];
    if (!key) continue;
    const isOpen = row.isOpen === true || row.closed === false;
    base[key] = {
      open: String(row.openTime ?? row.open ?? '09:00'),
      close: String(row.closeTime ?? row.close ?? '21:00'),
      closed: !isOpen,
    };
  }
  return base;
}

export function parseShopTimingFromStorage(raw: string | null): ShopTiming {
  if (!raw) return { ...DEFAULT_SHOP_TIMING };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return fromLegacyArray(parsed);
    }
    if (parsed && typeof parsed === 'object') {
      return { ...DEFAULT_SHOP_TIMING, ...(parsed as ShopTiming) };
    }
  } catch {
    /* ignore corrupt localStorage */
  }
  return { ...DEFAULT_SHOP_TIMING };
}

export function hasOpenShopDay(timing: ShopTiming): boolean {
  return (Object.keys(DAY_LABELS) as (keyof ShopTiming)[]).some((day) => !timing[day]?.closed);
}

export function formatShopTimingSummary(timing: ShopTiming): string {
  const open = (Object.keys(DAY_LABELS) as (keyof ShopTiming)[])
    .filter((day) => !timing[day]?.closed)
    .map((day) => {
      const slot = timing[day];
      return `${DAY_LABELS[day]}: ${slot.open} – ${slot.close}`;
    });

  if (open.length === 0) return 'Closed all days';
  if (open.length <= 3) return open.join(', ');
  return `${open.length} days open (see Settings for hours)`;
}
