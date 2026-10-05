import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Maximize2,
  Minimize2,
  PlusCircle,
  Edit,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { useGlobalData } from '@/store/GlobalDataProvider'
import { getScopedFactories } from '@/lib/user-scope'
import { factoryMatchesVendedor } from '@/lib/vendedorFilterHelper'
import { normalizeArray } from '@/lib/utils'
import { BLINK_LOCATIONS, BLINK_MARINGA_CD } from '@/constants/blinkLocations'
import {
  CLIENT_PROFILE_CATEGORIES,
  matchesAnyProfileCategory,
  countClientsByCategory,
} from '@/constants/clientCategories'
import {
  getFunnelCategory,
  FUNNEL_CATEGORY_OPTIONS,
  FUNNEL_CATEGORY_COLORS,
} from '@/lib/funnel-status'
import { useOsrmRoute } from '@/hooks/use-osrm-route'
import {
  resolveClientCoordinates,
  persistResolvedCoordinates,
  applyDeterministicCoordinateOffset,
  type GeocodePrecisao,
} from '@/services/client-geocoding'
import { ClienteFormDialog } from '@/components/ClienteFormDialog'
import type { Factory, GestaoTecnica } from '@/types'

const PRECISÃO_LABELS: Record<string, string> = {
  exata: 'Exata (Salva/Número)',
  rua: 'Rua/Logradouro',
  bairro: 'Bairro/CEP',
  cidade: 'Aprox. Cidade',
  'sem-localizacao': 'Sem Localização',
}

export default function MapaClientes() {
  const { user } = useAuth()
  const {
    factories: globalFactories,
    factoriesState,
    gestao_tecnica: globalGestaoTecnica,
    refreshCollection,
    notifyDataChanged,
  } = useGlobalData()

  const [search, setSearch] = useState('')
  const [vendedorFilter, setVendedorFilter] = useState('all')
  const [funnelStatusFilter, setFunnelStatusFilter] = useState<string>('all')
  const [precisionFilter, setPrecisionFilter] = useState<string>('all')
  const [profileFilter, setProfileFilter] = useState('all')
  const [accuracyMode, setAccuracyMode] = useState<'modo1' | 'modo2' | 'modo3'>('modo2')
  const [showBlinkLocations, setShowBlinkLocations] = useState(true)
  const [selectedClient, setSelectedClient] = useState<Factory | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeTab, setActiveTab] = useState<'plotados' | 'sem_localizacao'>('plotados')

  // Estado para cadastro/edição de cliente sem localização ou via botão "Novo Cliente"
  const [dialogOpen, setDialogOpen] = useState(false)
  const [clientToEdit, setClientToEdit] = useState<Factory | null>(null)

  // Resolução assíncrona única com cache de clientes que ainda não têm coordenadas salvas
  const [resolvingCoords, setResolvingCoords] = useState(false)
  const resolvedCacheRef = useRef<
    Map<string, { latitude?: number; longitude?: number; precisao: GeocodePrecisao }>
  >(new Map())
  const hasTriggeredResolutionRef = useRef(false)
  const hasShownSuccessToastRef = useRef(false)

  const { calculating, route, calculateRouteToCD, clearRoute } = useOsrmRoute()

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)
  const blinkLayerRef = useRef<any>(null)
  const routeLayerRef = useRef<any>(null)

  const userRef = useRef(user)
  useEffect(() => {
    userRef.current = user
  }, [user])

  // Clientes com escopo de permissão
  const factories = useMemo(() => {
    return getScopedFactories(globalFactories, userRef.current)
  }, [globalFactories])

  const gestaoTecnicaList: GestaoTecnica[] = (globalGestaoTecnica as GestaoTecnica[]) || []

  // Estados principais de UX (Loading, Empty, Error, Success)
  const initialLoading = factoriesState.loading && factories.length === 0
  const isResolving = initialLoading || resolvingCoords
  const isError = Boolean(factoriesState.error && factories.length === 0)
  const isEmpty = !factoriesState.loading && factories.length === 0 && !isError

  const loadData = useCallback(async () => {
    try {
      hasTriggeredResolutionRef.current = false
      hasShownSuccessToastRef.current = false
      await Promise.all([refreshCollection('factories'), refreshCollection('gestao_tecnica')])
    } catch (err: unknown) {
      console.warn('[MapaClientes] Erro ao recarregar:', err)
    }
  }, [refreshCollection])

  // 1. Resolução única e controlada por cache de clientes que ainda não possuem latitude/longitude persistidas
  useEffect(() => {
    if (factories.length === 0 || hasTriggeredResolutionRef.current) return

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

      // Se já tem coordenadas salvas ou já está marcado com sem-localizacao, não precisa resolver
      if (hasCoords) return false
      if (f.precisao === 'sem-localizacao') return false
      if (resolvedCacheRef.current.has(f.id)) return false
      return true
    })

    if (clientsNeedingResolution.length === 0) {
      // Nenhum cliente precisando de resolução: mapa já pronto
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
            // Persistir UMA única vez de volta no PocketBase
            await persistResolvedCoordinates(client.id, res)
          } catch (err: unknown) {
            console.warn('[MapaClientes] Falha ao resolver cliente:', client.name, err)
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
        console.warn('[MapaClientes] Erro durante ciclo de resolução:', err)
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
  }, [factories, notifyDataChanged])

  // 2. Separação estrita dos clientes:
  // - clientsWithCoords: possuem latitude e longitude válidas E precisao != 'sem-localizacao'
  // - clientsWithoutCoords: precisao === 'sem-localizacao' OU sem coordenadas válidas
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

  // Opções dinâmicas de membros ativos da gestão técnica
  const dynamicVendedoresOptions = useMemo(() => {
    const vends = new Set<string>()
    gestaoTecnicaList.forEach((m) => {
      if (m.ativo !== false && m.nome && m.nome.trim()) {
        vends.add(m.nome.trim())
      }
    })
    return Array.from(vends).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [gestaoTecnicaList])

  // Contagem por perfil sobre todos os clientes
  const profileCategoryCounts = useMemo(() => {
    return countClientsByCategory(factories)
  }, [factories])

  // Filtros aplicados sobre os clientes com coordenadas
  const filteredClientsWithCoords = useMemo(() => {
    return clientsWithCoords.filter((f) => {
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
      if (funnelStatusFilter !== 'all') {
        const cat = getFunnelCategory(f)
        if (cat !== funnelStatusFilter) return false
      }
      if (precisionFilter !== 'all') {
        if (f.precisao !== precisionFilter) return false
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
  }, [
    clientsWithCoords,
    search,
    vendedorFilter,
    funnelStatusFilter,
    precisionFilter,
    profileFilter,
  ])

  // Filtros aplicados sobre os clientes sem localização
  const filteredClientsWithoutCoords = useMemo(() => {
    return clientsWithoutCoords.filter((f) => {
      if (!f) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchName = f.name?.toLowerCase()?.includes(q) ?? false
        const matchCity = f.city?.toLowerCase()?.includes(q) ?? false
        const matchState = f.state?.toLowerCase()?.includes(q) ?? false
        const matchVendedor = f.vendedor_name?.toLowerCase()?.includes(q) ?? false
        if (!matchName && !matchCity && !matchState && !matchVendedor) return false
      }
      if (vendedorFilter !== 'all') {
        if (!factoryMatchesVendedor(f, vendedorFilter)) return false
      }
      if (funnelStatusFilter !== 'all') {
        const cat = getFunnelCategory(f)
        if (cat !== funnelStatusFilter) return false
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
  }, [clientsWithoutCoords, search, vendedorFilter, funnelStatusFilter, profileFilter])

  // Aplicação do nível de precisão / dispersão selecionado (Modos 1, 2 e 3)
  const plottedClientsWithOffset = useMemo(() => {
    if (accuracyMode === 'modo3') {
      // Modo 3: Endereço exato sem dispersão artificial adicional
      return filteredClientsWithCoords.map((c) => ({
        ...c,
        displayLat: c.latitude ?? c.lat ?? 0,
        displayLng: c.longitude ?? c.lng ?? 0,
        hasOffset: false,
      }))
    }
    // Modo 1 (Cidade) e Modo 2 (Dispersão raio 1-3km com offset determinístico)
    return applyDeterministicCoordinateOffset(filteredClientsWithCoords)
  }, [filteredClientsWithCoords, accuracyMode])

  // Invalidação de tamanho ao alternar tela cheia
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize()
      }, 150)
    }
  }, [isFullscreen])

  // Inicialização do Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    const initLeaflet = () => {
      if (!window.L || !mapContainerRef.current) return

      if (!mapInstanceRef.current) {
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
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize()
          }
        }, 200)
      }
    }

    let intervalId: ReturnType<typeof setInterval> | null = null
    if (window.L) {
      initLeaflet()
    } else {
      intervalId = setInterval(() => {
        if (window.L) {
          if (intervalId) clearInterval(intervalId)
          initLeaflet()
        }
      }, 100)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markersLayerRef.current = null
        blinkLayerRef.current = null
        routeLayerRef.current = null
      }
    }
  }, [])

  // Pontos Fixos Blink
  useEffect(() => {
    if (!mapInstanceRef.current || !blinkLayerRef.current || !window.L) return

    const L = window.L
    const blinkLayer = blinkLayerRef.current
    blinkLayer.clearLayers()

    if (!showBlinkLocations) return

    BLINK_LOCATIONS.forEach((loc) => {
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

  // Manipulador de rota
  const handleCalculateRouteRef = useRef<(f: Factory) => void>(() => {})
  const handleCalculateRoute = useCallback(
    (f: Factory) => {
      const lat = f.latitude ?? f.lat
      const lng = f.longitude ?? f.lng
      calculateRouteToCD(f.name, lat, lng)
    },
    [calculateRouteToCD],
  )
  useEffect(() => {
    handleCalculateRouteRef.current = handleCalculateRoute
  }, [handleCalculateRoute])

  const initialFitBoundsDone = useRef(false)

  // Renderização dos pins com fade-in suave, estilo mais leve para "cidade" e "bairro", e offset determinístico
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !window.L) return

    const L = window.L
    const map = mapInstanceRef.current
    const markersLayer = markersLayerRef.current

    markersLayer.clearLayers()

    if (plottedClientsWithOffset.length === 0) return

    const bounds = L.latLngBounds([])
    if (showBlinkLocations) {
      BLINK_LOCATIONS.forEach((l) => bounds.extend([l.lat, l.lng]))
    }

    plottedClientsWithOffset.forEach((f) => {
      const lat = f.displayLat
      const lng = f.displayLng

      const precisao = (f.precisao || 'exata') as GeocodePrecisao
      const isApproximate = precisao === 'cidade' || precisao === 'bairro'
      const isCity = precisao === 'cidade'
      const isBairro = precisao === 'bairro'

      // Cor de base pelo funil de vendas
      const funnelCat = getFunnelCategory(f)
      const baseColor = FUNNEL_CATEGORY_COLORS[funnelCat] || '#2563eb'

      // Para precisão "cidade" e "bairro", estilo mais claro/leve sinalizando aproximação
      const pinOpacity = isApproximate ? 0.78 : 1.0
      const borderStyle = isCity
        ? '2px dashed #ffffff'
        : isBairro
          ? '2px dotted #ffffff'
          : '2px solid #ffffff'

      const pinSize = isApproximate ? 30 : 26
      const shadowStyle = isApproximate
        ? '0 2px 6px rgba(0,0,0,0.25)'
        : '0 3px 10px rgba(0,0,0,0.4)'

      const innerBadgeHtml = isCity
        ? `<div style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.55); border-radius: 3px; padding: 1px 2px;"><span style="font-size: 8px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; line-height: 1;">CID</span></div>`
        : isBairro
          ? `<div style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.55); border-radius: 3px; padding: 1px 2px;"><span style="font-size: 8px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; line-height: 1;">BAI</span></div>`
          : `<div style="width: 7px; height: 7px; background-color: #ffffff; border-radius: 50%; transform: rotate(45deg); box-shadow: 0 1px 2px rgba(0,0,0,0.4);"></div>`

      const customIcon = L.divIcon({
        className: 'custom-map-pin animate-fade-in',
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
            box-shadow: ${shadowStyle};
            border: ${borderStyle};
            cursor: pointer;
            transition: transform 0.2s ease;
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
      const cityState = [f.city, f.state].filter(Boolean).join(' - ') || 'Localidade não informada'
      const perfilLabel = normalizeArray(f.profile_type).join(', ') || 'Não informado'

      const funnelBadgeBg =
        funnelCat === 'Ativos'
          ? '#dbeafe'
          : funnelCat === 'Prospectos'
            ? '#dcfce7'
            : funnelCat === 'Inativos'
              ? '#fef9c3'
              : '#fee2e2'
      const funnelBadgeColor =
        funnelCat === 'Ativos'
          ? '#1e40af'
          : funnelCat === 'Prospectos'
            ? '#166534'
            : funnelCat === 'Inativos'
              ? '#854d0e'
              : '#991b1b'

      const addressDetail = [
        f.logradouro ? `${f.logradouro}${f.numero ? `, ${f.numero}` : ''}` : null,
        f.bairro,
        f.cep ? `CEP: ${f.cep}` : null,
      ]
        .filter(Boolean)
        .join(' - ')

      const popupContent = `
        <div style="font-family: sans-serif; font-size: 13px; min-width: 250px; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
            <h4 style="font-weight: 700; font-size: 14px; margin: 0; color: #0f172a;">${f.name}</h4>
            <span style="font-weight: 700; font-size: 10px; padding: 2px 7px; border-radius: 9999px; background: ${funnelBadgeBg}; color: ${funnelBadgeColor}; white-space: nowrap;">
              ${funnelCat}
            </span>
          </div>
          <p style="margin: 0 0 4px 0; color: #475569; font-size: 12px;"><strong>Cidade/UF:</strong> ${cityState}</p>
          ${addressDetail ? `<p style="margin: 0 0 4px 0; color: #64748b; font-size: 11px;">${addressDetail}</p>` : ''}
          <p style="margin: 0 0 6px 0; color: #475569; font-size: 12px;"><strong>Perfil / Carteira:</strong> ${perfilLabel}</p>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 4px; border-top: 1px solid #e2e8f0;">
            <span style="color: #64748b; font-size: 11px;">Precisão:</span>
            <span style="font-weight: 600; font-size: 11px; padding: 2px 6px; border-radius: 4px; background: ${isApproximate ? '#fef3c7' : '#e2e8f0'}; color: ${isApproximate ? '#92400e' : '#1e293b'};">
              ${precisionLabel}${f.hasOffset ? ' (offset suave)' : ''}
            </span>
          </div>
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 6px;">
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
            handleCalculateRouteRef.current(f)
          }
        }
      })

      marker.addTo(markersLayer)
      bounds.extend([lat, lng])
    })

    if (bounds.isValid() && !initialFitBoundsDone.current) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
      initialFitBoundsDone.current = true
    }
  }, [plottedClientsWithOffset, showBlinkLocations])

  // Redesenho da rota Leaflet
  useEffect(() => {
    if (!mapInstanceRef.current || !routeLayerRef.current || !window.L) return

    const L = window.L
    const map = mapInstanceRef.current
    const routeLayer = routeLayerRef.current
    routeLayer.clearLayers()

    if (!route || route.coordinates.length === 0) return

    const polyline = L.polyline(route.coordinates, {
      color: '#2563eb',
      weight: 5,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
    })
    polyline.addTo(routeLayer)

    const bounds = polyline.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [60, 60] })
    }
  }, [route])

  const handleCenterOnClient = (f: Factory) => {
    setSelectedClient(f)
    const lat = f.latitude ?? f.lat
    const lng = f.longitude ?? f.lng
    if (mapInstanceRef.current && typeof lat === 'number' && typeof lng === 'number') {
      mapInstanceRef.current.setView([lat, lng], 14, { animate: true })
    }
  }

  const handleOpenClientForm = (client?: Factory) => {
    setClientToEdit(client || null)
    setDialogOpen(true)
  }

  const clearFilters = () => {
    setSearch('')
    setVendedorFilter('all')
    setFunnelStatusFilter('all')
    setPrecisionFilter('all')
    setProfileFilter('all')
  }

  const hasFilters =
    search.trim() !== '' ||
    vendedorFilter !== 'all' ||
    funnelStatusFilter !== 'all' ||
    precisionFilter !== 'all' ||
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
            variant="default"
            size="sm"
            onClick={() => handleOpenClientForm()}
            className="gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Novo Cliente
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isResolving}
            className="gap-2"
          >
            {isResolving ? (
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
              <p className="text-xs font-medium text-muted-foreground">Plotados no Mapa</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {clientsWithCoords.length}
              </p>
            </div>
            <MapPin className="w-8 h-8 text-emerald-500/40" />
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Exibidos no Filtro</p>
              <p className="text-2xl font-bold text-primary">{filteredClientsWithCoords.length}</p>
            </div>
            <Layers className="w-8 h-8 text-primary/40" />
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Sem Localização</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {clientsWithoutCoords.length}
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
                  <SelectContent className="z-[9999]">
                    <SelectItem value="all">Todos os vendedores</SelectItem>
                    {dynamicVendedoresOptions.map((vend) => (
                      <SelectItem key={vend} value={vend}>
                        {vend}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro Status do Funil de Vendas */}
              <div className="w-full sm:w-[220px]">
                <Select value={funnelStatusFilter} onValueChange={setFunnelStatusFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Status do funil de vendas" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="all">Status do funil: Todos</SelectItem>
                    {FUNNEL_CATEGORY_OPTIONS.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                            style={{ backgroundColor: FUNNEL_CATEGORY_COLORS[cat] }}
                          />
                          <span>{cat}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro Perfil/Categoria */}
              <div className="w-full sm:w-[190px]">
                <Select value={profileFilter} onValueChange={setProfileFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Perfil / Categoria" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="all">Todos os Perfis</SelectItem>
                    {CLIENT_PROFILE_CATEGORIES.map((prof) => (
                      <SelectItem key={prof} value={prof}>
                        {prof} ({profileCategoryCounts[prof] ?? 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro Precisão */}
              <div className="w-full sm:w-[180px]">
                <Select value={precisionFilter} onValueChange={setPrecisionFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Precisão do Pin" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="all">Todas as precisões</SelectItem>
                    <SelectItem value="exata">Exata (Número/Salva)</SelectItem>
                    <SelectItem value="rua">Rua/Logradouro</SelectItem>
                    <SelectItem value="bairro">Bairro/CEP</SelectItem>
                    <SelectItem value="cidade">Aprox. Cidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Seletor de Nível de Precisão do Mapa (Modos 1, 2 e 3) */}
              <div className="w-full sm:w-[260px]">
                <Select
                  value={accuracyMode}
                  onValueChange={(val: 'modo1' | 'modo2' | 'modo3') => setAccuracyMode(val)}
                >
                  <SelectTrigger
                    className="h-9 text-xs font-medium"
                    aria-label="Nível de precisão do mapa"
                  >
                    <SelectValue placeholder="Nível de precisão do mapa" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="modo1" className="text-xs">
                      Modo 1 · Nível Cidade (Centroide)
                    </SelectItem>
                    <SelectItem value="modo2" className="text-xs">
                      Modo 2 · Dispersão (Raio 1–3 km)
                    </SelectItem>
                    <SelectItem value="modo3" className="text-xs">
                      Modo 3 · Endereço Completo
                    </SelectItem>
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

          {/* Aviso visível quando Modos 1 ou 2 estiverem ativos */}
          {(accuracyMode === 'modo1' || accuracyMode === 'modo2') && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Posição aproximada no nível de município — não representa o endereço exato do
                cliente.
              </span>
            </div>
          )}

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
      <div
        className={
          isFullscreen
            ? 'fixed inset-0 z-50 bg-background p-4 grid grid-cols-1 lg:grid-cols-4 gap-4 overflow-hidden'
            : 'grid grid-cols-1 lg:grid-cols-4 gap-6'
        }
      >
        {/* Map View */}
        <div className="lg:col-span-3 h-full">
          <Card
            className={`shadow-subtle overflow-hidden flex flex-col relative ${
              isFullscreen ? 'h-full' : 'h-[650px]'
            }`}
          >
            <CardHeader className="py-3 px-4 border-b bg-card flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Mapa Interativo do Brasil
                </CardTitle>
                <CardDescription className="text-xs">
                  {filteredClientsWithCoords.length} cliente(s) plotado(s)
                  {showBlinkLocations ? ' + 4 pontos fixos Blink' : ''}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {/* Legenda do Mapa */}
                <div className="hidden sm:flex items-center gap-2.5 text-xs flex-wrap">
                  <span className="flex items-center gap-1" title="Ativos">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block shadow-sm"
                      style={{ backgroundColor: FUNNEL_CATEGORY_COLORS.Ativos }}
                    />{' '}
                    Ativos
                  </span>
                  <span className="flex items-center gap-1" title="Prospectos">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block shadow-sm"
                      style={{ backgroundColor: FUNNEL_CATEGORY_COLORS.Prospectos }}
                    />{' '}
                    Prospectos
                  </span>
                  <span className="flex items-center gap-1" title="Inativos">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block shadow-sm"
                      style={{ backgroundColor: FUNNEL_CATEGORY_COLORS.Inativos }}
                    />{' '}
                    Inativos
                  </span>
                  <span className="flex items-center gap-1" title="Negociação encerrada">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block shadow-sm"
                      style={{ backgroundColor: FUNNEL_CATEGORY_COLORS['Negociação encerrada'] }}
                    />{' '}
                    Encerrados
                  </span>

                  <span className="h-3 w-px bg-border mx-0.5" />

                  <span
                    className="flex items-center gap-1 text-muted-foreground"
                    title="Aproximação por Centróide de Cidade (tracejado/mais claro)"
                  >
                    <span className="inline-flex items-center justify-center px-1 rounded text-[9px] font-bold bg-slate-800 text-white">
                      CID
                    </span>{' '}
                    Cidade
                  </span>
                  <span
                    className="flex items-center gap-1 text-muted-foreground"
                    title="Aproximação por Bairro/CEP (pontilhado)"
                  >
                    <span className="inline-flex items-center justify-center px-1 rounded text-[9px] font-bold bg-slate-800 text-white">
                      BAI
                    </span>{' '}
                    Bairro
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setIsFullscreen((prev) => !prev)}
                  title={isFullscreen ? 'Sair da tela cheia' : 'Modo tela cheia'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardHeader>

            <div className="flex-1 w-full relative">
              {/* 1. LOADING STATE */}
              {isResolving && (
                <div className="absolute inset-0 z-[1000] bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm font-medium text-foreground">
                    Carregando e posicionando clientes no mapa...
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
                      Não foi possível carregar o mapa.
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Ocorreu uma instabilidade ao obter os dados dos clientes. Por favor, tente
                      novamente.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
                    <RotateCcw className="w-4 h-4" /> Tentar novamente
                  </Button>
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
                      Comece cadastrando seu primeiro cliente para acompanhar sua localização no
                      mapa.
                    </p>
                  </div>
                  <Button onClick={() => handleOpenClientForm()} className="gap-2" size="sm">
                    <PlusCircle className="w-4 h-4" />
                    Cadastrar primeiro cliente
                  </Button>
                </div>
              )}

              {/* Rota ativa */}
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

              {/* Mensagem caso todos os clientes cadastrados estejam sem localização */}
              {!isResolving && !isError && !isEmpty && clientsWithCoords.length === 0 && (
                <div className="absolute inset-0 z-[500] bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="max-w-md space-y-1">
                    <h3 className="font-semibold text-foreground text-base">
                      Todos os clientes estão sem localização
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Nenhum cliente possui endereço ou coordenadas suficientes para plotar pins no
                      mapa. Utilize a lista lateral "Clientes sem localização" para completar o
                      endereço.
                    </p>
                  </div>
                </div>
              )}

              <div ref={mapContainerRef} className="w-full h-full min-h-[500px]" />
            </div>
          </Card>
        </div>

        {/* Sidebar list of clients (com abas: Plotados no Mapa vs Clientes sem localização) */}
        <div className="lg:col-span-1 h-full">
          <Card className={`shadow-subtle flex flex-col ${isFullscreen ? 'h-full' : 'h-[650px]'}`}>
            <CardHeader className="py-2.5 px-3 border-b">
              <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as 'plotados' | 'sem_localizacao')}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 h-8 text-xs">
                  <TabsTrigger value="plotados" className="text-[11px] gap-1 px-1">
                    <MapPin className="w-3 h-3 text-emerald-600" />
                    No Mapa ({filteredClientsWithCoords.length})
                  </TabsTrigger>
                  <TabsTrigger value="sem_localizacao" className="text-[11px] gap-1 px-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Sem Localização ({filteredClientsWithoutCoords.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>

            <CardContent className="p-0 flex-1 overflow-y-auto">
              {activeTab === 'plotados' ? (
                /* Lista de Clientes Plotados */
                filteredClientsWithCoords.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
                    <MapPin className="w-6 h-6 mx-auto text-muted-foreground/40" />
                    <p>Nenhum cliente com coordenadas para listar no filtro atual.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredClientsWithCoords.map((f) => {
                      const isSelected = selectedClient?.id === f.id
                      const profiles = normalizeArray(f.profile_type)
                      const funnelCat = getFunnelCategory(f)
                      const funnelBadgeBg =
                        funnelCat === 'Ativos'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-300'
                          : funnelCat === 'Prospectos'
                            ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 border-green-300'
                            : funnelCat === 'Inativos'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-300'
                              : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-300'

                      return (
                        <div
                          key={f.id}
                          onClick={() => handleCenterOnClient(f)}
                          className={`p-3 text-left transition-colors cursor-pointer hover:bg-muted/50 ${
                            isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-semibold text-xs text-foreground truncate">
                              {f.name}
                            </p>
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: FUNNEL_CATEGORY_COLORS[funnelCat] }}
                              title={`Status do funil: ${funnelCat}`}
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {[f.city, f.state].filter(Boolean).join(' - ') ||
                              'Localidade não informada'}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 h-4 font-semibold ${funnelBadgeBg}`}
                            >
                              {funnelCat}
                            </Badge>
                            {profiles.map((p) => (
                              <Badge
                                key={p}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 h-4"
                              >
                                {p}
                              </Badge>
                            ))}
                            {f.precisao && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300"
                              >
                                {f.precisao === 'cidade'
                                  ? 'CID'
                                  : f.precisao === 'bairro'
                                    ? 'BAI'
                                    : f.precisao === 'rua'
                                      ? 'RUA'
                                      : 'EXATO'}
                              </Badge>
                            )}
                          </div>

                          <div className="mt-2.5 pt-2 border-t flex items-center justify-between gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[11px] px-1.5 text-muted-foreground hover:text-foreground gap-1"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenClientForm(f)
                              }}
                            >
                              <Edit className="w-3 h-3" /> Editar cadastro
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[11px] px-1.5 text-primary gap-1"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCalculateRoute(f)
                              }}
                            >
                              <Navigation className="w-3 h-3" /> Rota CD
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              ) : (
                /* Lista Lateral: "Clientes sem localização" */
                <div className="divide-y divide-border">
                  <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <span>
                      Estes clientes não têm endereço nem coordenadas válidas e{' '}
                      <strong>não são plotados no mapa</strong>. Clique em{' '}
                      <strong>Completar endereço</strong> para regularizar.
                    </span>
                  </div>

                  {filteredClientsWithoutCoords.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      Parabéns! Nenhum cliente pendente de localização no filtro atual.
                    </div>
                  ) : (
                    filteredClientsWithoutCoords.map((client) => {
                      return (
                        <div
                          key={client.id}
                          className="p-3 text-left space-y-2 hover:bg-muted/40 transition-colors"
                        >
                          <div>
                            <p className="font-semibold text-xs text-foreground truncate">
                              {client.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {[client.city, client.state].filter(Boolean).join(' - ') ||
                                'Sem cidade/estado'}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                            >
                              Sem Localização
                            </Badge>

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
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
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog para Criar ou Editar Cliente (completar endereço, viaCEP, etc) */}
      <ClienteFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cliente={clientToEdit}
        gestaoTecnicaList={gestaoTecnicaList}
        onSuccess={() => {
          hasTriggeredResolutionRef.current = false
          void loadData()
        }}
      />
    </div>
  )
}
