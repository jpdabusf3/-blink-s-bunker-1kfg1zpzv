import { useState, useRef, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sparkles,
  Upload,
  AlertCircle,
  Loader2,
  CheckCircle2,
  RotateCcw,
  FileSpreadsheet,
  FileText,
  Layers,
  Copy,
  ChevronRight,
  TrendingUp,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { FATURAMENTO_FIELDS, type FaturamentoFieldKey } from '@/services/import-faturamento'
import {
  smartParseFile,
  validateSmartRows,
  executeSmartImport,
  type SmartImportParseResult,
} from '@/services/smart-import-service'
import { formatCurrency, formatCurrencyUSD } from '@/lib/utils'
import { useRealtimeDataContext } from '@/hooks/useRealtimeData'

interface SmartImportFlowProps {
  onSuccess?: () => void
}

export function SmartImportFlow({ onSuccess }: SmartImportFlowProps) {
  const { notifyDataChanged } = useRealtimeDataContext()

  // Estados principais do fluxo
  const [step, setStep] = useState<'EMPTY' | 'LOADING' | 'ERROR' | 'REVIEW' | 'SUCCESS'>('EMPTY')
  const [file, setFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<SmartImportParseResult | null>(null)
  const [mapping, setMapping] = useState<Record<string, FaturamentoFieldKey | ''>>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Configurações de importação
  const [ignoreDuplicates, setIgnoreDuplicates] = useState<boolean>(true)
  const [autoCreateClients, setAutoCreateClients] = useState<boolean>(true)
  const [importing, setImporting] = useState<boolean>(false)

  // Resultado pós-gravação
  const [executionResult, setExecutionResult] = useState<{
    totalRead: number
    imported: number
    duplicatesIgnored: number
    errorsCount: number
    errorDetails: Array<{ row: number; reason: string }>
    message: string
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Validação dinâmica das linhas com base no mapeamento atual
  const validationSummary = useMemo(() => {
    if (!parseResult || !parseResult.rows) return null
    return validateSmartRows(parseResult.rows, mapping)
  }, [parseResult, mapping])

  // Campos obrigatórios ausentes
  const mappedFields = useMemo(() => {
    return new Set(Object.values(mapping).filter((f): f is FaturamentoFieldKey => !!f))
  }, [mapping])

  const missingRequired = useMemo(() => {
    return FATURAMENTO_FIELDS.filter((f) => f.required && !mappedFields.has(f.key))
  }, [mappedFields])

  const hasMappedValue = useMemo(() => {
    return mappedFields.has('valor') || mappedFields.has('valor_usd')
  }, [mappedFields])

  const canConfirmImport = useMemo(() => {
    return (
      missingRequired.length === 0 &&
      hasMappedValue &&
      validationSummary &&
      validationSummary.validCount > 0 &&
      !importing
    )
  }, [missingRequired, hasMappedValue, validationSummary, importing])

  const handleReset = () => {
    setStep('EMPTY')
    setFile(null)
    setParseResult(null)
    setMapping({})
    setErrorMessage(null)
    setExecutionResult(null)
    setImporting(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    setFile(selected)
    setStep('LOADING')
    setErrorMessage(null)

    try {
      const res = await smartParseFile(selected)
      setParseResult(res)
      setMapping(res.suggestedMapping)
      setStep('REVIEW')
      toast.success(
        `Arquivo analisado com sucesso! ${res.headers.length} colunas e ${res.totalRows} linhas identificadas.`,
      )
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Não foi possível identificar dados tabulares neste documento. Use XLSX, CSV ou um relatório PDF da Blink.'
      setErrorMessage(msg)
      setStep('ERROR')
      toast.error(msg)
    }
  }

  const handleMappingChange = (header: string, target: FaturamentoFieldKey | 'none') => {
    setMapping((prev) => ({
      ...prev,
      [header]: target === 'none' ? '' : target,
    }))
  }

  const handleConfirmImport = async () => {
    if (!parseResult) return
    if (!hasMappedValue) {
      toast.error('Associe ao menos uma coluna de valor (Valor Total R$ ou USD $).')
      return
    }

    setImporting(true)
    try {
      const result = await executeSmartImport({
        parseResult,
        mapping,
        ignoreDuplicates,
        autoCreateClients,
      })

      setExecutionResult(result)
      setStep('SUCCESS')

      if (result.success) {
        toast.success('Importação concluída com sucesso!')
        notifyDataChanged('faturamento')
        notifyDataChanged('historico_vendas')
        notifyDataChanged('pedidos_carteira')
        notifyDataChanged('metas')
        notifyDataChanged('activity_logs')
        onSuccess?.()
      } else {
        toast.error(result.message || 'Falha ao gravar importação.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar importação no servidor'
      toast.error(msg)
      setErrorMessage(msg)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ========================================================
          ESTADO 1: EMPTY (Seleção de Arquivo)
         ======================================================== */}
      {step === 'EMPTY' && (
        <Card className="border-border shadow-subtle">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Importação Inteligente Multi-formato
                  <Badge
                    variant="outline"
                    className="text-xs bg-primary/5 text-primary border-primary/20"
                  >
                    Auto-detecção IA
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Envie planilhas (.xlsx, .xls, .csv), relatórios em PDF oficiais da Blink ou
                  documentos com dados tabulares (.doc, .docx).
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-muted-foreground/30 rounded-2xl p-10 text-center cursor-pointer hover:border-primary/60 hover:bg-muted/20 transition-all group"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                <Upload className="w-8 h-8" />
              </div>
              <p className="text-base font-semibold text-foreground">Nenhum arquivo selecionado</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Clique para selecionar ou arraste o arquivo aqui. Suporta planilhas Excel,
                relatórios em PDF da Blink (Matriz de venda, Pedidos em carteira, Relatório de
                vendas semanal) ou tabelas em Word.
              </p>

              <div className="mt-5 flex justify-center">
                <Button
                  type="button"
                  variant="default"
                  className="gap-2 shadow-sm font-semibold pointer-events-none"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Selecionar arquivo
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border bg-muted/20 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Planilhas Excel e CSV</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Detecção automática de cabeçalhos, tolerante a quebras de linha e células
                  mescladas.
                </p>
              </div>

              <div className="rounded-xl border bg-muted/20 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <FileText className="w-4 h-4 text-primary" />
                  <span>Relatórios PDF da Blink</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Extrai Matriz de Venda, Pedidos em Carteira e Relatório de Vendas Semanal
                  diretamente.
                </p>
              </div>

              <div className="rounded-xl border bg-muted/20 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Layers className="w-4 h-4 text-purple-600" />
                  <span>Documentos Word (.docx/.doc)</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Converte tabelas inseridas no documento em linhas estruturadas prontas para
                  gravação.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================
          ESTADO 2: LOADING (Análise de Estrutura)
         ======================================================== */}
      {step === 'LOADING' && (
        <Card className="border-border shadow-subtle">
          <CardContent className="py-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto animate-pulse">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                Analisando estrutura do arquivo...
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Identificando colunas, tipos de dados, datas brasileiras, moedas e verificando
                relatórios cadastrados.
              </p>
              {file && (
                <p className="text-xs font-mono text-muted-foreground pt-2">
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================
          ESTADO 3: ERROR (Mensagem em Português + Tentar Novamente)
         ======================================================== */}
      {step === 'ERROR' && (
        <Card className="border-destructive/30 bg-destructive/5 shadow-subtle">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <CardTitle className="text-base font-semibold">
                Não foi possível processar o documento
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground">
              {errorMessage ||
                'Não foi possível identificar dados tabulares neste documento. Use XLSX, CSV ou um relatório PDF da Blink.'}
            </p>

            <div className="rounded-lg bg-background border p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Formatos recomendados:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Planilha Excel (.xlsx ou .xls) ou CSV delimitado</li>
                <li>
                  Relatório oficial PDF da Blink: Matriz de venda, Pedidos em carteira ou Relatório
                  semanal
                </li>
                <li>Documento Word (.docx) contendo ao menos uma tabela com cabeçalhos</li>
              </ul>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <Button onClick={handleReset} variant="default" className="gap-2">
                <RotateCcw className="w-4 h-4" /> Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================
          ESTADO 4: REVIEW (Tela de Revisão antes de Gravar)
         ======================================================== */}
      {step === 'REVIEW' && parseResult && (
        <div className="space-y-6">
          {/* Cabeçalho do arquivo lido */}
          <Card className="border-border shadow-subtle">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <span>{parseResult.fileName}</span>
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        {parseResult.detectedType === 'spreadsheet' && 'Planilha Excel/CSV'}
                        {parseResult.detectedType === 'pdf_matriz_venda' &&
                          'PDF: Matriz de Venda Blink'}
                        {parseResult.detectedType === 'pdf_pedidos_carteira' &&
                          'PDF: Pedidos em Carteira'}
                        {parseResult.detectedType === 'pdf_relatorio_vendas_semanal' &&
                          'PDF: Relatório Semanal'}
                        {parseResult.detectedType === 'document_table' &&
                          'Tabela de Documento Word'}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {parseResult.totalRows} linhas e {parseResult.headers.length} colunas lidas.
                    </CardDescription>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="gap-1.5 text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Trocar arquivo
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Mapeamento de Colunas */}
          <Card className="border-border shadow-subtle">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Mapeamento de Destino por Coluna
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Associe as colunas detectadas no arquivo aos campos do CRM. Campos com estrela
                    (★) são obrigatórios.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[35%] text-xs font-semibold">
                        Coluna Detectada
                      </TableHead>
                      <TableHead className="w-[20%] text-xs text-center font-semibold">
                        Exemplo (Linha 1)
                      </TableHead>
                      <TableHead className="w-[45%] text-xs font-semibold">
                        Campo no CRM / Destino
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parseResult.headers.map((header) => {
                      const currentField = mapping[header] || ''
                      const sampleVal = parseResult.rows[0]?.[header]

                      return (
                        <TableRow key={header} className="hover:bg-muted/20">
                          <TableCell className="font-mono text-xs font-medium text-foreground">
                            {header}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground text-center truncate max-w-[150px]">
                            {sampleVal !== undefined &&
                            sampleVal !== null &&
                            String(sampleVal) !== '' ? (
                              <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-[11px]">
                                {String(sampleVal)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40 italic">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={currentField || 'none'}
                              onValueChange={(val) =>
                                handleMappingChange(header, val as FaturamentoFieldKey | 'none')
                              }
                            >
                              <SelectTrigger className="h-8 text-xs w-full sm:w-[300px]">
                                <SelectValue placeholder="Ignorar coluna" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[280px]">
                                <SelectItem value="none" className="text-muted-foreground text-xs">
                                  -- Ignorar coluna --
                                </SelectItem>
                                {FATURAMENTO_FIELDS.map((f) => {
                                  const isAssignedElsewhere = Object.entries(mapping).some(
                                    ([h, key]) => key === f.key && h !== header,
                                  )
                                  return (
                                    <SelectItem key={f.key} value={f.key} className="text-xs">
                                      <span>
                                        {f.label} {f.required && '★'}
                                      </span>
                                      {isAssignedElsewhere && (
                                        <span className="text-[10px] text-amber-600 ml-2">
                                          (já associado)
                                        </span>
                                      )}
                                    </SelectItem>
                                  )
                                })}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Alertas de Mapeamento */}
              {missingRequired.length > 0 && (
                <div className="flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-3 rounded-lg border border-amber-200 dark:border-amber-900/50">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <span className="font-semibold">Campos obrigatórios pendentes: </span>
                    {missingRequired.map((f) => f.label).join(', ')}.
                  </div>
                </div>
              )}

              {!hasMappedValue && (
                <div className="flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-3 rounded-lg border border-amber-200 dark:border-amber-900/50">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <span className="font-semibold">Coluna de valor ausente: </span>
                    Associe ao menos uma coluna de valores a "Valor Total (R$)" ou "Valor Total (USD
                    $)".
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configurações de Duplicatas e Clientes */}
          <Card className="border-border shadow-subtle">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Copy className="w-4 h-4 text-primary" />
                Tratamento de Duplicatas e Cadastros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  Detecção de Duplicidades (cliente + data + doc + produto):
                </Label>
                <RadioGroup
                  value={ignoreDuplicates ? 'ignore' : 'allow'}
                  onValueChange={(val) => setIgnoreDuplicates(val === 'ignore')}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  <div
                    onClick={() => setIgnoreDuplicates(true)}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      ignoreDuplicates ? 'bg-primary/5 border-primary' : 'bg-muted/10 border-border'
                    }`}
                  >
                    <RadioGroupItem value="ignore" id="dup-ignore" className="mt-0.5" />
                    <div>
                      <Label htmlFor="dup-ignore" className="text-xs font-semibold cursor-pointer">
                        Ignorar duplicados (padrão)
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Linhas suspeitas marcadas com aviso serão desconsideradas para preservar
                        idempotência.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setIgnoreDuplicates(false)}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      !ignoreDuplicates
                        ? 'bg-primary/5 border-primary'
                        : 'bg-muted/10 border-border'
                    }`}
                  >
                    <RadioGroupItem value="allow" id="dup-allow" className="mt-0.5" />
                    <div>
                      <Label htmlFor="dup-allow" className="text-xs font-semibold cursor-pointer">
                        Importar mesmo assim
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Importa todas as linhas válidas mesmo se forem suspeitas de duplicidade.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="auto-create-smart"
                    className="text-xs font-semibold cursor-pointer"
                  >
                    Cadastrar automaticamente novos clientes se não encontrados no CRM
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Vincula clientes existentes por CNPJ ou nome; novos clientes são criados
                    automaticamente.
                  </p>
                </div>
                <Switch
                  id="auto-create-smart"
                  checked={autoCreateClients}
                  onCheckedChange={setAutoCreateClients}
                />
              </div>
            </CardContent>
          </Card>

          {/* Prévia com Tabela e Avisos */}
          <Card className="border-border shadow-subtle">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Prévia dos Dados Processados
                    <span className="text-xs font-normal text-muted-foreground">
                      (primeiras {Math.min(10, parseResult.rows.length)} linhas)
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Validação em tempo real: moedas brasileiras (R$), datas no padrão DD/MM/AAAA e
                    identificação de duplicatas.
                  </CardDescription>
                </div>

                {validationSummary && (
                  <div className="flex items-center gap-2 text-xs">
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-700 border-emerald-200"
                    >
                      {validationSummary.validCount} válidas
                    </Badge>
                    {validationSummary.duplicateCount > 0 && (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-200"
                      >
                        {validationSummary.duplicateCount} possíveis duplicatas
                      </Badge>
                    )}
                    {validationSummary.invalidCount > 0 && (
                      <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                        {validationSummary.invalidCount} inválidas (não bloqueiam)
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-12 text-center text-xs">#</TableHead>
                      <TableHead className="text-xs">Status / Validação</TableHead>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs">NF / Doc</TableHead>
                      <TableHead className="text-xs">Cliente</TableHead>
                      <TableHead className="text-xs">Produto</TableHead>
                      <TableHead className="text-xs text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parseResult.rows.slice(0, 10).map((row, idx) => {
                      const rowVal = validationSummary?.rowValidations[idx]
                      const isDup = rowVal?.isDuplicate
                      const isValid = rowVal?.isValid

                      return (
                        <TableRow
                          key={idx}
                          className={isDup ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''}
                        >
                          <TableCell className="text-xs text-center font-mono text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {isDup && (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0"
                                >
                                  Possível duplicata
                                </Badge>
                              )}
                              {!isValid && (
                                <Badge
                                  variant="outline"
                                  className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] px-1.5 py-0"
                                >
                                  Inválida
                                </Badge>
                              )}
                              {isValid && !isDup && (
                                <span className="text-emerald-600 text-xs flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Válida
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-mono whitespace-nowrap font-medium">
                            {rowVal?.date || '—'}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {rowVal?.documentNumber || '—'}
                          </TableCell>
                          <TableCell
                            className="text-xs font-medium max-w-[200px] truncate"
                            title={rowVal?.clientName}
                          >
                            {rowVal?.clientName || '—'}
                          </TableCell>
                          <TableCell
                            className="text-xs max-w-[180px] truncate"
                            title={rowVal?.product}
                          >
                            {rowVal?.product || '—'}
                          </TableCell>
                          <TableCell className="text-xs font-mono font-semibold text-right whitespace-nowrap">
                            {rowVal?.value && rowVal.value > 0
                              ? formatCurrency(rowVal.value)
                              : rowVal?.valueUsd && rowVal.valueUsd > 0
                                ? formatCurrencyUSD(rowVal.valueUsd)
                                : '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Lista de Erros que NÃO bloqueiam */}
              {validationSummary && validationSummary.validationErrors.length > 0 && (
                <div className="rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-800 dark:text-rose-300">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>
                      {validationSummary.validationErrors.length} linha(s) com inconsistência
                      detectada (não bloquearão o restante da importação):
                    </span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 text-xs text-rose-700 dark:text-rose-400 pl-6">
                    {validationSummary.validationErrors.slice(0, 10).map((err, i) => (
                      <div key={i} className="font-mono text-[11px]">
                        • {err.reason}
                      </div>
                    ))}
                    {validationSummary.validationErrors.length > 10 && (
                      <div className="text-[11px] italic">
                        ...e mais {validationSummary.validationErrors.length - 10} linha(s).
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={importing}
                  className="gap-2 w-full sm:w-auto"
                >
                  <RotateCcw className="w-4 h-4" /> Cancelar
                </Button>

                <Button
                  onClick={handleConfirmImport}
                  disabled={!canConfirmImport}
                  className="gap-2 w-full sm:w-auto bg-primary hover:bg-primary/90 font-semibold shadow-sm"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gravando importação...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirmar e importar
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================
          ESTADO 5: SUCCESS (Resumo após Gravação Concluída)
         ======================================================== */}
      {step === 'SUCCESS' && executionResult && (
        <Card className="border-border shadow-subtle">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Importação Concluída</CardTitle>
                <CardDescription>
                  Os dados foram processados e gravados com segurança no banco em modo append.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-muted/40 rounded-xl p-3 border text-center">
                <p className="text-xs text-muted-foreground">Linhas Lidas</p>
                <p className="text-2xl font-bold mt-1">{executionResult.totalRead}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 border border-emerald-200 dark:border-emerald-900/40 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Gravadas
                </p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  {executionResult.imported}
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-200 dark:border-blue-900/40 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Copy className="w-3.5 h-3.5 text-blue-600" /> Duplicatas Ignoradas
                </p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {executionResult.duplicatesIgnored}
                </p>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/30 rounded-xl p-3 border border-rose-200 dark:border-rose-900/40 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" /> Com Erro
                </p>
                <p className="text-2xl font-bold text-rose-600 mt-1">
                  {executionResult.errorsCount}
                </p>
              </div>
            </div>

            {/* Lista de Erros que Permanecem Visíveis */}
            {executionResult.errorDetails && executionResult.errorDetails.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Detalhamento das linhas com erro (permanecem
                  visíveis para conferência):
                </p>
                <div className="max-h-56 overflow-y-auto space-y-1 border rounded-lg p-3 bg-rose-50/40 dark:bg-rose-950/10">
                  {executionResult.errorDetails.map((err, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2 py-0.5"
                    >
                      <span className="font-mono font-semibold shrink-0">Linha {err.row}:</span>
                      <span>{err.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ações pós-importação */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Button onClick={handleReset} variant="default" className="gap-2">
                <RotateCcw className="w-4 h-4" /> Importar outro arquivo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
