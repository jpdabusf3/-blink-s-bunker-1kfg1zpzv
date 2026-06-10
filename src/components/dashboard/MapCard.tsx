import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAppContext } from '@/store/AppContext'
import { Factory } from '@/types'
import { Map as MapIcon, X, Car } from 'lucide-react'

declare global {
  interface Window {
    google: any
  }
}

export function MapCard({ regionFilter = 'Todas as Regiões' }: { regionFilter?: string }) {
  const { factories } = useAppContext()
  const navigate = useNavigate()
  const mapRef = useRef<HTMLDivElement>(null)

  const [map, setMap] = useState<any>(null)
  const [markers, setMarkers] = useState<any[]>([])
  const [directionsService, setDirectionsService] = useState<any>(null)
  const [directionsRenderer, setDirectionsRenderer] = useState<any>(null)

  const [selectedRoute, setSelectedRoute] = useState<Factory[]>([])
  const [routeMetrics, setRouteMetrics] = useState<{ distance: string; duration: string } | null>(
    null,
  )
  const [isMapLoaded, setIsMapLoaded] = useState(!!window.google?.maps)

  useEffect(() => {
    if (window.google?.maps) {
      setIsMapLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => setIsMapLoaded(true)
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || map) return

    const newMap = new window.google.maps.Map(mapRef.current, {
      center: { lat: -13.0, lng: -56.0 },
      zoom: 6,
      mapTypeControl: false,
      streetViewControl: false,
    })

    const dirService = new window.google.maps.DirectionsService()
    const dirRenderer = new window.google.maps.DirectionsRenderer({
      map: newMap,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#2563eb',
        strokeWeight: 4,
      },
    })

    setMap(newMap)
    setDirectionsService(dirService)
    setDirectionsRenderer(dirRenderer)
  }, [isMapLoaded, mapRef, map])

  useEffect(() => {
    if (!map) return

    const filteredFactories =
      regionFilter === 'Todas as Regiões'
        ? factories
        : factories.filter((f) => f.region === regionFilter)

    markers.forEach((m) => m.setMap(null))

    const newMarkers = filteredFactories.map((f) => {
      const lat = f.coordinates?.lat || -16 + Math.random() * 6
      const lng = f.coordinates?.lng || -58 + Math.random() * 5

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        title: f.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor:
            f.priority === 'High' ? '#ef4444' : f.priority === 'Medium' ? '#f59e0b' : '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      })

      marker.addListener('click', () => {
        setSelectedRoute((prev) => {
          if (prev.find((p) => p.id === f.id)) return prev.filter((p) => p.id !== f.id)
          return [...prev, f]
        })
      })

      return marker
    })

    setMarkers(newMarkers)

    if (newMarkers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds()
      newMarkers.forEach((m) => bounds.extend(m.getPosition()))
      map.fitBounds(bounds)
    }
  }, [factories, regionFilter, map])

  useEffect(() => {
    if (!directionsService || !directionsRenderer) return

    if (selectedRoute.length < 2) {
      directionsRenderer.setDirections({ routes: [] })
      setRouteMetrics(null)
      return
    }

    const waypoints = selectedRoute.slice(1, -1).map((f) => ({
      location: {
        lat: f.coordinates?.lat || -16,
        lng: f.coordinates?.lng || -58,
      },
      stopover: true,
    }))

    const origin = selectedRoute[0]
    const dest = selectedRoute[selectedRoute.length - 1]

    directionsService.route(
      {
        origin: {
          lat: origin.coordinates?.lat || -16,
          lng: origin.coordinates?.lng || -58,
        },
        destination: {
          lat: dest.coordinates?.lat || -16,
          lng: dest.coordinates?.lng || -58,
        },
        waypoints,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result: any, status: string) => {
        if (status === 'OK') {
          directionsRenderer.setDirections(result)

          let totalDist = 0
          let totalTime = 0
          const route = result.routes[0]
          route.legs.forEach((leg: any) => {
            totalDist += leg.distance.value
            totalTime += leg.duration.value
          })

          setRouteMetrics({
            distance: (totalDist / 1000).toFixed(1) + ' km',
            duration:
              Math.floor(totalTime / 3600) + 'h ' + Math.floor((totalTime % 3600) / 60) + 'm',
          })
        } else {
          console.error('Directions request failed: ' + status)
        }
      },
    )
  }, [selectedRoute, directionsService, directionsRenderer])

  return (
    <Card className="shadow-subtle flex flex-col relative h-[450px] overflow-hidden print:hidden">
      <CardHeader className="py-3 px-4 flex flex-col sm:flex-row items-start sm:items-center justify-between z-10 bg-background/90 backdrop-blur-md absolute top-0 left-0 right-0 border-b gap-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <MapIcon className="w-4 h-4" />
          Planejamento de Rotas
        </CardTitle>
        {selectedRoute.length > 0 && (
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {routeMetrics && (
              <div className="text-xs font-medium text-muted-foreground flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
                <Car className="w-3 h-3" />
                {routeMetrics.distance} • {routeMetrics.duration}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedRoute([])}
              className="h-7 text-xs px-2 shrink-0"
            >
              <X className="w-3 h-3 mr-1" /> Limpar
            </Button>
          </div>
        )}
      </CardHeader>
      <div className="flex-1 w-full relative h-full mt-[50px] sm:mt-[48px]">
        {!isMapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
            <span className="text-sm text-muted-foreground">Carregando mapa...</span>
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" />

        {selectedRoute.length > 0 && (
          <div className="absolute bottom-4 left-4 right-4 bg-background/95 backdrop-blur shadow-lg border rounded-lg p-3 max-h-[120px] overflow-y-auto z-10">
            <div className="text-xs font-semibold mb-2 flex items-center justify-between">
              <span>Rota de Visita ({selectedRoute.length} pontos)</span>
              <span className="text-[10px] text-muted-foreground hidden sm:block">
                Clique no mapa para adicionar/remover
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedRoute.map((f, i) => (
                <div
                  key={f.id}
                  className="flex items-center gap-1 text-[11px] bg-primary/10 text-primary px-2 py-1 rounded-md"
                >
                  <span className="font-bold w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px]">
                    {i + 1}
                  </span>
                  {f.name}
                  <button
                    onClick={() => setSelectedRoute((prev) => prev.filter((p) => p.id !== f.id))}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
