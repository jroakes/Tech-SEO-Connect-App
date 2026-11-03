export interface Place {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  narrative?: string;
  /** The conference venue, always shown on the map as a gold star. */
  isVenue?: boolean;
  /** Its Google Maps listing (see content/google-listings.json). */
  googlePlaceId?: string;
  address?: string;
  /** The pin's coordinates before they were set from the Google listing. */
  originalLat?: number;
  originalLng?: number;
}

export interface Session {
  /** Stable ID used for saved sessions and analytics. See lib/sessions.ts. */
  id: string;
  /** 1-based position of the session's date in the schedule. */
  day: number;
  /** ISO date, e.g. 2026-11-05 */
  date?: string;
  time: string;
  duration: number;
  title: string;
  speaker?: string;
  isBreak: boolean;
  description?: string;
}

export type SessionInput = Omit<Session, "id">;

export interface ConferenceDay {
  day: number;
  /** ISO date, e.g. 2026-11-05 */
  date: string;
  label: string;
}
