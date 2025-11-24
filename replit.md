# Tech SEO Connect Conference App

## Overview

Tech SEO Connect is a conference companion application for a December 4-5, 2025 event in Durham, NC. The app helps attendees navigate the conference by providing:

- Interactive map of conference-related locations (hotels, restaurants, venues)
- Conference schedule with speaker sessions and breaks
- Location directory with narratives and categories
- Photo gallery for sharing conference images

The application serves as a utility-focused tool prioritizing fast access to schedule, locations, and shared content through a mobile-first, information-dense interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool

**UI Component System**: 
- shadcn/ui component library built on Radix UI primitives
- Tailwind CSS for styling with a custom design system
- Design philosophy inspired by Linear (utility-first, clean information hierarchy)
- Typography: Inter for UI elements, Source Serif 4 for narrative content
- Mobile-first responsive design approach

**Routing**: wouter for lightweight client-side routing

**State Management**: 
- @tanstack/react-query for server state and API data caching
- React hooks for local component state
- Query client configured with aggressive caching (staleTime: Infinity)

**Key Pages**:
- MapPage: Interactive Leaflet map with custom category-specific marker icons, dropdown category filter, collapsible narratives, and Google/Apple Maps navigation buttons with GA4 tracking
- SchedulePage: Two-day conference schedule with tabbed interface and speaker heart/like feature
- LocationsPage: Searchable/filterable location directory with Google/Apple Maps navigation on cards and responsive detail dialogs with GA4 tracking
- GalleryPage: Image upload, display, and moderation with delete capability

**Analytics Tracking** (November 2025):
- GA4 dataLayer integration via `client/src/lib/analytics.ts`
- Map button clicks tracked: `{ event: 'map_button_click', map_type: 'google_maps'|'apple_maps', location_name, location_category }`
- Speaker likes tracked: `{ event: 'speaker_like', speaker_name: session.title, conference_day }`
- Tracking enabled on Map page popups, Location cards, Location detail dialogs
- Debug mode: Open browser console and run `enableAnalyticsDebug()` to log dataLayer events to console
  - Run `disableAnalyticsDebug()` to turn off console logging
  - Setting persists in localStorage until disabled

**Speaker Like Feature** (November 2025):
- Heart icon on each speaker session (not breaks) in the schedule
- Grey heart by default, pink after like with rising animation
- Single-click only (no toggle off) - liked hearts stay pink and become non-clickable
- Persistence via localStorage with key `techseo_liked_speakers`
- CSS animation class `animate-heart-rise` for 0.6s rising effect

**Mobile UX Improvements** (November 2025):
- All interactive buttons meet 44px minimum tap target requirement (min-h-11)
- Category filter buttons converted from Badge to Button components for better touch targets
- Map category filters replaced with compact dropdown select box (November 24, 2025)
- Google Maps and Apple Maps buttons displayed side-by-side with flex-1 for equal width
- Map location narratives collapse by default (line-clamp-3) with click-to-expand functionality
- Location cards and detail dialogs include Google/Apple Maps navigation buttons
- Location detail dialogs constrained to viewport width on mobile (max-w-[calc(100vw-2rem)]) (November 24, 2025)
- Navigation button text shortened to "Google Maps"/"Apple Maps" for better mobile fit (November 24, 2025)
- Removed coordinate display from Locations page (lat/long no longer shown on cards or dialogs)
- Consistent button styling across Map and Locations pages for cohesive mobile experience

### Backend Architecture

**Server**: Express.js with TypeScript

**Development Setup**: 
- Vite dev server with HMR for development
- Static file serving for production
- Separate entry points (index-dev.ts vs index-prod.ts)

**API Structure**:
- RESTful endpoints under `/api` prefix
- `/api/kml-data`: Serves location data from KML file
- `/api/conference-images`: GET (list) and POST (create) operations for gallery images
- `/api/conference-images/:id`: DELETE endpoint for image moderation
- `/api/conference-images/upload`: Pre-signed upload URL generation for object storage

**Data Layer**:
- PostgreSQL database (DbStorage class) for conference images metadata
- File-based data for locations (KML parsing)
- Drizzle ORM for database schema management and queries
- Object deletion removes from both database and Google Cloud Storage

**Architecture Decision**: Conference images use PostgreSQL for metadata persistence with Google Cloud Storage for actual image files. This hybrid approach provides database-backed reliability while leveraging object storage for efficient file serving. Location data remains file-based as it's static conference data that doesn't change.

### Data Storage Solutions

**Current Implementation**:
- Location data: Static KML file parsed on client-side load
- Location narratives: JSON file imported as static asset
- Conference images: PostgreSQL database for metadata + Google Cloud Storage for files

**Database Persistence** (November 2025):
- Conference images migrated from in-memory to PostgreSQL database
- Metadata (id, imagePath, fullPath, uploadedAt) stored in `conference_images` table
- Images persist across server restarts and deployments
- Drizzle ORM with Neon serverless PostgreSQL connection
- Full CRUD operations: create, list, and delete with cascade to object storage

**Object Storage Integration**:
- Gallery images uploaded to Google Cloud Storage using pre-signed URLs
- Public access via `/objects/:objectPath` route that maps to private storage bucket
- Delete operations remove from both database AND object storage (no orphaned files)
- Required environment variables (automatically set by Replit):
  - `DEFAULT_OBJECT_STORAGE_BUCKET_ID`: GCS bucket ID
  - `PRIVATE_OBJECT_DIR`: Private directory path within bucket for uploads
  - `PUBLIC_OBJECT_SEARCH_PATHS`: Comma-separated paths for public object resolution

**Image Moderation** (November 2025):
- Delete button on each gallery image with confirmation dialog
- DELETE endpoint removes image from both database and cloud storage
- Proper error handling and logging for storage deletion failures
- Cache invalidation ensures UI updates immediately after deletion

**Rationale**: The hybrid database + object storage approach provides reliable metadata persistence while leveraging cloud storage for efficient file serving. Images survive server restarts, and the moderation system ensures clean removal without orphaned files.

### External Dependencies

**Cloud Storage**: 
- Google Cloud Storage via `@google-cloud/storage`
- Replit Object Storage integration for image uploads
- Pre-signed URL pattern for secure client-side uploads
- Environment variable `PUBLIC_OBJECT_SEARCH_PATHS` for bucket configuration

**Mapping Service**:
- Leaflet for interactive maps
- OpenStreetMap tile layer for map tiles
- Custom marker icons with category-specific SVG icons and color coding (November 24, 2025):
  - Hotels: Building icon with blue background (#6A8EC4)
  - Lunch/Dinner: Utensils icon with green background (#0DB47C)
  - Coffee: Coffee cup icon with green background (#0DB47C)
  - Drinks: Martini glass icon with brown background (#836152)
  - Conference: Office building icon with dark green background (#3C4639)
  - Attractions: Camera icon with teal background (#689581)
  - 32px marker size for improved visibility
- Dropdown category filter for cleaner mobile UI with high z-index (z-[9999]) to appear above map (November 24, 2025)
- Special venue marker (November 2025):
  - "The Fruit -Conference Venue" always appears on map as gold star (#D4AF37)
  - Larger size (44px vs 32px) for visibility
  - Appears regardless of category filter selection (helps users judge distance to venue)
  - Higher z-index (zIndexOffset=1000) ensures visibility above other markers
- Enhanced popups (November 2025):
  - Collapsible narratives with line-clamp-3 and "Read more"/"Show less" toggle
  - Google Maps and Apple Maps navigation buttons on same line
  - Opens directions in new tab with proper coordinate URLs
  - 44px minimum tap targets for all interactive elements

**UI Libraries**:
- Radix UI for accessible component primitives
- Uppy for file upload interface (@uppy/core, @uppy/dashboard, @uppy/aws-s3, @uppy/react)
- react-leaflet for React-Leaflet integration

**Fonts**:
- Google Fonts: Inter and Source Serif 4
- Loaded via CDN in index.html

**Database** (active since November 2025):
- Neon PostgreSQL via `@neondatabase/serverless`
- Drizzle ORM for schema management and queries
- Active tables: `conference_images` with id, imagePath, fullPath, uploadedAt
- Migration via `npm run db:push` command

**Development Tools**:
- Replit-specific plugins for runtime error overlay and dev banner
- TypeScript with strict mode enabled
- Path aliases for clean imports (@/, @shared/, @assets/)

**Authentication/Authorization**: None currently implemented (open access model appropriate for conference companion app)