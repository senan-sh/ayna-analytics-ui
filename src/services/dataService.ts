import axios from 'axios'
import * as Papa from 'papaparse'
import type { Position } from 'geojson'
import type { CsvRecord, GenericProperties, RegionsGeoJson, RouteFeature, RouteGeometry } from '../types/data'

const REGIONS_DATA_PATH = '/data/zone_attributes_synthetic.geojson'
const LEGACY_REGIONS_DATA_PATH = '/zone_attributes_synthetic%20.geojson'
const BUS_CSV_PATH = '/data/ceck_in_buss.csv'
const DEFAULT_ROUTES_ENDPOINT = 'https://map.ayna.gov.az/api/routes'
const DEFAULT_AYNA_API_BASE = 'https://map-api.ayna.gov.az'
const BUS_LIST_SNAPSHOT_PATH = '/data/getBusList.json'
const BUS_BY_ID_SNAPSHOT_PATH = '/data/example-getBusById-response.json'
const REQUEST_TIMEOUT_MS = 12000
const BUS_LIST_CACHE_TTL_MS = 5 * 60 * 1000
const BUS_DETAILS_CACHE_TTL_MS = 90 * 1000

let busListCache: { data: AynaBusSummary[]; expiresAt: number } | null = null
const busDetailsCache = new Map<number, { data: AynaBusDetails; expiresAt: number }>()

export function clearAynaBusCaches(): void {
  busListCache = null
  busDetailsCache.clear()
}

export async function loadRegionsGeoJson(): Promise<RegionsGeoJson> {
  const response = await loadFirstAvailableJson([REGIONS_DATA_PATH, LEGACY_REGIONS_DATA_PATH])

  const payload = (await response.json()) as RegionsGeoJson
  if (!payload.features || payload.type !== 'FeatureCollection') {
    throw new Error('Regions file is not a valid GeoJSON FeatureCollection.')
  }

  return payload
}

async function loadFirstAvailableJson(paths: string[]): Promise<Response> {
  for (const path of paths) {
    const response = await fetch(path)
    if (response.ok) {
      return response
    }
  }

  throw new Error(`Could not load any JSON resource from: ${paths.join(', ')}`)
}

export async function loadBusCsv(): Promise<CsvRecord[]> {
  const response = await fetch(BUS_CSV_PATH)
  if (!response.ok) {
    throw new Error(`Could not load ${BUS_CSV_PATH}.`)
  }

  const csvText = await response.text()
  const result = Papa.parse<CsvRecord>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  })

  if (result.errors.length > 0) {
    throw new Error(`CSV parse error: ${result.errors[0].message}`)
  }

  return result.data
}

export async function loadRouteFeatures(endpoint = DEFAULT_ROUTES_ENDPOINT): Promise<RouteFeature[]> {
  const { data } = await axios.get(endpoint, { timeout: REQUEST_TIMEOUT_MS })
  return normalizeRoutePayload(data)
}

type LiveRouteResult = {
  features: RouteFeature[]
  source: 'live-api' | 'snapshot-fallback'
}

export type AynaBusSummary = {
  id: number
  number: string
}

export type AynaBusDetails = {
  id: number
  number: string
  carrier: string | null
  firstPoint: string | null
  lastPoint: string | null
  tariffStr: string | null
  durationMinuts: number | null
  features: RouteFeature[]
  source: 'live-api' | 'snapshot-fallback'
}

export async function loadAynaBusList(apiBaseUrl?: string): Promise<{ buses: AynaBusSummary[]; source: 'live-api' | 'snapshot-fallback' }> {
  if (busListCache && busListCache.expiresAt > Date.now()) {
    return {
      buses: busListCache.data,
      source: 'live-api',
    }
  }

  for (const baseUrl of getApiBaseCandidates(apiBaseUrl)) {
    const sanitizedBase = sanitizeBaseUrl(baseUrl)
    try {
      const list = await getBusList(sanitizedBase)
      const buses = list
        .filter((item) => typeof item.id === 'number' && Number.isFinite(item.id))
        .map((item) => ({
          id: item.id,
          number: typeof item.number === 'string' && item.number.trim().length > 0 ? item.number : String(item.id),
        }))

      busListCache = {
        data: buses,
        expiresAt: Date.now() + BUS_LIST_CACHE_TTL_MS,
      }

      return {
        buses,
        source: 'live-api',
      }
    } catch {
      continue
    }
  }

  const snapshot = await loadBusListSnapshot()
  return {
    buses: snapshot,
    source: 'snapshot-fallback',
  }
}

export async function loadAynaBusDetails(
  busId: number,
  apiBaseUrl?: string,
  forceRefresh = false,
): Promise<AynaBusDetails> {
  if (!forceRefresh) {
    const cached = busDetailsCache.get(busId)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data
    }
  }

  for (const baseUrl of getApiBaseCandidates(apiBaseUrl)) {
    const sanitizedBase = sanitizeBaseUrl(baseUrl)
    try {
      const bus = await getBusById(sanitizedBase, busId)
      const mapped = mapBusDetails(bus, 'live-api')
      busDetailsCache.set(busId, { data: mapped, expiresAt: Date.now() + BUS_DETAILS_CACHE_TTL_MS })
      return mapped
    } catch {
      continue
    }
  }

  const fallbackBus = await loadBusByIdSnapshot(busId)
  const mapped = mapBusDetails(fallbackBus, 'snapshot-fallback')
  busDetailsCache.set(busId, { data: mapped, expiresAt: Date.now() + BUS_DETAILS_CACHE_TTL_MS })
  return mapped
}

export async function loadAynaRouteFeatures(apiBaseUrl?: string): Promise<LiveRouteResult> {
  for (const baseUrl of getApiBaseCandidates(apiBaseUrl)) {
    const sanitizedBase = sanitizeBaseUrl(baseUrl)
    try {
      const busList = await getBusList(sanitizedBase)
      const busIds = busList
        .map((bus) => bus.id)
        .filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
        .slice(0, 250)

      if (busIds.length === 0) {
        throw new Error('No bus ids in getBusList response')
      }

      const detailResponses = await getBusDetailsInBatches(sanitizedBase, busIds, 20)
      const features = detailResponses
        .filter((item): item is PromiseFulfilledResult<BusDetailResponse> => item.status === 'fulfilled')
        .flatMap((item) => mapBusDetailToFeatures(item.value))

      if (features.length === 0) {
        throw new Error('No route coordinates in getBusById responses')
      }

      return {
        features,
        source: 'live-api',
      }
    } catch {
      continue
    }
  }

  const fallback = await loadSnapshotRouteFeatures()
  return {
    features: fallback,
    source: 'snapshot-fallback',
  }
}

async function getBusDetailsInBatches(baseUrl: string, busIds: number[], batchSize: number): Promise<PromiseSettledResult<BusDetailResponse>[]> {
  const settled: PromiseSettledResult<BusDetailResponse>[] = []

  for (let index = 0; index < busIds.length; index += batchSize) {
    const batch = busIds.slice(index, index + batchSize)
    const result = await Promise.allSettled(batch.map((id) => getBusById(baseUrl, id)))
    settled.push(...result)
  }

  return settled
}

type BusListItem = {
  id: number
  number?: string
}

type FlowPoint = {
  lat: number
  lng: number
}

type BusRouteItem = {
  id?: number
  code?: string
  customerName?: string
  destination?: string
  directionTypeId?: number
  flowCoordinates?: FlowPoint[]
}

type BusDetailResponse = {
  id?: number
  number?: string
  carrier?: string | null
  firstPoint?: string | null
  lastPoint?: string | null
  tariffStr?: string | null
  durationMinuts?: number | null
  routes?: BusRouteItem[]
}

async function getBusList(baseUrl: string): Promise<BusListItem[]> {
  const { data } = await axios.get(`${baseUrl}/api/bus/getBusList`, { timeout: REQUEST_TIMEOUT_MS })
  if (!Array.isArray(data)) {
    return []
  }
  return data as BusListItem[]
}

async function getBusById(baseUrl: string, id: number): Promise<BusDetailResponse> {
  const { data } = await axios.get(`${baseUrl}/api/bus/getBusById?id=${id}`, { timeout: REQUEST_TIMEOUT_MS })
  return data as BusDetailResponse
}

async function loadBusListSnapshot(): Promise<AynaBusSummary[]> {
  const response = await fetch(BUS_LIST_SNAPSHOT_PATH)
  if (!response.ok) {
    return []
  }

  const payload = (await response.json()) as unknown
  if (!Array.isArray(payload)) {
    return []
  }

  return payload
    .filter((item): item is BusListItem => isRecord(item) && typeof item.id === 'number')
    .map((item) => ({
      id: item.id,
      number: typeof item.number === 'string' && item.number.trim().length > 0 ? item.number : String(item.id),
    }))
}

async function loadBusByIdSnapshot(busId: number): Promise<BusDetailResponse> {
  const response = await fetch(BUS_BY_ID_SNAPSHOT_PATH)
  if (!response.ok) {
    throw new Error('Snapshot detail file missing')
  }

  const payload = (await response.json()) as BusDetailResponse
  if (payload.id === busId) {
    return payload
  }

  return {
    id: busId,
    number: String(busId),
    routes: [],
  }
}

async function loadSnapshotRouteFeatures(): Promise<RouteFeature[]> {
  const [busListResponse, busExampleResponse] = await Promise.all([
    fetch(BUS_LIST_SNAPSHOT_PATH),
    fetch(BUS_BY_ID_SNAPSHOT_PATH),
  ])

  const features: RouteFeature[] = []

  if (busExampleResponse.ok) {
    const busExample = (await busExampleResponse.json()) as BusDetailResponse
    features.push(...mapBusDetailToFeatures(busExample))
  }

  if (features.length > 0) {
    return features
  }

  if (!busListResponse.ok) {
    return []
  }

  const list = (await busListResponse.json()) as unknown
  if (!Array.isArray(list) || list.length === 0) {
    return []
  }

  return []
}

function mapBusDetailToFeatures(bus: BusDetailResponse): RouteFeature[] {
  if (!Array.isArray(bus.routes)) {
    return []
  }

  return bus.routes
    .map((route, index) => {
      const coordinates = route.flowCoordinates
        ?.filter((point) => Number.isFinite(point?.lng) && Number.isFinite(point?.lat))
        .map((point) => [point.lng, point.lat] as Position)

      if (!coordinates || coordinates.length < 2) {
        return null
      }

      const routeCode = route.code ?? route.customerName ?? bus.number ?? `Bus ${String(bus.id ?? '-')}`
      const routeId = `${String(bus.id ?? 'x')}-${String(route.id ?? index + 1)}-${String(route.directionTypeId ?? '0')}`
      const routeName = route.destination ?? routeCode

      return {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates,
        },
        properties: {
          id: routeId,
          name: routeName,
          number: routeCode,
          busId: bus.id,
          directionTypeId: route.directionTypeId,
        },
      } as RouteFeature
    })
    .filter((item): item is RouteFeature => item !== null)
}

function mapBusDetails(bus: BusDetailResponse, source: 'live-api' | 'snapshot-fallback'): AynaBusDetails {
  const safeId = typeof bus.id === 'number' ? bus.id : -1
  const safeNumber = typeof bus.number === 'string' && bus.number.trim().length > 0 ? bus.number : String(safeId)

  return {
    id: safeId,
    number: safeNumber,
    carrier: typeof bus.carrier === 'string' ? bus.carrier : null,
    firstPoint: typeof bus.firstPoint === 'string' ? bus.firstPoint : null,
    lastPoint: typeof bus.lastPoint === 'string' ? bus.lastPoint : null,
    tariffStr: typeof bus.tariffStr === 'string' ? bus.tariffStr : null,
    durationMinuts: typeof bus.durationMinuts === 'number' ? bus.durationMinuts : null,
    features: mapBusDetailToFeatures(bus),
    source,
  }
}

function sanitizeBaseUrl(baseUrl: string): string {
  const value = baseUrl.trim()
  if (!value) {
    return DEFAULT_AYNA_API_BASE
  }
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function getApiBaseCandidates(baseUrl?: string): string[] {
  if (typeof baseUrl === 'string' && baseUrl.trim().length > 0) {
    return [baseUrl]
  }

  return ['/ayna-api', DEFAULT_AYNA_API_BASE]
}

function normalizeRoutePayload(payload: unknown): RouteFeature[] {
  if (isRouteFeatureCollection(payload)) {
    return payload.features
  }

  const items = extractArray(payload)
  return items
    .map((item, index) => createRouteFeature(item, index))
    .filter((item): item is RouteFeature => item !== null)
}

function isRouteFeatureCollection(payload: unknown): payload is { features: RouteFeature[] } {
  if (!isRecord(payload)) {
    return false
  }

  if (payload.type !== 'FeatureCollection' || !Array.isArray(payload.features)) {
    return false
  }

  return true
}

function extractArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (!isRecord(payload)) {
    return []
  }

  const nestedCandidate = payload.data
  if (Array.isArray(nestedCandidate)) {
    return nestedCandidate
  }

  if (isRecord(nestedCandidate) && Array.isArray(nestedCandidate.routes)) {
    return nestedCandidate.routes
  }

  if (Array.isArray(payload.routes)) {
    return payload.routes
  }

  return []
}

function createRouteFeature(input: unknown, index: number): RouteFeature | null {
  if (!isRecord(input)) {
    return null
  }

  const geometry = resolveGeometry(input)
  if (!geometry) {
    return null
  }

  const id = input.id ?? input.route_id ?? index + 1
  const name = input.name ?? input.route_name ?? input.number ?? `Route ${String(id)}`

  const properties: GenericProperties = {
    ...input,
    id,
    name,
  }

  return {
    type: 'Feature',
    geometry,
    properties,
  }
}

function resolveGeometry(input: Record<string, unknown>): RouteGeometry | null {
  if (isRecord(input.geometry)) {
    const geoType = input.geometry.type
    const coordinates = input.geometry.coordinates
    if (geoType === 'LineString' && isLineCoordinates(coordinates)) {
      return {
        type: 'LineString',
        coordinates,
      }
    }
    if (geoType === 'MultiLineString' && isMultiLineCoordinates(coordinates)) {
      return {
        type: 'MultiLineString',
        coordinates,
      }
    }
  }

  const coordinateCandidates = [input.coordinates, input.path, input.route, input.polyline]
  for (const candidate of coordinateCandidates) {
    if (isMultiLineCoordinates(candidate)) {
      return {
        type: 'MultiLineString',
        coordinates: candidate,
      }
    }

    if (isLineCoordinates(candidate)) {
      return {
        type: 'LineString',
        coordinates: candidate,
      }
    }
  }

  return null
}

function isLineCoordinates(value: unknown): value is Position[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false
  }
  return value.every((point) => Array.isArray(point) && point.length >= 2 && point.every((coordinate) => typeof coordinate === 'number'))
}

function isMultiLineCoordinates(value: unknown): value is Position[][] {
  if (!Array.isArray(value) || value.length === 0) {
    return false
  }
  return value.every((line) => isLineCoordinates(line))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
