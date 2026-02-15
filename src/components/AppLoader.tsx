import { Box, Typography } from '@mui/material'

type AppLoaderProps = {
  label?: string
}

export default function AppLoader({ label = 'Loading...' }: AppLoaderProps) {
  return (
    <Box className="app-loader-shell" role="status" aria-live="polite">
      <Box className="app-loader-glow" />
      <Box className="app-loader-icon" />
      <Typography variant="body2" className="app-loader-label">
        {label}
      </Typography>
    </Box>
  )
}
