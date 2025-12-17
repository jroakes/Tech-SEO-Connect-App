# Tech SEO Connect Conference App

A mobile-first Progressive Web App (PWA) companion for the Tech SEO Connect conference (December 4-5, 2025) in Durham, NC.

## Overview

Tech SEO Connect is a conference companion application that helps attendees navigate and engage with the event through:

- **Interactive Map** - Explore Durham locations (hotels, restaurants, venues, attractions) with category filters and real-time navigation
- **Conference Schedule** - Two-day event schedule with speaker sessions and the ability to like sessions for personal tracking
- **Locations Directory** - Searchable directory of Durham locations with detailed narratives and navigation options
- **Sponsors Gallery** - Display of conference sponsors and partners
- **Photo Gallery** - Share and view conference photos submitted by attendees

The app is designed with a mobile-first approach, emphasizing fast access to information in an information-dense, clean interface inspired by Linear's design philosophy.

## Features

### Core Features

- **PWA Support** - Installable on mobile devices with offline support via service worker
- **Interactive Leaflet Map** - Custom category-specific markers with Google/Apple Maps navigation
- **GA4 Analytics** - Comprehensive event tracking for map interactions and speaker engagement
- **Real-time Photo Gallery** - Upload, display, and manage conference images with cloud storage
- **Persistent User Preferences** - LocalStorage-based liked speakers tracking
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile devices

### Analytics Tracking

- Map button clicks with location and category data
- Speaker session engagement (likes)
- Page view tracking
- Debug mode for development: `setAnalyticsDebug(true)` in browser console

## Tech Stack

### Frontend
- **React** 18 with TypeScript
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Component library built on Radix UI
- **Wouter** - Lightweight client-side routing
- **TanStack React Query** - Server state management and caching
- **Leaflet** - Interactive mapping library
- **Uppy** - File upload interface
- **Framer Motion** - Animations

### Backend
- **Express.js** - REST API server
- **TypeScript** - Type-safe development
- **Drizzle ORM** - Database schema management
- **Neon PostgreSQL** - Cloud database for image metadata
- **Google Cloud Storage** - Object storage for gallery images

### Services
- **MapTiler** - Tile layer API for map rendering
- **Google Analytics 4** - Analytics and event tracking
- **Replit Object Storage** - Cloud file storage integration

## Installation & Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Getting Started

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd tech-seo-connect-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   The following secrets are automatically configured by Replit:
   - `DATABASE_URL` - PostgreSQL connection
   - `DEFAULT_OBJECT_STORAGE_BUCKET_ID` - Cloud storage bucket
   - `VITE_MAPTILER_API_KEY` - MapTiler API key
   - `SESSION_SECRET` - Session encryption key

4. **Push database schema**
   ```bash
   npm run db:push
   ```

## Development

### Running Locally

```bash
npm run dev
```

The app will start on `http://localhost:5000` with:
- Express backend serving API endpoints
- Vite dev server with HMR for frontend changes
- Automatic service worker registration (localhost only)

### Project Structure

```
client/
├── src/
│   ├── pages/           # Route pages (Schedule, Map, Locations, Sponsors)
│   ├── components/      # Reusable UI components
│   ├── lib/
│   │   ├── analytics.ts # GA4 event tracking
│   │   ├── kmlParser.ts # KML data parsing
│   │   └── queryClient.ts # React Query setup
│   ├── data/
│   │   └── scheduleData.ts # Conference schedule
│   └── assets/          # Static images and data
├── index.html           # GA4 script and PWA meta tags
├── public/              # Service worker and manifest
└── src/main.tsx        # React entry point

server/
├── routes.ts           # API endpoints
├── storage.ts          # Data storage interface
├── index-dev.ts        # Development entry point
└── vite.ts            # Vite server config

shared/
└── schema.ts          # Shared data types and schemas
```

### Database Schema

Uses Drizzle ORM with PostgreSQL:
- `conference_images` - Stores metadata for uploaded gallery images (id, imagePath, fullPath, uploadedAt)
- Images are persisted to Google Cloud Storage with database references

### API Endpoints

- `GET /api/kml-data` - Returns KML location data
- `GET /api/conference-images` - List uploaded gallery images
- `POST /api/conference-images` - Create image metadata
- `DELETE /api/conference-images/:id` - Remove image from gallery
- `POST /api/conference-images/upload` - Get pre-signed upload URL

### Environment Variables (Frontend)

Frontend variables must be prefixed with `VITE_`:
- `VITE_MAPTILER_API_KEY` - MapTiler API key for map tiles

## Deployment

### Building for Production

```bash
npm run build
```

This creates optimized bundles for both frontend and backend.

### Hosting

The app is hosted at **app.techseoconnect.com** with:
- HTTPS enabled
- PWA installable on mobile devices
- Service worker caching for offline support
- Google Analytics tracking active

## Color Palette

The app uses a carefully selected color scheme:
- **Primary** (`#3C4639`) - Dark forest green, conference branding
- **Accent** (`#0DB47C`) - Bright teal/green, interactive elements
- **Warm** (`#836152`) - Muted brown, secondary accents
- **Light** (`#D9CEC5`) - Warm beige, light backgrounds
- **Teal** (`#689581`) - Muted teal, tertiary accents
- **Blue** (`#6A8EC4`) - Slate blue, hotel markers

## Mobile Optimizations

- **Touch Targets** - All interactive elements meet 44px minimum tap target
- **Category Filter Dropdown** - Compact select for mobile map filtering
- **Responsive Dialogs** - Location detail dialogs constrained to viewport
- **Offline Support** - Service worker caches critical assets and API responses
- **PWA Installation** - Web manifest and meta tags for home screen installation

## Analytics & Tracking

### Custom Events

**Map Navigation:**
```
event: "map_button_click"
- map_type: "google_maps" | "apple_maps"
- location_name: string
- location_category: string
```

**Speaker Engagement:**
```
event: "speaker_like"
- speaker_name: string
- conference_day: 1 | 2
```

### Debug Mode

Enable analytics debug logging:
```javascript
// In browser console
setAnalyticsDebug(true)      // Enable
enableAnalyticsDebug()       // Enable (alias)
disableAnalyticsDebug()      // Disable
```

Events will be logged to console when debug mode is active.

## Notes

- **Location Data** - Static KML file with Durham conference-related locations
- **Schedule Data** - Real speaker names and session titles from conference organizers
- **Photo Persistence** - Images stored in cloud persist across server restarts
- **Image Moderation** - Delete button for gallery images removes from both DB and cloud storage
- **No Authentication** - Open access model appropriate for conference companion app

## Contributing

This is a Replit-based project. To contribute:

1. Make changes to source files
2. Test locally with `npm run dev`
3. Verify analytics events fire correctly
4. Ensure database migrations succeed with `npm run db:push`
5. Deploy updates via Replit's publish feature

## Support

For issues or feature requests related to the conference, contact the Tech SEO Connect organizers.

---

**Last Updated:** December 2025  
**Version:** 1.0  
**Hosted at:** app.techseoconnect.com
