import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  MapPin,
  Search,
  RotateCcw,
  Building2,
  AlertTriangle,
  Layers,
  Navigation,
  ExternalLink,
  X,
  Clock,
  Compass,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { getAllFactories } from '@/services/factories'
import { getGestaoTecnica, type GestaoTecnica } from '@/services/gestao-tecnica'
import { getScopedFactories } from '@/lib/user-scope'
import { factoryMatchesVendedor } from '@/lib/vendedorFilterHelper'
import { normalizeArray } from '@/lib/utils'
import { BLINK_LOCATIONS, BLINK_MARINGA_CD } from '@/constants/blinkLocations'
import {
  CLIENT_PROFILE_CATEGORIES,
  matchesAnyProfileCategory,
  countClientsByCategory,
} from '@/constants/clientCategories'
import { useOsrmRoute } from '@/hooks/use-osrm-route'
import type { Factory } from '@/types'

// Window.L is declared in src/components/ClientsMapDialog.tsx

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
  const [gestaoTecnicaList, setGestaoTecnicaList] = useState<GestaoTecnica[]>([])
  const [vendedorFilter, setVendedorFilter] = useState('all')
  const [addressStatusFilter, setAddressStatusFilter] = useState('all')
  const [profileFilter, setProfileFilter] = useState('all')
  const [showBlinkLocations, setShowBlinkLocations] = useState(true)
  const [selectedClient, setSelectedClient] = useState<Factory | null>(null)

  const { calculating, route, calculateRouteToCD, clearRoute } = useOsrmRoute()

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)
  const blinkLayerRef = useRef<any>(null)
  const routeLayerRef = useRef<any>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [all, gestao] = await Promise.all([
        getAllFactories(),
        getGestaoTecnica().catch(() => [] as GestaoTecnica[]),
      ])
      setFactories(getScopedFactories(all, user))
      setGestaoTecnicaList(gestao)
    } catch (err) {
      console.error('[mapa] erro ao carregar clientes', err)
      toast.error('Erro ao carregar clientes do mapa. Tente novamente.')
      setFactories([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('factories', loadData)
  useRealtime('gestao_tecnica', () => {
    getGestaoTecnica()
      .then(setGestaoTecnicaList)
      .catch(() => {})
  })

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

  // Opções dinâmicas de vendedores sincronizadas com gestao_tecnica
  const dynamicVendedoresOptions = useMemo(() => {
    const vends = new Set<string>()
    gestaoTecnicaList.forEach((m) => {
      if (m.funcao === 'vendedor' && m.nome && m.nome.trim()) {
        vends.add(m.nome.trim())
      }
    })
    return Array.from(vends).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [gestaoTecnicaList])

  // Contagem estática por categoria sobre o conjunto completo de clientes carregados
  const profileCategoryCounts = useMemo(() => {
    return countClientsByCategory(factories)
  }, [factories])

  // Filtros aplicados sobre os clientes com coordenadas válidas
  const filteredFactories = useMemo(() => {
    return validFactories.filter((f) => {
      if (!f) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchName = f.name?.toLowerCase()?.includes(q) ?? false
        const matchCity = f.city?.toLowerCase()?.includes(q) ?? false
        const matchState = f.state?.toLowerCase()?.includes(q) ?? false
        const matchGestor = f.gestor_tecnico_name?.toLowerCase()?.includes(q) ?? false
        const matchVendedor = f.vendedor_name?.toLowerCase()?.includes(q) ?? false
        if (!matchName && !matchCity && !matchState && !matchGestor && !matchVendedor) return false
      }
      if (vendedorFilter !== 'all') {
        if (!factoryMatchesVendedor(f, vendedorFilter)) return false
      }
      if (addressStatusFilter !== 'all') {
        if (f.address_status !== addressStatusFilter) return false
      }
      if (profileFilter !== 'all') {
        const profs = normalizeArray(f.profile_type)
        if (f.carteira && f.carteira.trim() && !profs.includes(f.carteira.trim())) {
          profs.push(f.carteira.trim())
        }
        if (!matchesAnyProfileCategory(profs, [profileFilter])) return false
      }
      return true
    })
  }, [validFactories, search, vendedorFilter, addressStatusFilter, profileFilter])

  // Inicialização do Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return

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

        const routeLayer = window.L.layerGroup().addTo(map)
        const markersLayer = window.L.layerGroup().addTo(map)
        const blinkLayer = window.L.layerGroup().addTo(map)

        mapInstanceRef.current = map
        routeLayerRef.current = routeLayer
        markersLayerRef.current = markersLayer
        blinkLayerRef.current = blinkLayer

        setTimeout(() => {
          map.invalidateSize()
        }, 200)
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
        blinkLayerRef.current = null
        routeLayerRef.current = null
      }
    }
  }, [])

  // Atualização dos Pontos Fixos Blink no Mapa
  useEffect(() => {
    if (!mapInstanceRef.current || !blinkLayerRef.current || !window.L) return

    const L = window.L
    const blinkLayer = blinkLayerRef.current
    blinkLayer.clearLayers()

    if (!showBlinkLocations) return

    BLINK_LOCATIONS.forEach((loc) => {
      // Marcador com cor dourada (#F5C518 / #d97706) e ícone industrial/predial
      const isCD = loc.type === 'cd'
      const pinColor = isCD ? '#F5C518' : '#0f172a'
      const iconTextColor = isCD ? '#0f172a' : '#F5C518'
      const badgeText = isCD ? 'CD' : loc.type === 'fabrica' ? 'FÁBRICA' : 'SEDE'

      const blinkIcon = L.divIcon({
        className: 'custom-blink-pin',
        html: `
          <div style="
            background: linear-gradient(135deg, ${pinColor} 0%, #d97706 100%);
            width: 36px;
            height: 36px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.45);
            border: 3px solid #ffffff;
            cursor: pointer;
            position: relative;
          ">
            <div style="
              transform: rotate(45deg);
              font-family: sans-serif;
              font-weight: 800;
              font-size: 10px;
              color: ${iconTextColor};
              letter-spacing: -0.5px;
            ">${badgeText}</div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36],
      })

      const marker = L.marker([loc.lat, loc.lng], { icon: blinkIcon, zIndexOffset: 1000 })

      const popupContent = `
        <div style="font-family: sans-serif; font-size: 13px; min-width: 240px; padding: 4px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
            <span style="background: #F5C518; color: #0f172a; font-weight: 800; font-size: 10px; padding: 2px 6px; border-radius: 4px;">BLINK</span>
            <span style="font-weight: 700; font-size: 12px; color: #64748b; text-transform: uppercase;">Ponto Fixo</span>
          </div>
          <h4 style="font-weight: 700; font-size: 14px; margin: 0 0 4px 0; color: #0f172a; line-height: 1.3;">${loc.name}</h4>
          <p style="margin: 0 0 6px 0; color: #475569; font-size: 12px; line-height: 1.4;">${loc.addressText}</p>
          ${loc.phone ? `<p style="margin: 4px 0 0 0; color: #0f172a; font-size: 12px;"><strong>Telefone:</strong> ${loc.phone}</p>` : ''}
        </div>
      `

      marker.bindPopup(popupContent)
      marker.addTo(blinkLayer)
    })
  }, [showBlinkLocations])

  // Atualização dos Marcadores de Clientes no Mapa
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !window.L) return

    const L = window.L
    const map = mapInstanceRef.current
    const markersLayer = markersLayerRef.current

    markersLayer.clearLayers()

    if (filteredFactories.length === 0) return

    const bounds = L.latLngBounds([])

    // Adiciona pontos de referência aos bounds caso visíveis
    if (showBlinkLocations) {
      BLINK_LOCATIONS.forEach((l) => bounds.extend([l.lat, l.lng]))
    }

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
      const perfilLabel = normalizeArray(f.profile_type).join(', ') || 'Não informado'

      const popupContent = `
        <div style="font-family: sans-serif; font-size: 13px; min-width: 220px; padding: 2px;">
          <h4 style="font-weight: 700; font-size: 14px; margin: 0 0 4px 0; color: #0f172a;">${f.name}</h4>
          <p style="margin: 0 0 4px 0; color: #475569; font-size: 12px;"><strong>Localização:</strong> ${cityState}</p>
          <p style="margin: 0 0 6px 0; color: #475569; font-size: 12px;"><strong>Perfil / Carteira:</strong> ${perfilLabel}</p>
          <div style="margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span style="color: #64748b; font-size: 12px;">Status Endereço:</span>
            <span style="font-weight: 600; font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #e2e8f0; color: #1e293b;">${statusLabel}</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span style="color: #64748b; font-size: 12px;">Precisão Geocode:</span>
            <span style="font-weight: 600; font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #e2e8f0; color: #1e293b;">${precisionLabel}</span>
          </div>
          ${f.standardized_address ? `<p style="margin: 6px 0 0 0; padding-top: 4px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">${f.standardized_address}</p>` : ''}
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 6px;">
            <button
              id="btn-rota-${f.id}"
              style="
                background: #2563eb;
                color: #ffffff;
                border: none;
                border-radius: 6px;
                padding: 6px 10px;
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
              "
            >
              Mostrar rota até o CD (Maringá)
            </button>
            <a
              href="https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${BLINK_MARINGA_CD.lat},${BLINK_MARINGA_CD.lng}"
              target="_blank"
              rel="noopener noreferrer"
              style="
                background: #f1f5f9;
                color: #0f172a;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                padding: 5px 10px;
                font-size: 11px;
                font-weight: 600;
                text-decoration: none;
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
              "
            >
              Abrir no Google Maps ↗
            </a>
          </div>
        </div>
      `

      marker.bindPopup(popupContent)
      marker.on('click', () => {
        setSelectedClient(f)
      })

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-rota-${f.id}`)
        if (btn) {
          btn.onclick = () => {
            handleCalculateRoute(f)
          }
        }
      })

      marker.addTo(markersLayer)
      bounds.extend([lat, lng])
    })

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
  }, [filteredFactories, showBlinkLocations])

  // Desenho da Rota no Mapa
  useEffect(() => {
    if (!mapInstanceRef.current || !routeLayerRef.current || !window.L) return

    const L = window.L
    const map = mapInstanceRef.current
    const routeLayer = routeLayerRef.current
    routeLayer.clearLayers()

    if (!route || route.coordinates.length === 0) return

    // Polyline principal da rota em azul vibrante
    const polyline = L.polyline(route.coordinates, {
      color: '#2563eb',
      weight: 5,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
    })

    polyline.addTo(routeLayer)

    // Ajusta visualização do mapa para englobar a rota inteira
    const bounds = polyline.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [60, 60] })
    }
  }, [route])

  const handleCalculateRoute = (f: Factory) => {
    const lat = f.lat ?? f.coordinates?.lat
    const lng = f.lng ?? f.coordinates?.lng
    calculateRouteToCD(f.name, lat, lng)
  }

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
    setVendedorFilter('all')
    setAddressStatusFilter('all')
    setProfileFilter('all')
  }

  const hasFilters =
    search.trim() !== '' ||
    vendedorFilter !== 'all' ||
    addressStatusFilter !== 'all' ||
    profileFilter !== 'all'

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
        <CardContent className="p-4 space-y-3">
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
              {/* Filtro Vendedor */}
              <div className="w-full sm:w-[190px]">
                <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Todos os vendedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os vendedores</SelectItem>
                    {dynamicVendedoresOptions.map((vend) => (
                      <SelectItem key={vend} value={vend}>
                        {vend}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro Perfil/Categoria */}
              <div className="w-full sm:w-[210px]">
                <Select value={profileFilter} onValueChange={setProfileFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Perfil / Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Perfis</SelectItem>
                    {CLIENT_PROFILE_CATEGORIES.map((prof) => (
                      <SelectItem key={prof} value={prof}>
                        {prof} ({profileCategoryCounts[prof] ?? 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Endereço */}
              <div className="w-full sm:w-[170px]">
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

          {/* Toggle de Pontos de Referência Blink */}
          <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Switch
                id="toggle-blink-locations"
                checked={showBlinkLocations}
                onCheckedChange={setShowBlinkLocations}
              />
              <Label
                htmlFor="toggle-blink-locations"
                className="cursor-pointer font-medium text-xs flex items-center gap-1.5"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#F5C518] inline-block border border-slate-700" />
                Exibir pontos fixos da Blink (CD Maringá, Fábrica PY, Matriz Indaiatuba, Escritório
                SP)
              </Label>
            </div>
            <span className="text-muted-foreground text-[11px]">
              {showBlinkLocations ? '4 pontos de referência ativos' : 'Pontos fixos ocultos'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Main Map + Sidebar list */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map View */}
        <div className="lg:col-span-3">
          <Card className="shadow-subtle overflow-hidden flex flex-col h-[650px] relative">
            <CardHeader className="py-3 px-4 border-b bg-card flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Mapa Interativo do Brasil
                </CardTitle>
                <CardDescription className="text-xs">
                  {filteredFactories.length} cliente(s) plotado(s)
                  {showBlinkLocations ? ' + 4 pontos fixos Blink' : ''}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 text-xs flex-wrap">
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
                {showBlinkLocations && (
                  <span className="flex items-center gap-1 font-semibold text-slate-900 dark:text-amber-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F5C518] inline-block border border-slate-600" />{' '}
                    Blink
                  </span>
                )}
              </div>
            </CardHeader>

            <div className="flex-1 w-full relative">
              {loading && (
                <div className="absolute inset-0 z-[1000] bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm font-medium text-foreground">Carregando dados do mapa...</p>
                </div>
              )}

              {/* Overlay de rota ativa */}
              {route && (
                <div className="absolute top-4 left-4 z-[500] bg-background/95 backdrop-blur border rounded-lg p-3 shadow-lg max-w-sm pointer-events-auto">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-primary/10 text-primary p-1.5 rounded-md">
                        <Navigation className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground truncate max-w-[200px]">
                          Rota até o CD Maringá
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                          {route.clientName}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={clearRoute}
                      title="Limpar rota"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t text-xs">
                    <div className="flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-blue-600" />
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Distância</span>
                        <span className="font-bold text-foreground">
                          {route.distanceKm.toLocaleString('pt-BR')} km
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Tempo Est.</span>
                        <span className="font-bold text-foreground">{route.durationFormatted}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs flex-1 gap-1"
                      asChild
                    >
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=${route.clientLat},${route.clientLng}&destination=${BLINK_MARINGA_CD.lat},${BLINK_MARINGA_CD.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-3 h-3" /> Abrir no Google Maps
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground hover:text-destructive"
                      onClick={clearRoute}
                    >
                      Limpar rota
                    </Button>
                  </div>
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
                      Tente alterar os termos de busca ou remover os filtros aplicados.
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
          <Card className="shadow-subtle h-[650px] flex flex-col">
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
                    const profiles = normalizeArray(f.profile_type)
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
                          {profiles.map((p) => (
                            <Badge
                              key={p}
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 h-4"
                            >
                              {p}
                            </Badge>
                          ))}
                          {f.address_status && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                              {ADDRESS_STATUS_LABELS[f.address_status] || f.address_status}
                            </Badge>
                          )}
                        </div>

                        {isSelected && (
                          <div
                            className="mt-3 pt-2 border-t flex flex-col gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-xs w-full gap-1.5"
                              disabled={calculating}
                              onClick={() => handleCalculateRoute(f)}
                            >
                              {calculating ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Navigation className="w-3.5 h-3.5" />
                              )}
                              Mostrar rota até CD (Maringá)
                            </Button>
                            {(() => {
                              const lat = f.lat ?? f.coordinates?.lat
                              const lng = f.lng ?? f.coordinates?.lng
                              if (typeof lat !== 'number' || typeof lng !== 'number') return null
                              return (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs w-full gap-1"
                                  asChild
                                >
                                  <a
                                    href={`https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${BLINK_MARINGA_CD.lat},${BLINK_MARINGA_CD.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="w-3 h-3" /> Abrir no Google Maps
                                  </a>
                                </Button>
                              )
                            })()}
                          </div>
                        )}
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
