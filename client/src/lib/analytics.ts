declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

if (typeof window !== 'undefined' && !window.dataLayer) {
  window.dataLayer = [];
}

const DEBUG_KEY = 'techseo_debug_analytics';

export function isAnalyticsDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DEBUG_KEY) === 'true';
}

export function setAnalyticsDebug(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  if (enabled) {
    localStorage.setItem(DEBUG_KEY, 'true');
    console.log('%c[Analytics Debug] Enabled - dataLayer events will be logged to console', 'color: #0DB47C; font-weight: bold');
  } else {
    localStorage.removeItem(DEBUG_KEY);
    console.log('%c[Analytics Debug] Disabled', 'color: #836152; font-weight: bold');
  }
}

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).enableAnalyticsDebug = () => setAnalyticsDebug(true);
  (window as unknown as Record<string, unknown>).disableAnalyticsDebug = () => setAnalyticsDebug(false);
}

export function pushToDataLayer(event: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(event);
    
    if (isAnalyticsDebugEnabled()) {
      console.log(
        '%c[dataLayer]',
        'background: #3C4639; color: white; padding: 2px 6px; border-radius: 3px;',
        event
      );
    }
  }
}

export function trackMapButtonClick(
  mapType: 'google_maps' | 'apple_maps',
  locationName: string,
  locationCategory: string
) {
  pushToDataLayer({
    event: 'map_button_click',
    map_type: mapType,
    location_name: locationName,
    location_category: locationCategory,
  });
}

export function trackSpeakerLike(speakerName: string, day: number) {
  pushToDataLayer({
    event: 'speaker_like',
    speaker_name: speakerName,
    conference_day: day,
  });
}

const LIKED_SPEAKERS_KEY = 'techseo_liked_speakers';

export function getLikedSpeakers(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(LIKED_SPEAKERS_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch (e) {
    console.error('Error reading liked speakers from localStorage:', e);
  }
  return new Set();
}

export function saveLikedSpeaker(speakerKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    const liked = getLikedSpeakers();
    liked.add(speakerKey);
    localStorage.setItem(LIKED_SPEAKERS_KEY, JSON.stringify(Array.from(liked)));
  } catch (e) {
    console.error('Error saving liked speaker to localStorage:', e);
  }
}

export function isSpeakerLiked(speakerKey: string): boolean {
  return getLikedSpeakers().has(speakerKey);
}
