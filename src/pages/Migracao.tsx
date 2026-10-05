import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Database,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Download,
  Trash2,
  FileSpreadsheet,
  Layers,
  ShieldCheck,
  Info,
  Clock,
  Sparkles,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import {
  detectLocalStorageData,
  runDataMigration,
  clearMigratedLocalStorageKeys,
  generateFailuresCsv,
  type LocalStorageKeyInfo,
  type MigrationProgress,
  type MigrationSummaryReport,
} from '@/services/data-migration'

type MigrationState = 'IDLE' | 'LOADING' | 'EMPTY' | 'ERROR' | 'SUCCESS'

export default function MigracaoPage() {
  const [detectedKeys, setDetectedKeys] = useState<LocalStorageKeyInfo[]>([])
  const [state, setState] = useState<MigrationState>('IDLE')
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [finishDialogOpen, setFinishDialogOpen] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  const [progress, setProgress] = useState<MigrationProgress>({
    currentTableIndex: 0,
    totalTables: 0,
    currentTableLabel: '',
    currentItemIndex: 0,
    totalItemsInTable: 0,
    overallPercent: 0,
    statusText: '',
  })

  const [summaryReport, setSummaryReport] = useState<MigrationSummaryReport | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastStoppedIndex, setLastStoppedIndex] = useState<number>(0)
  const [hasFinished, setHasFinished] = useState<boolean>(false)
  const [hasClearedLocal, setHasClearedLocal] = useState<boolean>(false)

  // Escanear localStorage no carregamento
  const scanStorage = useCallback(() => {
    const keys = detectLocalStorageData()
    setDetectedKeys(keys)
    if (keys.length === 0) {
      setState('EMPTY')
    } else if (state !== 'SUCCESS' && state !== 'LOADING') {
      setState('IDLE')
    }
  }, [state])

  useEffect(() => {
    scanStorage()
  }, [scanStorage])

  const totalRecordsFound = useMemo(() => {
    return detectedKeys.reduce((acc, curr) => acc + curr.count, 0)
  }, [detectedKeys])

  // Iniciar migração
  const handleStartMigration = async (resumeIndex = 0) => {
    setConfirmDialogOpen(false)
    setState('LOADING')
    setErrorMessage(null)

    try {
      const report = await runDataMigration(detectedKeys, {
        resumeFromTableIndex: resumeIndex,
        onProgress: (p) => {
          setProgress(p)
          setLastStoppedIndex(p.currentTableIndex)
        },
      })

      setSummaryReport(report)
      setState('SUCCESS')
      toast.success('Migração concluída com sucesso!')
    } catch (err: unknown) {
      setState('ERROR')
      const msg = err instanceof Error ? err.message : 'Falha inesperada durante a migração.'
      setErrorMessage(`Ocorreu um erro ao migrar os dados: ${msg}`)
      toast.error('Erro na migração de dados.')
    }
  }

  // Baixar relatório CSV de falhas / conflitos / incompletos
  const handleDownloadCsv = () => {
    if (!summaryReport) return
    const csvContent = generateFailuresCsv(summaryReport)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `relatorio-migracao-blink-${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.info('Download do relatório CSV iniciado.')
  }

  // Concluir migração
  const handleConfirmFinish = () => {
    setFinishDialogOpen(false)
    setHasFinished(true)
    toast.success('Migração finalizada com sucesso! Todos os dados estão seguros no banco.')
  }

  // Limpeza dos dados locais (opcional e apenas após concluir)
  const handleClearLocalStorage = () => {
    setClearDialogOpen(false)
    const keysToRemove = detectedKeys.map((k) => k.key)
    const res = clearMigratedLocalStorageKeys(keysToRemove)
    setHasClearedLocal(true)
    toast.success(`${res.cleared.length} chave(s) de dados locais foram removidas com sucesso.`)
    scanStorage()
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary p-2.5 rounded-xl border border-primary/20">
            <Database className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Migração de dados
              </h1>
              <Badge variant="outline" className="text-xs bg-muted/50 border-primary/20">
                localStorage → PocketBase
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Transfira todos os registros do armazenamento local do navegador para o banco de dados
              central da Blink com segurança e idempotência.
            </p>
          </div>
        </div>

        {state === 'IDLE' && detectedKeys.length > 0 && (
          <Button
            size="lg"
            className="gap-2 shadow-sm font-semibold"
            onClick={() => setConfirmDialogOpen(true)}
          >
            <Sparkles className="w-4 h-4" />
            Iniciar migração
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Cartão de aviso de segurança permanente */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3 text-sm text-foreground">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-primary">Segurança de backup garantida</p>
          <p className="text-muted-foreground leading-relaxed">
            Nenhum dado é excluído do seu navegador durante a transferência. O{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">localStorage</code>{' '}
            permanece como backup intacto até que você conclua com sucesso e opte por limpá-lo. Esta
            operação é totalmente <strong>idempotente</strong>: executá-la mais de uma vez não
            criará duplicatas.
          </p>
        </div>
      </div>

      {/* 1. ESTADO EMPTY */}
      {state === 'EMPTY' && (
        <Card className="shadow-subtle border-dashed border-2 py-12 text-center">
          <CardContent className="space-y-4">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                Nenhum dado local encontrado para migrar
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Não existem chaves ou registros antigos salvos no armazenamento local deste
                navegador. Todos os dados já estão sincronizados com o banco de dados PocketBase.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={scanStorage} className="gap-2">
              <RotateCw className="w-4 h-4" />
              Verificar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 2. ESTADO LOADING (Progresso detalhado) */}
      {state === 'LOADING' && (
        <Card className="shadow-subtle border-primary/30 bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <RotateCw className="w-5 h-5 animate-spin text-primary" />
                Migrando dados para o PocketBase...
              </CardTitle>
              <Badge variant="secondary" className="font-mono">
                {progress.overallPercent}%
              </Badge>
            </div>
            <CardDescription>{progress.statusText}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <div className="space-y-2">
              <Progress value={progress.overallPercent} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground font-mono">
                <span>
                  Tabela {progress.currentTableIndex + 1} de {progress.totalTables}:{' '}
                  <strong>{progress.currentTableLabel}</strong>
                </span>
                <span>
                  Registro {progress.currentItemIndex} de {progress.totalItemsInTable}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-muted/30 rounded-lg border border-border/40 text-xs">
                <span className="text-muted-foreground block mb-1">Tabelas processadas</span>
                <span className="text-base font-semibold text-foreground">
                  {progress.currentTableIndex} / {progress.totalTables}
                </span>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border border-border/40 text-xs">
                <span className="text-muted-foreground block mb-1">Mapeamento em execução</span>
                <span className="text-base font-semibold text-primary truncate block">
                  {progress.currentTableLabel || 'Iniciando...'}
                </span>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border border-border/40 text-xs">
                <span className="text-muted-foreground block mb-1">Regra de Vendedor</span>
                <span className="text-base font-semibold text-foreground">
                  Canônico (João Figueiredo)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. ESTADO ERROR com botão para retomar */}
      {state === 'ERROR' && (
        <Card className="border-destructive/40 shadow-subtle bg-destructive/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg text-destructive">
                  Falha na execução da migração
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {errorMessage || 'Ocorreu um problema ao conectar com o PocketBase.'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground leading-relaxed">
              Você pode retomar o processo a partir da tabela onde parou sem perder o progresso
              anterior. Nenhum dado local foi apagado.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="destructive"
                onClick={() => handleStartMigration(lastStoppedIndex)}
                className="gap-2"
              >
                <RotateCw className="w-4 h-4" />
                Tentar novamente (a partir da tabela {lastStoppedIndex + 1})
              </Button>
              <Button variant="outline" onClick={() => handleStartMigration(0)} className="gap-2">
                Reiniciar desde o início
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. ESTADO SUCCESS: Resumo e Relatório completo */}
      {state === 'SUCCESS' && summaryReport && (
        <div className="space-y-6">
          <Card className="border-green-500/30 bg-green-500/5 shadow-subtle">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-green-700 dark:text-green-300">
                      Migração concluída com sucesso
                    </CardTitle>
                    <CardDescription>
                      Todos os dados foram processados e gravados com segurança no banco de dados.
                    </CardDescription>
                  </div>
                </div>
                <Badge className="bg-green-600 text-white hover:bg-green-700">100% Concluído</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {/* Cards de Métricas Gerais */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
                <div className="bg-background/80 p-3 rounded-lg border border-border/50 text-center">
                  <span className="text-xs text-muted-foreground block">Encontrados</span>
                  <span className="text-xl font-bold text-foreground">
                    {summaryReport.totalFound}
                  </span>
                </div>
                <div className="bg-background/80 p-3 rounded-lg border border-green-500/30 text-center">
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium block">
                    Criados
                  </span>
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">
                    {summaryReport.totalImported}
                  </span>
                </div>
                <div className="bg-background/80 p-3 rounded-lg border border-blue-500/30 text-center">
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium block">
                    Atualizados
                  </span>
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {summaryReport.totalUpdated}
                  </span>
                </div>
                <div className="bg-background/80 p-3 rounded-lg border border-amber-500/30 text-center">
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium block">
                    Duplicatas ignoradas
                  </span>
                  <span className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    {summaryReport.totalSkippedDuplicates}
                  </span>
                </div>
                <div className="bg-background/80 p-3 rounded-lg border border-orange-500/30 text-center">
                  <span className="text-xs text-orange-600 dark:text-orange-400 font-medium block">
                    Incompletos
                  </span>
                  <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                    {summaryReport.totalIncomplete}
                  </span>
                </div>
                <div className="bg-background/80 p-3 rounded-lg border border-red-500/30 text-center">
                  <span className="text-xs text-red-600 dark:text-red-400 font-medium block">
                    Falhas/Conflitos
                  </span>
                  <span className="text-xl font-bold text-red-600 dark:text-red-400">
                    {summaryReport.totalFailed + summaryReport.totalConflicts}
                  </span>
                </div>
              </div>

              {/* Botões de Ação Final */}
              <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-5 border-t border-border/40">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadCsv}
                    className="gap-2 shadow-none"
                  >
                    <Download className="w-4 h-4" />
                    Baixar relatório de falhas e incompletos (CSV)
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  {!hasFinished ? (
                    <Button
                      size="default"
                      onClick={() => setFinishDialogOpen(true)}
                      className="gap-2 font-semibold bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Concluir migração
                    </Button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-500/40 gap-1.5 py-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Migração finalizada
                      </Badge>

                      {!hasClearedLocal ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setClearDialogOpen(true)}
                          className="gap-1.5"
                        >
                          <Trash2 className="w-4 h-4" />
                          Limpar dados locais
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Dados locais limpos com sucesso.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabela de Relatório Detalhado por Tabela */}
          <Card className="shadow-subtle">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-lg">Relatório discriminado por tabela</CardTitle>
              <CardDescription>
                Detalhamento dos registros processados por cada conjunto de dados encontrado no
                localStorage.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Tabela / Chave</TableHead>
                      <TableHead className="text-center">Total Encontrado</TableHead>
                      <TableHead className="text-center">Criados</TableHead>
                      <TableHead className="text-center">Atualizados</TableHead>
                      <TableHead className="text-center">Duplicatas locais</TableHead>
                      <TableHead className="text-center">Incompletos</TableHead>
                      <TableHead className="text-center">Conflitos DB</TableHead>
                      <TableHead className="text-center">Falhas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(summaryReport.tables).map(([key, t]) => (
                      <TableRow key={key} className="hover:bg-muted/40">
                        <TableCell>
                          <div className="font-semibold text-foreground text-sm">{t.label}</div>
                          <span className="font-mono text-xs text-muted-foreground">{key}</span>
                        </TableCell>
                        <TableCell className="text-center font-medium font-mono text-sm">
                          {t.totalFound}
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm text-green-600 dark:text-green-400 font-semibold">
                          {t.imported}
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm text-blue-600 dark:text-blue-400 font-semibold">
                          {t.updated}
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm text-amber-600 dark:text-amber-400">
                          {t.skippedDuplicates}
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm text-orange-600 dark:text-orange-400">
                          {t.importedIncomplete}
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm text-muted-foreground">
                          {t.conflicts}
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm font-semibold">
                          {t.failed > 0 ? (
                            <span className="text-destructive">{t.failed}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lista das chaves de localStorage detectadas antes da migração */}
      {state !== 'EMPTY' && (
        <Card className="shadow-subtle">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" />
                  Conjuntos de dados encontrados no localStorage
                </CardTitle>
                <CardDescription>
                  Foram localizadas <strong>{detectedKeys.length} chave(s)</strong> no armazenamento
                  deste navegador totalizando <strong>{totalRecordsFound} registro(s)</strong>.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={scanStorage}
                disabled={state === 'LOADING'}
                className="gap-1.5 shadow-none"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Atualizar leitura
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Chave local</TableHead>
                    <TableHead>Coleção de Destino (PocketBase)</TableHead>
                    <TableHead>Chave Natural de Deduplicação</TableHead>
                    <TableHead className="text-right">Quantidade de Registros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detectedKeys.map((item) => (
                    <TableRow key={item.key} className="hover:bg-muted/40">
                      <TableCell className="font-mono text-sm font-semibold text-foreground">
                        {item.key}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {item.targetCollection}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{item.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {item.targetCollection === 'factories' && 'CNPJ (ou Nome + Cidade)'}
                        {item.targetCollection === 'orders' && 'Cliente + Produto + Data'}
                        {item.targetCollection === 'pedidos' && 'Número do Pedido / NF'}
                        {item.targetCollection === 'tasks' && 'Título + Data + Fábrica'}
                        {item.targetCollection === 'visits' && 'Fábrica + Data da Visita'}
                        {item.targetCollection === 'produtos' && 'Código do Produto'}
                        {item.targetCollection === 'metas' && 'Vendedor + Segmento + Período'}
                        {![
                          'factories',
                          'orders',
                          'pedidos',
                          'tasks',
                          'visits',
                          'produtos',
                          'metas',
                        ].includes(item.targetCollection) && 'Identificador Natural da Entidade'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-sm text-foreground">
                        {item.count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regras e Especificações da Migração */}
      <Card className="shadow-subtle bg-muted/20 border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            Políticas ativas nesta migração
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="font-semibold text-foreground block">
                • Vendedor Canônico (João Figueiredo)
              </span>
              <p>
                Qualquer referência ao vendedor "João Pedro" é automaticamente convertida para o
                nome canônico <strong>"João Figueiredo"</strong>.
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-semibold text-foreground block">
                • Endereço Completo de Clientes
              </span>
              <p>
                Os campos <code>cep</code>, <code>logradouro</code>, <code>numero</code>,{' '}
                <code>bairro</code>, <code>complemento</code>, <code>latitude</code>,{' '}
                <code>longitude</code> e <code>precisao</code> são preservados e mapeados para a
                coleção <code>factories</code>.
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-semibold text-foreground block">
                • Tratamento de Incompletos
              </span>
              <p>
                Registros com campos ausentes nunca são descartados. Eles são importados com os
                campos faltantes vazios e listados na auditoria como "incompletos".
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-semibold text-foreground block">
                • Prioridade em Conflitos de Versão
              </span>
              <p>
                Se um registro já existir no PocketBase e a versão do banco for mais recente que a
                do localStorage, a versão do banco é rigorosamente mantida e o conflito é computado.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DIÁLOGO 1: Confirmação antes de iniciar */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Database className="w-5 h-5 text-primary" />
              Confirmar início da migração
            </DialogTitle>
            <DialogDescription className="text-left pt-2 space-y-3 leading-relaxed text-sm">
              <p>
                Você está prestes a iniciar a migração de{' '}
                <strong className="text-foreground">{totalRecordsFound} registros</strong> contidos
                em <strong className="text-foreground">{detectedKeys.length} chaves locais</strong>{' '}
                para o banco de dados PocketBase da Blink.
              </p>
              <div className="bg-muted p-3 rounded-lg border border-border/50 text-xs text-foreground space-y-1">
                <p className="font-semibold text-primary">Importante:</p>
                <p>
                  • Os dados existentes no seu navegador serão copiados com segurança para o banco
                  de dados.
                </p>
                <p>• Nada será excluído do seu armazenamento local durante este processo.</p>
                <p>• O processo é idempotente e pode ser repetido a qualquer momento.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => handleStartMigration(0)} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Confirmar e Iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO 2: Concluir migração */}
      <Dialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Concluir migração de dados?
            </DialogTitle>
            <DialogDescription className="text-left pt-2 space-y-3 text-sm">
              <p>
                Ao concluir a migração, você confirma que revisou o relatório de importação e que
                todos os registros necessários foram processados.
              </p>
              <p className="text-xs text-muted-foreground">
                Seus dados no localStorage continuarão salvos até que você opte explicitamente por
                limpá-los.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setFinishDialogOpen(false)}>
              Voltar
            </Button>
            <Button
              onClick={handleConfirmFinish}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Confirmar conclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO 3: Limpar dados locais (opcional e seguro) */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5 text-destructive" />
              Limpar dados locais do navegador?
            </DialogTitle>
            <DialogDescription className="text-left pt-2 space-y-3 text-sm">
              <p>
                Esta ação removerá apenas as chaves de dados legados do <code>localStorage</code>{' '}
                que já foram migradas com sucesso para o PocketBase.
              </p>
              <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg text-xs text-destructive">
                Suas preferências de tema e idioma serão preservadas. Esta ação não afeta o banco de
                dados PocketBase.
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleClearLocalStorage}>
              Sim, limpar dados locais
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
