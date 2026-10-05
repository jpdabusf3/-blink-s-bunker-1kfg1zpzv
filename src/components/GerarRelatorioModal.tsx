import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  type RelatorioVendasFiltros,
  type PeriodoPreset,
  type SecaoConteudoId,
  type FormatoRelatorio,
  getDatasPorPeriodoPreset,
} from '@/services/relatorio-vendas-service'
import {
  Calendar,
  Filter,
  Layers,
  FileSpreadsheet,
  FileText,
  Monitor,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'

const SEGMENTOS_DISPONIVEIS = ['AVES', 'PETS', 'RUMINANTES', 'SUINOS']

const SECOES_DISPONIVEIS: { id: SecaoConteudoId; label: string; desc: string }[] = [
  {
    id: 'resumo_executivo',
    label: 'Resumo executivo',
    desc: 'Cards de total faturado, lançamentos, ticket médio e clientes ativos',
  },
  {
    id: 'vendas_por_cliente',
    label: 'Vendas por cliente',
    desc: 'Tabela classificada de clientes, valores, participação e notas',
  },
  {
    id: 'vendas_por_segmento',
    label: 'Vendas por segmento',
    desc: 'Consolidação de AVES, PETS, RUMINANTES e SUINOS',
  },
  {
    id: 'vendas_por_estado',
    label: 'Vendas por estado',
    desc: 'Distribuição regional de vendas por Unidade da Federação (UF)',
  },
  {
    id: 'evolucao_mensal',
    label: 'Evolução mensal',
    desc: 'Histórico cronológico com valores, ticket médio e variações',
  },
  {
    id: 'top_produtos',
    label: 'Top produtos',
    desc: 'Ranking dos produtos e famílias com maior faturamento',
  },
]

const STORAGE_KEY_FILTROS = 'blink_relatorio_vendas_filtros_v1'
const STORAGE_KEY_SECOES = 'blink_relatorio_vendas_secoes_v1'
const STORAGE_KEY_FORMATO = 'blink_relatorio_vendas_formato_v1'

interface GerarRelatorioModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendedoresList: { id: string; nome: string }[]
  estadosList: string[]
  onConfirmar: (
    filtros: RelatorioVendasFiltros,
    secoes: SecaoConteudoId[],
    formato: FormatoRelatorio,
  ) => void
}

export function GerarRelatorioModal({
  open,
  onOpenChange,
  vendedoresList,
  estadosList,
  onConfirmar,
}: GerarRelatorioModalProps) {
  const isMobile = useIsMobile()
  const [step, setStep] = useState<number>(1)
  const [stepError, setStepError] = useState<string | null>(null)

  // Step 1: Período
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>('ultimos_30_dias')
  const [dataInicio, setDataInicio] = useState<string>('')
  const [dataFim, setDataFim] = useState<string>('')

  // Step 2: Filtros
  const [segmentos, setSegmentos] = useState<string[]>(['AVES', 'PETS', 'RUMINANTES', 'SUINOS'])
  const [vendedor, setVendedor] = useState<string>('all')
  const [estado, setEstado] = useState<string>('all')

  // Step 3: Conteúdo
  const [secoes, setSecoes] = useState<SecaoConteudoId[]>([
    'resumo_executivo',
    'vendas_por_cliente',
    'vendas_por_segmento',
    'vendas_por_estado',
    'evolucao_mensal',
    'top_produtos',
  ])

  // Step 4: Formato
  const [formato, setFormato] = useState<FormatoRelatorio>('tela')

  // Carrega preferências memorizadas
  useEffect(() => {
    try {
      const savedFiltros = localStorage.getItem(STORAGE_KEY_FILTROS)
      if (savedFiltros) {
        const parsed = JSON.parse(savedFiltros)
        if (parsed.periodoPreset) setPeriodoPreset(parsed.periodoPreset)
        if (parsed.dataInicio) setDataInicio(parsed.dataInicio)
        if (parsed.dataFim) setDataFim(parsed.dataFim)
        if (Array.isArray(parsed.segmentos)) setSegmentos(parsed.segmentos)
        if (parsed.vendedor) setVendedor(parsed.vendedor)
        if (parsed.estado) setEstado(parsed.estado)
      } else {
        const datas = getDatasPorPeriodoPreset('ultimos_30_dias')
        setDataInicio(datas.dataInicio)
        setDataFim(datas.dataFim)
      }

      const savedSecoes = localStorage.getItem(STORAGE_KEY_SECOES)
      if (savedSecoes) {
        const parsed = JSON.parse(savedSecoes)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSecoes(parsed)
        }
      }

      const savedFormato = localStorage.getItem(STORAGE_KEY_FORMATO)
      if (savedFormato && ['tela', 'pdf', 'excel'].includes(savedFormato)) {
        setFormato(savedFormato as FormatoRelatorio)
      }
    } catch {
      // noop
    }
  }, [])

  // Atualiza datas quando o preset de período muda (exceto se for personalizado)
  const handlePeriodoPresetChange = (preset: PeriodoPreset) => {
    setPeriodoPreset(preset)
    setStepError(null)
    if (preset !== 'personalizado') {
      const datas = getDatasPorPeriodoPreset(preset)
      setDataInicio(datas.dataInicio)
      setDataFim(datas.dataFim)
    }
  }

  // Alterna segmento multi-select
  const toggleSegmento = (seg: string) => {
    setSegmentos((prev) => (prev.includes(seg) ? prev.filter((s) => s !== seg) : [...prev, seg]))
  }

  // Alterna seção
  const toggleSecao = (secId: SecaoConteudoId) => {
    setStepError(null)
    setSecoes((prev) => (prev.includes(secId) ? prev.filter((s) => s !== secId) : [...prev, secId]))
  }

  // Validação por etapa
  const validarPassoAtual = (currentStep: number): boolean => {
    setStepError(null)

    if (currentStep === 1) {
      if (!dataInicio || !dataFim) {
        setStepError('Informe a data de início e a data de fim do período.')
        return false
      }
      if (dataInicio > dataFim) {
        setStepError('A data de início não pode ser posterior à data de fim.')
        return false
      }
      return true
    }

    if (currentStep === 2) {
      // Filtros são todos opcionais
      return true
    }

    if (currentStep === 3) {
      if (secoes.length === 0) {
        setStepError('Selecione pelo menos uma seção para compor o relatório.')
        return false
      }
      return true
    }

    if (currentStep === 4) {
      if (!formato) {
        setStepError('Selecione o formato de saída do relatório.')
        return false
      }
      return true
    }

    return true
  }

  const handleProximo = () => {
    if (!validarPassoAtual(step)) return
    setStep((prev) => Math.min(prev + 1, 4))
  }

  const handleAnterior = () => {
    setStepError(null)
    setStep((prev) => Math.max(prev - 1, 1))
  }

  const handleConfirmarFinal = () => {
    if (!validarPassoAtual(4)) return

    const finalFiltros: RelatorioVendasFiltros = {
      periodoPreset,
      dataInicio,
      dataFim,
      segmentos: segmentos.length > 0 ? segmentos : ['AVES', 'PETS', 'RUMINANTES', 'SUINOS'],
      vendedor,
      estado,
    }

    // Memoriza as últimas escolhas utilizadas
    try {
      localStorage.setItem(STORAGE_KEY_FILTROS, JSON.stringify(finalFiltros))
      localStorage.setItem(STORAGE_KEY_SECOES, JSON.stringify(secoes))
      localStorage.setItem(STORAGE_KEY_FORMATO, formato)
    } catch {
      // ignore
    }

    onConfirmar(finalFiltros, secoes, formato)
    onOpenChange(false)
  }

  // Reseta step ao reabrir
  useEffect(() => {
    if (open) {
      setStep(1)
      setStepError(null)
    }
  }, [open])

  // Corpo do Modal/Sheet
  const modalBody = (
    <div className="flex flex-col h-full space-y-5">
      {/* Indicador de passos */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3 pt-1">
        {[
          { num: 1, label: 'Período', icon: Calendar },
          { num: 2, label: 'Filtros', icon: Filter },
          { num: 3, label: 'Conteúdo', icon: Layers },
          { num: 4, label: 'Formato', icon: Monitor },
        ].map((s) => {
          const isDone = step > s.num
          const isCurrent = step === s.num
          return (
            <div key={s.num} className="flex flex-col items-center flex-1 text-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20'
                    : isDone
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : s.num}
              </div>
              <span
                className={`text-[11px] mt-1 hidden sm:inline ${
                  isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'
                }`}
              >
                {s.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Alerta de erro de validação */}
      {stepError && (
        <div className="flex items-center gap-2 p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{stepError}</span>
        </div>
      )}

      {/* Conteúdo de cada Step */}
      <div className="flex-1 overflow-y-auto pr-1">
        {/* STEP 1: Período */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Selecione o período de análise
              </Label>
              <RadioGroup
                value={periodoPreset}
                onValueChange={(v) => handlePeriodoPresetChange(v as PeriodoPreset)}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2"
              >
                {[
                  {
                    id: 'ultimos_30_dias',
                    label: 'Últimos 30 dias',
                    desc: 'Últimos 30 dias corridos',
                  },
                  { id: 'mes_atual', label: 'Mês atual', desc: 'Do dia 1º até hoje' },
                  { id: 'trimestre', label: 'Trimestre', desc: 'Trimestre corrente' },
                  { id: 'ano_atual', label: 'Ano atual', desc: 'Ano de 2026 acumulado' },
                  {
                    id: 'personalizado',
                    label: 'Personalizado',
                    desc: 'Escolha data início e fim',
                  },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      periodoPreset === item.id
                        ? 'border-primary bg-primary/5 shadow-xs'
                        : 'border-border/60 hover:bg-muted/40'
                    }`}
                  >
                    <RadioGroupItem value={item.id} id={`periodo-${item.id}`} className="mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium text-foreground block">
                        {item.label}
                      </span>
                      <span className="text-xs text-muted-foreground block">{item.desc}</span>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {/* Inputs de Data (obrigatórios se personalizado ou exibidos para ajuste fino) */}
            <div className="pt-2 border-t border-border/40">
              <Label className="text-xs font-semibold text-foreground">Intervalo de Datas</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Data Início:</span>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => {
                      setDataInicio(e.target.value)
                      setPeriodoPreset('personalizado')
                      setStepError(null)
                    }}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Data Fim:</span>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => {
                      setDataFim(e.target.value)
                      setPeriodoPreset('personalizado')
                      setStepError(null)
                    }}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Filtros */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            {/* Multi-select de Segmentos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Segmento comercial
                </Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSegmentos(['AVES', 'PETS', 'RUMINANTES', 'SUINOS'])}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Marcar todos
                  </button>
                  <span className="text-muted-foreground text-xs">•</span>
                  <button
                    type="button"
                    onClick={() => setSegmentos([])}
                    className="text-[11px] text-muted-foreground hover:underline"
                  >
                    Desmarcar todos
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SEGMENTOS_DISPONIVEIS.map((seg) => {
                  const checked = segmentos.includes(seg)
                  return (
                    <label
                      key={seg}
                      className={`flex items-center gap-2.5 p-2.5 rounded-md border cursor-pointer transition-all ${
                        checked
                          ? 'border-primary bg-primary/5 font-medium text-foreground'
                          : 'border-border/60 text-muted-foreground hover:bg-muted/30'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleSegmento(seg)}
                        id={`seg-${seg}`}
                      />
                      <span className="text-xs">{seg}</span>
                    </label>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Se nenhum segmento for marcado, todos os segmentos serão incluídos.
              </p>
            </div>

            {/* Vendedor */}
            <div className="space-y-1.5 pt-2 border-t border-border/40">
              <Label className="text-xs font-semibold text-foreground">Vendedor (Opcional)</Label>
              <Select value={vendedor} onValueChange={setVendedor}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Todos os vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os vendedores</SelectItem>
                  {vendedoresList.map((v) => (
                    <SelectItem key={v.id} value={v.nome}>
                      {v.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estado */}
            <div className="space-y-1.5 pt-2 border-t border-border/40">
              <Label className="text-xs font-semibold text-foreground">
                Estado (UF) (Opcional)
              </Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Todos os estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estados</SelectItem>
                  {estadosList.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* STEP 3: Conteúdo */}
        {step === 3 && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center justify-between pb-1">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Seções do Relatório
              </Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSecoes(SECOES_DISPONIVEIS.map((s) => s.id))}
                  className="text-[11px] text-primary hover:underline"
                >
                  Marcar todas
                </button>
                <span className="text-muted-foreground text-xs">•</span>
                <button
                  type="button"
                  onClick={() => setSecoes([])}
                  className="text-[11px] text-muted-foreground hover:underline"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {SECOES_DISPONIVEIS.map((sec) => {
                const checked = secoes.includes(sec.id)
                return (
                  <label
                    key={sec.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      checked
                        ? 'border-primary bg-primary/5 shadow-xs'
                        : 'border-border/60 hover:bg-muted/30'
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleSecao(sec.id)}
                      id={`sec-${sec.id}`}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-foreground block">
                        {sec.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground block">{sec.desc}</span>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* STEP 4: Formato */}
        {step === 4 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Formato de Saída
              </Label>
              <RadioGroup
                value={formato}
                onValueChange={(v) => {
                  setFormato(v as FormatoRelatorio)
                  setStepError(null)
                }}
                className="grid grid-cols-1 gap-2.5 mt-2"
              >
                {[
                  {
                    id: 'tela',
                    label: 'Visualizar na tela',
                    desc: 'Exibe o relatório interativo completo na tela com cards e tabelas responsivas',
                    icon: Monitor,
                  },
                  {
                    id: 'pdf',
                    label: 'Baixar PDF',
                    desc: 'Gera e baixa o arquivo relatorio-vendas-YYYY-MM-DD.pdf no modelo corporativo executivo',
                    icon: FileText,
                  },
                  {
                    id: 'excel',
                    label: 'Baixar Excel',
                    desc: 'Gera e baixa a planilha relatorio-vendas-YYYY-MM-DD.xlsx com abas das seções selecionadas',
                    icon: FileSpreadsheet,
                  },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3.5 p-3.5 rounded-lg border cursor-pointer transition-all ${
                      formato === item.id
                        ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30'
                        : 'border-border/60 hover:bg-muted/30'
                    }`}
                  >
                    <RadioGroupItem value={item.id} id={`formato-${item.id}`} className="mt-1" />
                    <div className="w-8 h-8 rounded-md bg-muted/60 flex items-center justify-center shrink-0 text-primary">
                      <item.icon className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-sm font-semibold text-foreground block">
                        {item.label}
                      </span>
                      <span className="text-xs text-muted-foreground block">{item.desc}</span>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>
          </div>
        )}
      </div>

      {/* Botões de Navegação */}
      <div className="flex items-center justify-between border-t border-border/50 pt-3 mt-auto">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAnterior}
          disabled={step === 1}
          className="gap-1.5 text-xs h-9"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Anterior
        </Button>

        {step < 4 ? (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleProximo}
            className="gap-1.5 text-xs h-9 font-semibold"
          >
            Próximo <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleConfirmarFinal}
            className="gap-1.5 text-xs h-9 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar
          </Button>
        )}
      </div>
    </div>
  )

  // Em mobile, renderiza como Sheet em tela cheia (full-screen sheet)
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[95vh] rounded-t-xl p-5 flex flex-col">
          <SheetHeader className="text-left pb-2">
            <SheetTitle className="text-lg font-bold">Personalizar Relatório de Vendas</SheetTitle>
            <SheetDescription className="text-xs">
              Etapa {step} de 4 · Configure período, filtros, conteúdo e formato
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">{modalBody}</div>
        </SheetContent>
      </Sheet>
    )
  }

  // Em desktop, renderiza como Dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-xl font-bold">Personalizar Relatório de Vendas</DialogTitle>
          <DialogDescription className="text-xs">
            Etapa {step} de 4 · Configure o período, filtros, conteúdo e formato desejados
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">{modalBody}</div>
      </DialogContent>
    </Dialog>
  )
}
