/// <reference lib="webworker" />

import * as Papa from 'papaparse'
import type {
  AnalyticsCell,
  AnalyticsRow,
  BusAnalyticsChartData,
  BusAnalyticsWorkerIncomingMessage,
  BusAnalyticsWorkerRequest,
  BusAnalyticsWorkerSuccessPayload,
} from '../types/busAnalytics'

type RawRecord = Record<string, unknown>

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope

workerScope.onmessage = async (event: MessageEvent<BusAnalyticsWorkerRequest>) => {
  const request = event.data
  if (request.type !== 'parse-csv') {
    return
  }

  try {
    const response = await fetch(request.csvUrl)
    if (!response.ok) {
      throw new Error(`CSV file not found. Expected ${request.csvUrl}.`)
    }

    const csvText = await response.text()
    const parsed = Papa.parse<RawRecord>(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    })

    if (parsed.errors.length > 0) {
      throw new Error(`CSV parse error: ${parsed.errors[0].message}`)
    }

    const records = parsed.data.filter(isRecord)
    const fields = getColumnKeys(records)
    const dateFields = new Set(fields.filter((field) => isDateColumn(records, field)))
    const numericFields = fields.filter((field) => isNumericColumn(records, field))
    const rows = records.map((record, index) => normalizeRow(record, fields, dateFields, index + 1))

    const firstMetricField = numericFields[0] ?? null
    const firstMetricTotal =
      firstMetricField === null
        ? null
        : rows.reduce((sum, row) => sum + asNumber(row[firstMetricField]), 0)

    const payload: BusAnalyticsWorkerSuccessPayload = {
      rows,
      fields,
      numericFields,
      firstMetricField,
      firstMetricTotal,
      chartData: buildChartData(rows, fields),
    }

    const message: BusAnalyticsWorkerIncomingMessage = {
      type: 'parse-success',
      payload,
    }
    workerScope.postMessage(message)
  } catch (error) {
    const message: BusAnalyticsWorkerIncomingMessage = {
      type: 'parse-error',
      message: error instanceof Error ? error.message : 'Failed to process CSV data.',
    }
    workerScope.postMessage(message)
  }
}

function normalizeRow(record: RawRecord, fields: string[], dateFields: Set<string>, id: number): AnalyticsRow {
  const row: Record<string, AnalyticsCell> = {}

  for (const field of fields) {
    row[field] = normalizeCell(record[field], dateFields.has(field))
  }

  return {
    ...row,
    id,
  }
}

function normalizeCell(value: unknown, formatAsDate: boolean): AnalyticsCell {
  if (formatAsDate) {
    return formatDateTime(value)
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (value === null || value === undefined) {
    return null
  }

  if (value instanceof Date) {
    return formatDateTime(value)
  }

  return String(value)
}

function getColumnKeys(records: RawRecord[]): string[] {
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

function isNumericColumn(records: RawRecord[], field: string): boolean {
  const sample = records.find((record) => record[field] !== undefined && record[field] !== null)
  if (!sample) {
    return false
  }

  return typeof sample[field] === 'number'
}

function isDateColumn(records: RawRecord[], field: string): boolean {
  const lowerField = field.toLowerCase()
  if (lowerField.includes('date') || lowerField.includes('time')) {
    return true
  }

  const sample = records.find((record) => typeof record[field] === 'string' || record[field] instanceof Date)
  if (!sample) {
    return false
  }

  const value = sample[field]
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime())
  }

  if (typeof value === 'string') {
    return !Number.isNaN(Date.parse(value))
  }

  return false
}

function formatDateTime(value: unknown): string {
  if (value instanceof Date) {
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
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  if (isoLike) {
    const day = String(parsed.getUTCDate()).padStart(2, '0')
    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
    const year = parsed.getUTCFullYear()
    const hours = String(parsed.getUTCHours()).padStart(2, '0')
    const minutes = String(parsed.getUTCMinutes()).padStart(2, '0')
    return `${day}.${month}.${year} ${hours}:${minutes}`
  }

  const day = String(parsed.getDate()).padStart(2, '0')
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const year = parsed.getFullYear()
  const hours = String(parsed.getHours()).padStart(2, '0')
  const minutes = String(parsed.getMinutes()).padStart(2, '0')
  return `${day}.${month}.${year} ${hours}:${minutes}`
}

function buildChartData(rows: AnalyticsRow[], fields: string[]): BusAnalyticsChartData {
  const hourField = findFieldName(fields, /hour/i)
  const routeField = findFieldName(fields, /^route$/i)
  const totalCountField = findFieldName(fields, /total\s*count/i)
  const operatorField = findFieldName(fields, /operator/i)
  const smartCardField = findFieldName(fields, /smart\s*card/i)
  const qrField = findFieldName(fields, /\bqr\b/i)

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
}

function findFieldName(fields: string[], matcher: RegExp): string | null {
  const found = fields.find((field) => matcher.test(field))
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

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null
}

export {}
