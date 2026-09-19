import { useState, useRef, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  TrendingUp,
  XCircle,
  AlertTriangle,
  UserPlus,
  PackagePlus,
  DollarSign,
  Ban,
  Undo2,
  Info,
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
import { createFactoryPB } from '@/services/factories'
import { produtosService } from '@/services/produtos-service'
import pb from '@/lib/pocketbase/client'

interface SmartImportFlowProps {
  onSuccess?: () => void
}

interface KnownClient {
  id: string
  name: string
  cnpj?: string
}

interface KnownProduct {
  id: string
  codigo: string
  nome: string
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
  const [autoCreateClients, setAutoCreateClients] = useState<boolean>(false)
  const [importing, setImporting] = useState<boolean>(false)
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number } | null>(null)

  // Coleções do banco para verificação de existência
  const [clientsList, setClientsList] = useState<KnownClient[]>([])
  const [productsList, setProductsList] = useState<KnownProduct[]>([])
  const [isLoadingEntities, setIsLoadingEntities] = useState<boolean>(false)

  // Linhas ignoradas pelo usuário (por padrão linhas com entidades não encontradas começam marcadas como ignoradas)
  const [skippedRowIndices, setSkippedRowIndices] = useState<Set<number>>(new Set())

  // Modais de cadastro rápido inline
  const [quickClientModalOpen, setQuickClientModalOpen] = useState(false)
  const [quickProductModalOpen, setQuickProductModalOpen] = useState(false)
  const [savingQuickEntity, setSavingQuickEntity] = useState(false)

  // Formulário rápido de cliente
  const [quickClientName, setQuickClientName] = useState('')
  const [quickClientCnpj, setQuickClientCnpj] = useState('')
  const [quickClientCity, setQuickClientCity] = useState('')
  const [quickClientState, setQuickClientState] = useState('')

  // Formulário rápido de produto
  const [quickProductCode, setQuickProductCode] = useState('')
  const [quickProductName, setQuickProductName] = useState('')

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

  // Carregar lista de clientes e produtos existentes ao montar
  const loadEntities = async () => {
    setIsLoadingEntities(true)
    try {
      const [facRes, prodRes] = await Promise.all([
        pb
          .collection('factories')
          .getFullList({ fields: 'id,name,cnpj' })
          .catch(() => []),
        pb
          .collection('produtos')
          .getFullList({ fields: 'id,codigo,nome' })
          .catch(() => []),
      ])

      setClientsList(
        facRes.map((f: any) => ({
          id: f.id,
          name: (f.name || '').trim(),
          cnpj: (f.cnpj || '').replace(/\D/g, ''),
        })),
      )

      setProductsList(
        prodRes.map((p: any) => ({
          id: p.id,
          codigo: (p.codigo || '').trim(),
          nome: (p.nome || '').trim(),
        })),
      )
    } catch (err) {
      console.error('Erro ao carregar clientes/produtos existentes:', err)
    } finally {
      setIsLoadingEntities(false)
    }
  }

  useEffect(() => {
    loadEntities()
  }, [])

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

  // Helpers de matching para Cliente e Produto
  const checkClientExists = (rawClientName?: string, rawCnpj?: string): boolean => {
    if (!rawClientName && !rawCnpj) return false
    const cleanCnpj = (rawCnpj || '').replace(/\D/g, '')
    const cleanName = (rawClientName || '').trim().toLowerCase()

    return clientsList.some((c) => {
      if (cleanCnpj && cleanCnpj.length >= 11 && c.cnpj) {
        if (c.cnpj === cleanCnpj) return true
      }
      if (cleanName && cleanName.length > 2 && c.name) {
        const dbName = c.name.toLowerCase()
        if (dbName === cleanName || dbName.includes(cleanName) || cleanName.includes(dbName)) {
          return true
        }
      }
      return false
    })
  }

  const checkProductExists = (rawProdCodeOrName?: string): boolean => {
    if (!rawProdCodeOrName) return false
    const clean = rawProdCodeOrName.trim().toLowerCase()
    if (!clean) return false

    return productsList.some((p) => {
      const code = p.codigo.toLowerCase()
      const name = p.nome.toLowerCase()
      if (code && (code === clean || clean.startsWith(code) || clean.includes(code))) {
        return true
      }
      if (name && (name === clean || clean.includes(name) || name.includes(clean))) {
        return true
      }
      return false
    })
  }

  // Análise linha a linha detalhada para o preview e flags de clientes/produtos ausentes
  const rowsAnalysis = useMemo(() => {
    if (!parseResult || !parseResult.rows) return []

    // Localizar cabeçalhos mapeados
    let clienteH: string | undefined
    let cnpjh: string | undefined
    let prodH: string | undefined
    let valBrlH: string | undefined
    let valUsdH: string | undefined

    Object.entries(mapping).forEach(([h, field]) => {
      if (field === 'cliente') clienteH = h
      if (field === 'cnpj') cnpjh = h
      if (field === 'produto') prodH = h
      if (field === 'valor') valBrlH = h
      if (field === 'valor_usd') valUsdH = h
    })

    return parseResult.rows.map((row, idx) => {
      const rowVal = validationSummary?.rowValidations[idx]
      const rawCliente = clienteH ? String(row[clienteH] ?? '').trim() : rowVal?.clientName || ''
      const rawCnpj = cnpjh ? String(row[cnpjh] ?? '').trim() : ''
      const rawProd = prodH ? String(row[prodH] ?? '').trim() : rowVal?.product || ''

      const clientFound = checkClientExists(rawCliente, rawCnpj)
      const productFound = checkProductExists(rawProd)

      const isClientMissing = Boolean(rawCliente && !clientFound)
      const isProductMissing = Boolean(rawProd && !productFound)
      const isSyntaxInvalid = !rowVal?.isValid
      const isDuplicate = Boolean(rowVal?.isDuplicate)

      const hasProblem = isClientMissing || isProductMissing || isSyntaxInvalid

      return {
        idx,
        rowNumber: idx + 1,
        rowVal,
        rawCliente,
        rawCnpj,
        rawProd,
        clientFound,
        productFound,
        isClientMissing,
        isProductMissing,
        isSyntaxInvalid,
        isDuplicate,
        hasProblem,
        rawRow: row,
        value: rowVal?.value || 0,
      }
    })
  }, [parseResult, mapping, validationSummary, clientsList, productsList])

  // Ao carregar ou re-validar linhas com problemas, inicializar skippedRowIndices com as linhas com problemas
  useEffect(() => {
    if (rowsAnalysis.length === 0) {
      setSkippedRowIndices(new Set())
      return
    }

    const problematic = new Set<number>()
    rowsAnalysis.forEach((r) => {
      if (r.isClientMissing || r.isProductMissing || r.isSyntaxInvalid) {
        problematic.add(r.idx)
      }
    })
    setSkippedRowIndices(problematic)
  }, [parseResult, mapping, clientsList.length, productsList.length])

  // Totalizadores para a barra de resumo do Preview
  const totalRowsCount = parseResult?.rows.length || 0
  const totalValueBRL = useMemo(() => {
    return rowsAnalysis.reduce((acc, r) => acc + (r.value || 0), 0)
  }, [rowsAnalysis])

  const problemRowsCount = useMemo(() => {
    return rowsAnalysis.filter((r) => r.hasProblem).length
  }, [rowsAnalysis])

  const missingClientsRows = useMemo(() => {
    return rowsAnalysis.filter((r) => r.isClientMissing)
  }, [rowsAnalysis])

  const missingProductsRows = useMemo(() => {
    return rowsAnalysis.filter((r) => r.isProductMissing)
  }, [rowsAnalysis])

  // Contagem de linhas que serão efetivamente importadas
  const validRowsToImport = useMemo(() => {
    return rowsAnalysis.filter((r) => {
      if (skippedRowIndices.has(r.idx)) return false
      if (r.isSyntaxInvalid) return false
      if (ignoreDuplicates && r.isDuplicate) return false
      return true
    })
  }, [rowsAnalysis, skippedRowIndices, ignoreDuplicates])

  const canConfirmImport = useMemo(() => {
    return (
      missingRequired.length === 0 && hasMappedValue && validRowsToImport.length > 0 && !importing
    )
  }, [missingRequired, hasMappedValue, validRowsToImport.length, importing])

  const handleReset = () => {
    setStep('EMPTY')
    setFile(null)
    setParseResult(null)
    setMapping({})
    setErrorMessage(null)
    setExecutionResult(null)
    setImporting(false)
    setSaveProgress(null)
    setSkippedRowIndices(new Set())
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    const ext = selected.name.split('.').pop()?.toLowerCase()
    if (ext !== 'xlsx' && ext !== 'csv') {
      const msg = 'Formato não suportado. Envie .xlsx ou .csv.'
      setErrorMessage(msg)
      setStep('ERROR')
      toast.error(msg)
      return
    }
    if (selected.size > 10 * 1024 * 1024) {
      const msg = 'Arquivo maior que 10MB.'
      setErrorMessage(msg)
      setStep('ERROR')
      toast.error(msg)
      return
    }

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
          : 'Não foi possível processar o arquivo. Envie uma planilha XLSX ou CSV válida.'
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

  const toggleSkipRow = (idx: number) => {
    setSkippedRowIndices((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) {
        next.delete(idx)
      } else {
        next.add(idx)
      }
      return next
    })
  }

  const skipAllFlagged = () => {
    const next = new Set(skippedRowIndices)
    rowsAnalysis.forEach((r) => {
      if (r.hasProblem) next.add(r.idx)
    })
    setSkippedRowIndices(next)
    toast.info('Todas as linhas com alertas foram marcadas para pular.')
  }

  const unskipAll = () => {
    setSkippedRowIndices(new Set())
    toast.info('Todas as linhas foram desmarcadas.')
  }

  // Abertura dos formulários rápidos
  const openQuickClient = (prefillName = '', prefillCnpj = '') => {
    setQuickClientName(prefillName)
    setQuickClientCnpj(prefillCnpj)
    setQuickClientCity('')
    setQuickClientState('')
    setQuickClientModalOpen(true)
  }

  const openQuickProduct = (prefill = '') => {
    setQuickProductCode(prefill.toUpperCase().slice(0, 20))
    setQuickProductName(prefill)
    setQuickProductModalOpen(true)
  }

  // Cadastro rápido de Cliente (Factory)
  const handleSaveQuickClient = async () => {
    if (!quickClientName.trim()) {
      toast.error('Informe a razão social ou nome do cliente.')
      return
    }
    setSavingQuickEntity(true)
    try {
      const created = await createFactoryPB({
        name: quickClientName.trim(),
        cnpj: quickClientCnpj.trim() || undefined,
        city: quickClientCity.trim() || undefined,
        state: quickClientState.trim().toUpperCase() || undefined,
        status: 'ativa',
      })
      toast.success(`Cliente "${created.name}" cadastrado com sucesso!`)
      setQuickClientModalOpen(false)
      // Atualizar lista local
      await loadEntities()
      notifyDataChanged('factories')
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao cadastrar cliente.')
    } finally {
      setSavingQuickEntity(false)
    }
  }

  // Cadastro rápido de Produto
  const handleSaveQuickProduct = async () => {
    if (!quickProductCode.trim() || !quickProductName.trim()) {
      toast.error('Código e nome do produto são obrigatórios.')
      return
    }
    setSavingQuickEntity(true)
    try {
      const created = await produtosService.createProduto({
        codigo: quickProductCode.trim().toUpperCase(),
        nome: quickProductName.trim(),
      })
      toast.success(`Produto "${created.nome}" cadastrado com sucesso!`)
      setQuickProductModalOpen(false)
      // Atualizar lista local
      await loadEntities()
      notifyDataChanged('produtos')
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao cadastrar produto.')
    } finally {
      setSavingQuickEntity(false)
    }
  }

  // Gravação confirmada pelo usuário
  const handleConfirmImport = async () => {
    if (!parseResult) return
    if (!hasMappedValue) {
      toast.error('Associe ao menos uma coluna de valor (Valor Total R$ ou USD $).')
      return
    }

    if (validRowsToImport.length === 0) {
      toast.error('Nenhuma linha válida selecionada para importação.')
      return
    }

    setImporting(true)
    setSaveProgress({ current: 0, total: validRowsToImport.length })

    try {
      // Filtrar as linhas exatas que o usuário aprovou
      const rowsToImportArray = validRowsToImport.map((r) => r.rawRow)

      const result = await executeSmartImport({
        parseResult,
        mapping,
        ignoreDuplicates,
        autoCreateClients,
        rowsToImportOverride: rowsToImportArray,
        onProgress: (current, total) => {
          setSaveProgress({ current, total })
        },
      })

      setExecutionResult(result)
      setStep('SUCCESS')

      const ignoredTotal = (result.duplicatesIgnored || 0) + (result.skippedRows || 0)
      toast.success(
        `Importação concluída: ${result.imported} registros importados, ${ignoredTotal} ignorados.`,
      )

      notifyDataChanged('faturamento')
      notifyDataChanged('historico_vendas')
      notifyDataChanged('pedidos_carteira')
      notifyDataChanged('metas')
      notifyDataChanged('activity_logs')
      notifyDataChanged('import_history')
      onSuccess?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar importação no servidor'
      toast.error(msg)
      setErrorMessage(msg)
    } finally {
      setImporting(false)
      setSaveProgress(null)
    }
  }

  // 20 primeiras linhas para o Review Table
  const previewRows = useMemo(() => {
    return rowsAnalysis.slice(0, 20)
  }, [rowsAnalysis])

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
                  Importação Inteligente de Faturamento
                  <Badge
                    variant="outline"
                    className="text-xs bg-primary/5 text-primary border-primary/20"
                  >
                    Detecção e Validação
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Envie planilhas (.xlsx, .csv) de faturamento. Arquivos são validados, vinculados a
                  clientes e produtos e importados sem sobrescrever dados.
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
              <p className="text-base font-semibold text-foreground">
                Nenhuma importação realizada
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Clique para selecionar ou arraste sua planilha (.xlsx ou .csv até 10MB) aqui para
                iniciar o mapeamento de faturamento.
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
                accept=".xlsx,.csv"
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
                  Reconhecimento automático de cabeçalhos e conversão de valores em R$ e datas
                  brasileiras.
                </p>
              </div>

              <div className="rounded-xl border bg-muted/20 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>Validação de Clientes e Produtos</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Identifica entidades não cadastradas com opção de cadastro rápido em 1 clique ou
                  pular linha.
                </p>
              </div>

              <div className="rounded-xl border bg-muted/20 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Copy className="w-4 h-4 text-blue-600" />
                  <span>Proteção Idempotente</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Prevenção total contra duplicatas (NF + Produto + Data) em modo append seguro.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================
          ESTADO 2: LOADING (Análise ou Salvamento)
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
                Identificando colunas, valores monetários (R$), datas no formato DD/MM/AAAA e
                verificando clientes e produtos existentes.
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
                Não foi possível processar o arquivo
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground">
              {errorMessage ||
                'Não foi possível identificar dados tabulares válidos no arquivo enviado. Use arquivos XLSX ou CSV com até 10MB.'}
            </p>

            <div className="rounded-lg bg-background border p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Instruções para importação:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Certifique-se de que a planilha possui cabeçalhos na primeira linha.</li>
                <li>
                  Formatos suportados: .xlsx ou .csv (delimitador vírgula ou ponto-e-vírgula).
                </li>
                <li>Tamanho máximo permitido: 10MB.</li>
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
          ESTADO 4: REVIEW (Tela de Revisão Completa antes de Gravar)
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
                        Planilha Excel/CSV
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
                    Associe as colunas da sua planilha aos campos do sistema. Campos com estrela (★)
                    são obrigatórios.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border overflow-x-auto">
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

          {/* Barra de Resumo da Importação */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="border-border shadow-subtle p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total de Linhas</p>
                <p className="text-2xl font-bold font-mono mt-1 text-foreground">
                  {totalRowsCount.toLocaleString('pt-BR')}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {validRowsToImport.length} selecionadas para gravação
                </span>
              </div>
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                <Layers className="w-5 h-5" />
              </div>
            </Card>

            <Card className="border-border shadow-subtle p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Valor Total Lido</p>
                <p className="text-2xl font-bold font-mono mt-1 text-emerald-700 dark:text-emerald-400">
                  R${' '}
                  {totalValueBRL.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  Soma de todas as linhas lidas
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600">
                <DollarSign className="w-5 h-5" />
              </div>
            </Card>

            <Card
              className={`border-border shadow-subtle p-4 flex items-center justify-between ${
                problemRowsCount > 0
                  ? 'border-amber-300/80 bg-amber-50/20 dark:bg-amber-950/10'
                  : ''
              }`}
            >
              <div>
                <p className="text-xs text-muted-foreground font-medium">Linhas com Alertas</p>
                <p
                  className={`text-2xl font-bold font-mono mt-1 ${
                    problemRowsCount > 0 ? 'text-amber-600' : 'text-muted-foreground'
                  }`}
                >
                  {problemRowsCount.toLocaleString('pt-BR')}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  Cliente/produto não achado ou dado inválido
                </span>
              </div>
              <div
                className={`p-3 rounded-xl ${
                  problemRowsCount > 0
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-muted/40 text-muted-foreground'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
            </Card>
          </div>

          {/* SEÇÃO SEPARADA: Linhas com Clientes ou Produtos não cadastrados */}
          {(missingClientsRows.length > 0 || missingProductsRows.length > 0) && (
            <Card className="border-amber-300 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 shadow-subtle">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base text-amber-900 dark:text-amber-200 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      Entidades não encontradas no sistema (
                      {missingClientsRows.length + missingProductsRows.length} alertas)
                    </CardTitle>
                    <CardDescription className="text-xs text-amber-800/80 dark:text-amber-300/80">
                      Por padrão, linhas cujo cliente ou produto não foi localizado são sinalizadas
                      e <strong>NÃO</strong> serão importadas, a menos que você as cadastre abaixo
                      ou marque para incluir.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={skipAllFlagged}
                      className="text-xs gap-1.5 border-amber-300 text-amber-900 dark:text-amber-200"
                    >
                      <Ban className="w-3.5 h-3.5" /> Pular todas com alerta
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={unskipAll}
                      className="text-xs gap-1.5 border-amber-300 text-amber-900 dark:text-amber-200"
                    >
                      <Undo2 className="w-3.5 h-3.5" /> Desmarcar pulos
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Clientes Faltantes */}
                  <div className="border rounded-lg p-3 bg-background/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                        <UserPlus className="w-4 h-4 text-primary" /> Clientes não encontrados (
                        {missingClientsRows.length})
                      </span>
                    </div>
                    {missingClientsRows.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic">
                        Todos os clientes foram identificados no banco.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {Array.from(
                          new Set(
                            missingClientsRows.map((r) =>
                              JSON.stringify({ name: r.rawCliente, cnpj: r.rawCnpj }),
                            ),
                          ),
                        )
                          .map((str) => JSON.parse(str))
                          .slice(0, 15)
                          .map((clientObj: any, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30 border text-xs"
                            >
                              <div className="truncate min-w-0">
                                <p className="font-medium text-foreground truncate">
                                  {clientObj.name || 'Nome não informado'}
                                </p>
                                {clientObj.cnpj && (
                                  <p className="text-[10px] font-mono text-muted-foreground">
                                    CNPJ: {clientObj.cnpj}
                                  </p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openQuickClient(clientObj.name, clientObj.cnpj)}
                                className="h-7 text-xs gap-1 shrink-0"
                              >
                                <UserPlus className="w-3 h-3" /> Cadastrar
                              </Button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Produtos Faltantes */}
                  <div className="border rounded-lg p-3 bg-background/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                        <PackagePlus className="w-4 h-4 text-emerald-600" /> Produtos não
                        encontrados ({missingProductsRows.length})
                      </span>
                    </div>
                    {missingProductsRows.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic">
                        Todos os produtos foram identificados no catálogo.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {Array.from(new Set(missingProductsRows.map((r) => r.rawProd)))
                          .filter(Boolean)
                          .slice(0, 15)
                          .map((prodName, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30 border text-xs"
                            >
                              <p className="font-medium text-foreground truncate min-w-0">
                                {prodName}
                              </p>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openQuickProduct(prodName)}
                                className="h-7 text-xs gap-1 shrink-0"
                              >
                                <PackagePlus className="w-3 h-3" /> Cadastrar
                              </Button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Configurações de Duplicatas */}
          <Card className="border-border shadow-subtle">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Copy className="w-4 h-4 text-primary" />
                Prevenção de Duplicidades (NF + Produto + Data)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
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
                        Ignorar duplicatas (padrão)
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Registros com mesma NF + produto + data serão pulados e contabilizados como
                        duplicados.
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
                        Importar duplicatas mesmo assim
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Permite duplicar registros caso haja re-emissão intencional.
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
                    Criar clientes automaticamente no CRM durante o salvamento
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Quando ativado, clientes inexistentes serão inseridos de forma transparente
                    durante o lote.
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

          {/* TABELA DE PRÉVIA: Primeiras 20 Linhas (Desktop: Tabela / Mobile < 768px: Cards) */}
          <Card className="border-border shadow-subtle">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Tabela de Prévia dos Dados
                    <span className="text-xs font-normal text-muted-foreground">
                      (primeiras {Math.min(20, parseResult.rows.length)} linhas analisadas)
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Revise cada linha. Linhas sinalizadas podem ser puladas ou cadastradas antes do
                    salvamento definitivo.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-200"
                  >
                    {validRowsToImport.length} para importar
                  </Badge>
                  {skippedRowIndices.size > 0 && (
                    <Badge
                      variant="outline"
                      className="bg-muted text-muted-foreground border-border"
                    >
                      {skippedRowIndices.size} ignorada(s)
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* VISUALIZAÇÃO DESKTOP: TABELA (oculta em telas abaixo de 768px / md:block) */}
              <div className="hidden md:block overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-12 text-center text-xs">#</TableHead>
                      <TableHead className="text-xs">Ação</TableHead>
                      <TableHead className="text-xs">Status / Validação</TableHead>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs">NF / Doc</TableHead>
                      <TableHead className="text-xs">Cliente</TableHead>
                      <TableHead className="text-xs">Produto</TableHead>
                      <TableHead className="text-xs text-right">Valor (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((r) => {
                      const isSkipped = skippedRowIndices.has(r.idx)

                      return (
                        <TableRow
                          key={r.idx}
                          className={`${
                            isSkipped
                              ? 'opacity-50 bg-muted/20 line-through'
                              : r.hasProblem
                                ? 'bg-amber-50/40 dark:bg-amber-950/10'
                                : ''
                          }`}
                        >
                          <TableCell className="text-xs text-center font-mono text-muted-foreground">
                            {r.rowNumber}
                          </TableCell>

                          {/* Ação individual para pular / incluir */}
                          <TableCell className="no-underline">
                            <Button
                              size="sm"
                              variant={isSkipped ? 'outline' : 'ghost'}
                              onClick={() => toggleSkipRow(r.idx)}
                              className="h-7 text-[11px] px-2 py-0"
                            >
                              {isSkipped ? 'Incluir' : 'Pular'}
                            </Button>
                          </TableCell>

                          {/* Status / Validação */}
                          <TableCell className="text-xs whitespace-nowrap no-underline">
                            <div className="flex flex-col gap-1">
                              {r.isDuplicate && (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0 w-fit"
                                >
                                  Duplicata
                                </Badge>
                              )}
                              {r.isClientMissing && (
                                <Badge
                                  variant="outline"
                                  className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] px-1.5 py-0 w-fit"
                                >
                                  Cliente não cadastrado
                                </Badge>
                              )}
                              {r.isProductMissing && (
                                <Badge
                                  variant="outline"
                                  className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] px-1.5 py-0 w-fit"
                                >
                                  Produto não cadastrado
                                </Badge>
                              )}
                              {r.isSyntaxInvalid && (
                                <Badge
                                  variant="outline"
                                  className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] px-1.5 py-0 w-fit"
                                >
                                  Dado inválido
                                </Badge>
                              )}
                              {!r.hasProblem && !r.isDuplicate && (
                                <span className="text-emerald-600 text-xs flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Válida
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Data */}
                          <TableCell className="text-xs font-mono whitespace-nowrap font-medium">
                            {r.rowVal?.date || '—'}
                          </TableCell>

                          {/* NF / Doc */}
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {r.rowVal?.documentNumber || '—'}
                          </TableCell>

                          {/* Cliente com botão de adicionar caso falte */}
                          <TableCell className="text-xs font-medium max-w-[200px]">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="truncate" title={r.rawCliente}>
                                {r.rawCliente || '—'}
                              </span>
                              {r.isClientMissing && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openQuickClient(r.rawCliente, r.rawCnpj)}
                                  className="h-6 w-6 p-0 text-primary shrink-0"
                                  title="Cadastrar cliente rápido"
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>

                          {/* Produto com botão de adicionar caso falte */}
                          <TableCell className="text-xs max-w-[180px]">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="truncate" title={r.rawProd}>
                                {r.rawProd || '—'}
                              </span>
                              {r.isProductMissing && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openQuickProduct(r.rawProd)}
                                  className="h-6 w-6 p-0 text-emerald-600 shrink-0"
                                  title="Cadastrar produto rápido"
                                >
                                  <PackagePlus className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>

                          {/* Valor em R$ */}
                          <TableCell className="text-xs font-mono font-semibold text-right whitespace-nowrap">
                            {r.value && r.value > 0
                              ? `R$ ${r.value.toLocaleString('pt-BR', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                              : r.rowVal?.valueUsd && r.rowVal.valueUsd > 0
                                ? formatCurrencyUSD(r.rowVal.valueUsd)
                                : '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* VISUALIZAÇÃO MOBILE: CARDS (ativa abaixo de 768px / md:hidden) */}
              <div className="md:hidden space-y-3">
                {previewRows.map((r) => {
                  const isSkipped = skippedRowIndices.has(r.idx)

                  return (
                    <div
                      key={r.idx}
                      className={`p-3.5 rounded-xl border space-y-2 transition-all ${
                        isSkipped
                          ? 'opacity-60 bg-muted/20 border-dashed'
                          : r.hasProblem
                            ? 'bg-amber-50/30 border-amber-300 dark:bg-amber-950/20 dark:border-amber-900/60'
                            : 'bg-card border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-muted-foreground">
                          Linha #{r.rowNumber}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant={isSkipped ? 'outline' : 'ghost'}
                            onClick={() => toggleSkipRow(r.idx)}
                            className="h-6 text-[10px] px-2 py-0"
                          >
                            {isSkipped ? 'Desfazer pulo' : 'Pular linha'}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Data</span>
                          <span className="font-mono font-medium">{r.rowVal?.date || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">NF / Doc</span>
                          <span className="font-mono font-medium">
                            {r.rowVal?.documentNumber || '—'}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs">
                        <span className="text-[10px] text-muted-foreground block">Cliente</span>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <span className="font-medium text-foreground truncate">
                            {r.rawCliente || '—'}
                          </span>
                          {r.isClientMissing && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openQuickClient(r.rawCliente, r.rawCnpj)}
                              className="h-6 text-[10px] px-2 gap-1 text-primary shrink-0"
                            >
                              <UserPlus className="w-3 h-3" /> Cadastrar
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="text-xs">
                        <span className="text-[10px] text-muted-foreground block">Produto</span>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <span className="text-foreground truncate">{r.rawProd || '—'}</span>
                          {r.isProductMissing && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openQuickProduct(r.rawProd)}
                              className="h-6 text-[10px] px-2 gap-1 text-emerald-600 shrink-0"
                            >
                              <PackagePlus className="w-3 h-3" /> Cadastrar
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t text-xs">
                        <div className="flex flex-wrap gap-1">
                          {r.isDuplicate && (
                            <Badge
                              variant="outline"
                              className="text-[9px] bg-amber-100 text-amber-800"
                            >
                              Duplicata
                            </Badge>
                          )}
                          {r.isClientMissing && (
                            <Badge
                              variant="outline"
                              className="text-[9px] bg-rose-100 text-rose-800"
                            >
                              Cliente ausente
                            </Badge>
                          )}
                          {r.isProductMissing && (
                            <Badge
                              variant="outline"
                              className="text-[9px] bg-rose-100 text-rose-800"
                            >
                              Produto ausente
                            </Badge>
                          )}
                          {!r.hasProblem && !r.isDuplicate && (
                            <Badge
                              variant="outline"
                              className="text-[9px] bg-emerald-100 text-emerald-800"
                            >
                              Válida
                            </Badge>
                          )}
                        </div>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {r.value && r.value > 0
                            ? `R$ ${r.value.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Indicador de Salvamento em Progresso */}
              {importing && saveProgress && (
                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-primary">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gravando faturamento no banco de dados...
                    </span>
                    <span className="font-mono">
                      Gravando {saveProgress.current} de {saveProgress.total}...
                    </span>
                  </div>
                  <div className="w-full bg-primary/20 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-200"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (saveProgress.current / Math.max(1, saveProgress.total)) * 100,
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Botões de Ação Definitivos (Nada é salvo sem confirmação explícita) */}
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
                      {saveProgress
                        ? `Gravando ${saveProgress.current} de ${saveProgress.total}...`
                        : 'Gravando importação...'}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirmar e importar ({validRowsToImport.length} registros)
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
                <CardTitle className="text-lg">Importação Concluída com Sucesso</CardTitle>
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
                  <XCircle className="w-3.5 h-3.5 text-rose-600" /> Com Erro / Puladas
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
                  <AlertCircle className="w-4 h-4" /> Detalhamento das linhas com alerta ou erro:
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

      {/* ========================================================
          MODAL: CADASTRO RÁPIDO DE CLIENTE (Inline)
         ======================================================== */}
      <Dialog open={quickClientModalOpen} onOpenChange={setQuickClientModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Cadastrar Cliente Rápido
            </DialogTitle>
            <DialogDescription>
              Insira os dados essenciais para cadastrar o cliente na base e vincular ao faturamento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label htmlFor="qc-name">Razão Social / Nome *</Label>
              <Input
                id="qc-name"
                value={quickClientName}
                onChange={(e) => setQuickClientName(e.target.value)}
                placeholder="Ex: Frigorífico Estrela D'Alva"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="qc-cnpj">CNPJ</Label>
              <Input
                id="qc-cnpj"
                value={quickClientCnpj}
                onChange={(e) => setQuickClientCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="qc-city">Cidade</Label>
                <Input
                  id="qc-city"
                  value={quickClientCity}
                  onChange={(e) => setQuickClientCity(e.target.value)}
                  placeholder="Ex: Chapecó"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qc-state">Estado (UF)</Label>
                <Input
                  id="qc-state"
                  maxLength={2}
                  value={quickClientState}
                  onChange={(e) => setQuickClientState(e.target.value.toUpperCase())}
                  placeholder="SC"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={savingQuickEntity}
              onClick={() => setQuickClientModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={savingQuickEntity || !quickClientName.trim()}
              onClick={handleSaveQuickClient}
              className="gap-2"
            >
              {savingQuickEntity ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Cadastrar Cliente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          MODAL: CADASTRO RÁPIDO DE PRODUTO (Inline)
         ======================================================== */}
      <Dialog open={quickProductModalOpen} onOpenChange={setQuickProductModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-emerald-600" /> Cadastrar Produto Rápido
            </DialogTitle>
            <DialogDescription>
              Cadastre o produto no catálogo com o mesmo padrão e validação da aba Produtos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label htmlFor="qp-code">Código do Produto *</Label>
              <Input
                id="qp-code"
                value={quickProductCode}
                onChange={(e) => setQuickProductCode(e.target.value.toUpperCase())}
                placeholder="Ex: PRD-001"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="qp-name">Nome do Produto *</Label>
              <Input
                id="qp-name"
                value={quickProductName}
                onChange={(e) => setQuickProductName(e.target.value)}
                placeholder="Ex: Desinfetante Concentrado Clorado 5L"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={savingQuickEntity}
              onClick={() => setQuickProductModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={savingQuickEntity || !quickProductCode.trim() || !quickProductName.trim()}
              onClick={handleSaveQuickProduct}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {savingQuickEntity ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Cadastrar Produto
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
