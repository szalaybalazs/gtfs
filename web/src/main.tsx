import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import './index.css'
import Layout from './components/Layout'
import { MapPage, PhonePreviewPage, RouteDetailsPage, StationPage, TripPage, UxMapPage, preloadMapWhenIdle } from './lib/lazyPages'
import { initLocale } from './lib/i18n'
import { applyTheme } from './lib/theme'
import HomePage from './pages/HomePage'
import NearbyPage from './pages/NearbyPage'
import AlertsPage from './pages/AlertsPage'
import LinesPage from './pages/LinesPage'
import RoutesPage from './pages/RoutesPage'
import SettingsPage from './pages/SettingsPage'
import StopPage from './pages/StopPage'
import StopsPage from './pages/StopsPage'

applyTheme()
initLocale()
preloadMapWhenIdle()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={null}>
        <Routes>
          <Route path="/phone" element={<PhonePreviewPage />} />
          <Route path="/ux" element={<UxMapPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/routes/:routeId" element={<RouteDetailsPage />} />
            <Route path="/lines" element={<LinesPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/stops" element={<StopsPage />} />
            <Route path="/stops/:stopId" element={<StopPage />} />
            <Route path="/stations/:stationId" element={<StationPage />} />
            <Route path="/trips/:tripId" element={<TripPage />} />
            <Route path="/nearby" element={<NearbyPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)

// Installable app + offline shell. Production only, so dev reloads stay fresh.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
