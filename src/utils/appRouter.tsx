import { HashRouter, BrowserRouter } from 'react-router-dom';

/** Desktop app always uses hash routes (dev server + file:// production). */
export const isDesktopApp =
  typeof window !== 'undefined' &&
  (Boolean(window.electron) || window.location.protocol === 'file:');

export const AppRouter = isDesktopApp ? HashRouter : BrowserRouter;

export function resetAppRoute(path = '/') {
  if (!isDesktopApp) return;
  const target = path.startsWith('/') ? path : `/${path}`;
  const next = `#${target}`;
  if (window.location.hash !== next) {
    window.location.hash = next;
  }
}
