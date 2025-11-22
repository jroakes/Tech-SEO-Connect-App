# Tech SEO Connect Conference App - Design Guidelines

## Design Approach

**Selected Approach:** Hybrid Design System with Reference Inspiration
- **Primary Reference:** Linear (clean utility-first interface, precise information hierarchy)
- **Secondary Influences:** Apple Maps (for location features), Notion (for content organization)
- **Rationale:** This is a utility-focused conference companion app where fast access to schedule, locations, and shared content is critical. The design should feel professional and efficient while maintaining visual appeal through precise typography, thoughtful spacing, and subtle interactions.

## Core Design Principles

1. **Information Clarity First:** Every screen optimized for scanning and quick comprehension
2. **Precision Over Decoration:** Sharp edges, deliberate spacing, purposeful UI elements
3. **Restrained Elegance:** Visual sophistication through typography and layout, not heavy styling
4. **Mobile-First Navigation:** Touch-friendly targets, gesture-aware interactions

---

## Typography System

**Font Selection:**
- Primary: Inter (via Google Fonts) - for UI elements, labels, body text
- Secondary: Source Serif 4 (via Google Fonts) - for location narratives and longer content blocks

**Type Scale:**
- Hero/Page Titles: 32px (mobile) / 48px (desktop), font-weight 700, letter-spacing -0.02em
- Section Headers: 24px (mobile) / 32px (desktop), font-weight 600
- Card Titles/Location Names: 18px, font-weight 600
- Body Text: 16px, font-weight 400, line-height 1.6
- Labels/Metadata: 14px, font-weight 500, letter-spacing 0.01em
- Small Text/Timestamps: 12px, font-weight 400, text-transform uppercase for labels

**Hierarchy Rules:**
- Use weight variation (400/500/600/700) rather than size changes where possible
- Maintain consistent line-height for readability (1.5-1.6 for body, 1.2 for headings)
- Reserve Source Serif 4 for narrative content blocks to create visual distinction

---

## Layout & Spacing System

**Spacing Primitives:** Tailwind units of 2, 4, 8, 12, 16
- Micro spacing (between related elements): p-2, gap-2
- Standard spacing (component padding, gaps): p-4, gap-4, mb-4
- Section spacing (between major sections): p-8, py-12, gap-8
- Large spacing (page margins, major separations): p-16, py-16

**Grid System:**
- Mobile: Single column, full-width cards with 4 horizontal padding
- Tablet: 2-column grid for location cards, single column for schedule
- Desktop: 3-column grid for locations/gallery, 2-column for schedule details

**Container Widths:**
- Mobile: Full width with px-4 margins
- Desktop max-width: 1400px centered
- Content max-width for text: 800px

**Border Radius Philosophy:**
- Minimal use: 4px for subtle definition on cards and inputs
- 8px maximum for prominent interactive elements (buttons, major cards)
- 0px (sharp edges) for navigation bars, headers, section dividers

---

## Component Library

### Navigation
**Primary App Navigation:**
- Fixed bottom navigation on mobile (60px height)
- Horizontal top navigation on desktop with logo integration
- Four primary sections: Map, Schedule, Locations, Gallery
- Active state: Use color-2 (#0DB47C) underline (3px), not background fills
- Icons: Heroicons outline style, 24px, paired with labels on desktop

### Header
- Desktop: Full tc-2 logo (left), navigation links (center), utility actions (right)
- Mobile: tc-1 icon logo (left), hamburger menu (right), 56px height
- Background: color-1 (#3C4639) with subtle bottom border (1px, color-4 at 20% opacity)

### Cards

**Location Cards:**
- 1px border using color-4 (#836152) at 30% opacity
- 4px border-radius
- Padding: p-4
- Shadow: Subtle (1px 2px 4px rgba(0,0,0,0.08))
- Hover: Lift with shadow increase, no color change
- Structure: Category badge (top), title, distance/metadata, brief excerpt

**Schedule Cards:**
- Sharp design with left border accent (4px solid using color-2 or color-6 based on type)
- No rounded corners (border-radius: 0)
- Time display: Bold 18px with subtle background (color-3 at 15%)
- Break times: Distinct visual treatment with color-5 accent

### Buttons

**Primary Button:**
- Background: color-2 (#0DB47C)
- Text: White, 16px, font-weight 600
- Padding: px-6, py-3
- Border-radius: 6px
- Hover: Darken by 10%
- Active: Scale 0.98

**Secondary Button:**
- Border: 2px solid color-4 (#836152)
- Text: color-4, same sizing as primary
- Background: Transparent
- Hover: Background color-4 at 5%, border darkens

**Ghost/Tertiary:**
- No border, no background
- Text: color-6 (#6A8EC4)
- Hover: Background color-6 at 8%

### Map Component
- Full-screen on dedicated Map tab
- Custom markers using provided color palette
- Category-based marker colors: Hotels (color-6), Food (color-2), Venues (color-4)
- Info windows: Minimal design with location name, category badge, "View Details" link
- Filter controls: Chip-style toggles with active state using category colors

### Forms & Inputs

**Image Upload:**
- Drag-and-drop zone with dashed border (2px, color-5)
- Icon + instructional text centered
- Selected images: Grid preview with remove button overlay
- Upload button: Primary button style

**Search/Filter Inputs:**
- Height: 44px for touch targets
- Border: 1px solid color-4 at 30%
- Focus state: Border color-2, 2px, no glow
- Icon prefix: 20px Heroicons, color-5
- Border-radius: 6px

### Image Gallery
- Masonry grid layout on desktop (3 columns)
- 2-column on tablet, single column on mobile
- Gap: gap-4 between images
- Lightbox on click: Full-screen modal with color-1 background at 95% opacity
- Navigation arrows: Subtle, positioned on sides

---

## Interactive States & Animations

**Interaction Philosophy:** Subtle and purposeful
- Card hovers: Translate Y by -2px with shadow increase (transition: 150ms ease)
- Button clicks: Scale to 0.98 (transition: 100ms ease)
- Tab transitions: Fade in/out content areas (200ms)
- No loading spinners - use skeleton screens with color-3 backgrounds
- Page transitions: Smooth 200ms opacity fades

**Disabled States:**
- Opacity: 0.4
- Cursor: not-allowed
- No hover effects

---

## Color Application Strategy

Since colors are provided, here's the usage mapping:

- **color-1 (#3C4639):** Headers, navigation backgrounds, text on light backgrounds
- **color-2 (#0DB47C):** Primary actions, active states, success indicators, food category
- **color-3 (#D9CEC5):** Subtle backgrounds, skeleton loaders, disabled states
- **color-4 (#836152):** Borders, secondary text, venue category
- **color-5 (#689581):** Tertiary accents, break times in schedule
- **color-6 (#6A8EC4):** Links, hotel category, tertiary buttons

**Semantic Usage:**
- Active/Selected: color-2
- Neutral/Background: color-3
- Borders/Dividers: color-4 at 30%
- Informational links: color-6

---

## Accessibility Standards

- Touch targets: Minimum 44x44px
- Color contrast: WCAG AA minimum (4.5:1 for text)
- Focus indicators: 2px outline using color-2, 2px offset
- Keyboard navigation: Logical tab order through all interactive elements
- Alt text: Required for all images, descriptive for location photos
- Form labels: Always visible, not placeholder-dependent

---

## Images

**Logo Usage:**
- tc-1 icon: Mobile header (32px), favicon, app icon contexts
- tc-2 full logo: Desktop header (height: 40px), about/info sections

**Location Images:**
- Not included in initial design - rely on map markers and text descriptions
- Placeholder spots in location detail views for future photo integration

**User-Generated Content:**
- Gallery section for attendee-uploaded conference photos
- Aspect ratio: Free-form, displayed in masonry grid
- Maximum display size: 1200px width

**No hero images** - this is a utility app prioritizing function over marketing visuals.