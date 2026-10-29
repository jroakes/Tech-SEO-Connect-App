# Yearly content update process

How the app's content gets refreshed each year. This folder is the 2026 run;
copy it to `content/<year>-update/` for the next one.

1. **Review the new venue information**: venue name and address, dates,
   official events (welcome party, happy hour, after party) and hotels from
   techseoconnect.com.
2. **Look for restaurants**: coffee, lunch, dinner, drinks and things to do
   near the venue. Check each one is open on the conference days at the hours
   that matter, using the business's own website first and Google second. If
   the business's site says it's open, treat it as open.
3. **Update the places, sponsors and event details**: places in `places.kml`
   (one folder per category) with descriptions in `place-narratives.json`,
   sponsors in `sponsors.ts`, and the event details listed in `README.md`.
4. **Save it to files** in this folder, with a `README.md` that says what
   replaces what and lists anything to confirm before launch.

Another developer then applies the files to the app by following `README.md`.
The schedule isn't part of this; the app syncs it from techseoconnect.com.
