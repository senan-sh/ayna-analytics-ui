import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, Button, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Typography } from '@mui/material'
import { scaleQuantile } from 'd3-scale'
import * as L from 'leaflet'
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet'
import type { Map as LeafletMap, PathOptions } from 'leaflet'
import { loadRegionsGeoJson } from '../services/dataService'
import { useLanguage } from '../i18n/useLanguage'
import type { RegionFeature, RegionsGeoJson } from '../types/data'

type RegionLevel = 'micro' | 'meso' | 'macro'
type MetricKey = 'population' | 'jobs'

const MAP_CENTER: [number, number] = [40.4093, 49.8671]

const COLOR_RANGE = ['#eff4ff', '#dbe8ff', '#b8d2ff', '#7eadff', '#2970ff']

export default function Demographics() {
  const { t } = useLanguage()
  const [regions, setRegions] = useState<RegionsGeoJson | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [regionLevel, setRegionLevel] = useState<RegionLevel>('micro')
  const [metric, setMetric] = useState<MetricKey>('population')
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    let active = true
    loadRegionsGeoJson()
      .then((data) => {
        if (!active) {
          return
        }
        setRegions(data)
        setError(null)
      })
      .catch(() => {
        if (!active) {
          return
        }
        setError('Regional GeoJSON file not found. Expected /public/data/zone_attributes_synthetic.geojson.')
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const hasExplicitRegionLevels = useMemo(() => {
    if (!regions) {
      return false
    }

    return regions.features.some((feature) => getFeatureLevel(feature.properties) !== null)
  }, [regions])

  const filteredFeatures = useMemo(() => {
    if (!regions) {
      return []
    }

    if (!hasExplicitRegionLevels) {
      return regions.features
    }

    return regions.features.filter((feature) => featureMatchesLevel(feature.properties, regionLevel))
  }, [regions, hasExplicitRegionLevels, regionLevel])

  const groupedTotalsByLevel = useMemo(() => {
    if (!regions || hasExplicitRegionLevels) {
      return null
    }

    const totals = new Map<string, { population: number; jobs: number }>()
    for (const feature of regions.features) {
      const key = getHierarchyName(feature.properties, regionLevel)
      const current = totals.get(key) ?? { population: 0, jobs: 0 }
      current.population += getMetricValue(feature.properties, 'population')
      current.jobs += getMetricValue(feature.properties, 'jobs')
      totals.set(key, current)
    }

    return totals
  }, [regions, hasExplicitRegionLevels, regionLevel])

  const resolveDisplayMetricValue = useCallback(
    (properties: Record<string, unknown>, selectedMetric: MetricKey): number => {
      if (hasExplicitRegionLevels || !groupedTotalsByLevel) {
        return getMetricValue(properties, selectedMetric)
      }

      const key = getHierarchyName(properties, regionLevel)
      const totals = groupedTotalsByLevel.get(key)
      if (!totals) {
        return 0
      }
      return selectedMetric === 'population' ? totals.population : totals.jobs
    },
    [groupedTotalsByLevel, hasExplicitRegionLevels, regionLevel],
  )

  const metricValues = useMemo(() => {
    if (!hasExplicitRegionLevels && groupedTotalsByLevel) {
      return [...groupedTotalsByLevel.values()]
        .map((totals) => (metric === 'population' ? totals.population : totals.jobs))
        .filter((value) => value > 0)
    }

    return filteredFeatures.map((feature) => resolveDisplayMetricValue(feature.properties, metric)).filter((value) => value > 0)
  }, [filteredFeatures, groupedTotalsByLevel, hasExplicitRegionLevels, metric, resolveDisplayMetricValue])

  const colorScale = useMemo(() => {
    if (metricValues.length === 0) {
      return null
    }

    return scaleQuantile<string>().domain(metricValues).range(COLOR_RANGE)
  }, [metricValues])

  const legendItems = useMemo(() => {
    if (!colorScale || metricValues.length === 0) {
      return [] as Array<{ color: string; label: string }>
    }

    const sortedValues = [...metricValues].sort((a, b) => a - b)
    const min = sortedValues[0]
    const max = sortedValues[sortedValues.length - 1]
    const thresholds = colorScale.quantiles()
    const boundaries = [min, ...thresholds, max]

    return COLOR_RANGE.map((color, index) => {
      const start = boundaries[index]
      const end = boundaries[index + 1]
      return {
        color,
        label: `${formatCompact(start)} - ${formatCompact(end)}`,
      }
    })
  }, [colorScale, metricValues])

  const legendBounds = useMemo(() => {
    if (metricValues.length === 0) {
      return { min: 0, max: 0 }
    }

    return {
      min: Math.min(...metricValues),
      max: Math.max(...metricValues),
    }
  }, [metricValues])

  const styleFeature = useCallback(
    (feature?: RegionFeature): PathOptions => {
      const value = feature ? resolveDisplayMetricValue(feature.properties, metric) : 0
      return {
        color: '#2557be',
        weight: 1,
        fillOpacity: 0.78,
        fillColor: colorScale ? colorScale(value) : '#dce7ff',
      }
    },
    [colorScale, metric, resolveDisplayMetricValue],
  )

  const onEachFeature = useCallback(
    (feature: RegionFeature, layer: L.Layer) => {
      const properties = feature.properties
      const name = getRegionName(properties, regionLevel)
      const value = resolveDisplayMetricValue(properties, metric)
      const population = resolveDisplayMetricValue(properties, 'population')
      const jobs = resolveDisplayMetricValue(properties, 'jobs')
      const micro = getHierarchyName(properties, 'micro')
      const meso = getHierarchyName(properties, 'meso')
      const macro = getHierarchyName(properties, 'macro')
      const label = `<div class="map-tooltip-inner"><strong>${escapeHtml(name)}</strong><span>${t(metric)}: ${value.toLocaleString()}</span></div>`
      layer.bindTooltip(label, { sticky: true, className: 'map-tooltip' })
      layer.bindPopup(
        `<div class="map-popup"><div class="map-popup-title">${escapeHtml(name)}</div><div class="map-popup-grid"><div class="map-popup-row"><span>${escapeHtml(t('micro'))}</span><strong>${escapeHtml(micro)}</strong></div><div class="map-popup-row"><span>${escapeHtml(t('meso'))}</span><strong>${escapeHtml(meso)}</strong></div><div class="map-popup-row"><span>${escapeHtml(t('macro'))}</span><strong>${escapeHtml(macro)}</strong></div><div class="map-popup-row"><span>${escapeHtml(t('population'))}</span><strong>${population.toLocaleString()}</strong></div><div class="map-popup-row"><span>${escapeHtml(t('jobs'))}</span><strong>${jobs.toLocaleString()}</strong></div></div></div>`,
      )
    },
    [metric, regionLevel, resolveDisplayMetricValue, t],
  )

  useEffect(() => {
    const map = mapRef.current
    if (!map || filteredFeatures.length === 0) {
      return
    }

    const bounds = L.geoJSON({ type: 'FeatureCollection', features: filteredFeatures } as never).getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.05))
    }
  }, [filteredFeatures])

  const handleResetView = () => {
    const map = mapRef.current
    if (!map) {
      return
    }
    map.setView(MAP_CENTER, 11)
  }

  return (
    <Stack spacing={2.5}>
      <Paper className="page-panel" elevation={0}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="metric-label">{t('metric')}</InputLabel>
            <Select
              labelId="metric-label"
              value={metric}
              label={t('metric')}
              onChange={(event) => setMetric(event.target.value as MetricKey)}
            >
              <MenuItem value="population">{t('population')}</MenuItem>
              <MenuItem value="jobs">{t('jobs')}</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="region-level-label">{t('regionLevel')}</InputLabel>
            <Select
              labelId="region-level-label"
              value={regionLevel}
              label={t('regionLevel')}
              onChange={(event) => setRegionLevel(event.target.value as RegionLevel)}
            >
              <MenuItem value="micro">{t('micro')}</MenuItem>
              <MenuItem value="meso">{t('meso')}</MenuItem>
              <MenuItem value="macro">{t('macro')}</MenuItem>
            </Select>
          </FormControl>

          <Button variant="contained" color="secondary" onClick={handleResetView}>
            {t('resetView')}
          </Button>
        </Stack>

        <Typography variant="body2" sx={{ mt: 1.5 }}>
          {t(regionLevel)} {t('showingWithMetric')} {t(metric)}.
        </Typography>
      </Paper>

      {error && <Alert severity="warning">{error}</Alert>}

      <Paper className="map-panel" elevation={0}>
        {loading ? (
          <Box className="loading-state">{t('loadingMapData')}</Box>
        ) : (
          <MapContainer
            center={MAP_CENTER}
            zoom={11}
            scrollWheelZoom
            attributionControl={false}
            className="map-canvas"
            ref={mapRef}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filteredFeatures.length > 0 && (
              <GeoJSON
                data={{ type: 'FeatureCollection', features: filteredFeatures } as never}
                style={styleFeature as never}
                onEachFeature={onEachFeature as never}
              />
            )}
          </MapContainer>
        )}
      </Paper>

      <Paper className="page-panel" elevation={0}>
        <Typography variant="subtitle2" gutterBottom>
          {t('legend')} ({t(metric)})
        </Typography>
        <Box className="legend-card">
          <Box className="legend-gradient-track" />
          <Box className="legend-boundary-row">
            <Typography variant="body2">{formatCompact(legendBounds.min)}</Typography>
            <Typography variant="body2">{formatCompact(legendBounds.max)}</Typography>
          </Box>
          <Box className="legend-chip-grid">
            {legendItems.map((item) => (
              <Box key={item.color} className="legend-item">
                <Box className="legend-swatch" sx={{ backgroundColor: item.color }} />
                <Typography variant="caption">{item.label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Paper>
    </Stack>
  )
}

function getRegionName(properties: Record<string, unknown>, level: RegionLevel): string {
  const candidatesByLevel: Record<RegionLevel, string[]> = {
    micro: ['MICRO', 'micro', 'zone_id', 'id', 'fid', 'name'],
    meso: ['MESO', 'meso', 'region_name', 'zone_name', 'district'],
    macro: ['MACRO', 'macro', 'region_name', 'zone_name', 'district'],
  }

  const candidates = [...candidatesByLevel[level], 'name', 'region_name', 'zone_name', 'district', 'id']
  for (const key of candidates) {
    const value = properties[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
  }
  return 'Unknown Region'
}

function featureMatchesLevel(properties: Record<string, unknown>, selectedLevel: RegionLevel): boolean {
  const level = getFeatureLevel(properties)
  if (!level) {
    return true
  }

  return level === selectedLevel
}

function getFeatureLevel(properties: Record<string, unknown>): RegionLevel | null {
  const candidates = ['level', 'region_level', 'zone_level', 'category', 'LEVEL', 'REGION_LEVEL', 'ZONE_LEVEL', 'CATEGORY']
  for (const key of candidates) {
    const value = properties[key]
    if (typeof value === 'string') {
      const lower = value.toLowerCase()
      if (lower === 'micro' || lower === 'meso' || lower === 'macro') {
        return lower
      }
    }
    if (typeof value === 'number') {
      if (value === 1) {
        return 'micro'
      }
      if (value === 2) {
        return 'meso'
      }
      if (value === 3) {
        return 'macro'
      }
    }
  }

  return null
}

function getMetricValue(properties: Record<string, unknown>, metric: MetricKey): number {
  const candidates =
    metric === 'population'
      ? ['population', 'pop', 'population_total', 'residents']
      : ['tot_jobs', 'jobs', 'employment', 'job_count', 'jobs_total']

  for (const key of candidates) {
    const value = properties[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return 0
}

function getHierarchyName(properties: Record<string, unknown>, level: RegionLevel): string {
  const candidates: Record<RegionLevel, string[]> = {
    micro: ['MICRO', 'micro', 'zone_id', 'id', 'fid'],
    meso: ['MESO', 'meso', 'region_name', 'zone_name'],
    macro: ['MACRO', 'macro', 'district', 'region_name'],
  }

  for (const key of candidates[level]) {
    const value = properties[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
  }

  return '-'
}

function formatCompact(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }
  return value.toLocaleString()
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
