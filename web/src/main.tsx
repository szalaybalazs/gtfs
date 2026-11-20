import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import './index.css'
import Layout from './components/Layout'
import { applyTheme } from './lib/theme'
import HomePage from './pages/HomePage'
import MapPage from './pages/MapPage'
import NearbyPage from './pages/NearbyPage'
import PhonePreviewPage from './pages/PhonePreviewPage'
import RouteDetailsPage from './pages/RouteDetailsPage'
import RoutesPage from './pages/RoutesPage'
import SettingsPage from './pages/SettingsPage'
import StationPage from './pages/StationPage'
import StopPage from './pages/StopPage'
import StopsPage from './pages/StopsPage'
import TripPage from './pages/TripPage'

applyTheme()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/phone" element={<PhonePreviewPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/routes/:routeId" element={<RouteDetailsPage />} />
            <Route path="/stops" element={<StopsPage />} />
            <Route path="/stops/:stopId" element={<StopPage />} />
            <Route path="/stations/:stationId" element={<StationPage />} />
            <Route path="/trips/:tripId" element={<TripPage />} />
            <Route path="/nearby" element={<NearbyPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
