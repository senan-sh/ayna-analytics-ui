# AGENTS.md

This document defines responsibilities, boundaries, and operational rules for AI agents or automated tools working on the AYNA Data Visualization UI project.

---

# 1. Project Context

Project Type: Frontend-first web application
Stack: React + TypeScript (Vite)
Architecture: Static data with minimal external API dependency
Deployment Target: Static hosting (e.g., Vercel / Netlify)

Agents must prioritize:

* Simplicity
* Maintainability
* Deterministic behavior
* No unnecessary backend complexity

---

# 2. Agent Roles

## 2.1 UI Agent

Responsibilities:

* Implement React components
* Maintain consistent layout and spacing
* Ensure responsive design
* Avoid unnecessary re-renders
* Follow Material UI design patterns

Constraints:

* No business logic inside presentation components
* No direct DOM manipulation
* No inline large logic blocks inside JSX

---

## 2.2 Map Agent

Responsibilities:

* Implement Leaflet-based map rendering
* Load and render GeoJSON data
* Implement choropleth logic
* Handle route polyline rendering
* Optimize layer updates

Constraints:

* Do not mutate GeoJSON data
* Memoize heavy map layers
* Keep map state isolated from global UI state

---

## 2.3 Data Agent

Responsibilities:

* Parse CSV using PapaParse
* Normalize dataset fields
* Provide typed interfaces for datasets
* Handle loading and error states

Constraints:

* No implicit any types
* No data transformation inside UI components
* All parsing logic must be centralized

---

## 2.4 Networking Agent

Responsibilities:

* Handle Axios requests
* Implement retry logic if needed
* Provide graceful fallback on failure

Constraints:

* No direct calls inside components
* Abstract API calls into service layer
* Avoid polling unless explicitly required

---

# 3. Code Standards

## Type Safety

* Strict TypeScript mode enabled
* Define interfaces for:

  * Region properties
  * Bus records
  * Route geometry

## Naming Conventions

* Components: PascalCase
* Hooks: useCamelCase
* Services: camelCase
* Constants: UPPER_SNAKE_CASE

## File Organization

```
src/
 ├─ pages/
 ├─ components/
 ├─ services/
 ├─ hooks/
 ├─ types/
 └─ utils/
```

---

# 4. Performance Rules

Agents must:

* Use React.memo where beneficial
* Use useMemo for heavy computations
* Use useCallback for stable handlers
* Avoid unnecessary state duplication

GeoJSON should be pre-optimized before deployment.

---

# 5. Error Handling Policy

All async operations must:

* Handle loading state
* Handle error state
* Provide user-friendly fallback

No silent failures.
No console spam in production.

---

# 6. Non-Goals

Agents must NOT:

* Introduce backend architecture
* Add database layer
* Add authentication system
* Add complex state management library unless required
* Add heavy GIS processing on client

---

# 7. Testing Expectations

Minimum expectations:

* Components render without runtime errors
* No TypeScript compile errors
* Map loads valid GeoJSON
* Table handles large CSV gracefully

Optional:

* Basic unit tests for utilities

---

# 8. Deployment Rules

Before production build:

* Remove console logs
* Ensure production build succeeds
* Confirm static assets load correctly
* Validate routes work on refresh

Build command:

```bash
npm run build
```

---

# 9. Decision Principles

When uncertainty exists:

1. Choose the simpler solution.
2. Avoid adding new dependencies.
3. Keep logic explicit and readable.
4. Prefer clarity over abstraction.

---

End of AGENTS.md
