import React, { useState } from 'react';
import { ExternalLink, Link2, MapPin } from 'lucide-react';
import type { OnboardingData } from '../../../utils/auth';
import {
  generateGoogleMapsLinkFromAddress,
  extractAddressFromMapsLink,
  extractAllFromMapsLink,
  detectCurrentLocationFull,
  getExpandUrlFn,
  extractGoogleMapsUrlFromText,
} from '../../../utils/locationHelpers';

interface ShopLocationStepProps {
  data: OnboardingData;
  onChange: (patch: Partial<OnboardingData>) => void;
}

const actionBtn =
  'text-xs font-medium py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-blue-300 hover:text-blue-700 dark:hover:text-blue-400 disabled:opacity-50 transition-colors';

const ShopLocationStep: React.FC<ShopLocationStepProps> = ({ data, onChange }) => {
  const [isExtractingAddress, setIsExtractingAddress] = useState(false);
  const [isExtractingAll, setIsExtractingAll] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const expandUrl = getExpandUrlFn();

  const showStatus = (message: string, type: 'success' | 'error' = 'success') => {
    setStatus({ type, message });
  };

  const handleGenerateLink = () => {
    if (!data.address.trim()) {
      showStatus('Enter an address first', 'error');
      return;
    }
    onChange({ googleMapsLink: generateGoogleMapsLinkFromAddress(data.address) });
    showStatus('Google Maps link generated');
  };

  const runExtractAll = async (link: string) => {
    setIsExtractingAll(true);
    setStatus(null);
    try {
      const patch = await extractAllFromMapsLink(link, expandUrl);
      onChange({ googleMapsLink: link, ...patch });
      showStatus(
        patch.address && patch.latitude
          ? 'Address and coordinates filled from link'
          : patch.address
            ? 'Address filled — check coordinates'
            : 'Coordinates filled — check address'
      );
    } catch (e) {
      showStatus(e instanceof Error ? e.message : 'Extraction failed', 'error');
    } finally {
      setIsExtractingAll(false);
    }
  };

  const handleExtractAddress = async () => {
    if (!data.googleMapsLink) return;
    setIsExtractingAddress(true);
    setStatus(null);
    try {
      const address = await extractAddressFromMapsLink(data.googleMapsLink, expandUrl);
      onChange({ address });
      showStatus('Address extracted');
    } catch (e) {
      showStatus(e instanceof Error ? e.message : 'Extraction failed', 'error');
    } finally {
      setIsExtractingAddress(false);
    }
  };

  const handleExtractAll = () => {
    if (!data.googleMapsLink) return;
    void runExtractAll(data.googleMapsLink);
  };

  const handleMapsLinkPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    const link = extractGoogleMapsUrlFromText(pasted);
    if (!link) return;

    e.preventDefault();
    onChange({ googleMapsLink: link });
    void runExtractAll(link);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const link = extractGoogleMapsUrlFromText(text);
      if (!link) {
        showStatus(
          'Clipboard has no Google Maps link. Copy a maps.app.goo.gl or google.com/maps link first.',
          'error'
        );
        return;
      }
      onChange({ googleMapsLink: link });
      void runExtractAll(link);
    } catch {
      showStatus('Could not read clipboard. Paste the link manually with Ctrl+V.', 'error');
    }
  };

  const handleGetFromMapsWindow = async () => {
    if (!window.electron?.getMapsWindowUrl) {
      showStatus('Close and restart the desktop app, then try again.', 'error');
      return;
    }
    setStatus(null);
    try {
      const url = await window.electron.getMapsWindowUrl();
      onChange({ googleMapsLink: url });
      await runExtractAll(url);
    } catch (e) {
      showStatus(e instanceof Error ? e.message : 'Could not read Maps window', 'error');
    }
  };

  const handleOpenMaps = () => {
    window.open('https://www.google.com/maps', '_blank', 'noopener,noreferrer');
  };

  const handleDetect = async () => {
    setIsDetecting(true);
    setStatus(null);
    try {
      const patch = await detectCurrentLocationFull();
      onChange(patch);
      showStatus(
        patch.address
          ? 'Location detected — address and coordinates filled'
          : 'Coordinates detected (enter address manually if needed)'
      );
    } catch (e) {
      showStatus(e instanceof Error ? e.message : 'Detection failed', 'error');
    } finally {
      setIsDetecting(false);
    }
  };

  const busy = isExtractingAddress || isExtractingAll || isDetecting;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Shop location</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Pin your shop on Google Maps, then paste the link below.
        </p>
      </div>

      {status && (
        <div
          className={`rounded-xl px-3 py-2 text-sm ${
            status.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
              : 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
          }`}
        >
          {status.message}
        </div>
      )}

      <div>
        <label className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
          <span>Shop address</span>
          <button
            type="button"
            onClick={handleExtractAddress}
            disabled={!data.googleMapsLink || busy}
            className={actionBtn}
          >
            {isExtractingAddress ? 'Extracting…' : 'From Maps link'}
          </button>
        </label>
        <textarea
          rows={3}
          value={data.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="Complete shop address with pincode"
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
          <span className="flex items-center gap-1">
            <Link2 className="h-4 w-4" />
            Google Maps link
          </span>
          <button
            type="button"
            onClick={handleGenerateLink}
            disabled={!data.address.trim() || busy}
            className={actionBtn}
          >
            From address
          </button>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={data.googleMapsLink}
            onChange={(e) => onChange({ googleMapsLink: e.target.value })}
            onPaste={handleMapsLinkPaste}
            placeholder="https://maps.app.goo.gl/..."
            autoComplete="off"
            spellCheck={false}
            className="flex-1 min-w-0 px-4 py-3 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleOpenMaps}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-gray-800 text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-blue-400 hover:text-blue-700 dark:hover:text-blue-400 transition-colors`}
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            Open Maps
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {data.googleMapsLink ? (
            <button type="button" onClick={handleExtractAll} disabled={busy} className={actionBtn}>
              {isExtractingAll ? 'Extracting…' : 'Fill address & coordinates'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleGetFromMapsWindow}
                disabled={busy}
                className={actionBtn}
              >
                Get link from Maps
              </button>
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                disabled={busy}
                className={actionBtn}
              >
                Paste link
              </button>
            </>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Coordinates</span>
          <button
            type="button"
            onClick={handleDetect}
            disabled={busy}
            className={`${actionBtn} inline-flex items-center gap-1 border-green-200 text-green-700 dark:border-green-800 dark:text-green-400`}
          >
            <MapPin className="w-3 h-3 shrink-0" />
            {isDetecting ? 'Detecting…' : 'Auto-detect'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Latitude
            </label>
            <input
              type="text"
              value={data.latitude}
              onChange={(e) => onChange({ latitude: e.target.value })}
              placeholder="18.5204"
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Longitude
            </label>
            <input
              type="text"
              value={data.longitude}
              onChange={(e) => onChange({ longitude: e.target.value })}
              placeholder="73.8567"
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopLocationStep;
