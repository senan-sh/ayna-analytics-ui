import type { Feature, FeatureCollection, Geometry, LineString, MultiLineString } from 'geojson'

export type GenericProperties = Record<string, unknown>

export type RegionFeature = Feature<Geometry, GenericProperties>
export type RegionsGeoJson = FeatureCollection<Geometry, GenericProperties>

export type RouteGeometry = LineString | MultiLineString
export type RouteFeature = Feature<RouteGeometry, GenericProperties>

export type CsvRecord = Record<string, string | number | boolean | Date | null>
