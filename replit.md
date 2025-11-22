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
- MapPage: Interactive Leaflet map with location markers
- SchedulePage: Two-day conference schedule with tabbed interface
- LocationsPage: Searchable/filterable location directory
- GalleryPage: Image upload and display with dialog previews

### Backend Architecture

**Server**: Express.js with TypeScript

**Development Setup**: 
- Vite dev server with HMR for development
- Static file serving for production
- Separate entry points (index-dev.ts vs index-prod.ts)

**API Structure**:
- RESTful endpoints under `/api` prefix
- `/api/kml-data`: Serves location data from KML file
- `/api/conference-images`: CRUD operations for gallery images
- `/api/conference-images/upload`: Pre-signed upload URL generation

**Data Layer**:
- In-memory storage (MemStorage class) for conference images
- File-based data for locations (KML parsing)
- Drizzle ORM configured for PostgreSQL (schema defined but not actively used)

**Architecture Decision**: The application currently uses in-memory storage with file-based location data. The PostgreSQL schema is defined via Drizzle ORM but not implemented, suggesting the app can migrate to database persistence when needed without major refactoring.

### Data Storage Solutions

**Current Implementation**:
- Location data: Static KML file parsed on client-side load
- Location narratives: JSON file imported as static asset
- Conference images: Object storage (Google Cloud Storage via Replit integration) with in-memory metadata

**Object Storage Integration**:
- Gallery images are uploaded to Google Cloud Storage using pre-signed URLs
- Images persist across server restarts and deployments
- Public access via `/objects/:objectPath` route that maps to private storage bucket
- Required environment variables (automatically set by Replit):
  - `DEFAULT_OBJECT_STORAGE_BUCKET_ID`: GCS bucket ID
  - `PRIVATE_OBJECT_DIR`: Private directory path within bucket for uploads
  - `PUBLIC_OBJECT_SEARCH_PATHS`: Comma-separated paths for public object resolution

**Prepared for Migration**:
- Drizzle ORM schema defined for `conference_images` table
- Database connection configured for Neon PostgreSQL
- Can migrate image metadata from in-memory to database persistence without changing upload flow
- Migration infrastructure in place (drizzle-kit)

**Rationale**: The in-memory approach allows rapid development and deployment without database setup. The schema-first approach via Drizzle enables zero-downtime migration to persistent storage when scale requires it.

### External Dependencies

**Cloud Storage**: 
- Google Cloud Storage via `@google-cloud/storage`
- Replit Object Storage integration for image uploads
- Pre-signed URL pattern for secure client-side uploads
- Environment variable `PUBLIC_OBJECT_SEARCH_PATHS` for bucket configuration

**Mapping Service**:
- Leaflet for interactive maps
- OpenStreetMap tile layer (implied by Leaflet default usage)
- Custom marker icons with category-based color coding

**UI Libraries**:
- Radix UI for accessible component primitives
- Uppy for file upload interface (@uppy/core, @uppy/dashboard, @uppy/aws-s3, @uppy/react)
- react-leaflet for React-Leaflet integration

**Fonts**:
- Google Fonts: Inter and Source Serif 4
- Loaded via CDN in index.html

**Database** (configured but not active):
- Neon PostgreSQL via `@neondatabase/serverless`
- Drizzle ORM for schema management and queries

**Development Tools**:
- Replit-specific plugins for runtime error overlay and dev banner
- TypeScript with strict mode enabled
- Path aliases for clean imports (@/, @shared/, @assets/)

**Authentication/Authorization**: None currently implemented (open access model appropriate for conference companion app)