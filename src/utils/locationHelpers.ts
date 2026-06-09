export interface ShopLocationData {
  address: string;
  googleMapsLink: string;
  latitude: string;
  longitude: string;
}

export type LocationPatch = Partial<ShopLocationData>;

function normalizeMapsUrl(raw: string): string {
  return raw.trim();
}

export function generateGoogleMapsLinkFromAddress(address: string): string {
  const encodedAddress = encodeURIComponent(address.trim());
  return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
}

export function generateGoogleMapsLinkFromCoordinates(latitude: string, longitude: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export async function expandMapsUrlIfShort(
  urlStr: string,
  expandUrl?: (url: string) => Promise<string>
): Promise<string> {
  const normalized = extractUrlFromInput(normalizeMapsUrl(urlStr));

  if (isShortMapsUrl(normalized)) {
    if (expandUrl) {
      try {
        const expanded = await expandUrl(normalized);
        return expanded || normalized;
      } catch {
        throw new Error(
          'Could not expand the share link. Copy the long URL from your browser address bar instead.'
        );
      }
    }
    throw new Error(
      'Share links need the desktop app. Copy the long URL from your browser address bar instead.'
    );
  }
  return normalized;
}

export async function extractAddressFromMapsLink(
  googleMapsLink: string,
  expandUrl?: (url: string) => Promise<string>
): Promise<string> {
  const fromGoogle = await fetchGoogleMapsStreetAddress(googleMapsLink, expandUrl);
  if (fromGoogle?.address) {
    return fromGoogle.address;
  }

  const urlStr = await expandMapsUrlIfShort(googleMapsLink, expandUrl);
  const coords = parseCoordinatesFromUrl(urlStr);
  if (coords) {
    return reverseGeocodeAddress(coords.latitude, coords.longitude);
  }

  const url = new URL(urlStr);
  let queryAddress = '';

  if (url.searchParams.has('query')) {
    queryAddress = decodeURIComponent(url.searchParams.get('query') || '').replace(/\+/g, ' ');
  } else if (url.searchParams.has('q')) {
    queryAddress = decodeURIComponent(url.searchParams.get('q') || '').replace(/\+/g, ' ');
  }

  if (queryAddress.trim() && !/^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(queryAddress.trim())) {
    return queryAddress.trim();
  }

  throw new Error('Could not extract street address from this link.');
}

function parseCoordinatesFromUrl(urlStr: string): { latitude: string; longitude: string } | null {
  let lat: string | null = null;
  let lng: string | null = null;

  const preciseMatch = urlStr.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (preciseMatch) {
    return { latitude: preciseMatch[1], longitude: preciseMatch[2] };
  }

  const patterns = [
    /!8m2!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]center=(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];

  for (const pattern of patterns) {
    const match = urlStr.match(pattern);
    if (match) {
      lat = match[1];
      lng = match[2];
      break;
    }
  }

  if (!lat || !lng) {
    try {
      const urlObj = new URL(urlStr);
      const query = urlObj.searchParams.get('query') || urlObj.searchParams.get('q');
      if (query) {
        const queryMatch = query.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
        if (queryMatch) {
          lat = queryMatch[1];
          lng = queryMatch[2];
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (!lat || !lng) {
    const generalMatch = urlStr.match(/(-?\d+\.\d{3,})\s*,\s*(-?\d+\.\d{3,})/);
    if (generalMatch) {
      lat = generalMatch[1];
      lng = generalMatch[2];
    }
  }

  if (!lat || !lng) return null;
  return { latitude: lat, longitude: lng };
}

export async function extractCoordinatesFromMapsLink(
  googleMapsLink: string,
  expandUrl?: (url: string) => Promise<string>
): Promise<{ latitude: string; longitude: string }> {
  const urlStr = await expandMapsUrlIfShort(googleMapsLink, expandUrl);
  const coords = parseCoordinatesFromUrl(urlStr);

  if (!coords) {
    throw new Error(
      'Could not find coordinates. Copy the full link from the address bar, not the Share button.'
    );
  }

  return coords;
}

export async function extractAllFromMapsLink(
  googleMapsLink: string,
  expandUrl?: (url: string) => Promise<string>
): Promise<LocationPatch> {
  const patch: LocationPatch = {};
  let urlStr = googleMapsLink;

  const fromGoogle = await fetchGoogleMapsStreetAddress(googleMapsLink, expandUrl);
  if (fromGoogle) {
    patch.address = fromGoogle.address;
    urlStr = fromGoogle.expandedUrl;
  } else {
    urlStr = await expandMapsUrlIfShort(googleMapsLink, expandUrl);
  }

  const coords = parseCoordinatesFromUrl(urlStr);
  if (coords) {
    patch.latitude = coords.latitude;
    patch.longitude = coords.longitude;
  }

  if (!patch.address && coords) {
    try {
      patch.address = await reverseGeocodeAddress(coords.latitude, coords.longitude);
    } catch {
      /* try text fallback below */
    }
  }

  if (!patch.address) {
    try {
      patch.address = await extractAddressFromMapsLink(urlStr, expandUrl);
    } catch {
      /* coords-only links are OK */
    }
  }

  if (!patch.address && !patch.latitude) {
    throw new Error('Could not extract address or coordinates from this link.');
  }

  return patch;
}

async function reverseGeocodeAddress(latitude: string, longitude: string): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
    { headers: { Accept: 'application/json', 'User-Agent': 'PrintGetDesktop/1.0' } }
  );

  if (!res.ok) {
    throw new Error('Could not look up address for this location');
  }

  const data = (await res.json()) as { display_name?: string };
  if (!data.display_name) {
    throw new Error('No address found for this location');
  }
  return data.display_name;
}

export function detectCurrentLocation(): Promise<{ latitude: string; longitude: string }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        });
      },
      (error) => {
        reject(
          new Error(
            error.message ||
              'Failed to detect location. Check privacy settings or use a Maps link.'
          )
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

/** GPS detect + reverse geocode address + maps link (same as Settings should do). */
export async function detectCurrentLocationFull(): Promise<LocationPatch> {
  const coords = await detectCurrentLocation();
  const patch: LocationPatch = { ...coords };

  try {
    patch.address = await reverseGeocodeAddress(coords.latitude, coords.longitude);
  } catch {
    /* coords still usable without address */
  }

  patch.googleMapsLink = generateGoogleMapsLinkFromCoordinates(coords.latitude, coords.longitude);
  return patch;
}

export function notifyLocation(message: string, type: 'success' | 'error' = 'success') {
  window.dispatchEvent(
    new CustomEvent('show-notification', {
      detail: { type, message },
    })
  );
}

export function getExpandUrlFn(): ((url: string) => Promise<string>) | undefined {
  if (window.electron?.expandUrl) {
    return (url: string) => window.electron!.expandUrl!(url);
  }
  return undefined;
}

export function getFetchMapsAddressFn():
  | ((url: string) => Promise<{ address: string; expandedUrl: string }>)
  | undefined {
  if (window.electron?.fetchMapsPlaceAddress) {
    return (url: string) => window.electron!.fetchMapsPlaceAddress!(url);
  }
  return undefined;
}

async function fetchGoogleMapsStreetAddress(
  googleMapsLink: string,
  expandUrl?: (url: string) => Promise<string>
): Promise<{ address: string; expandedUrl: string } | null> {
  const fetchFromMaps = getFetchMapsAddressFn();
  if (fetchFromMaps) {
    try {
      return await fetchFromMaps(googleMapsLink);
    } catch {
      /* fall through */
    }
  }

  if (expandUrl) {
    try {
      const expandedUrl = await expandMapsUrlIfShort(googleMapsLink, expandUrl);
      const fetchFromMaps2 = getFetchMapsAddressFn();
      if (fetchFromMaps2) {
        return await fetchFromMaps2(expandedUrl);
      }
    } catch {
      /* fall through */
    }
  }

  return null;
}

function extractUrlFromInput(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0].replace(/[.,;:!?)]+$/, '') : trimmed;
}

export function extractGoogleMapsUrlFromText(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const patterns = [
    /https?:\/\/(?:www\.)?google\.[^\s/]+\/maps[^\s<>"']*/i,
    /https?:\/\/maps\.google\.[^\s<>"']*/i,
    /https?:\/\/maps\.app\.goo\.gl\/[^\s<>"']+/i,
    /https?:\/\/goo\.gl\/maps\/[^\s<>"']+/i,
    /https?:\/\/g\.page\/[^\s<>"']+/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[0].replace(/[.,;:!?)]+$/, '');
  }

  const url = extractUrlFromInput(trimmed);
  return isGoogleMapsUrl(url) ? url : null;
}

export function isGoogleMapsUrl(value: string): boolean {
  const v = extractUrlFromInput(value).toLowerCase();
  return (
    v.includes('google.com/maps') ||
    v.includes('maps.google.com') ||
    v.includes('maps.app.goo.gl') ||
    v.includes('goo.gl/maps') ||
    v.includes('g.page/')
  );
}

function isShortMapsUrl(url: string): boolean {
  const v = url.toLowerCase();
  return (
    v.includes('maps.app.goo.gl') ||
    v.includes('goo.gl/maps') ||
    v.includes('g.page/')
  );
}
