import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { BLINK_MARINGA_CD } from '@/constants/blinkLocations'

export interface RouteResult {
  coordinates: [number, number][] // [lat, lng] para Leaflet Polyline
  distanceKm: number
  durationFormatted: string
  clientName: string
  clientLat: number
  clientLng: number
}

function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) {
    return `${hours}h ${minutes}min`
  }
  return `${minutes}min`
}

function formatDistance(meters: number): number {
  return Math.round((meters / 1000) * 10) / 10
}

export function useOsrmRoute() {
  const [calculating, setCalculating] = useState(false)
  const [route, setRoute] = useState<RouteResult | null>(null)

  const calculateRouteToCD = useCallback(
    async (clientName: string, clientLat?: number | null, clientLng?: number | null) => {
      // Validação de coordenadas
      if (
        typeof clientLat !== 'number' ||
        typeof clientLng !== 'number' ||
        isNaN(clientLat) ||
        isNaN(clientLng) ||
        (clientLat === 0 && clientLng === 0)
      ) {
        toast.warning(
          'Este cliente ainda não possui coordenadas. Execute o enriquecimento de dados.',
        )
        return null
      }

      setCalculating(true)
      try {
        // Formato OSRM: {lng1},{lat1};{lng2},{lat2}
        const originLng = clientLng
        const originLat = clientLat
        const destLng = BLINK_MARINGA_CD.lng
        const destLat = BLINK_MARINGA_CD.lat

        const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`

        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`OSRM HTTP ${response.status}`)
        }

        const data = await response.json()
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
          throw new Error('Nenhuma rota encontrada pelo OSRM')
        }

        const primaryRoute = data.routes[0]
        // GeoJSON do OSRM retorna array de [lng, lat]
        // Leaflet precisa de [lat, lng]
        const leafletCoords: [number, number][] = primaryRoute.geometry.coordinates.map(
          (pt: [number, number]) => [pt[1], pt[0]],
        )

        const result: RouteResult = {
          coordinates: leafletCoords,
          distanceKm: formatDistance(primaryRoute.distance),
          durationFormatted: formatDuration(primaryRoute.duration),
          clientName,
          clientLat,
          clientLng,
        }

        setRoute(result)
        toast.success(
          `Rota calculada: ${result.distanceKm.toLocaleString('pt-BR')} km (~${result.durationFormatted})`,
        )
        return result
      } catch (err) {
        console.error('[osrm] erro ao calcular rota', err)
        toast.error('Não foi possível calcular a rota. Tente novamente.')
        return null
      } finally {
        setCalculating(false)
      }
    },
    [],
  )

  const clearRoute = useCallback(() => {
    setRoute(null)
  }, [])

  return {
    calculating,
    route,
    calculateRouteToCD,
    clearRoute,
  }
}
