export type DayTiming = { open: string; close: string; closed: boolean };

export type ShopTiming = {
  monday: DayTiming;
  tuesday: DayTiming;
  wednesday: DayTiming;
  thursday: DayTiming;
  friday: DayTiming;
  saturday: DayTiming;
  sunday: DayTiming;
};

const OPEN_DAY: DayTiming = { open: '09:00', close: '21:00', closed: false };

/** Default: every day 9 AM – 9 PM, no weekly off days. Partners can change in Settings. */
export const DEFAULT_SHOP_TIMING: ShopTiming = {
  monday: { ...OPEN_DAY },
  tuesday: { ...OPEN_DAY },
  wednesday: { ...OPEN_DAY },
  thursday: { ...OPEN_DAY },
  friday: { ...OPEN_DAY },
  saturday: { ...OPEN_DAY },
  sunday: { ...OPEN_DAY },
};
