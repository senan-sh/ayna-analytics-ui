# AYNA UI – Features Documentation

## Project Overview

A 3-page interactive data visualization web application built with:

- React + TypeScript (Vite)
- Leaflet (maps)
- Material UI (tables/UI)
- PapaParse (CSV parsing)
- D3-scale (color scaling)

Architecture: **Frontend-only**, with static data (GeoJSON + CSV).  
Minimal proxy only if required for live routes.

---

# 1️⃣ Regional Demographics Map

## Objective
Visualize demographic indicators across geographic regions.

## Data Source
- `zone_attributes_synthetic.gpkg`
- Converted to `regions.geojson`

## Core Features

### Data Visualization
- Choropleth map
- Dynamic color scaling
- Tooltip on hover
- Popup on click

### Metrics
- Population
- Jobs

### Region Levels
- Micro
- Meso
- Macro
- Toggle switch to filter layer

### UI Controls
- Metric selector (Population / Jobs)
- Region level selector
- Legend with color scale
- Reset view button

### Technical Notes
- GeoJSON loaded from `/public/data`
- D3 quantile or linear scale
- Styled with perceptually uniform color palette

---

# 2️⃣ Bus Registration & Volume Analytics

## Objective
Provide structured tabular insights for bus registrations and transit volume.

## Data Source
- `ceck_in_buss.csv`

## Core Features

### Table
- Sortable columns
- Filterable columns
- Pagination
- Sticky header
- Responsive layout

### Optional Enhancements
- Summary cards:
  - Total registrations
  - Total transit volume
- Date filtering
- Export to CSV

### Technical Notes
- CSV parsed via PapaParse
- DataGrid from Material UI
- Client-side filtering and sorting

---

# 3️⃣ Live Route Visualization

## Objective
Display active bus routes on interactive map.

## Data Source
- https://map.ayna.gov.az
- Prefer direct API access
- Minimal proxy only if CORS blocked

## Core Features

### Map Overlay
- Polyline rendering of routes
- Distinct color per route
- Tooltip with route info
- Layer control (show/hide routes)

### Live Behavior
- Auto refresh (optional, e.g. every 30–60s)
- Loading indicator
- Error fallback state

### Technical Notes
- Route data converted to GeoJSON format
- Rendered via Leaflet Polyline
- Axios for data fetching

---

# Global UI Features

## Layout
- Clean dashboard layout
- Top navigation bar
- Responsive design
- Consistent spacing and typography

## UX
- Loading states
- Error handling
- No console errors
- Accessible color contrast

## Performance
- Lazy load pages
- Code splitting
- Memoized map layers
- Efficient re-renders

---

# Deployment

- Static hosting (Vercel / Netlify)
- Public link submission required
- Production build optimized

---

# Non-Goals

- No heavy backend
- No database
- No authentication
- No server-side GIS processing

---

# Deliverables

- Hosted live link
- Clean UI
- Stable performance
- Source code repository (optional)

---

# Future Improvements (Optional)

- Real-time WebSocket route updates
- Heatmap visualization
- Analytics dashboard charts
- Dark mode
- Mobile-optimized layout

---
