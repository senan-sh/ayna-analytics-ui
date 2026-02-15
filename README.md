# AYNA Data Visualization UI

A three-page interactive web application for demographic mapping, transit analytics, and live bus route visualization.

The application is implemented as a frontend-focused solution using React + TypeScript with static data sources and minimal external dependencies.

---

# Tech Stack

* React (Vite + TypeScript)
* Leaflet (map rendering)
* Material UI (UI components + DataGrid)
* PapaParse (CSV parsing)
* D3-scale (color scaling)
* Axios (HTTP requests)

---

# Features

## 1. Regional Demographics Map

* Choropleth visualization of regions
* Toggle between Micro / Meso / Macro levels
* Metric selector (Population / Jobs)
* Dynamic color scale legend
* Hover tooltips with region details
* Click interaction for detailed popup
* Reset map control

Data source:

* zone_attributes_synthetic.gpkg (converted to GeoJSON)

---

## 2. Bus Registration & Volume Analytics

* Structured and sortable table
* Column filtering
* Pagination
* Responsive layout
* Client-side CSV parsing

Data source:

* ceck_in_buss.csv

---

## 3. Live Route Visualization

* Interactive map overlay
* Polyline rendering of routes
* Distinct route colors
* Optional periodic refresh
* Graceful loading and error handling

Data source:

* [https://map.ayna.gov.az](https://map.ayna.gov.az) (API access preferred)

---

# Project Structure

```
ayna-ui/
 ├─ public/
 │   └─ data/
 │       ├─ regions.geojson
 │       └─ ceck_in_buss.csv
 ├─ src/
 │   ├─ pages/
 │   │   ├─ Demographics.tsx
 │   │   ├─ BusAnalytics.tsx
 │   │   └─ LiveRoutes.tsx
 │   ├─ components/
 │   ├─ services/
 │   └─ App.tsx
 ├─ package.json
 └─ README.md
```

---

# Setup

## 1. Install dependencies

```bash
npm install
```

## 2. Start development server

```bash
npm run dev
```

Default local address:

```
http://localhost:5173
```

---

# Data Preparation

## GeoPackage Conversion

Browsers cannot read `.gpkg` directly.

Convert to GeoJSON before running the application:

```bash
ogr2ogr -f GeoJSON regions.geojson zone_attributes_synthetic.gpkg
```

Place the generated file inside:

```
/public/data/
```

## CSV

Place `ceck_in_buss.csv` inside:

```
/public/data/
```

---

# Build & Deployment

## Production build

```bash
npm run build
```

Output directory:

```
/dist
```

Deploy using any static hosting platform such as Vercel or Netlify.

After deployment, share the hosted link as required.

---

# Performance Considerations

* GeoJSON optimized before deployment
* Client-side filtering and sorting
* Lazy page loading
* Controlled re-renders for map layers

---

# Limitations

* No authentication layer
* No server-side GIS processing
* Live route scraping may require proxy if CORS restrictions apply
* All analytics executed client-side

---

# Author

Sanan Shahmarov
