import { Box, Grid, Paper, Typography } from '@mui/material'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type ChartItem = {
  label: string
  value: number
}

type BusAnalyticsChartsProps = {
  chartData: {
    hourly: ChartItem[]
    topRoutes: ChartItem[]
    operatorSplit: ChartItem[]
    paymentMix: ChartItem[]
  }
  labels: {
    hourlyPassengerVolume: string
    topRoutesByCount: string
    operatorContribution: string
    paymentMix: string
  }
}

const OPERATOR_COLORS = ['#2970ff', '#155eef', '#2e90fa', '#175cd3', '#53b1fd', '#7a5af8']
const PAYMENT_COLORS = ['#2970ff', '#2e90fa']

export default function BusAnalyticsCharts({ chartData, labels }: BusAnalyticsChartsProps) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, lg: 6 }}>
        <Paper className="page-panel" elevation={0}>
          <Typography variant="subtitle2" gutterBottom>
            {labels.hourlyPassengerVolume}
          </Typography>
          <Box className="chart-shell">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData.hourly} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbe7ff" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => formatTooltipValue(value)} />
                <Bar dataKey="value" fill="#2970ff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Grid>
      <Grid size={{ xs: 12, lg: 6 }}>
        <Paper className="page-panel" elevation={0}>
          <Typography variant="subtitle2" gutterBottom>
            {labels.topRoutesByCount}
          </Typography>
          <Box className="chart-shell">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData.topRoutes} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbe7ff" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" width={44} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => formatTooltipValue(value)} />
                <Bar dataKey="value" fill="#155eef" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Grid>
      <Grid size={{ xs: 12, lg: 6 }}>
        <Paper className="page-panel" elevation={0}>
          <Typography variant="subtitle2" gutterBottom>
            {labels.operatorContribution}
          </Typography>
          <Box className="chart-shell">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={chartData.operatorSplit} dataKey="value" nameKey="label" outerRadius={88} innerRadius={52} paddingAngle={2}>
                  {chartData.operatorSplit.map((entry, index) => (
                    <Cell key={entry.label} fill={OPERATOR_COLORS[index % OPERATOR_COLORS.length]} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={40} />
                <Tooltip formatter={(value) => formatTooltipValue(value)} />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Grid>
      <Grid size={{ xs: 12, lg: 6 }}>
        <Paper className="page-panel" elevation={0}>
          <Typography variant="subtitle2" gutterBottom>
            {labels.paymentMix}
          </Typography>
          <Box className="chart-shell">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={chartData.paymentMix} dataKey="value" nameKey="label" outerRadius={88} innerRadius={52}>
                  {chartData.paymentMix.map((entry, index) => (
                    <Cell key={entry.label} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={40} />
                <Tooltip formatter={(value) => formatTooltipValue(value)} />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Grid>
    </Grid>
  )
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

function formatTooltipValue(value: unknown): string {
  return asNumber(value).toLocaleString()
}
