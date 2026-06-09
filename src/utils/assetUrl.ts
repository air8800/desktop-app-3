import notificationIconUrl from '/icon.png?url';

/**
 * Resolve a public asset URL that works with file:// and hash routes (#/settings).
 */
export function assetUrl(relativePath: string): string {
  const clean = relativePath.replace(/^\//, '');
  if (typeof window === 'undefined') {
    return `./${clean}`;
  }
  const documentUrl = window.location.href.split('#')[0];
  return new URL(clean, documentUrl).href;
}

/** Bundled by Vite — always correct in Electron production builds. */
export const NOTIFICATION_ICON_URL = notificationIconUrl;
