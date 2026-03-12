import { useEffect, useRef, useState } from 'react'
import { useAppContext } from '@/store/AppContext'
import { useToast } from '@/hooks/use-toast'
import { Button } from './ui/button'

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const dp = ((lat2 - lat1) * Math.PI) / 180
  const dl = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export function GeofenceTracker() {
  const { factories, updateFactory } = useAppContext()
  const { toast } = useToast()
  const [notified, setNotified] = useState<Record<string, boolean>>({})
  const setupDone = useRef(false)

  useEffect(() => {
    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords

        if (!setupDone.current && factories.length > 0) {
          setupDone.current = true
          const testFactory = factories[0]
          if (!testFactory.coordinates) {
            updateFactory(testFactory.id, {
              coordinates: { lat: latitude + 0.002, lng: longitude },
            })
          }
        }

        factories.forEach((factory) => {
          if (factory.coordinates) {
            const dist = getDistance(
              latitude,
              longitude,
              factory.coordinates.lat,
              factory.coordinates.lng,
            )

            if (dist <= 500 && !notified[factory.id]) {
              setNotified((prev) => ({ ...prev, [factory.id]: true }))
              toast({
                title: '📍 Fábrica Próxima Detectada',
                description: `Você está a ${Math.round(dist)}m de ${factory.name}.`,
                action: (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      window.location.href = `/cadastro?factoryId=${factory.id}`
                    }}
                  >
                    Abrir Ficha
                  </Button>
                ),
                duration: 15000,
              })
            }
          }
        })
      },
      (err) => console.warn('Geofence error:', err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [factories, notified, toast, updateFactory])

  return null
}
