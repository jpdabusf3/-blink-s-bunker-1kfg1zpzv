import { useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Building2 } from 'lucide-react'

// Centros aproximados das capitais/sedes dos estados brasileiros
const UF_COORDINATES: Record<string, { lat: number; lng: number; nome: string }> = {
  AC: { lat: -9.97499, lng: -67.8243, nome: 'Acre' },
  AL: { lat: -9.66599, lng: -35.735, nome: 'Alagoas' },
  AP: { lat: 0.034934, lng: -51.0694, nome: 'Amapá' },
  AM: { lat: -3.11866, lng: -60.0212, nome: 'Amazonas' },
  BA: { lat: -12.9718, lng: -38.5011, nome: 'Bahia' },
  CE: { lat: -3.71839, lng: -38.5434, nome: 'Ceará' },
  DF: { lat: -15.7795, lng: -47.9297, nome: 'Distrito Federal' },
  ES: { lat: -20.3222, lng: -40.3381, nome: 'Espírito Santo' },
  GO: { lat: -16.6864, lng: -49.2643, nome: 'Goiás' },
  MA: { lat: -2.53874, lng: -44.2825, nome: 'Maranhão' },
  MT: { lat: -15.5989, lng: -56.0949, nome: 'Mato Grosso' },
  MS: { lat: -20.4486, lng: -54.6295, nome: 'Mato Grosso do Sul' },
  MG: { lat: -19.9173, lng: -43.9346, nome: 'Minas Gerais' },
  PA: { lat: -1.4554, lng: -48.4898, nome: 'Pará' },
  PB: { lat: -7.11509, lng: -34.8641, nome: 'Paraíba' },
  PR: { lat: -25.4195, lng: -49.2646, nome: 'Paraná' },
  PE: { lat: -8.04666, lng: -34.8771, nome: 'Pernambuco' },
  PI: { lat: -5.0949, lng: -42.8042, nome: 'Piauí' },
  RJ: { lat: -22.9068, lng: -43.1729, nome: 'Rio de Janeiro' },
  RN: { lat: -5.79357, lng: -35.1986, nome: 'Rio Grande do Norte' },
  RS: { lat: -30.0346, lng: -51.2177, nome: 'Rio Grande do Sul' },
  RO: { lat: -8.76077, lng: -63.8999, nome: 'Rondônia' },
  RR: { lat: 2.81984, lng: -60.6733, nome: 'Roraima' },
  SC: { lat: -27.5973, lng: -48.5496, nome: 'Santa Catarina' },
  SP: { lat: -23.5489, lng: -46.6388, nome: 'São Paulo' },
  SE: { lat: -10.9091, lng: -37.0677, nome: 'Sergipe' },
  TO: { lat: -10.184, lng: -48.3338, nome: 'Tocantins' },
}

interface DistribuidorCarteiraMapProps {
  distribuidorNome: string
  ufCounts: Record<string, number>
  selectedUf?: string | null
  onSelectUf?: (uf: string | null) => void
}

export function DistribuidorCarteiraMap({
  distribuidorNome,
  ufCounts,
  selectedUf,
  onSelectUf,
}: DistribuidorCarteiraMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)

  // Iniciar mapa Leaflet via window.L
  useEffect(() => {
    let checkInterval: any = null
    const initMap = () => {
      if (!window.L || !mapContainerRef.current || mapInstanceRef.current) return
      const L = window.L

      const map = L.map(mapContainerRef.current, {
        center: [-15.78, -47.92],
        zoom: 4,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map)

      const markersLayer = L.layerGroup().addTo(map)
      markersLayerRef.current = markersLayer
      mapInstanceRef.current = map
    }

    if (window.L) {
      initMap()
    } else {
      checkInterval = setInterval(() => {
        if (window.L) {
          clearInterval(checkInterval)
          initMap()
        }
      }, 200)
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Plotar marcadores por UF com contagem de clientes da carteira
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !window.L) return
    const L = window.L
    const markersLayer = markersLayerRef.current
    markersLayer.clearLayers()

    const bounds = L.latLngBounds([])
    let markersCount = 0

    Object.entries(ufCounts).forEach(([uf, count]) => {
      const coord = UF_COORDINATES[uf]
      if (!coord || count <= 0) return

      const isCurrentSelected = selectedUf === uf

      const html = `
        <div style="
          background-color: ${isCurrentSelected ? '#2563eb' : '#0ea5e9'};
          color: white;
          width: ${Math.min(48, Math.max(34, 28 + Math.log2(count + 1) * 4))}px;
          height: ${Math.min(48, Math.max(34, 28 + Math.log2(count + 1) * 4))}px;
          border-radius: 9999px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 3px solid white;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);
          font-weight: 700;
          font-size: 11px;
          line-height: 1;
          cursor: pointer;
          transform: ${isCurrentSelected ? 'scale(1.15)' : 'scale(1)'};
          transition: transform 0.15s ease;
        ">
          <span>${uf}</span>
          <span style="font-size: 9px; opacity: 0.9;">${count}</span>
        </div>
      `

      const customIcon = L.divIcon({
        className: 'custom-carteira-distribuidor-pin',
        html,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      })

      const marker = L.marker([coord.lat, coord.lng], { icon: customIcon })
      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; line-height: 1.4;">
          <strong style="font-size: 13px; color: #0f172a;">${coord.nome} (${uf})</strong>
          <p style="margin: 4px 0 0; color: #475569;">
            <strong>${count}</strong> cliente(s) na carteira da ${distribuidorNome}
          </p>
          <div style="margin-top: 6px;">
            <span style="font-size: 11px; color: #2563eb; text-decoration: underline; cursor: pointer;">
              Filtrar por este estado
            </span>
          </div>
        </div>
      `)

      marker.on('click', () => {
        if (onSelectUf) {
          onSelectUf(selectedUf === uf ? null : uf)
        }
      })

      marker.addTo(markersLayer)
      bounds.extend([coord.lat, coord.lng])
      markersCount++
    })

    if (markersCount > 0 && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 })
    }
  }, [ufCounts, selectedUf, distribuidorNome, onSelectUf])

  return (
    <Card className="border border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border/40 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm font-semibold">
            Visão Geográfica — Carteira por Estado de Sede
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          {selectedUf ? (
            <Badge variant="default" className="text-xs">
              Filtro ativo: {selectedUf} ({ufCounts[selectedUf] || 0} clientes)
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">
              Clique em um estado para filtrar a lista
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={mapContainerRef} className="w-full h-[340px] bg-muted/20 relative z-0" />
      </CardContent>
    </Card>
  )
}
