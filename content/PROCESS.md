# Yearly content update process

How the app's content gets refreshed each year.

1. **Review the new venue information**: venue name and address, dates,
   official events (welcome party, happy hour, after party) and hotels from
   techseoconnect.com.
2. **Look for restaurants**: coffee, lunch, dinner, drinks and things to do
   near the venue. Check each one is open on the conference days at the hours
   that matter, using the business's own website first and Google second. If
   the business's site says it's open, treat it as open.
3. **Update the files**: places in `content/places.kml` (one folder per
   category) with descriptions in `content/place-narratives.json`, each
   place's Google listing in `content/google-listings.json`, sponsors in
   `src/data/sponsors.ts`, and the event details in `src/data/event.ts`.
4. **Rebuild the places**: `npm run import:places` writes
   `src/data/places.json`. List anything to confirm before launch.

The schedule isn't part of this; the app syncs it from techseoconnect.com.
