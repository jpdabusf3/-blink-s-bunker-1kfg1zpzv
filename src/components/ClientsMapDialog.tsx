import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2,
  MapPin,
  Search,
  RotateCcw,
  AlertCircle,
  Building2,
  Maximize2,
  Minimize2,
  AlertTriangle,
  Edit,
  PlusCircle,
  HelpCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  resolveClientCoordinates,
  persistResolvedCoordinates,
  applyDeterministicCoordinateOffset,
  type GeocodePrecisao,
} from '@/services/client-geocoding'
import { getFunnelCategory, FUNNEL_CATEGORY_COLORS } from '@/lib/funnel-status'
import { ClienteFormDialog } from '@/components/ClienteFormDialog'
import { useGlobalData } from '@/store/GlobalDataProvider'
import type { Factory, GestaoTecnica } from '@/types'

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

export interface LeafletStatic {
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
  polyline: (
    latlngs: [number, number][],
    options?: Record<string, unknown>,
  ) => {
    addTo: (layer: unknown) => unknown
    getBounds: () => { isValid: () => boolean }
  }
  [key: string]: unknown
}

declare global {
  interface Window {
    L?: LeafletStatic
  }
}

const PRECISÃO_LABELS: Record<string, string> = {
  exata: 'Exata (Salva/Número)',
  rua: 'Rua/Logradouro',
  bairro: 'Bairro/CEP',
  cidade: 'Aprox. Cidade',
  'sem-localizacao': 'Sem Localização',
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
  const { gestao_tecnica: globalGestaoTecnica, notifyDataChanged } = useGlobalData()
  const gestaoTecnicaList: GestaoTecnica[] = (globalGestaoTecnica as GestaoTecnica[]) || []

  const [search, setSearch] = useState('')
  const [precisionFilter, setPrecisionFilter] = useState<string>('all')
  const [selectedClient, setSelectedClient] = useState<Factory | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeTab, setActiveTab] = useState<'plotados' | 'sem_localizacao'>('plotados')

  // Estado para cadastro/edição de cliente sem localização
  const [clientFormOpen, setClientFormOpen] = useState(false)
  const [clientToEdit, setClientToEdit] = useState<Factory | null>(null)

  // Resolução única e cache de coordenadas
  const [resolvingCoords, setResolvingCoords] = useState(false)
  const resolvedCacheRef = useRef<
    Map<string, { latitude?: number; longitude?: number; precisao: GeocodePrecisao }>
  >(new Map())
  const hasTriggeredResolutionRef = useRef(false)
  const hasShownSuccessToastRef = useRef(false)

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<LeafletMap | null>(null)
  const markersLayerRef = useRef<{ clearLayers: () => void } | null>(null)

  // 1. Resolução única em segundo plano para clientes sem coordenadas salvas quando o diálogo abre
  useEffect(() => {
    if (!open || factories.length === 0 || hasTriggeredResolutionRef.current) return

    const clientsNeedingResolution = factories.filter((f) => {
      const lat = f.latitude ?? f.lat
      const lng = f.longitude ?? f.lng
      const hasCoords =
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat !== 0 &&
        lng !== 0

      if (hasCoords) return false
      if (f.precisao === 'sem-localizacao') return false
      if (resolvedCacheRef.current.has(f.id)) return false
      return true
    })

    if (clientsNeedingResolution.length === 0) {
      if (!hasShownSuccessToastRef.current && factories.length > 0) {
        hasShownSuccessToastRef.current = true
        toast.success('Mapa atualizado')
      }
      return
    }

    hasTriggeredResolutionRef.current = true
    let isCancelled = false

    const runResolution = async () => {
      setResolvingCoords(true)
      try {
        for (const client of clientsNeedingResolution) {
          if (isCancelled) break
          try {
            const res = await resolveClientCoordinates(client)
            resolvedCacheRef.current.set(client.id, res)
            await persistResolvedCoordinates(client.id, res)
          } catch (err: unknown) {
            console.warn('[ClientsMapDialog] Erro ao resolver coordenadas:', client.name, err)
            resolvedCacheRef.current.set(client.id, {
              latitude: undefined,
              longitude: undefined,
              precisao: 'sem-localizacao',
            })
          }
        }
        if (!isCancelled) {
          notifyDataChanged('factories')
          if (!hasShownSuccessToastRef.current) {
            hasShownSuccessToastRef.current = true
            toast.success('Mapa atualizado')
          }
        }
      } catch (err: unknown) {
        console.warn('[ClientsMapDialog] Erro no ciclo de resolução:', err)
      } finally {
        if (!isCancelled) {
          setResolvingCoords(false)
        }
      }
    }

    void runResolution()

    return () => {
      isCancelled = true
    }
  }, [open, factories, notifyDataChanged])

  // 2. Separação de clientes com coordenadas vs sem localização
  const { clientsWithCoords, clientsWithoutCoords } = useMemo(() => {
    const withCoords: Factory[] = []
    const withoutCoords: Factory[] = []

    factories.forEach((f) => {
      const cached = resolvedCacheRef.current.get(f.id)
      const lat = f.latitude ?? f.lat ?? cached?.latitude
      const lng = f.longitude ?? f.lng ?? cached?.longitude
      const precisao = (cached?.precisao ||
        f.precisao ||
        (lat && lng ? 'exata' : 'sem-localizacao')) as GeocodePrecisao

      const hasValidCoords =
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat !== 0 &&
        lng !== 0

      if (hasValidCoords && precisao !== 'sem-localizacao') {
        withCoords.push({
          ...f,
          latitude: lat,
          longitude: lng,
          lat,
          lng,
          precisao,
        })
      } else {
        withoutCoords.push({
          ...f,
          latitude: undefined,
          longitude: undefined,
          lat: undefined,
          lng: undefined,
          precisao: 'sem-localizacao',
        })
      }
    })

    return { clientsWithCoords: withCoords, clientsWithoutCoords: withoutCoords }
  }, [factories])

  // Filtragem
  const visibleClientsWithCoords = useMemo(() => {
    return clientsWithCoords.filter((f) => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchName = f.name?.toLowerCase().includes(q)
        const matchCity = f.city?.toLowerCase().includes(q)
        const matchState = f.state?.toLowerCase().includes(q)
        if (!matchName && !matchCity && !matchState) return false
      }
      if (precisionFilter !== 'all') {
        if (f.precisao !== precisionFilter) return false
      }
      return true
    })
  }, [clientsWithCoords, search, precisionFilter])

  const visibleClientsWithoutCoords = useMemo(() => {
    return clientsWithoutCoords.filter((f) => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchName = f.name?.toLowerCase().includes(q)
        const matchCity = f.city?.toLowerCase().includes(q)
        const matchState = f.state?.toLowerCase().includes(q)
        if (!matchName && !matchCity && !matchState) return false
      }
      return true
    })
  }, [clientsWithoutCoords, search])

  // Offset determinístico suave para clientes com as mesmas coordenadas
  const plottedClientsWithOffset = useMemo(() => {
    return applyDeterministicCoordinateOffset(visibleClientsWithCoords)
  }, [visibleClientsWithCoords])

  // Estados principais de UX (Loading, Empty, Error, Success)
  const isResolving = loading || resolvingCoords
  const isError = Boolean(error && factories.length === 0)
  const isEmpty = !loading && factories.length === 0 && !isError

  useEffect(() => {
    if (open) {
      setSelectedClient(null)
      setSearch('')
      setPrecisionFilter('all')
      hasTriggeredResolutionRef.current = false
      hasShownSuccessToastRef.current = false
    }
  }, [open])

  // Inicialização do Leaflet Map dentro do diálogo
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

  // Renderização dos pins no mapa com estilo leve para cidade/bairro e offset determinístico
  useEffect(() => {
    if (!open || !mapInstanceRef.current || !markersLayerRef.current || !window.L) return

    const L = window.L
    const map = mapInstanceRef.current
    const markersLayer = markersLayerRef.current

    markersLayer.clearLayers()

    if (plottedClientsWithOffset.length === 0) return

    const bounds = L.latLngBounds([])

    plottedClientsWithOffset.forEach((f) => {
      const lat = f.displayLat
      const lng = f.displayLng

      const precisao = (f.precisao || 'exata') as GeocodePrecisao
      const isApproximate = precisao === 'cidade' || precisao === 'bairro'
      const isCity = precisao === 'cidade'
      const isBairro = precisao === 'bairro'

      // Cor do funil
      const funnelCat = getFunnelCategory(f)
      const baseColor = FUNNEL_CATEGORY_COLORS[funnelCat] || '#2563eb'

      const pinOpacity = isApproximate ? 0.78 : 1.0
      const borderStyle = isCity
        ? '2px dashed #ffffff'
        : isBairro
          ? '2px dotted #ffffff'
          : '2px solid #ffffff'
      const pinSize = isApproximate ? 28 : 24

      const innerBadgeHtml = isCity
        ? `<div style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.55); border-radius: 2px; padding: 1px;"><span style="font-size: 7px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; line-height: 1;">CID</span></div>`
        : isBairro
          ? `<div style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.55); border-radius: 2px; padding: 1px;"><span style="font-size: 7px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; line-height: 1;">BAI</span></div>`
          : `<div style="width: 6px; height: 6px; background-color: #ffffff; border-radius: 50%; transform: rotate(45deg);"></div>`

      const customIcon = L.divIcon({
        className: 'custom-client-marker animate-fade-in',
        html: `
          <div style="
            background-color: ${baseColor};
            opacity: ${pinOpacity};
            width: ${pinSize}px;
            height: ${pinSize}px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 5px rgba(0,0,0,0.35);
            border: ${borderStyle};
            cursor: pointer;
          ">
            ${innerBadgeHtml}
          </div>
        `,
        iconSize: [pinSize, pinSize],
        iconAnchor: [pinSize / 2, pinSize],
        popupAnchor: [0, -pinSize],
      })

      const marker = L.marker([lat, lng], { icon: customIcon })
      const precisionLabel = PRECISÃO_LABELS[precisao] || precisao
      const cityState = [f.city, f.state].filter(Boolean).join(' / ') || 'Não informado'

      const addressDetail = [
        f.logradouro ? `${f.logradouro}${f.numero ? `, ${f.numero}` : ''}` : null,
        f.bairro,
        f.cep ? `CEP: ${f.cep}` : null,
      ]
        .filter(Boolean)
        .join(' - ')

      const popupContent = `
        <div style="font-family: inherit; font-size: 13px; min-width: 220px; padding: 2px 0;">
          <h4 style="font-weight: 700; font-size: 14px; margin: 0 0 4px 0; color: #0f172a; line-height: 1.2;">
            ${f.name}
          </h4>
          <p style="margin: 0 0 4px 0; color: #475569; font-size: 12px;">
            <strong>Cidade/UF:</strong> ${cityState}
          </p>
          ${addressDetail ? `<p style="margin: 0 0 4px 0; color: #64748b; font-size: 11px;">${addressDetail}</p>` : ''}
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0;">
            <span style="color: #64748b; font-size: 11px;">Precisão:</span>
            <span style="font-weight: 600; font-size: 11px; padding: 2px 8px; border-radius: 9999px; background-color: ${isApproximate ? '#fef3c7' : '#e2e8f0'}; color: ${isApproximate ? '#92400e' : '#1e293b'};">
              ${precisionLabel}${f.hasOffset ? ' (offset)' : ''}
            </span>
          </div>
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
  }, [open, plottedClientsWithOffset])

  const handleFocusClient = (f: Factory) => {
    setSelectedClient(f)
    const lat = f.latitude ?? f.lat
    const lng = f.longitude ?? f.lng
    if (mapInstanceRef.current && typeof lat === 'number' && typeof lng === 'number') {
      mapInstanceRef.current.setView([lat, lng], 14, { animate: true })
    }
  }

  const handleOpenClientForm = useCallback((client?: Factory) => {
    setClientToEdit(client || null)
    setClientFormOpen(true)
  }, [])

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
              Visualização geográfica dos clientes com coordenadas estruturadas e sem fallback
              silencioso.
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

        {/* Filter Bar */}
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
                onClick={() => setPrecisionFilter('all')}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  precisionFilter === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                Todas as precisões ({clientsWithCoords.length})
              </button>
              {(['exata', 'rua', 'bairro', 'cidade'] as const).map((prec) => {
                const count = clientsWithCoords.filter((c) => c.precisao === prec).length
                if (count === 0 && precisionFilter !== prec) return null
                const isSelected = precisionFilter === prec
                return (
                  <button
                    key={prec}
                    type="button"
                    onClick={() => setPrecisionFilter(isSelected ? 'all' : prec)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    }`}
                  >
                    {PRECISÃO_LABELS[prec]} ({count})
                  </button>
                )
              })}
            </div>
          </div>

          {(search || precisionFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('')
                setPrecisionFilter('all')
              }}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Limpar
            </Button>
          )}
        </div>

        {/* Corpo: Mapa + Lista Lateral */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 relative overflow-hidden">
          <div className="flex-1 h-full relative bg-muted/10">
            {/* 1. LOADING STATE */}
            {isResolving && (
              <div className="absolute inset-0 z-[1000] bg-background/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-foreground">
                  Posicionando clientes no mapa...
                </p>
              </div>
            )}

            {/* 3. ERROR STATE */}
            {!isResolving && isError && (
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
                    <RotateCcw className="w-4 h-4" /> Tentar novamente
                  </Button>
                )}
              </div>
            )}

            {/* 2. EMPTY STATE: nenhum cliente cadastrado ainda */}
            {!isResolving && !isError && isEmpty && (
              <div className="absolute inset-0 z-[1000] bg-background/95 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="max-w-md space-y-1">
                  <h3 className="font-semibold text-foreground text-base">
                    Nenhum cliente cadastrado ainda
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Cadastre o primeiro cliente para visualizá-lo no mapa.
                  </p>
                </div>
                <Button onClick={() => handleOpenClientForm()} size="sm" className="gap-2">
                  <PlusCircle className="w-4 h-4" />
                  Cadastrar cliente
                </Button>
              </div>
            )}

            {/* Clientes sem localização total */}
            {!isResolving && !isError && !isEmpty && clientsWithCoords.length === 0 && (
              <div className="absolute inset-0 z-[500] bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="max-w-md space-y-1">
                  <h3 className="font-semibold text-foreground text-base">
                    Nenhum cliente com coordenadas válidas
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Todos os clientes cadastrados constam na aba "Sem Localização". Complete o
                    endereço para plotá-los.
                  </p>
                </div>
              </div>
            )}

            <div ref={mapContainerRef} className="w-full h-full min-h-[300px]" />

            {/* Legenda */}
            <div className="absolute bottom-3 left-3 z-[400] bg-background/90 backdrop-blur-md border rounded-md p-2 shadow-md flex items-center gap-3 text-xs pointer-events-auto">
              <span className="font-medium text-foreground text-[11px]">Precisão:</span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-white" />{' '}
                Exata/Rua
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600/70 border border-dashed border-white" />{' '}
                Cidade (CID)
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600/70 border border-dotted border-white" />{' '}
                Bairro (BAI)
              </span>
            </div>
          </div>

          {/* Sidebar lateral com Abas: Plotados no Mapa vs Clientes sem localização */}
          <div className="w-full md:w-80 h-48 md:h-full border-t md:border-t-0 md:border-l bg-card flex flex-col shrink-0">
            <div className="p-2.5 border-b bg-muted/20">
              <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as 'plotados' | 'sem_localizacao')}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 h-8 text-xs">
                  <TabsTrigger value="plotados" className="text-[11px] gap-1 px-1">
                    <MapPin className="w-3 h-3 text-emerald-600" />
                    No Mapa ({visibleClientsWithCoords.length})
                  </TabsTrigger>
                  <TabsTrigger value="sem_localizacao" className="text-[11px] gap-1 px-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Sem Local ({visibleClientsWithoutCoords.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {activeTab === 'plotados' ? (
                visibleClientsWithCoords.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Nenhum cliente para listar.
                  </div>
                ) : (
                  visibleClientsWithCoords.map((client) => {
                    const isSelected = selectedClient?.id === client.id
                    const precisao = (client.precisao || 'exata') as GeocodePrecisao
                    const precisionLabel = PRECISÃO_LABELS[precisao] || precisao

                    return (
                      <div
                        key={client.id}
                        onClick={() => handleFocusClient(client)}
                        className={`p-2.5 text-left transition-colors cursor-pointer hover:bg-muted/50 ${
                          isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-medium text-xs text-foreground truncate">
                            {client.name}
                          </p>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenClientForm(client)
                            }}
                            title="Editar cadastro"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {[client.city, client.state].filter(Boolean).join(' / ') ||
                            'Localidade não informada'}
                        </p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {precisionLabel}
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
                )
              ) : (
                /* Aba: Clientes sem localização com botão para abrir cadastro e completar endereço */
                <div className="divide-y divide-border">
                  <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                    <span className="text-[11px] leading-tight">
                      Estes clientes <strong>não são plotados no mapa</strong>. Complete o endereço
                      para posicioná-los.
                    </span>
                  </div>

                  {visibleClientsWithoutCoords.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      Nenhum cliente sem localização.
                    </div>
                  ) : (
                    visibleClientsWithoutCoords.map((client) => {
                      return (
                        <div
                          key={client.id}
                          className="p-2.5 text-left space-y-1.5 hover:bg-muted/40 transition-colors"
                        >
                          <div>
                            <p className="font-semibold text-xs text-foreground truncate">
                              {client.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {[client.city, client.state].filter(Boolean).join(' / ') ||
                                'Sem cidade/UF'}
                            </p>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-300"
                            >
                              Sem Localização
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px] px-2 gap-1 border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-100"
                              onClick={() => handleOpenClientForm(client)}
                            >
                              <Edit className="w-3 h-3" /> Completar endereço
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Dialog para Completar o Endereço do Cliente */}
      <ClienteFormDialog
        open={clientFormOpen}
        onOpenChange={setClientFormOpen}
        cliente={clientToEdit}
        gestaoTecnicaList={gestaoTecnicaList}
        onSuccess={() => {
          hasTriggeredResolutionRef.current = false
          if (onReload) onReload()
        }}
      />
    </Dialog>
  )
}
