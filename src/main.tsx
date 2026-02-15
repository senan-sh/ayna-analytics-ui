import { createRoot } from 'react-dom/client'
import '@fontsource/manrope/latin-ext-400.css'
import '@fontsource/manrope/latin-ext-500.css'
import '@fontsource/manrope/latin-ext-600.css'
import '@fontsource/manrope/latin-ext-700.css'
import '@fontsource/manrope/cyrillic-400.css'
import '@fontsource/manrope/cyrillic-500.css'
import '@fontsource/manrope/cyrillic-600.css'
import '@fontsource/manrope/cyrillic-700.css'
import '@fontsource/space-grotesk/latin-ext-500.css'
import '@fontsource/space-grotesk/latin-ext-700.css'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.tsx'
import { LanguageProvider } from './i18n/LanguageContext.tsx'

createRoot(document.getElementById('root')!).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>
)
