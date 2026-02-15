import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import * as L from 'leaflet'
import { Alert, Box, Button, CircularProgress, FormControlLabel, Paper, Skeleton, Stack, Switch, TextField, Typography, useMediaQuery } from '@mui/material'
import { MapContainer, Polyline, Popup, TileLayer, Tooltip } from 'react-leaflet'
import { useLanguage } from '../i18n/useLanguage'
import { loadAynaBusDetails, loadAynaBusList, type AynaBusDetails, type AynaBusSummary } from '../services/dataService'
import type { RouteGeometry } from '../types/data'

const MAP_CENTER: [number, number] = [40.4093, 49.8671]
const ROUTE_COLORS = ['#2970ff', '#155eef', '#2e90fa', '#175cd3', '#53b1fd', '#7a5af8', '#364152']

export default function LiveRoutes() {
  const { t } = useLanguage()
  const isMobile = useMediaQuery('(max-width:900px)')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [busSearch, setBusSearch] = useState('')
  const [debouncedBusSearch, setDebouncedBusSearch] = useState('')
  const [loadingList, setLoadingList] = useState(true)
  const [loadingBus, setLoadingBus] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [buses, setBuses] = useState<AynaBusSummary[]>([])
  const [selectedBusId, setSelectedBusId] = useState<number | null>(null)
  const [selectedBus, setSelectedBus] = useState<AynaBusDetails | null>(null)
  const [activeRoutePopup, setActiveRoutePopup] = useState<{ label: string; position: [number, number] } | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [sourceLabel, setSourceLabel] = useState('')
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (isMobile) {
      setAutoRefresh(false)
    }
  }, [isMobile])

  const loadBusList = useCallback(async () => {
    setLoadingList(true)
    try {
      const result = await loadAynaBusList()
      setBuses(result.buses)
      setSourceLabel(result.source === 'live-api' ? t('liveApi') : t('fallbackSource'))
      setError(result.buses.length === 0 ? t('noRoutesFound') : null)
    } catch {
      setError(t('routeLoadError'))
      setSourceLabel(t('unavailable'))
    } finally {
      setLoadingList(false)
    }
  }, [t])

  const loadSingleBus = useCallback(
    async (busId: number) => {
      setLoadingBus(true)
      try {
        const busDetails = await loadAynaBusDetails(busId)
        setSelectedBus(busDetails)
        setSourceLabel(busDetails.source === 'live-api' ? t('liveApi') : t('fallbackSource'))
        setError(busDetails.features.length === 0 ? t('noRouteGeometry') : null)
        setLastUpdated(new Date())
      } catch {
        setError(t('routeLoadError'))
      } finally {
        setLoadingBus(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void loadBusList()
  }, [loadBusList])

  useEffect(() => {
    if (buses.length === 0) {
      return
    }

    setSelectedBusId((prev) => {
      if (typeof prev === 'number' && buses.some((bus) => bus.id === prev)) {
        return prev
      }
      return buses[0].id
    })
  }, [buses])

  useEffect(() => {
    if (selectedBusId === null) {
      return
    }

    setActiveRoutePopup(null)
    void loadSingleBus(selectedBusId)
  }, [selectedBusId, loadSingleBus])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedBusSearch(busSearch)
    }, 220)

    return () => window.clearTimeout(timeoutId)
  }, [busSearch])

  useEffect(() => {
    if (!autoRefresh || selectedBusId === null) {
      return
    }

    const interval = window.setInterval(() => {
      void loadSingleBus(selectedBusId)
    }, 45000)

    return () => window.clearInterval(interval)
  }, [autoRefresh, selectedBusId, loadSingleBus])

  const filteredBuses = useMemo(() => {
    const query = debouncedBusSearch.trim().toLowerCase()
    if (!query) {
      return buses
    }
    return buses.filter((bus) => bus.number.toLowerCase().includes(query))
  }, [buses, debouncedBusSearch])

  const renderedRoutes = useMemo(
    () =>
      (selectedBus?.features ?? [])
        .map((feature, index) => {
          const positions = geometryToLatLng(feature.geometry)
          if (positions.length === 0) {
            return null
          }

          const flowName =
            typeof feature.properties.destination === 'string'
              ? feature.properties.destination
              : typeof feature.properties.name === 'string'
                ? feature.properties.name
                : t('unknownFlow')

          return {
            id: String(feature.properties.id ?? index + 1),
            flowName,
            positions,
            color: ROUTE_COLORS[index % ROUTE_COLORS.length],
          }
        })
        .filter((item): item is { id: string; flowName: string; positions: [number, number][]; color: string } => item !== null),
    [selectedBus, t],
  )

  useEffect(() => {
    const map = mapRef.current
    if (!map || renderedRoutes.length === 0) {
      return
    }

    const latLngPoints = renderedRoutes.flatMap((route) => route.positions)
    const bounds = L.latLngBounds(latLngPoints)
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.08))
    }
  }, [renderedRoutes])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      map.invalidateSize()
    }, 180)

    return () => window.clearTimeout(timeoutId)
  }, [isMobile, selectedBusId, renderedRoutes.length])

  return (
    <Stack spacing={2.5}>
      <Paper className="page-panel" elevation={0}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Button variant="contained" onClick={() => void loadBusList()}>
            {t('refreshNow')}
          </Button>
          <FormControlLabel
            control={<Switch checked={autoRefresh} onChange={(_, checked) => setAutoRefresh(checked)} />}
            label={t('autoRefresh')}
          />
        </Stack>
        <Typography variant="body2" sx={{ mt: 1.5 }}>
          {lastUpdated ? `${t('lastUpdated')}: ${lastUpdated.toLocaleTimeString()}` : t('noSuccessfulRefresh')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('dataSource')}: {sourceLabel || t('liveApi')}
        </Typography>
      </Paper>

      {error && <Alert severity="warning">{error}</Alert>}

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} className="live-routes-layout">
        <Paper className="map-panel live-map-panel" elevation={0}>
          <MapContainer
            center={MAP_CENTER}
            zoom={11}
            scrollWheelZoom={!isMobile}
            zoomControl={!isMobile}
            className="map-canvas"
            ref={mapRef}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {renderedRoutes.map((route) => (
              <Polyline
                key={route.id}
                positions={route.positions}
                pathOptions={{ color: route.color, weight: 6, opacity: 0.9 }}
                eventHandlers={{
                  click: (event) => {
                    setActiveRoutePopup({
                      label: `${selectedBus?.number ?? ''} - ${route.flowName}`,
                      position: [event.latlng.lat, event.latlng.lng],
                    })
                  },
                }}
              >
                <Tooltip sticky>{`${selectedBus?.number ?? ''} - ${route.flowName}`}</Tooltip>
              </Polyline>
            ))}
            {activeRoutePopup && (
              <Popup
                position={activeRoutePopup.position}
                eventHandlers={{
                  remove: () => setActiveRoutePopup(null),
                }}
              >
                {activeRoutePopup.label}
              </Popup>
            )}
          </MapContainer>
          {(loadingList || loadingBus) && (
            <Box className="map-overlay-loading loading-overlay-rich">
              <CircularProgress size={18} thickness={5} sx={{ color: '#fff' }} />
              <span>{t('loadingRouteData')}</span>
            </Box>
          )}
          {!loadingList && !loadingBus && renderedRoutes.length === 0 && (
            <Box className="map-overlay-loading">{t('selectRouteRightPanel')}</Box>
          )}
        </Paper>

        <Paper className="page-panel route-list-panel" elevation={0}>
          <Typography variant="subtitle2" gutterBottom>
            {t('routes')} ({filteredBuses.length}/{buses.length})
          </Typography>
          <TextField
            value={busSearch}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setBusSearch(event.target.value)}
            placeholder={t('searchRoutes')}
            size="small"
            fullWidth
            sx={{ mb: 1 }}
          />

          <Box className="bus-grid">
            {loadingList &&
              Array.from({ length: 12 }).map((_, index) => (
                <Skeleton key={`bus-skeleton-${index}`} variant="rounded" height={42} animation="wave" />
              ))}

            {!loadingList &&
              filteredBuses.map((bus) => (
                <Button
                  key={bus.id}
                  variant={selectedBusId === bus.id ? 'contained' : 'outlined'}
                  onClick={() => setSelectedBusId(bus.id)}
                  className="bus-grid-item"
                >
                  {bus.number}
                </Button>
              ))}

            {filteredBuses.length === 0 && <Typography variant="body2">{t('noRoutesFound')}</Typography>}
          </Box>

          {selectedBus && (
            <Box className="bus-info-panel">
              <Typography variant="subtitle2">{`${t('routes')}: ${selectedBus.number}`}</Typography>
              <Typography variant="body2">{t('carrier')}: {selectedBus.carrier ?? t('notAvailable')}</Typography>
              <Typography variant="body2">{t('firstPoint')}: {selectedBus.firstPoint ?? t('notAvailable')}</Typography>
              <Typography variant="body2">{t('lastPoint')}: {selectedBus.lastPoint ?? t('notAvailable')}</Typography>
              <Typography variant="body2">{t('tariff')}: {selectedBus.tariffStr ?? t('notAvailable')}</Typography>
              <Typography variant="body2">
                {t('duration')}: {selectedBus.durationMinuts === null ? t('notAvailable') : `${selectedBus.durationMinuts} min`}
              </Typography>
            </Box>
          )}
        </Paper>
      </Stack>
    </Stack>
  )
}

function geometryToLatLng(geometry: RouteGeometry): [number, number][] {
  if (geometry.type === 'LineString') {
    return geometry.coordinates
      .filter((point): point is [number, number] => Array.isArray(point) && point.length >= 2)
      .map((point) => [point[1], point[0]])
  }

  return geometry.coordinates
    .flatMap((line) => line)
    .filter((point): point is [number, number] => Array.isArray(point) && point.length >= 2)
    .map((point) => [point[1], point[0]])
}
