import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Loader2,
  MapPin,
  Search,
  RotateCcw,
  AlertCircle,
  Building2,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Factory } from '@/types'

// Leaflet types declaration
interface LeafletPoint {
  lat: number
  lng: number
}

interface LeafletMarker {
  bindPopup: (content: string) => LeafletMarker
  on: (event: string, fn: () => void) => LeafletMarker
  addTo: (layer: unknown) => LeafletMarker
}

interface LeafletMap {
  setView: (center: [number, number], zoom: number, options?: { animate?: boolean }) => void
  fitBounds: (bounds: unknown, options?: { padding?: [number, number]; maxZoom?: number }) => void
  remove: () => void
  invalidateSize: () => void
}

interface LeafletStatic {
  map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMap
  tileLayer: (
    url: string,
    options?: Record<string, unknown>,
  ) => { addTo: (map: LeafletMap) => void }
  layerGroup: () => {
    addTo: (map: LeafletMap) => {
      clearLayers: () => void
    }
    clearLayers: () => void
  }
  divIcon: (options: Record<string, unknown>) => unknown
  marker: (latLng: [number, number], options?: Record<string, unknown>) => LeafletMarker
  latLngBounds: (points: LeafletPoint[]) => {
    extend: (latLng: [number, number]) => void
    isValid: () => boolean
  }
}

declare global {
  interface Window {
    L?: LeafletStatic
  }
}

const ADDRESS_STATUS_LABELS: Record<string, string> = {
  complete: 'Completo',
  partial: 'Parcial',
  inconsistent: 'Inconsistente',
  enriched: 'Enriquecido',
  failed: 'Falhou',
}

const ADDRESS_STATUS_COLORS: Record<string, string> = {
  complete: '#10b981',
  enriched: '#3b82f6',
  partial: '#f59e0b',
  inconsistent: '#f97316',
  failed: '#ef4444',
}

interface ClientsMapDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  factories: Factory[]
  loading?: boolean
  error?: boolean
  onReload?: () => void
}

export function ClientsMapDialog({
  open,
  onOpenChange,
  factories,
  loading = false,
  error = false,
  onReload,
}: ClientsMapDialogProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedClient, setSelectedClient] = useState<Factory | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<LeafletMap | null>(null)
  const markersLayerRef = useRef<{ clearLayers: () => void } | null>(null)

  const clientsWithCoordinates = useMemo(() => {
    return factories
      .filter((f) => {
        const lat = f.lat ?? f.coordinates?.lat
        const lng = f.lng ?? f.coordinates?.lng
        return (
          typeof lat === 'number' &&
          typeof lng === 'number' &&
          !isNaN(lat) &&
          !isNaN(lng) &&
          lat !== 0 &&
          lng !== 0
        )
      })
      .slice(0, 500)
  }, [factories])

  const visibleClients = useMemo(() => {
    return clientsWithCoordinates.filter((f) => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchName = f.name?.toLowerCase().includes(q)
        const matchCity = f.city?.toLowerCase().includes(q)
        const matchState = f.state?.toLowerCase().includes(q)
        if (!matchName && !matchCity && !matchState) return false
      }
      if (statusFilter !== 'all') {
        if (f.address_status !== statusFilter) return false
      }
      return true
    })
  }, [clientsWithCoordinates, search, statusFilter])

  useEffect(() => {
    if (open && error) {
      toast.error('Erro ao carregar clientes para o mapa.')
    }
  }, [open, error])

  useEffect(() => {
    if (open) {
      setSelectedClient(null)
      setSearch('')
      setStatusFilter('all')
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markersLayerRef.current = null
      }
      return
    }

    let timer: ReturnType<typeof setInterval> | null = null

    const initMap = () => {
      if (!window.L || !mapContainerRef.current || mapInstanceRef.current) return

      const L = window.L
      const map = L.map(mapContainerRef.current, {
        center: [-14.235, -51.925],
        zoom: 4,
        scrollWheelZoom: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> colaboradores',
        maxZoom: 19,
      }).addTo(map)

      const markersLayer = L.layerGroup().addTo(map)
      mapInstanceRef.current = map
      markersLayerRef.current = markersLayer

      setTimeout(() => {
        map.invalidateSize()
      }, 200)
    }

    if (window.L) {
      const t = setTimeout(initMap, 50)
      return () => clearTimeout(t)
    } else {
      timer = setInterval(() => {
        if (window.L) {
          if (timer) clearInterval(timer)
          initMap()
        }
      }, 100)
      return () => {
        if (timer) clearInterval(timer)
      }
    }
  }, [open])

  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize()
      }, 150)
    }
  }, [isFullscreen])

  useEffect(() => {
    if (!open || !mapInstanceRef.current || !markersLayerRef.current || !window.L) return

    const L = window.L
    const map = mapInstanceRef.current
    const markersLayer = markersLayerRef.current

    markersLayer.clearLayers()

    if (visibleClients.length === 0) return

    const bounds = L.latLngBounds([])

    visibleClients.forEach((f) => {
      const lat = (f.lat ?? f.coordinates?.lat)!
      const lng = (f.lng ?? f.coordinates?.lng)!

      const statusColor = ADDRESS_STATUS_COLORS[f.address_status || ''] || '#64748b'

      const customIcon = L.divIcon({
        className: 'custom-client-marker',
        html: `
          <div style="
            background-color: ${statusColor};
            width: 26px;
            height: 26px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 5px rgba(0,0,0,0.35);
            border: 2px solid #ffffff;
            cursor: pointer;
          ">
            <div style="
              width: 7px;
              height: 7px;
              background-color: #ffffff;
              border-radius: 50%;
              transform: rotate(45deg);
            "></div>
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 26],
        popupAnchor: [0, -26],
      })

      const marker = L.marker([lat, lng], { icon: customIcon })

      const statusLabel = f.address_status
        ? ADDRESS_STATUS_LABELS[f.address_status] || f.address_status
        : 'Não informado'
      const cityState = [f.city, f.state].filter(Boolean).join(' / ') || 'Não informado'

      const popupContent = `
        <div style="font-family: inherit; font-size: 13px; min-width: 200px; padding: 2px 0;">
          <h4 style="font-weight: 700; font-size: 14px; margin: 0 0 6px 0; color: #0f172a; line-height: 1.2;">
            ${f.name}
          </h4>
          <p style="margin: 0 0 6px 0; color: #475569; font-size: 12px;">
            <strong>Cidade/UF:</strong> ${cityState}
          </p>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0;">
            <span style="color: #64748b; font-size: 11px;">Status Endereço:</span>
            <span style="font-weight: 600; font-size: 11px; padding: 2px 8px; border-radius: 9999px; background-color: ${statusColor}20; color: ${statusColor};">
              ${statusLabel}
            </span>
          </div>
          ${
            f.standardized_address
              ? `<p style="margin: 6px 0 0 0; font-size: 11px; color: #64748b;">${f.standardized_address}</p>`
              : ''
          }
        </div>
      `

      marker.bindPopup(popupContent)
      marker.on('click', () => {
        setSelectedClient(f)
      })

      marker.addTo(markersLayer)
      bounds.extend([lat, lng])
    })

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
  }, [open, visibleClients])

  const handleFocusClient = (f: Factory) => {
    setSelectedClient(f)
    const lat = f.lat ?? f.coordinates?.lat
    const lng = f.lng ?? f.coordinates?.lng
    if (mapInstanceRef.current && typeof lat === 'number' && typeof lng === 'number') {
      mapInstanceRef.current.setView([lat, lng], 14, { animate: true })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`transition-all duration-200 flex flex-col p-0 gap-0 overflow-hidden ${
          isFullscreen
            ? 'max-w-[100vw] w-screen h-screen max-h-screen rounded-none'
            : 'max-w-5xl w-[95vw] h-[85vh] max-h-[850px] rounded-xl'
        }`}
      >
        <DialogHeader className="p-4 border-b bg-card flex flex-row items-center justify-between shrink-0">
          <div className="space-y-1">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Mapa de Clientes
            </DialogTitle>
            <DialogDescription className="text-xs">
              Visualização geográfica dos clientes com coordenadas cadastradas.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2 mr-6">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Reduzir tela' : 'Tela cheia'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </DialogHeader>

        <div className="p-3 bg-muted/30 border-b flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, cidade ou UF..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs bg-background"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                Todos ({clientsWithCoordinates.length})
              </button>
              {Object.entries(ADDRESS_STATUS_LABELS).map(([val, label]) => {
                const count = clientsWithCoordinates.filter((c) => c.address_status === val).length
                if (count === 0 && statusFilter !== val) return null
                const isSelected = statusFilter === val
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setStatusFilter(isSelected ? 'all' : val)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: ADDRESS_STATUS_COLORS[val] }}
                    />
                    {label} ({count})
                  </button>
                )
              })}
            </div>
          </div>

          {(search || statusFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
              }}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Limpar
            </Button>
          )}
        </div>

        <div className="flex-1 flex flex-col md:flex-row min-h-0 relative overflow-hidden">
          <div className="flex-1 h-full relative bg-muted/10">
            {loading && (
              <div className="absolute inset-0 z-[1000] bg-background/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-foreground">
                  Carregando clientes para o mapa...
                </p>
              </div>
            )}

            {!loading && error && (
              <div className="absolute inset-0 z-[1000] bg-background/95 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="max-w-md space-y-1">
                  <h3 className="font-semibold text-foreground text-base">
                    Erro ao carregar clientes para o mapa.
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Não foi possível obter as coordenadas dos clientes no momento. Tente novamente.
                  </p>
                </div>
                {onReload && (
                  <Button variant="outline" size="sm" onClick={onReload} className="gap-2">
                    <RotateCcw className="w-4 h-4" /> Recarregar
                  </Button>
                )}
              </div>
            )}

            {!loading && !error && clientsWithCoordinates.length === 0 && (
              <div className="absolute inset-0 z-[1000] bg-background/95 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <MapPin className="w-6 h-6" />
                </div>
                <div className="max-w-md space-y-1">
                  <h3 className="font-semibold text-foreground text-base">
                    Nenhum cliente com coordenadas disponíveis.
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Execute o enriquecimento de dados primeiro para geocodificar os endereços dos
                    clientes cadastrados.
                  </p>
                </div>
              </div>
            )}

            {!loading &&
              !error &&
              clientsWithCoordinates.length > 0 &&
              visibleClients.length === 0 && (
                <div className="absolute inset-0 z-[500] bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <Search className="w-5 h-5" />
                  </div>
                  <div className="max-w-md space-y-1">
                    <h3 className="font-semibold text-foreground text-sm">
                      Nenhum cliente encontrado com os filtros atuais.
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Tente alterar os termos de busca ou o filtro de status.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch('')
                      setStatusFilter('all')
                    }}
                    className="text-xs h-7"
                  >
                    Limpar Filtros
                  </Button>
                </div>
              )}

            <div ref={mapContainerRef} className="w-full h-full min-h-[300px]" />

            <div className="absolute bottom-3 left-3 z-[400] bg-background/90 backdrop-blur-md border rounded-md p-2 shadow-md flex items-center gap-3 text-xs pointer-events-auto">
              <span className="font-medium text-foreground text-[11px]">Legenda:</span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Completo
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Enriquecido
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Parcial
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Inconsistente
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Falhou
              </span>
            </div>
          </div>

          <div className="w-full md:w-80 h-48 md:h-full border-t md:border-t-0 md:border-l bg-card flex flex-col shrink-0">
            <div className="p-3 border-b flex items-center justify-between text-xs bg-muted/20">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                Clientes no Mapa
              </span>
              <Badge variant="secondary" className="text-[11px]">
                {visibleClients.length} de {clientsWithCoordinates.length}
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {visibleClients.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Nenhum cliente para listar.
                </div>
              ) : (
                visibleClients.map((client) => {
                  const isSelected = selectedClient?.id === client.id
                  const status = client.address_status || ''
                  const statusLabel = ADDRESS_STATUS_LABELS[status] || status || 'Não informado'
                  const statusColor = ADDRESS_STATUS_COLORS[status] || '#64748b'

                  return (
                    <div
                      key={client.id}
                      onClick={() => handleFocusClient(client)}
                      className={`p-2.5 text-left transition-colors cursor-pointer hover:bg-muted/50 ${
                        isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : ''
                      }`}
                    >
                      <p className="font-medium text-xs text-foreground truncate">{client.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {[client.city, client.state].filter(Boolean).join(' / ') ||
                          'Localidade não informada'}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                          style={{
                            backgroundColor: `${statusColor}15`,
                            color: statusColor,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: statusColor }}
                          />
                          {statusLabel}
                        </span>
                        {client.vendedor_name && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[110px]">
                            {client.vendedor_name}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
