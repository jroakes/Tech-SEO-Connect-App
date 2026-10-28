import type { Place, Session } from "./types";

declare global {
  interface Window {
    dataLayer: (Record<string, unknown> | unknown[])[];
    gtag?: (...args: unknown[]) => void;
    setAnalyticsDebug?: (enabled: boolean) => void;
    enableAnalyticsDebug?: () => void;
    disableAnalyticsDebug?: () => void;
  }
}

if (typeof window !== "undefined" && !window.dataLayer) {
  window.dataLayer = [];
}

const DEBUG_KEY = "techseo_debug_analytics";
const ANON_ID_KEY = "tsc_anon_id";

export function isAnalyticsDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DEBUG_KEY) === "true";
  } catch {
    return false;
  }
}

export function setAnalyticsDebug(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      localStorage.setItem(DEBUG_KEY, "true");
      console.log("%c[Analytics Debug] Enabled - events will be logged to console", "color: #0DB47C; font-weight: bold");
    } else {
      localStorage.removeItem(DEBUG_KEY);
      console.log("%c[Analytics Debug] Disabled", "color: #836152; font-weight: bold");
    }
  } catch {
    // Storage unavailable (private mode); nothing to persist.
  }
}

if (typeof window !== "undefined") {
  window.setAnalyticsDebug = setAnalyticsDebug;
  window.enableAnalyticsDebug = () => setAnalyticsDebug(true);
  window.disableAnalyticsDebug = () => setAnalyticsDebug(false);
}

/** Sends an event to GA4 through gtag.js (loaded in the layout). */
export function pushToDataLayer(event: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  const eventName = event.event as string;
  const eventData = { ...event };
  delete eventData.event;

  window.gtag?.("event", eventName, eventData);

  if (isAnalyticsDebugEnabled()) {
    console.log("%c[GA4 Event]", "background: #3C4639; color: white; padding: 2px 6px; border-radius: 3px;", eventName, eventData);
  }
}

// --- First-party event log ---------------------------------------------------
// Events are queued and sent in batches to /api/events, which stores them in D1.

type EventProps = Record<string, string | number | boolean>;
interface QueuedEvent {
  type: string;
  path: string;
  props?: EventProps;
  ts: number;
}

const MAX_BATCH = 25;
let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function getAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

function flush() {
  clearTimeout(flushTimer);
  flushTimer = undefined;
  while (queue.length) {
    const body = JSON.stringify({ anonId: getAnonId(), events: queue.splice(0, MAX_BATCH) });
    const sent = navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }));
    if (!sent) {
      fetch("/api/events", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

export function logEvent(type: string, props?: EventProps) {
  if (typeof window === "undefined") return;
  queue.push({ type, path: location.pathname, props, ts: Date.now() });
  if (isAnalyticsDebugEnabled()) console.log("%c[App Event]", "background: #0DB47C; color: white; padding: 2px 6px; border-radius: 3px;", type, props ?? {});
  if (queue.length >= MAX_BATCH) flush();
  else flushTimer ??= setTimeout(flush, 5000);
}

// --- Named events --------------------------------------------------------------

export function trackMapButtonClick(mapType: "google_maps" | "apple_maps", place: Place, source: "map" | "list" | "detail") {
  pushToDataLayer({
    event: "map_button_click",
    map_type: mapType,
    location_name: place.name,
    location_category: place.category,
  });
  logEvent("map_button_click", { map_type: mapType, place_id: place.id, place_name: place.name, category: place.category, source });
}

export function trackPlaceView(place: Place, source: "map" | "list") {
  logEvent("place_view", { place_id: place.id, place_name: place.name, category: place.category, source });
}

export function trackSessionSave(session: Session, saved: boolean) {
  if (saved) {
    pushToDataLayer({
      event: "speaker_like",
      speaker_name: session.speaker || session.title,
      conference_day: session.day,
    });
  }
  logEvent(saved ? "session_save" : "session_unsave", {
    session_id: session.id,
    title: session.title,
    ...(session.speaker ? { speaker: session.speaker } : {}),
    day: session.day,
  });
}

export function openDirections(mapType: "google_maps" | "apple_maps", place: Place) {
  const url =
    mapType === "google_maps"
      ? `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
      : `https://maps.apple.com/?q=${encodeURIComponent(place.name)}&ll=${place.lat},${place.lng}`;
  window.open(url, "_blank", "noopener");
}
