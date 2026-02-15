import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Alert, Box, Card, CardContent, Grid, Paper, Skeleton, Stack, Typography } from '@mui/material'
import { DataGrid, type GridColDef, type GridLocaleText } from '@mui/x-data-grid'
import { useLanguage } from '../i18n/useLanguage'
import { loadBusCsv } from '../services/dataService'
import type { CsvRecord } from '../types/data'

type AnalyticsRow = CsvRecord & { id: number }

const BusAnalyticsCharts = lazy(() => import('../components/BusAnalyticsCharts'))

export default function BusAnalytics() {
  const { t, language } = useLanguage()
  const [rows, setRows] = useState<AnalyticsRow[]>([])
  const [columns, setColumns] = useState<GridColDef[]>([])
  const [viewMode, setViewMode] = useState<'table' | 'charts'>('table')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    loadBusCsv()
      .then((records) => {
        if (!active) {
          return
        }

        const keys = getColumnKeys(records)
        const dateKeys = keys.filter((key) => isDateColumn(records, key))

        const tableRows = records.map((record, index) => {
          const normalizedRecord: CsvRecord = { ...record }
          for (const dateKey of dateKeys) {
            normalizedRecord[dateKey] = formatDateTime(record[dateKey])
          }
          return {
            ...normalizedRecord,
            id: index + 1,
          }
        })

        const tableColumns: GridColDef[] = keys.map((key) => ({
          field: key,
          headerName: translateColumnLabel(key, language),
          flex: 1,
          minWidth: 160,
          type: isNumericColumn(records, key) ? 'number' : 'string',
        }))

        setRows(tableRows)
        setColumns(tableColumns)
        setError(null)
      })
      .catch(() => {
        if (!active) {
          return
        }
        setError('CSV file not found. Expected /public/data/ceck_in_buss.csv.')
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [language])

  const stats = useMemo(() => {
    const numericColumns = columns.filter((column) => column.type === 'number')
    const firstNumericField = numericColumns[0]?.field
    const totalFirstMetric = firstNumericField
      ? rows.reduce((sum, row) => {
          const value = row[firstNumericField]
          return typeof value === 'number' ? sum + value : sum
        }, 0)
      : null

    return {
      records: rows.length,
      columns: columns.length,
      firstMetric: totalFirstMetric,
      firstMetricLabel: firstNumericField ? translateColumnLabel(firstNumericField, language) : null,
    }
  }, [columns, rows, language])

  const chartData = useMemo(() => {
    const hourField = findFieldName(rows, /hour/i)
    const routeField = findFieldName(rows, /^route$/i)
    const totalCountField = findFieldName(rows, /total\s*count/i)
    const operatorField = findFieldName(rows, /operator/i)
    const smartCardField = findFieldName(rows, /smart\s*card/i)
    const qrField = findFieldName(rows, /\bqr\b/i)

    const hourlyTotals = new Map<string, number>()
    const routeTotals = new Map<string, number>()
    const operatorTotals = new Map<string, number>()
    let smartCardTotal = 0
    let qrTotal = 0

    for (const row of rows) {
      const countValue = totalCountField ? asNumber(row[totalCountField]) : 0
      if (countValue <= 0) {
        continue
      }

      if (hourField) {
        const hourValue = String(row[hourField] ?? '')
        const hourLabel = hourValue.length > 0 ? `${hourValue.padStart(2, '0')}:00` : 'Unknown'
        hourlyTotals.set(hourLabel, (hourlyTotals.get(hourLabel) ?? 0) + countValue)
      }

      if (routeField) {
        const route = String(row[routeField] ?? 'Unknown')
        routeTotals.set(route, (routeTotals.get(route) ?? 0) + countValue)
      }

      if (operatorField) {
        const operator = String(row[operatorField] ?? 'Unknown')
        operatorTotals.set(operator, (operatorTotals.get(operator) ?? 0) + countValue)
      }

      if (smartCardField) {
        smartCardTotal += asNumber(row[smartCardField])
      }

      if (qrField) {
        qrTotal += asNumber(row[qrField])
      }
    }

    const hourly = [...hourlyTotals.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }))

    const topRoutes = [...routeTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([label, value]) => ({ label, value }))

    const operatorSplit = [...operatorTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }))

    const paymentMix = [
      { label: 'SmartCard', value: smartCardTotal },
      { label: 'QR', value: qrTotal },
    ].filter((item) => item.value > 0)

    return { hourly, topRoutes, operatorSplit, paymentMix }
  }, [rows])

  const gridLocaleText = useMemo(() => getGridLocaleText(language), [language])

  return (
    <Stack spacing={2.5}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card className="stats-card" elevation={0}>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                {t('totalRecords')}
              </Typography>
              <Typography variant="h5">{stats.records.toLocaleString()}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card className="stats-card" elevation={0}>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                {t('totalColumns')}
              </Typography>
              <Typography variant="h5">{stats.columns.toLocaleString()}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card className="stats-card" elevation={0}>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                {stats.firstMetricLabel ?? t('firstMetricTotal')}
              </Typography>
              <Typography variant="h5">
                {stats.firstMetric === null ? '-' : stats.firstMetric.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {error && <Alert severity="warning">{error}</Alert>}

      <Stack direction="row" spacing={1}>
        <Typography
          component="button"
          className={`view-mode-chip ${viewMode === 'table' ? 'view-mode-chip-active' : ''}`}
          onClick={() => setViewMode('table')}
        >
          {t('tableView')}
        </Typography>
        <Typography
          component="button"
          className={`view-mode-chip ${viewMode === 'charts' ? 'view-mode-chip-active' : ''}`}
          onClick={() => setViewMode('charts')}
        >
          {t('chartView')}
        </Typography>
      </Stack>

      {viewMode === 'table' && (
        <Paper className="table-panel" elevation={0}>
          <Box sx={{ height: 600, width: '100%' }}>
            <DataGrid
              rows={rows}
              columns={columns}
              localeText={gridLocaleText}
              loading={loading}
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: {
                  paginationModel: {
                    pageSize: 10,
                    page: 0,
                  },
                },
              }}
              disableRowSelectionOnClick
              showToolbar
            />
          </Box>
        </Paper>
      )}

      {viewMode === 'charts' && (
        <Suspense
          fallback={
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 6 }}>
                <Skeleton variant="rounded" height={320} animation="wave" />
              </Grid>
              <Grid size={{ xs: 12, lg: 6 }}>
                <Skeleton variant="rounded" height={320} animation="wave" />
              </Grid>
            </Grid>
          }
        >
          <BusAnalyticsCharts
            chartData={chartData}
            labels={{
              hourlyPassengerVolume: t('hourlyPassengerVolume'),
              topRoutesByCount: t('topRoutesByCount'),
              operatorContribution: t('operatorContribution'),
              paymentMix: t('paymentMix'),
            }}
          />
        </Suspense>
      )}
    </Stack>
  )
}

function getColumnKeys(records: CsvRecord[]): string[] {
  const keys = new Set<string>()
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (key.trim().length > 0) {
        keys.add(key)
      }
    }
  }
  return [...keys]
}

function isNumericColumn(records: CsvRecord[], key: string): boolean {
  const sample = records.find((record) => record[key] !== undefined && record[key] !== null)
  if (!sample) {
    return false
  }
  return typeof sample[key] === 'number'
}

function toHeaderLabel(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function translateColumnLabel(field: string, language: 'az' | 'en' | 'ru'): string {
  const normalized = field.toLowerCase().replaceAll(/[_\-\s]+/g, '')

  const dictionary: Record<string, Record<'az' | 'en' | 'ru', string>> = {
    date: { az: 'Tarix', en: 'Date', ru: 'Дата' },
    hour: { az: 'Saat', en: 'Hour', ru: 'Час' },
    route: { az: 'Marşrut', en: 'Route', ru: 'Маршрут' },
    totalcount: { az: 'Ümumi sərnişin', en: 'Total Count', ru: 'Всего пассажиров' },
    bysmartcard: { az: 'SmartCard ilə', en: 'By SmartCard', ru: 'По SmartCard' },
    byqr: { az: 'QR ilə', en: 'By QR', ru: 'По QR' },
    numberofbusses: { az: 'Avtobus sayı', en: 'Number Of Buses', ru: 'Количество автобусов' },
    operator: { az: 'Operator', en: 'Operator', ru: 'Оператор' },
  }

  const translated = dictionary[normalized]
  if (translated) {
    return translated[language]
  }

  return toHeaderLabel(field)
}

function isDateColumn(records: CsvRecord[], key: string): boolean {
  const lowerKey = key.toLowerCase()
  if (lowerKey.includes('date') || lowerKey.includes('time')) {
    return true
  }

  const sample = records.find((record) => typeof record[key] === 'string')
  if (!sample) {
    return false
  }

  const sampleValue = String(sample[key])
  return !Number.isNaN(Date.parse(sampleValue))
}

function formatDateTime(value: CsvRecord[string]): string {
  if (typeof value === 'object' && value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return ''
    }
    const day = String(value.getUTCDate()).padStart(2, '0')
    const month = String(value.getUTCMonth() + 1).padStart(2, '0')
    const year = value.getUTCFullYear()
    const hours = String(value.getUTCHours()).padStart(2, '0')
    const minutes = String(value.getUTCMinutes()).padStart(2, '0')
    return `${day}.${month}.${year} ${hours}:${minutes}`
  }

  if (typeof value !== 'string') {
    return String(value ?? '')
  }

  const isoLike = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)

  if (isoLike) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return value
    }

    const day = String(date.getUTCDate()).padStart(2, '0')
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const year = date.getUTCFullYear()
    const hours = String(date.getUTCHours()).padStart(2, '0')
    const minutes = String(date.getUTCMinutes()).padStart(2, '0')
    return `${day}.${month}.${year} ${hours}:${minutes}`
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day}.${month}.${year} ${hours}:${minutes}`
}

function findFieldName(rows: AnalyticsRow[], matcher: RegExp): string | null {
  if (rows.length === 0) {
    return null
  }

  const keys = Object.keys(rows[0]).filter((key) => key !== 'id')
  const found = keys.find((key) => matcher.test(key))
  return found ?? null
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function getGridLocaleText(language: 'az' | 'en' | 'ru'): Partial<GridLocaleText> {
  if (language === 'az') {
    return {
      noRowsLabel: 'Məlumat tapılmadı',
      noResultsOverlayLabel: 'Nəticə tapılmadı',
      noColumnsOverlayLabel: 'Sütun tapılmadı',
      toolbarColumns: 'Sütunlar',
      toolbarColumnsLabel: 'Sütunları seç',
      toolbarFilters: 'Filtrlər',
      toolbarFiltersLabel: 'Filtrləri göstər',
      toolbarDensity: 'Sıxlıq',
      toolbarDensityLabel: 'Sətir sıxlığı',
      toolbarDensityCompact: 'Kompakt',
      toolbarDensityStandard: 'Standart',
      toolbarDensityComfortable: 'Rahat',
      toolbarExport: 'İxrac',
      toolbarExportLabel: 'İxrac et',
      toolbarExportCSV: 'CSV yüklə',
      toolbarQuickFilterLabel: 'Sürətli axtarış',
      toolbarQuickFilterPlaceholder: 'Axtar...',
      columnsManagementSearchTitle: 'Sütun axtar',
      columnsManagementShowHideAllText: 'Hamısını göstər/gizlət',
      columnsManagementReset: 'Sıfırla',
      filterPanelColumns: 'Sütun',
      filterPanelOperator: 'Operator',
      filterPanelInputLabel: 'Dəyər',
      columnMenuShowColumns: 'Sütunlar',
      columnMenuManageColumns: 'Sütunları idarə et',
      columnMenuFilter: 'Filtr',
      columnMenuHideColumn: 'Sütunu gizlət',
      columnMenuUnsort: 'Sıralamanı sil',
      columnMenuSortAsc: 'Artan sırala',
      columnMenuSortDesc: 'Azalan sırala',
      footerRowSelected: (count) => `${count.toLocaleString()} sətir seçildi`,
      footerTotalRows: 'Ümumi sətir:',
      paginationRowsPerPage: 'Səhifədə sətir:',
      paginationDisplayedRows: ({ from, to, count }: { from: number; to: number; count: number; estimated: number | undefined }) =>
        `${from}-${to} / ${count !== -1 ? count : `${to}+`}`,
    }
  }

  if (language === 'ru') {
    return {
      noRowsLabel: 'Нет данных',
      noResultsOverlayLabel: 'Ничего не найдено',
      noColumnsOverlayLabel: 'Нет колонок',
      toolbarColumns: 'Колонки',
      toolbarColumnsLabel: 'Выбрать колонки',
      toolbarFilters: 'Фильтры',
      toolbarFiltersLabel: 'Показать фильтры',
      toolbarDensity: 'Плотность',
      toolbarDensityLabel: 'Плотность строк',
      toolbarDensityCompact: 'Компактно',
      toolbarDensityStandard: 'Стандарт',
      toolbarDensityComfortable: 'Комфортно',
      toolbarExport: 'Экспорт',
      toolbarExportLabel: 'Экспорт',
      toolbarExportCSV: 'Скачать CSV',
      toolbarQuickFilterLabel: 'Быстрый поиск',
      toolbarQuickFilterPlaceholder: 'Поиск...',
      columnsManagementSearchTitle: 'Поиск колонки',
      columnsManagementShowHideAllText: 'Показать/скрыть все',
      columnsManagementReset: 'Сброс',
      filterPanelColumns: 'Колонка',
      filterPanelOperator: 'Оператор',
      filterPanelInputLabel: 'Значение',
      columnMenuShowColumns: 'Колонки',
      columnMenuManageColumns: 'Управление колонками',
      columnMenuFilter: 'Фильтр',
      columnMenuHideColumn: 'Скрыть колонку',
      columnMenuUnsort: 'Убрать сортировку',
      columnMenuSortAsc: 'Сортировать по возрастанию',
      columnMenuSortDesc: 'Сортировать по убыванию',
      footerRowSelected: (count) => `Выбрано строк: ${count.toLocaleString()}`,
      footerTotalRows: 'Всего строк:',
      paginationRowsPerPage: 'Строк на странице:',
      paginationDisplayedRows: ({ from, to, count }: { from: number; to: number; count: number; estimated: number | undefined }) =>
        `${from}-${to} из ${count !== -1 ? count : `${to}+`}`,
    }
  }

  return {
    noRowsLabel: 'No rows',
    noResultsOverlayLabel: 'No results found',
    noColumnsOverlayLabel: 'No columns',
    toolbarColumns: 'Columns',
    toolbarColumnsLabel: 'Select columns',
    toolbarFilters: 'Filters',
    toolbarFiltersLabel: 'Show filters',
    toolbarDensity: 'Density',
    toolbarDensityLabel: 'Row density',
    toolbarDensityCompact: 'Compact',
    toolbarDensityStandard: 'Standard',
    toolbarDensityComfortable: 'Comfortable',
    toolbarExport: 'Export',
    toolbarExportLabel: 'Export',
    toolbarExportCSV: 'Download CSV',
    toolbarQuickFilterLabel: 'Quick filter',
    toolbarQuickFilterPlaceholder: 'Search...',
    columnsManagementSearchTitle: 'Search column',
    columnsManagementShowHideAllText: 'Show/hide all',
    columnsManagementReset: 'Reset',
    filterPanelColumns: 'Column',
    filterPanelOperator: 'Operator',
    filterPanelInputLabel: 'Value',
    columnMenuShowColumns: 'Columns',
    columnMenuManageColumns: 'Manage columns',
    columnMenuFilter: 'Filter',
    columnMenuHideColumn: 'Hide column',
    columnMenuUnsort: 'Unsort',
    columnMenuSortAsc: 'Sort by ASC',
    columnMenuSortDesc: 'Sort by DESC',
    footerRowSelected: (count) => `${count.toLocaleString()} row(s) selected`,
    footerTotalRows: 'Total Rows:',
    paginationRowsPerPage: 'Rows per page:',
    paginationDisplayedRows: ({ from, to, count }: { from: number; to: number; count: number; estimated: number | undefined }) =>
      `${from}-${to} of ${count !== -1 ? count : `${to}+`}`,
  }
}
