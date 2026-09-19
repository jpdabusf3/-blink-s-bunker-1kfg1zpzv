import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Target,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  AlertCircle,
  Calendar,
  Layers,
  User,
  DollarSign,
  TrendingUp,
  Percent,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import {
  getMetasPorPeriodo,
  saveMetaVendedorSegmento,
  deleteMeta,
  SEGMENTOS_METAS,
  type Meta,
  type SegmentoMeta,
} from '@/services/metas'
import { getHistoricoVendas, type HistoricoVenda } from '@/services/historico-vendas'
import { getGestaoTecnica, type GestaoTecnica } from '@/services/gestao-tecnica'
import { type FaturamentoRecord } from '@/services/resumo-vendas'
import { type Factory } from '@/types'
import { normalizeStr } from '@/lib/vendedorFilterHelper'
import { cn } from '@/lib/utils'

export const MESES_PT = [
  { valor: 1, nome: 'Janeiro' },
  { valor: 2, nome: 'Fevereiro' },
  { valor: 3, nome: 'Março' },
  { valor: 4, nome: 'Abril' },
  { valor: 5, nome: 'Maio' },
  { valor: 6, nome: 'Junho' },
  { valor: 7, nome: 'Julho' },
  { valor: 8, nome: 'Agosto' },
  { valor: 9, nome: 'Setembro' },
  { valor: 10, nome: 'Outubro' },
  { valor: 11, nome: 'Novembro' },
  { valor: 12, nome: 'Dezembro' },
] as const

interface MetasVendedorSegmentoSectionProps {
  /** Registros de faturamento disponíveis na página Resumo (opcional) */
  faturamentos?: FaturamentoRecord[]
  /** Mapa de fábricas/clientes para cruzamento de carteira (opcional) */
  factoryMap?: Map<string, { carteira?: string; animalSpecies?: string | string[] }>
  /** Fábricas brutas */
  factories?: Factory[]
}

interface MetaProgressoLinha {
  meta: Meta
  vendedor: string
  segmento: SegmentoMeta | string
  valorMeta: number
  valorRealizado: number
  percentual: number
}

function formatMoedaBR(valor: number): string {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function parseCurrencyInput(value: string): number {
  if (!value) return 0
  const clean = value
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

function formatCurrencyInput(val: number): string {
  if (!val && val !== 0) return ''
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Normaliza o segmento/espécie vindo dos dados de vendas para os 5 segmentos padrão:
 * AVES, PETS, RUMINANTES, SUINOS, AQUA
 */
function normalizarSegmento(seg?: string | null): SegmentoMeta | 'OUTROS' {
  if (!seg) return 'OUTROS'
  const u = String(seg).trim().toUpperCase()
  if (u.includes('AVE') || u.includes('FRANGO') || u === 'MO-BE') return 'AVES'
  if (
    u.includes('PET') ||
    u.includes('CÃO') ||
    u.includes('CAO') ||
    u.includes('GATO') ||
    u === 'MI-XS'
  )
    return 'PETS'
  if (
    u.includes('RUMINANTE') ||
    u.includes('BOVIN') ||
    u.includes('GADO') ||
    u.includes('LEITE') ||
    u.includes('CORTE') ||
    u === 'MI-OR'
  )
    return 'RUMINANTES'
  if (u.includes('SUIN') || u.includes('PORCO') || u === 'MY-CO') return 'SUINOS'
  if (u.includes('AQUA') || u.includes('PEIXE') || u.includes('TILAPIA')) return 'AQUA'
  return 'OUTROS'
}

export function MetasVendedorSegmentoSection({
  faturamentos = [],
  factoryMap,
  factories = [],
}: MetasVendedorSegmentoSectionProps) {
  const { toast } = useToast()

  // Período de consulta da seção (padrão = mês e ano atuais)
  const today = useMemo(() => new Date(), [])
  const [selectedMes, setSelectedMes] = useState<number>(today.getMonth() + 1)
  const [selectedAno, setSelectedAno] = useState<number>(today.getFullYear())

  // Dados da seção
  const [metas, setMetas] = useState<Meta[]>([])
  const [historicoVendas, setHistoricoVendas] = useState<HistoricoVenda[]>([])
  const [gestaoVendedores, setGestaoVendedores] = useState<GestaoTecnica[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Estado do Modal de Criação / Edição
  const [modalOpen, setModalOpen] = useState(false)
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null)
  const [formVendedor, setFormVendedor] = useState('')
  const [formSegmento, setFormSegmento] = useState<SegmentoMeta>('RUMINANTES')
  const [formMes, setFormMes] = useState<number>(today.getMonth() + 1)
  const [formAno, setFormAno] = useState<number>(today.getFullYear())
  const [formValorMetaStr, setFormValorMetaStr] = useState('')
  const [formErrors, setFormErrors] = useState<{
    vendedor?: string
    segmento?: string
    mes?: string
    ano?: string
    valor_meta?: string
  }>({})
  const [saving, setSaving] = useState(false)

  // Estado do Modal de Confirmação de Exclusão
  const [metaToDelete, setMetaToDelete] = useState<Meta | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Carregar metas e dados de vendas/vendedores
  const carregarDados = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [metasList, vendasList, gestaoList] = await Promise.all([
        getMetasPorPeriodo(selectedMes, selectedAno),
        getHistoricoVendas().catch(() => [] as HistoricoVenda[]),
        getGestaoTecnica().catch(() => [] as GestaoTecnica[]),
      ])

      setMetas(metasList)
      setHistoricoVendas(vendasList)
      setGestaoVendedores(gestaoList.filter((g) => g.ativo !== false))
    } catch (err) {
      console.error('Erro ao carregar metas por vendedor e segmento:', err)
      setError('Não foi possível carregar as metas')
    } finally {
      setLoading(false)
    }
  }, [selectedMes, selectedAno])

  useEffect(() => {
    void carregarDados()
  }, [carregarDados])

  // Lista de vendedores distintos já presentes nos dados de vendas / CRM
  const vendedoresDisponiveis = useMemo(() => {
    const nomesSet = new Set<string>()

    // 1. De gestao_tecnica (vendedores ou gestores)
    gestaoVendedores.forEach((g) => {
      const n = (g.nome || '').trim()
      if (n) nomesSet.add(n)
    })

    // 2. De historico_vendas
    historicoVendas.forEach((v) => {
      const n = (v.vendedor || v.expand?.vendedor_id?.nome || '').trim()
      if (n && n !== '-') nomesSet.add(n)
    })

    // 3. De faturamentos
    faturamentos.forEach((f) => {
      const n = (f.vendedor || '').trim()
      if (n && n !== '-') nomesSet.add(n)
    })

    // 4. De factories (vendedor_name ou salesOwnerName)
    factories.forEach((fac) => {
      const vn = (fac.vendedor_name || fac.salesOwnerName || '').trim()
      if (vn) nomesSet.add(vn)
    })

    // Garantir Rodrigo Gardinal como fallback se não houver vendedores
    if (nomesSet.size === 0) {
      nomesSet.add('Rodrigo Gardinal')
    }

    return Array.from(nomesSet).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [gestaoVendedores, historicoVendas, faturamentos, factories])

  // Calcular o realizado do mês para cada meta (filtrando por vendedor, segmento, mês e ano)
  const linhasProgresso = useMemo<MetaProgressoLinha[]>(() => {
    return metas.map((meta) => {
      const vendNome = (
        meta.vendedor ||
        meta.vendedor_nome ||
        meta.expand?.vendedor_id?.nome ||
        ''
      ).trim()
      const segAlvo = normalizarSegmento(meta.segmento || meta.especie)
      const valorMeta = Number(meta.valor_meta || meta.meta_valor) || 0

      const normMetaVend = normalizeStr(vendNome)

      let realizadoTotal = 0

      // 1. Somar de historico_vendas (quando coincide com mes e ano)
      for (const v of historicoVendas) {
        let vAno = v.ano
        let vMesNum = 0
        if (v.data_documento || v.data) {
          const dateStr = v.data_documento || v.data || ''
          const d = new Date(dateStr)
          if (!isNaN(d.getTime())) {
            vAno = vAno || d.getFullYear()
            vMesNum = d.getMonth() + 1
          }
        }
        if (!vMesNum && v.mes) {
          // Checar se mes é string em pt ex: "agosto" ou "setembro"
          const mLower = String(v.mes).trim().toLowerCase()
          const foundIdx = MESES_PT.findIndex((m) => m.nome.toLowerCase() === mLower)
          if (foundIdx >= 0) {
            vMesNum = foundIdx + 1
          } else {
            const pInt = parseInt(v.mes, 10)
            if (!isNaN(pInt)) vMesNum = pInt
          }
        }

        if (vAno === selectedAno && vMesNum === selectedMes) {
          // Verificar vendedor
          const vVend = (v.vendedor || v.expand?.vendedor_id?.nome || '').trim()
          const vMatch =
            normalizeStr(vVend) === normMetaVend ||
            (meta.vendedor_id && v.vendedor_id === meta.vendedor_id)

          if (vMatch) {
            // Verificar segmento
            const vSeg = normalizarSegmento(v.especie_destino || v.especie)
            if (vSeg === segAlvo) {
              const val = Number(v.produto_valor_total || v.valor || 0)
              realizadoTotal += val
            }
          }
        }
      }

      // 2. Somar de faturamentos (se houver e não for sobreposto)
      for (const f of faturamentos) {
        const fAno = f.ano || (f.data_documento ? parseInt(f.data_documento.slice(0, 4), 10) : 0)
        const fMes = f.mes || (f.data_documento ? parseInt(f.data_documento.slice(5, 7), 10) : 0)

        if (fAno === selectedAno && fMes === selectedMes) {
          const fVend = (f.vendedor || '').trim()
          let isVend = false
          if (fVend && normalizeStr(fVend) === normMetaVend) {
            isVend = true
          } else if (!fVend && factoryMap) {
            // Tentar descobrir vendedor pela fábrica vinculada
            const cName = (f.cliente_nome || '').trim().toLowerCase()
            const cCod = (f.cliente_codigo || '').trim().toLowerCase()
            const matchFac = factories.find((fc) => {
              const fcAny = fc as unknown as Record<string, unknown>
              const nameMatch = fc.name?.toLowerCase().trim() === cName
              const codVal =
                typeof fcAny.codigo_cliente === 'string'
                  ? fcAny.codigo_cliente.toLowerCase().trim()
                  : ''
              const codMatch = Boolean(codVal && codVal === cCod)
              return nameMatch || codMatch
            })
            if (matchFac) {
              const fcVend = (matchFac.vendedor_name || matchFac.salesOwnerName || '').trim()
              if (fcVend && normalizeStr(fcVend) === normMetaVend) {
                isVend = true
              }
            }
          }

          if (isVend) {
            // Segmento da linha de faturamento
            let fSeg: SegmentoMeta | 'OUTROS' = 'OUTROS'
            if (factoryMap) {
              const cName = (f.cliente_nome || '').trim().toLowerCase()
              const cCod = (f.cliente_codigo || '').trim().toLowerCase()
              const facInfo = factoryMap.get(cName) || factoryMap.get(cCod)
              if (facInfo?.carteira) {
                fSeg = normalizarSegmento(facInfo.carteira)
              } else if (facInfo?.animalSpecies) {
                const sp = Array.isArray(facInfo.animalSpecies)
                  ? facInfo.animalSpecies[0]
                  : facInfo.animalSpecies
                fSeg = normalizarSegmento(sp)
              }
            }
            if (fSeg === 'OUTROS') {
              fSeg = normalizarSegmento(f.familia_produto)
            }

            if (fSeg === segAlvo) {
              const valBrl = Number(f.valor_brl) || 0
              // Se já temos vendas do histórico para o mês, não duplicar cegamente; somar apenas se historicoVendas estiver vazio
              if (historicoVendas.length === 0 && valBrl > 0) {
                realizadoTotal += valBrl
              }
            }
          }
        }
      }

      // Se a própria meta já tiver valor_realizado cadastrado maior, considerar fallback
      if (realizadoTotal === 0 && Number(meta.valor_realizado) > 0) {
        realizadoTotal = Number(meta.valor_realizado)
      }

      const percentual = valorMeta > 0 ? (realizadoTotal / valorMeta) * 100 : 0

      return {
        meta,
        vendedor: vendNome || 'Vendedor não informado',
        segmento: meta.segmento || meta.especie || 'RUMINANTES',
        valorMeta,
        valorRealizado: realizadoTotal,
        percentual: Math.round(percentual * 10) / 10,
      }
    })
  }, [metas, historicoVendas, faturamentos, factories, factoryMap, selectedMes, selectedAno])

  // Handlers para Modal Criar / Editar
  const handleOpenNovaMeta = () => {
    setEditingMeta(null)
    setFormVendedor(vendedoresDisponiveis[0] || 'Rodrigo Gardinal')
    setFormSegmento('RUMINANTES')
    setFormMes(selectedMes)
    setFormAno(selectedAno)
    setFormValorMetaStr('')
    setFormErrors({})
    setModalOpen(true)
  }

  const handleOpenEditar = (linha: MetaProgressoLinha) => {
    setEditingMeta(linha.meta)
    setFormVendedor(linha.vendedor)
    setFormSegmento(
      (SEGMENTOS_METAS.find((s) => s === linha.segmento) as SegmentoMeta) || 'RUMINANTES',
    )
    setFormMes(linha.meta.mes || selectedMes)
    setFormAno(linha.meta.ano || selectedAno)
    setFormValorMetaStr(formatCurrencyInput(linha.valorMeta))
    setFormErrors({})
    setModalOpen(true)
  }

  const validarForm = (): boolean => {
    const errs: typeof formErrors = {}
    if (!formVendedor.trim()) {
      errs.vendedor = 'Selecione ou informe o vendedor'
    }
    if (!formSegmento) {
      errs.segmento = 'Selecione o segmento'
    }
    if (!formMes || formMes < 1 || formMes > 12) {
      errs.mes = 'Selecione um mês válido (1 a 12)'
    }
    if (!formAno || formAno < 2000 || formAno > 2100) {
      errs.ano = 'Informe um ano válido'
    }
    const val = parseCurrencyInput(formValorMetaStr)
    if (!val || val <= 0) {
      errs.valor_meta = 'O valor da meta deve ser maior que zero'
    }

    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSalvarMeta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validarForm()) return

    setSaving(true)
    try {
      const valorMeta = parseCurrencyInput(formValorMetaStr)

      // Identificar se há vendedor_id correspondente em gestao_tecnica
      const gestorMatch = gestaoVendedores.find(
        (g) => normalizeStr(g.nome) === normalizeStr(formVendedor),
      )

      await saveMetaVendedorSegmento(
        {
          vendedor: formVendedor.trim(),
          segmento: formSegmento,
          mes: formMes,
          ano: formAno,
          valor_meta: valorMeta,
          vendedor_id: gestorMatch?.id,
        },
        editingMeta ? editingMeta.id : undefined,
      )

      toast({
        title: 'Sucesso',
        description: editingMeta ? 'Meta atualizada com sucesso' : 'Meta salva com sucesso',
      })

      setModalOpen(false)
      // Se a meta foi salva para outro período, podemos manter o período atual e recarregar
      await carregarDados()
    } catch (err) {
      console.error('Erro ao salvar meta:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar meta',
        description:
          err instanceof Error
            ? err.message
            : 'Não foi possível salvar a meta. Verifique se já não existe meta para esta combinação.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmarExcluir = async () => {
    if (!metaToDelete) return
    setDeleting(true)
    try {
      await deleteMeta(metaToDelete.id)
      toast({
        title: 'Sucesso',
        description: 'Meta excluída com sucesso',
      })
      setMetaToDelete(null)
      await carregarDados()
    } catch (err) {
      console.error('Erro ao excluir meta:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir meta',
        description: 'Não foi possível excluir a meta. Tente novamente.',
      })
    } finally {
      setDeleting(false)
    }
  }

  // Regra de cor para o percentual atingido:
  // verde quando percentual ≥ 100, amarelo entre 70 e 99, vermelho abaixo de 70
  const getCorStatus = (percent: number) => {
    if (percent >= 100) {
      return {
        badgeClass:
          'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        barClass: 'bg-emerald-500',
        textClass: 'text-emerald-600 dark:text-emerald-400',
      }
    }
    if (percent >= 70) {
      return {
        badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
        barClass: 'bg-amber-500',
        textClass: 'text-amber-600 dark:text-amber-400',
      }
    }
    return {
      badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      barClass: 'bg-rose-500',
      textClass: 'text-rose-600 dark:text-rose-400',
    }
  }

  // Nome do mês atual de consulta para exibição
  const nomeMesConsulta = useMemo(() => {
    return MESES_PT.find((m) => m.valor === selectedMes)?.nome || `Mês ${selectedMes}`
  }, [selectedMes])

  // Anos disponíveis para o seletor
  const anosDisponiveis = useMemo(() => {
    const list: number[] = []
    const yNow = today.getFullYear()
    for (let y = yNow - 2; y <= yNow + 2; y++) {
      list.push(y)
    }
    return list
  }, [today])

  return (
    <section className="space-y-4 pt-6 border-t border-border/40 animate-fade-in">
      {/* Cabeçalho da Seção com Seletor de Período e Botão Nova Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Target className="h-4 w-4" />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Metas por Vendedor e Segmento
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Acompanhamento de metas comerciais planejadas versus faturamento realizado por carteira
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Mês */}
          <Select
            value={String(selectedMes)}
            onValueChange={(val) => setSelectedMes(parseInt(val, 10))}
          >
            <SelectTrigger className="h-8 w-[125px] text-xs bg-card/60 border-border/70">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {MESES_PT.map((m) => (
                <SelectItem key={m.valor} value={String(m.valor)} className="text-xs">
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Seletor de Ano */}
          <Select
            value={String(selectedAno)}
            onValueChange={(val) => setSelectedAno(parseInt(val, 10))}
          >
            <SelectTrigger className="h-8 w-[88px] text-xs bg-card/60 border-border/70">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map((ano) => (
                <SelectItem key={ano} value={String(ano)} className="text-xs">
                  {ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Botão Atualizar */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void carregarDados()}
            disabled={loading}
            className="h-8 px-2.5 text-xs border-border/70 bg-card/60"
            title="Atualizar metas"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </Button>

          {/* Botão Nova Meta */}
          <Button
            size="sm"
            onClick={handleOpenNovaMeta}
            className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Meta</span>
          </Button>
        </div>
      </div>

      {/* 1. ESTADO DE ERROR */}
      {error && !loading && (
        <Card className="glass-card border-destructive/30 shadow-subtle">
          <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-semibold text-sm text-foreground">
                  Não foi possível carregar as metas
                </h4>
                <p className="text-xs text-muted-foreground">
                  Ocorreu uma falha ao consultar as metas do período selecionado.
                </p>
              </div>
            </div>
            <Button
              onClick={() => void carregarDados()}
              variant="outline"
              size="sm"
              className="gap-2 shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 2. ESTADO DE LOADING (Skeletons imitando o formato das linhas) */}
      {loading && !error && (
        <Card className="glass-card border-border/40 shadow-subtle">
          <CardHeader className="p-4 pb-3 border-b border-border/30">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64 mt-1" />
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`meta-skel-${i}`}
                className="p-3.5 rounded-lg border border-border/40 bg-card/40 space-y-2.5 animate-pulse"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20 rounded-full" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-7 w-16" />
                  </div>
                </div>
                <Skeleton className="h-2.5 w-full rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 3. ESTADO EMPTY */}
      {!loading && !error && linhasProgresso.length === 0 && (
        <Card className="glass-card border-dashed border-border/70 shadow-subtle">
          <CardContent className="p-10 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Target className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h4 className="font-semibold text-base text-foreground">
                Nenhuma meta cadastrada para este período
              </h4>
              <p className="text-xs text-muted-foreground">
                Defina metas de faturamento por vendedor e segmento para {nomeMesConsulta} de{' '}
                {selectedAno} e acompanhe o atingimento em tempo real.
              </p>
            </div>
            <Button
              onClick={handleOpenNovaMeta}
              size="sm"
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
            >
              <Plus className="w-4 h-4" /> Nova Meta
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 4. ESTADO SUCCESS / LISTAGEM COM BARRAS DE PROGRESSO */}
      {!loading && !error && linhasProgresso.length > 0 && (
        <Card className="glass-card border-border/40 shadow-subtle overflow-hidden">
          <CardHeader className="p-4 pb-3 border-b border-border/30 bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <span>
                    Progresso Comercial · {nomeMesConsulta} de {selectedAno}
                  </span>
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {linhasProgresso.length} {linhasProgresso.length === 1 ? 'meta' : 'metas'}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Verde ≥ 100% · Amarelo 70% a 99% · Vermelho &lt; 70%
                </CardDescription>
              </div>

              {/* Totalizadores resumidos da seção */}
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Meta Total: </span>
                  <strong className="font-mono text-foreground">
                    {formatMoedaBR(linhasProgresso.reduce((acc, l) => acc + l.valorMeta, 0))}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Realizado: </span>
                  <strong className="font-mono text-primary">
                    {formatMoedaBR(linhasProgresso.reduce((acc, l) => acc + l.valorRealizado, 0))}
                  </strong>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-3 sm:p-4 divide-y divide-border/30">
            {linhasProgresso.map((linha) => {
              const { badgeClass, barClass, textClass } = getCorStatus(linha.percentual)
              const clampedPercent = Math.min(Math.max(linha.percentual, 0), 100)

              return (
                <div
                  key={linha.meta.id}
                  className="py-3.5 first:pt-1 last:pb-1 space-y-2.5 transition-colors hover:bg-muted/10 rounded-md px-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    {/* Vendedor e Segmento */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                        <User className="w-3.5 h-3.5 text-primary" />
                        <span>{linha.vendedor}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] tracking-wide uppercase font-semibold px-2 py-0 border-border/70 bg-card/60"
                      >
                        <Layers className="w-3 h-3 mr-1 text-muted-foreground" />
                        {linha.segmento}
                      </Badge>
                    </div>

                    {/* Valores: Realizado vs Meta + Percentual + Ações */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                      <div className="text-right flex items-baseline sm:block gap-2">
                        <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                          <span>Realizado:</span>
                          <span className="font-mono font-semibold text-foreground">
                            {formatMoedaBR(linha.valorRealizado)}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center justify-end gap-1">
                          <span>Meta:</span>
                          <span className="font-mono">{formatMoedaBR(linha.valorMeta)}</span>
                        </div>
                      </div>

                      {/* Badge de Percentual */}
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs font-mono font-bold px-2.5 py-0.5 border shadow-xs',
                          badgeClass,
                        )}
                      >
                        {linha.percentual.toFixed(1).replace('.', ',')}%
                      </Badge>

                      {/* Botões de Ação: Editar e Excluir */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditar(linha)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Editar meta"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setMetaToDelete(linha.meta)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Excluir meta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Barra de Progresso Horizontal */}
                  <div className="space-y-1">
                    <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden relative">
                      <div
                        className={cn('h-full transition-all duration-500 rounded-full', barClass)}
                        style={{ width: `${clampedPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground px-0.5">
                      <span>0%</span>
                      <span className={cn('font-semibold font-mono', textClass)}>
                        {linha.percentual >= 100
                          ? `Meta Atingida (${linha.percentual.toFixed(0)}%)`
                          : `Faltam ${formatMoedaBR(Math.max(0, linha.valorMeta - linha.valorRealizado))}`}
                      </span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* MODAL: Nova / Editar Meta */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <span>{editingMeta ? 'Editar Meta' : 'Nova Meta'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Defina a meta de faturamento por vendedor e segmento para o período indicado.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarMeta} className="space-y-4 py-2">
            {/* Campo Vendedor */}
            <div className="space-y-1.5">
              <Label
                htmlFor="form-vendedor"
                className="text-xs font-semibold flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5 text-primary" />
                Vendedor <span className="text-destructive">*</span>
              </Label>
              <Select value={formVendedor} onValueChange={(val) => setFormVendedor(val)}>
                <SelectTrigger id="form-vendedor" className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o vendedor" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {vendedoresDisponiveis.map((v) => (
                    <SelectItem key={v} value={v} className="text-xs">
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.vendedor && (
                <p className="text-[11px] text-destructive">{formErrors.vendedor}</p>
              )}
            </div>

            {/* Campo Segmento */}
            <div className="space-y-1.5">
              <Label
                htmlFor="form-segmento"
                className="text-xs font-semibold flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-primary" />
                Segmento <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formSegmento}
                onValueChange={(val) => setFormSegmento(val as SegmentoMeta)}
              >
                <SelectTrigger id="form-segmento" className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o segmento" />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTOS_METAS.map((seg) => (
                    <SelectItem key={seg} value={seg} className="text-xs">
                      {seg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.segmento && (
                <p className="text-[11px] text-destructive">{formErrors.segmento}</p>
              )}
            </div>

            {/* Período: Mês e Ano */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="form-mes"
                  className="text-xs font-semibold flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  Mês <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={String(formMes)}
                  onValueChange={(val) => setFormMes(parseInt(val, 10))}
                >
                  <SelectTrigger id="form-mes" className="h-9 text-xs">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES_PT.map((m) => (
                      <SelectItem key={m.valor} value={String(m.valor)} className="text-xs">
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.mes && <p className="text-[11px] text-destructive">{formErrors.mes}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="form-ano" className="text-xs font-semibold">
                  Ano <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="form-ano"
                  type="number"
                  min={2000}
                  max={2100}
                  value={formAno}
                  onChange={(e) => setFormAno(parseInt(e.target.value, 10) || selectedAno)}
                  className="h-9 text-xs"
                />
                {formErrors.ano && <p className="text-[11px] text-destructive">{formErrors.ano}</p>}
              </div>
            </div>

            {/* Valor da Meta */}
            <div className="space-y-1.5">
              <Label
                htmlFor="form-valor"
                className="text-xs font-semibold flex items-center gap-1.5"
              >
                <DollarSign className="w-3.5 h-3.5 text-primary" />
                Valor da Meta (R$) <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                  R$
                </span>
                <Input
                  id="form-valor"
                  type="text"
                  placeholder="0,00"
                  value={formValorMetaStr}
                  onChange={(e) => setFormValorMetaStr(e.target.value)}
                  className="h-9 pl-9 text-xs font-mono"
                />
              </div>
              {formErrors.valor_meta && (
                <p className="text-[11px] text-destructive">{formErrors.valor_meta}</p>
              )}
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
              >
                {saving && <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {editingMeta ? 'Salvar Alterações' : 'Criar Meta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG: Confirmação de Exclusão */}
      <AlertDialog open={!!metaToDelete} onOpenChange={(open) => !open && setMetaToDelete(null)}>
        <AlertDialogContent className="sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <span>Confirmar Exclusão</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Tem certeza que deseja excluir a meta de{' '}
              <strong>{metaToDelete?.vendedor || metaToDelete?.vendedor_nome}</strong> no segmento{' '}
              <strong>{metaToDelete?.segmento || metaToDelete?.especie}</strong> para o período{' '}
              <strong>
                {metaToDelete?.mes
                  ? `${MESES_PT.find((m) => m.valor === metaToDelete?.mes)?.nome} de ${metaToDelete?.ano}`
                  : metaToDelete?.periodo}
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={deleting} className="text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExcluir}
              disabled={deleting}
              className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Excluir Meta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
