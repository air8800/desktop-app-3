import { supabase } from './supabase';

/**
 * Tell the website whether this shop is live right now.
 * When the desktop app is open we set true; when it closes or logs out we set false.
 * This overrides scheduled hours for customer-facing open/closed status.
 */
export async function setShopDesktopLive(
  shopId: string,
  isLive: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!shopId) return { success: false, error: 'No shop ID' };

  try {
    const { error } = await supabase
      .from('shops')
      .update({
        desktop_live: isLive,
        desktop_live_at: new Date().toISOString(),
      })
      .eq('id', shopId);

    if (error) {
      console.error('[shopLive] update failed:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[shopLive] update failed:', message);
    return { success: false, error: message };
  }
}
