// Links to a place in Google Maps and Apple Maps.
import type { Place } from "./types";

/**
 * The place's own Google listing (name, hours, reviews, directions) when we
 * know its Google Place ID, otherwise a pin at its coordinates.
 */
export function googleMapsUrl(place: Pick<Place, "name" | "lat" | "lng" | "googlePlaceId">): string {
  if (place.googlePlaceId) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.googlePlaceId}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
}

export function appleMapsUrl(place: Pick<Place, "name" | "lat" | "lng">): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(place.name)}&ll=${place.lat},${place.lng}`;
}
