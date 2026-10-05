import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { useGlobalData } from '@/store/GlobalDataProvider'
import pb from '@/lib/pocketbase/client'
import {
  FileText,
  PlusCircle,
  AlertCircle,
  RotateCw,
  Sparkles,
  BarChart3,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react'
import {
  type RelatorioVendasFiltros,
  type SecaoConteudoId,
  type FormatoRelatorio,
  type RelatorioVendasCalculado,
  type RelatorioGeradoRecord,
  buildRelatorioVendas,
  salvarRelatorioGerado,
  listarHistoricoRelatorios,
  exportarRelatorioVendasPDF,
  exportarRelatorioVendasExcel,
  getDatasPorPeriodoPreset,
} from '@/services/relatorio-vendas-service'
import { GerarRelatorioModal } from '@/components/GerarRelatorioModal'
import { RelatorioVendasVisualizacao } from '@/components/RelatorioVendasVisualizacao'
import { RelatoriosHistoricoSection } from '@/components/RelatoriosHistoricoSection'

export default function RelatorioVendas() {
  const { toast } = useToast()
  const { factories, gestao_tecnica, faturamento } = useGlobalData()

  // Estados principais da página: LOADING, EMPTY, ERROR, SUCCESS
  const [modalOpen, setModalOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [reportState, setReportState] = useState<'empty' | 'loading' | 'error' | 'success'>('empty')
  const [relatorioCalculado, setRelatorioCalculado] = useState<RelatorioVendasCalculado | null>(
    null,
  )
  const [historico, setHistorico] = useState<RelatorioGeradoRecord[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)

  // Guardar últimos parâmetros para permitir "Tentar novamente" em caso de erro
  const [lastParams, setLastParams] = useState<{
    filtros: RelatorioVendasFiltros
    secoes: SecaoConteudoId[]
    formato: FormatoRelatorio
  } | null>(null)

  // Lista de vendedores formatada e normalizada
  const vendedoresList = useMemo(() => {
    const list: { id: string; nome: string }[] = []
    const setNomes = new Set<string>()

    // Da equipe de gestao_tecnica
    for (const g of gestao_tecnica || []) {
      const nome = (g.nome || '').trim()
      if (nome && !setNomes.has(nome.toLowerCase())) {
        setNomes.add(nome.toLowerCase())
        list.push({ id: g.id || nome, nome })
      }
    }

    // Das factories
    for (const f of factories || []) {
      const nome = (f.vendedor_name || '').trim()
      if (nome && !setNomes.has(nome.toLowerCase())) {
        setNomes.add(nome.toLowerCase())
        list.push({ id: nome, nome })
      }
    }

    // Do faturamento
    for (const fat of faturamento || []) {
      const nome = (fat.vendedor || '').trim()
      if (nome && !setNomes.has(nome.toLowerCase())) {
        setNomes.add(nome.toLowerCase())
        list.push({ id: nome, nome })
      }
    }

    return list.sort((a, b) => a.nome.localeCompare(b.nome))
  }, [gestao_tecnica, factories, faturamento])

  // Lista de UFs
  const estadosList = useMemo(() => {
    const ufs = new Set<string>()
    for (const f of factories || []) {
      if (f.state && f.state.trim().length === 2) {
        ufs.add(f.state.trim().toUpperCase())
      }
    }
    const defaultUfs = ['SP', 'PR', 'SC', 'RS', 'MG', 'MS', 'MT', 'GO', 'BA', 'PE', 'CE', 'PA']
    defaultUfs.forEach((u) => ufs.add(u))
    return Array.from(ufs).sort()
  }, [factories])

  // Carrega histórico de relatórios
  const carregarHistorico = useCallback(async () => {
    try {
      setLoadingHistorico(true)
      const list = await listarHistoricoRelatorios(20)
      setHistorico(list)
    } catch (err) {
      console.warn('[RelatorioVendas] Falha ao carregar historico:', err)
    } finally {
      setLoadingHistorico(false)
    }
  }, [])

  // Inicialização
  useEffect(() => {
    carregarHistorico()
  }, [carregarHistorico])

  // Assinatura Realtime em relatorios_gerados
  useRealtime(
    'relatorios_gerados',
    useCallback(() => {
      // Atualiza lista em tempo real
      carregarHistorico()
    }, [carregarHistorico]),
  )

  // Execução do Gerador de Relatório
  const handleExecutarGeracao = async (
    filtros: RelatorioVendasFiltros,
    secoes: SecaoConteudoId[],
    formato: FormatoRelatorio,
  ) => {
    setLastParams({ filtros, secoes, formato })
    setReportState('loading')
    setIsGenerating(true)

    try {
      // 1. Gera cálculo dos dados a partir das tabelas vivas
      const calculado = await buildRelatorioVendas(filtros, secoes, formato)

      // 2. Persiste na coleção relatorios_gerados (RLS por usuário)
      try {
        await salvarRelatorioGerado(calculado)
      } catch (saveErr) {
        console.warn('[RelatorioVendas] Erro ao salvar historico:', saveErr)
      }

      setRelatorioCalculado(calculado)
      setReportState('success')

      // 3. Se formato for PDF ou Excel, dispara download automaticamente
      if (formato === 'pdf') {
        try {
          exportarRelatorioVendasPDF(calculado)
        } catch (pdfErr) {
          console.error('[RelatorioVendas] Erro export PDF:', pdfErr)
        }
      } else if (formato === 'excel') {
        try {
          exportarRelatorioVendasExcel(calculado)
        } catch (xlsxErr) {
          console.error('[RelatorioVendas] Erro export Excel:', xlsxErr)
        }
      }

      // Toast em português conforme especificação
      toast({
        title: 'Sucesso',
        description: 'Relatório gerado com sucesso!',
      })

      // Recarrega o histórico
      carregarHistorico()
    } catch (err) {
      console.error('[RelatorioVendas] Falha ao gerar relatório:', err)
      setReportState('error')
    } finally {
      setIsGenerating(false)
    }
  }

  // Ação: Visualizar relatório do histórico
  const handleVisualizarHistorico = async (item: RelatorioGeradoRecord) => {
    try {
      setReportState('loading')
      setIsGenerating(true)

      let filtros: RelatorioVendasFiltros
      try {
        filtros = JSON.parse(item.filtros)
      } catch {
        const datas = getDatasPorPeriodoPreset('ultimos_30_dias')
        filtros = {
          periodoPreset: 'ultimos_30_dias',
          dataInicio: datas.dataInicio,
          dataFim: datas.dataFim,
          segmentos: ['AVES', 'PETS', 'RUMINANTES', 'SUINOS'],
          vendedor: 'all',
          estado: 'all',
        }
      }

      let secoes: SecaoConteudoId[] = [
        'resumo_executivo',
        'vendas_por_cliente',
        'vendas_por_segmento',
        'vendas_por_estado',
        'evolucao_mensal',
        'top_produtos',
      ]
      try {
        const parsedConteudo = JSON.parse(item.conteudo)
        if (Array.isArray(parsedConteudo.secoes) && parsedConteudo.secoes.length > 0) {
          secoes = parsedConteudo.secoes
        }
      } catch {
        // default
      }

      const formato = (item.formato as FormatoRelatorio) || 'tela'

      // Sempre lê dados vivos mais recentes para o período e filtros
      const recalculado = await buildRelatorioVendas(filtros, secoes, formato)
      setRelatorioCalculado(recalculado)
      setReportState('success')

      toast({
        title: 'Relatório carregado',
        description: `Visualizando relatório do período ${item.periodo}`,
      })
    } catch (err) {
      console.error('[RelatorioVendas] Erro ao visualizar historico:', err)
      setReportState('error')
    } finally {
      setIsGenerating(false)
    }
  }

  // Ação: Baixar novamente do histórico
  const handleBaixarNovamenteHistorico = async (item: RelatorioGeradoRecord) => {
    try {
      let filtros: RelatorioVendasFiltros
      try {
        filtros = JSON.parse(item.filtros)
      } catch {
        const datas = getDatasPorPeriodoPreset('ultimos_30_dias')
        filtros = {
          periodoPreset: 'ultimos_30_dias',
          dataInicio: datas.dataInicio,
          dataFim: datas.dataFim,
          segmentos: ['AVES', 'PETS', 'RUMINANTES', 'SUINOS'],
          vendedor: 'all',
          estado: 'all',
        }
      }

      let secoes: SecaoConteudoId[] = [
        'resumo_executivo',
        'vendas_por_cliente',
        'vendas_por_segmento',
        'vendas_por_estado',
        'evolucao_mensal',
        'top_produtos',
      ]
      try {
        const parsedConteudo = JSON.parse(item.conteudo)
        if (Array.isArray(parsedConteudo.secoes) && parsedConteudo.secoes.length > 0) {
          secoes = parsedConteudo.secoes
        }
      } catch {
        // default
      }

      const formato = (item.formato as FormatoRelatorio) || 'tela'
      const rep = await buildRelatorioVendas(filtros, secoes, formato)

      if (formato === 'excel') {
        exportarRelatorioVendasExcel(rep)
      } else {
        exportarRelatorioVendasPDF(rep)
      }

      toast({
        title: 'Download iniciado',
        description: 'Seu arquivo está sendo baixado.',
      })
    } catch (err) {
      console.error('[RelatorioVendas] Erro ao baixar novamente:', err)
      toast({
        title: 'Erro',
        description: 'Não foi possível baixar o relatório. Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header com título "Relatorio de Vendas" e botão primário "Gerar Relatorio" */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-primary" /> Relatório de Vendas
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Personalize filtros, períodos e seções comerciais para emissão imediata em tela, PDF ou
            Excel.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setModalOpen(true)}
            disabled={isGenerating}
            size="default"
            className="gap-2 font-semibold shadow-sm text-xs sm:text-sm h-10 px-4"
          >
            <PlusCircle className="w-4 h-4" /> Gerar Relatório
          </Button>
        </div>
      </div>

      {/* ÁREA PRINCIPAL COM OS 4 ESTADOS MANDATÓRIOS: LOADING, EMPTY, ERROR, SUCCESS */}

      {/* ESTADO 1: LOADING */}
      {reportState === 'loading' && (
        <div className="space-y-6">
          <Card className="glass-card shadow-card p-6 flex flex-col items-center justify-center text-center space-y-3">
            <RotateCw className="w-8 h-8 text-primary animate-spin" />
            <h3 className="text-base font-bold text-foreground">Gerando seu relatório...</h3>
            <p className="text-xs text-muted-foreground max-w-md">
              Consolidando lançamentos de faturamento, vendas históricas, dados de clientes e
              calculando métricas.
            </p>
          </Card>

          {/* Skeleton para a área de relatório */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </div>

          <Card className="p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
        </div>
      )}

      {/* ESTADO 2: EMPTY */}
      {reportState === 'empty' && (
        <Card className="glass-card shadow-card border-dashed border-2 p-12 text-center">
          <CardContent className="flex flex-col items-center justify-center p-0 space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-xs">
              <FileText className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">Nenhum relatório gerado</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Clique em Gerar Relatório para começar.
              </p>
            </div>
            <Button
              onClick={() => setModalOpen(true)}
              size="default"
              className="gap-2 font-semibold text-xs sm:text-sm mt-2"
            >
              <PlusCircle className="w-4 h-4" /> Gerar Relatório
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ESTADO 3: ERROR */}
      {reportState === 'error' && (
        <Card className="glass-card shadow-card border-destructive/30 bg-destructive/5 p-8 text-center">
          <CardContent className="flex flex-col items-center justify-center p-0 space-y-3 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-destructive/15 flex items-center justify-center text-destructive">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">
                Não foi possível gerar o relatório. Tente novamente.
              </h3>
              <p className="text-xs text-muted-foreground">
                Houve uma falha ao consolidar os dados das tabelas de vendas.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  if (lastParams) {
                    handleExecutarGeracao(lastParams.filtros, lastParams.secoes, lastParams.formato)
                  } else {
                    setModalOpen(true)
                  }
                }}
                className="gap-1.5 text-xs font-semibold"
              >
                <RotateCw className="w-3.5 h-3.5" /> Tentar novamente
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(true)}
                className="text-xs"
              >
                Alterar parâmetros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ESTADO 4: SUCCESS */}
      {reportState === 'success' && relatorioCalculado && (
        <RelatorioVendasVisualizacao report={relatorioCalculado} />
      )}

      {/* SEÇÃO: Histórico de Relatórios (com Realtime) */}
      <div className="pt-4">
        <RelatoriosHistoricoSection
          historico={historico}
          loading={loadingHistorico}
          onVisualizar={handleVisualizarHistorico}
          onBaixarNovamente={handleBaixarNovamenteHistorico}
          onRecarregar={carregarHistorico}
        />
      </div>

      {/* MODAL DE PERSONALIZAÇÃO EM 4 ETAPAS */}
      <GerarRelatorioModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        vendedoresList={vendedoresList}
        estadosList={estadosList}
        onConfirmar={handleExecutarGeracao}
      />
    </div>
  )
}
