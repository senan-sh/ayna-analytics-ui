import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Box,
  Container,
  CssBaseline,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  ThemeProvider,
  Select,
  Typography,
  createTheme,
} from '@mui/material'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined'
import AltRouteOutlinedIcon from '@mui/icons-material/AltRouteOutlined'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import flagAz from 'flag-icons/flags/4x3/az.svg'
import flagGb from 'flag-icons/flags/4x3/gb.svg'
import flagRu from 'flag-icons/flags/4x3/ru.svg'
import './App.css'
import AppLoader from './components/AppLoader'
import { useLanguage } from './i18n/useLanguage'
import type { LanguageCode } from './i18n/translations'

const DemographicsPage = lazy(() => import('./pages/Demographics'))
const BusAnalyticsPage = lazy(() => import('./pages/BusAnalytics'))
const LiveRoutesPage = lazy(() => import('./pages/LiveRoutes'))

type PageKey = 'demographics' | 'analytics' | 'routes'

function NoSelectIcon() {
  return null
}

const LANGUAGE_OPTIONS: Array<{ value: LanguageCode; label: string; flagSrc: string }> = [
  { value: 'az', label: 'Azerbaijani', flagSrc: flagAz },
  { value: 'en', label: 'English', flagSrc: flagGb },
  { value: 'ru', label: 'Russian', flagSrc: flagRu },
]

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>('demographics')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { language, setLanguage, t } = useLanguage()

  const pageTitles = useMemo<Record<PageKey, string>>(
    () => ({
      demographics: t('pageDemographics'),
      analytics: t('pageAnalytics'),
      routes: t('pageRoutes'),
    }),
    [t],
  )

  const navItems: Array<{ key: PageKey; label: string; icon: ReactNode }> = [
    { key: 'demographics', label: t('tabDemographics'), icon: <MapOutlinedIcon fontSize="small" /> },
    { key: 'analytics', label: t('tabAnalytics'), icon: <InsightsOutlinedIcon fontSize="small" /> },
    { key: 'routes', label: t('tabRoutes'), icon: <AltRouteOutlinedIcon fontSize="small" /> },
  ]

  useEffect(() => {
    document.title = `${t('appTitle')} - ${pageTitles[activePage]}`
  }, [activePage, pageTitles, t])

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: 'light',
          primary: { main: '#2970FF' },
          secondary: { main: '#155EEF' },
          background: { default: '#f5f8ff', paper: '#ffffff' },
        },
        shape: { borderRadius: 12 },
        typography: {
          fontFamily: 'Manrope, Segoe UI, Tahoma, sans-serif',
          fontSize: 16,
          h5: {
            fontFamily: 'Space Grotesk, Manrope, sans-serif',
            fontWeight: 700,
            letterSpacing: 0.2,
            fontSize: 'clamp(1.45rem, 1.15rem + 0.6vw, 1.85rem)',
          },
          h6: {
            fontFamily: 'Space Grotesk, Manrope, sans-serif',
            fontWeight: 700,
            letterSpacing: 0.15,
            fontSize: 'clamp(1.15rem, 1rem + 0.35vw, 1.35rem)',
          },
          body1: {
            fontSize: '1.02rem',
            lineHeight: 1.62,
          },
          body2: {
            fontSize: '0.94rem',
            lineHeight: 1.55,
          },
          subtitle1: {
            fontFamily: 'Space Grotesk, Manrope, sans-serif',
            fontSize: '1.05rem',
          },
          button: {
            fontWeight: 600,
            letterSpacing: 0.2,
            textTransform: 'none',
            fontSize: '0.96rem',
            padding: '0.52rem 0.92rem',
          },
        },
      }),
    [],
  )

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box className="app-shell">
        <Box className={`layout-root ${sidebarCollapsed ? 'layout-root-collapsed' : ''}`}>
          <Box component="aside" className={`sidebar-shell ${sidebarCollapsed ? 'sidebar-shell-collapsed' : ''}`}>
            <Box className="sidebar-top-row">
              <Typography />
              <Box
                component="button"
                type="button"
                className="sidebar-toggle-btn"
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? <ChevronRightRoundedIcon fontSize="small" /> : <ChevronLeftRoundedIcon fontSize="small" />}
              </Box>
            </Box>

            <Box>
              {sidebarCollapsed ? (
                <Box className="sidebar-brand-icon-wrap">
                  <img src="/ayna-only-icon.svg" alt="AYNA" className="sidebar-brand-icon" />
                </Box>
              ) : (
                <Typography variant="h5" component="h1" className="brand-title">
                  {t('appTitle')}
                </Typography>
              )}
              <Typography variant="body2" className={`brand-subtitle ${sidebarCollapsed ? 'hidden-when-collapsed' : ''}`}>
                {t('appSubtitle')}
              </Typography>
            </Box>

            <Select
              size="small"
              value={language}
              onChange={(event) => setLanguage(event.target.value as LanguageCode)}
              className={`language-select ${sidebarCollapsed ? 'language-select-collapsed' : ''}`}
              IconComponent={sidebarCollapsed ? NoSelectIcon : undefined}
              renderValue={(value) => {
                const selectedOption = LANGUAGE_OPTIONS.find((option) => option.value === value)
                if (!selectedOption) {
                  return value
                }

                if (sidebarCollapsed) {
                  return <img src={selectedOption.flagSrc} alt="" className="language-flag" aria-hidden="true" />
                }

                return (
                  <Box className="language-select-value">
                    <img src={selectedOption.flagSrc} alt="" className="language-flag" aria-hidden="true" />
                    <span>{selectedOption.label}</span>
                  </Box>
                )
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    bgcolor: '#1b4db5',
                    color: '#ffffff',
                  },
                },
              }}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value} className={sidebarCollapsed ? 'language-menu-item-collapsed' : ''}>
                  <Box className={`language-menu-option ${sidebarCollapsed ? 'language-menu-option-collapsed' : ''}`}>
                    <img src={option.flagSrc} alt="" className="language-flag" aria-hidden="true" />
                    {!sidebarCollapsed && <span>{option.label}</span>}
                  </Box>
                </MenuItem>
              ))}
            </Select>

            <Divider className="sidebar-divider" />

            <List className="sidebar-nav-list" disablePadding>
              {navItems.map((item) => (
                <ListItemButton
                  key={item.key}
                  selected={activePage === item.key}
                  onClick={() => setActivePage(item.key)}
                  className={`sidebar-nav-item ${sidebarCollapsed ? 'sidebar-nav-item-collapsed' : ''}`}
                >
                  <ListItemIcon className="sidebar-nav-icon">
                    {item.icon}
                  </ListItemIcon>
                  {!sidebarCollapsed && <ListItemText primary={item.label} />}
                </ListItemButton>
              ))}
            </List>
          </Box>

          <Box className="content-shell">
            <Container maxWidth="xl" className="page-container">
              <Typography variant="h6" component="h2" className="page-title">
                {pageTitles[activePage]}
              </Typography>
              <Typography variant="body2" className="page-subtitle">
                {t('pageSubtitle')}
              </Typography>
              <Suspense
                fallback={
                  <AppLoader />
                }
              >
                <Box key={activePage} className="page-transition">
                  {activePage === 'demographics' && <DemographicsPage />}
                  {activePage === 'analytics' && <BusAnalyticsPage />}
                  {activePage === 'routes' && <LiveRoutesPage />}
                </Box>
              </Suspense>
            </Container>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  )
}
