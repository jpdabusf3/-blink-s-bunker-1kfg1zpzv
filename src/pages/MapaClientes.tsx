import { useEffect, useRef, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, MapPin, Search, RotateCcw, Building2, AlertTriangle, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { getAllFactories } from '@/services/factories'
import { getScopedFactories } from '@/lib/user-scope'
import type { Factory } from '@/types'

declare global {
  interface Window {
    L?: any
  }
}

const ADDRESS_STATUS_LABELS: Record<string, string> = {
  complete: 'Completo',
  partial: 'Parcial',
  inconsistent: 'Inconsistente',
  enriched: 'Enriquecido',
  failed: 'Falha',
}

const GEOCODE_PRECISION_LABELS: Record<string, string> = {
  exact: 'Exata (Número)',
  street: 'Rua/Logradouro',
  city: 'Cidade/Município',
  failed: 'Falha',
}

export default function MapaClientes() {
  const { user } = useAuth()
  const [factories, setFactories] = useState<Factory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [addressStatusFilter, setAddressStatusFilter] = useState('all')
  const [geocodePrecisionFilter, setGeocodePrecisionFilter] = useState('all')
  const [selectedClient, setSelectedClient] = useState<Factory | null>(null)

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const all = await getAllFactories()
      setFactories(getScopedFactories(all, user))
    } catch (err) {
      console.error('[mapa] erro ao carregar clientes', err)
      toast.error('Erro ao carregar clientes do mapa. Tente novamente.')
      setFactories([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])

  useRealtime('factories', () => loadData())

  // Clientes com coordenadas válidas (lat e lng preenchidos e diferentes de 0)
  const validFactories = useMemo(() => {
    return factories.filter((f) => {
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
  }, [factories])

  // Filtros aplicados sobre os clientes com coordenadas válidas
  const filteredFactories = useMemo(() => {
    return validFactories.filter((f) => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchName = f.name?.toLowerCase().includes(q)
        const matchCity = f.city?.toLowerCase().includes(q)
        const matchState = f.state?.toLowerCase().includes(q)
        if (!matchName && !matchCity && !matchState) return false
      }
      if (addressStatusFilter !== 'all') {
        if (f.address_status !== addressStatusFilter) return false
      }
      if (geocodePrecisionFilter !== 'all') {
        if (f.geocode_precision !== geocodePrecisionFilter) return false
      }
      return true
    })
  }, [validFactories, search, addressStatusFilter, geocodePrecisionFilter])

  // Inicialização do Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    // Aguarda carregar Leaflet da CDN se necessário
    const initLeaflet = () => {
      if (!window.L || !mapContainerRef.current) return

      if (!mapInstanceRef.current) {
        // Centro do Brasil: [-14.235, -51.925], zoom 4
        const map = window.L.map(mapContainerRef.current, {
          center: [-14.235, -51.925],
          zoom: 4,
          scrollWheelZoom: true,
        })

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> colaboradores',
          maxZoom: 19,
        }).addTo(map)

        const markersLayer = window.L.layerGroup().addTo(map)
        mapInstanceRef.current = map
        markersLayerRef.current = markersLayer
      }
    }

    if (window.L) {
      initLeaflet()
    } else {
      const timer = setInterval(() => {
        if (window.L) {
          clearInterval(timer)
          initLeaflet()
        }
      }, 100)
      return () => clearInterval(timer)
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markersLayerRef.current = null
      }
    }
  }, [])

  // Atualização dos Marcadores no Mapa
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !window.L) return

    const L = window.L
    const map = mapInstanceRef.current
    const markersLayer = markersLayerRef.current

    markersLayer.clearLayers()

    if (filteredFactories.length === 0) return

    const bounds = L.latLngBounds([])

    filteredFactories.forEach((f) => {
      const lat = (f.lat ?? f.coordinates?.lat)!
      const lng = (f.lng ?? f.coordinates?.lng)!

      const statusColor =
        f.address_status === 'complete'
          ? '#10b981'
          : f.address_status === 'enriched'
            ? '#3b82f6'
            : f.address_status === 'partial'
              ? '#f59e0b'
              : f.address_status === 'inconsistent'
                ? '#f97316'
                : '#ef4444'

      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="
            background-color: ${statusColor};
            width: 28px;
            height: 28px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            border: 2px solid #ffffff;
            cursor: pointer;
          ">
            <div style="
              width: 8px;
              height: 8px;
              background-color: #ffffff;
              border-radius: 50%;
              transform: rotate(45deg);
            "></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28],
      })

      const marker = L.marker([lat, lng], { icon: customIcon })

      const statusLabel = f.address_status
        ? ADDRESS_STATUS_LABELS[f.address_status] || f.address_status
        : 'Não informado'
      const precisionLabel = f.geocode_precision
        ? GEOCODE_PRECISION_LABELS[f.geocode_precision] || f.geocode_precision
        : 'Não informada'
      const cityState = [f.city, f.state].filter(Boolean).join(' - ') || 'Localidade não informada'

      const popupContent = `
        <div style="font-family: sans-serif; font-size: 13px; min-width: 200px; padding: 2px;">
          <h4 style="font-weight: 700; font-size: 14px; margin: 0 0 4px 0; color: #0f172a;">${f.name}</h4>
          <p style="margin: 0 0 6px 0; color: #475569; font-size: 12px;"><strong>Localização:</strong> ${cityState}</p>
          <div style="margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span style="color: #64748b; font-size: 12px;">Status Endereço:</span>
            <span style="font-weight: 600; font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #e2e8f0; color: #1e293b;">${statusLabel}</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span style="color: #64748b; font-size: 12px;">Precisão Geocode:</span>
            <span style="font-weight: 600; font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #e2e8f0; color: #1e293b;">${precisionLabel}</span>
          </div>
          ${f.standardized_address ? `<p style="margin: 6px 0 0 0; padding-top: 4px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">${f.standardized_address}</p>` : ''}
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
  }, [filteredFactories])

  const handleCenterOnClient = (f: Factory) => {
    setSelectedClient(f)
    const lat = f.lat ?? f.coordinates?.lat
    const lng = f.lng ?? f.coordinates?.lng
    if (mapInstanceRef.current && typeof lat === 'number' && typeof lng === 'number') {
      mapInstanceRef.current.setView([lat, lng], 14, { animate: true })
    }
  }

  const clearFilters = () => {
    setSearch('')
    setAddressStatusFilter('all')
    setGeocodePrecisionFilter('all')
  }

  const hasFilters =
    search.trim() !== '' || addressStatusFilter !== 'all' || geocodePrecisionFilter !== 'all'

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg text-primary-foreground">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mapa de Clientes</h1>
            <p className="text-muted-foreground text-sm">
              Visualize a distribuição geográfica dos clientes geocodificados em todo o Brasil.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-subtle">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total de Clientes</p>
              <p className="text-2xl font-bold">{factories.length}</p>
            </div>
            <Building2 className="w-8 h-8 text-muted-foreground/40" />
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Com Coordenadas</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {validFactories.length}
              </p>
            </div>
            <MapPin className="w-8 h-8 text-emerald-500/40" />
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Exibidos no Filtro</p>
              <p className="text-2xl font-bold text-primary">{filteredFactories.length}</p>
            </div>
            <Layers className="w-8 h-8 text-primary/40" />
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Sem Coordenadas</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {factories.length - validFactories.length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-amber-500/40" />
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="shadow-subtle">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente por nome, cidade ou estado..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="w-full sm:w-[180px]">
                <Select value={addressStatusFilter} onValueChange={setAddressStatusFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Status Endereço" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="complete">Completo</SelectItem>
                    <SelectItem value="enriched">Enriquecido</SelectItem>
                    <SelectItem value="partial">Parcial</SelectItem>
                    <SelectItem value="inconsistent">Inconsistente</SelectItem>
                    <SelectItem value="failed">Falha</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-[180px]">
                <Select value={geocodePrecisionFilter} onValueChange={setGeocodePrecisionFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Precisão Geocode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Precisões</SelectItem>
                    <SelectItem value="exact">Exata (Número)</SelectItem>
                    <SelectItem value="street">Rua/Logradouro</SelectItem>
                    <SelectItem value="city">Cidade/Município</SelectItem>
                    <SelectItem value="failed">Falha</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-9 px-2 text-xs gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Limpar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Map + Sidebar list */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map View */}
        <div className="lg:col-span-3">
          <Card className="shadow-subtle overflow-hidden flex flex-col h-[600px] relative">
            <CardHeader className="py-3 px-4 border-b bg-card flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Mapa Interativo do Brasil
                </CardTitle>
                <CardDescription className="text-xs">
                  {filteredFactories.length} marcador(es) plotado(s)
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Completo
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Enriquecido
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Parcial
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />{' '}
                  Inconsistente/Falha
                </span>
              </div>
            </CardHeader>

            <div className="flex-1 w-full relative">
              {loading && (
                <div className="absolute inset-0 z-[1000] bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm font-medium text-foreground">Carregando dados do mapa...</p>
                </div>
              )}

              {!loading && validFactories.length === 0 && (
                <div className="absolute inset-0 z-[500] bg-background/95 flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div className="max-w-md space-y-1">
                    <h3 className="font-semibold text-foreground text-base">
                      Nenhum cliente com coordenadas para exibir no mapa.
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Nenhum cliente cadastrado possui latitude e longitude válidas no momento. Você
                      pode utilizar a opção "Enriquecer Dados" na página de Cadastro para obter as
                      coordenadas automaticamente.
                    </p>
                  </div>
                </div>
              )}

              {!loading && validFactories.length > 0 && filteredFactories.length === 0 && (
                <div className="absolute inset-0 z-[500] bg-background/95 flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <Search className="w-6 h-6" />
                  </div>
                  <div className="max-w-md space-y-1">
                    <h3 className="font-semibold text-foreground text-base">
                      Nenhum cliente corresponde aos filtros selecionados.
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Tente alterar os termos de busca ou remover os filtros de status e precisão.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Limpar Filtros
                  </Button>
                </div>
              )}

              <div ref={mapContainerRef} className="w-full h-full min-h-[500px]" />
            </div>
          </Card>
        </div>

        {/* Sidebar list of clients */}
        <div className="lg:col-span-1">
          <Card className="shadow-subtle h-[600px] flex flex-col">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Clientes no Mapa</span>
                <Badge variant="secondary" className="text-xs">
                  {filteredFactories.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              {filteredFactories.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum cliente para listar.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredFactories.map((f) => {
                    const isSelected = selectedClient?.id === f.id
                    return (
                      <div
                        key={f.id}
                        onClick={() => handleCenterOnClient(f)}
                        className={`p-3 text-left transition-colors cursor-pointer hover:bg-muted/50 ${
                          isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : ''
                        }`}
                      >
                        <p className="font-semibold text-xs text-foreground truncate">{f.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {[f.city, f.state].filter(Boolean).join(' - ') ||
                            'Localidade não informada'}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {f.address_status && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                              {ADDRESS_STATUS_LABELS[f.address_status] || f.address_status}
                            </Badge>
                          )}
                          {f.geocode_precision && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                              {GEOCODE_PRECISION_LABELS[f.geocode_precision] || f.geocode_precision}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
