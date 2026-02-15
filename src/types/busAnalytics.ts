export type AnalyticsCell = string | number | boolean | null

export type AnalyticsRow = Record<string, AnalyticsCell> & {
  id: number
}

export type ChartItem = {
  label: string
  value: number
}

export type BusAnalyticsChartData = {
  hourly: ChartItem[]
  topRoutes: ChartItem[]
  operatorSplit: ChartItem[]
  paymentMix: ChartItem[]
}

export type BusAnalyticsWorkerSuccessPayload = {
  rows: AnalyticsRow[]
  fields: string[]
  numericFields: string[]
  firstMetricField: string | null
  firstMetricTotal: number | null
  chartData: BusAnalyticsChartData
}

export type BusAnalyticsWorkerRequest = {
  type: 'parse-csv'
  csvUrl: string
}

export type BusAnalyticsWorkerIncomingMessage =
  | {
      type: 'parse-success'
      payload: BusAnalyticsWorkerSuccessPayload
    }
  | {
      type: 'parse-error'
      message: string
    }
