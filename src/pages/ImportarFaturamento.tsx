import { useState, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Download,
  ArrowLeft,
  Layers,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserPlus,
  Building2,
  Check,
  HelpCircle,
  DollarSign,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  FATURAMENTO_FIELDS,
  autoSuggestMapping,
  parseDateBR,
  parseClientName,
  parseProductDesc,
  parseFaturamentoPreview,
  importFaturamento,
  downloadFaturamentoTemplate,
  type FaturamentoFieldKey,
  type FaturamentoImportResult,
} from '@/services/import-faturamento'
import { useDataSyncContext } from '@/hooks/useDataSync'

export default function ImportarFaturamento() {
  const { notifyDataChanged } = useDataSyncContext()
  const [file, setFile] = useState<File | null>(null)
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([])
  const [mapping, setMapping] = useState<Record<string, FaturamentoFieldKey | ''>>({})
  const [autoCreateClients, setAutoCreateClients] = useState(true)

  const [loadingFile, setLoadingFile] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<FaturamentoImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setFile(null)
    setSheetHeaders([])
    setPreviewRows([])
    setMapping({})
    setResult(null)
    setError(null)
    setLoadingFile(false)
    setImporting(false)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    const ext = selected.name.split('.').pop()?.toLowerCase()
    if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') {
      toast.error('Apenas arquivos .xlsx, .xls ou .csv são suportados')
      return
    }
    if (selected.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máximo 20MB)')
      return
    }

    setFile(selected)
    setResult(null)
    setError(null)
    setLoadingFile(true)

    try {
      const { headers, rows } = await parseFaturamentoPreview(selected, 8)
      setSheetHeaders(headers)
      setPreviewRows(rows)

      // Sugestão automática resiliente
      const suggested = autoSuggestMapping(headers)
      setMapping(suggested)

      toast.success(
        `Arquivo lido com sucesso! ${headers.length} colunas identificadas. Mapeamento sugerido aplicado.`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar arquivo'
      setError(msg)
      toast.error(msg)
      setSheetHeaders([])
      setPreviewRows([])
    } finally {
      setLoadingFile(false)
    }
  }

  const handleMappingChange = (header: string, crmField: FaturamentoFieldKey | 'none') => {
    setMapping((prev) => ({
      ...prev,
      [header]: crmField === 'none' ? '' : crmField,
    }))
  }

  // Validação dos campos obrigatórios e da regra de valor (USD ou R$)
  const mappedCrmFields = useMemo(() => {
    return new Set(Object.values(mapping).filter((v): v is FaturamentoFieldKey => !!v))
  }, [mapping])

  const hasMappedValue = useMemo(() => {
    return mappedCrmFields.has('valor_usd') || mappedCrmFields.has('valor')
  }, [mappedCrmFields])

  const missingRequiredFields = useMemo(() => {
    const missing = FATURAMENTO_FIELDS.filter((f) => f.required && !mappedCrmFields.has(f.key))
    return missing
  }, [mappedCrmFields])

  const validationErrors = useMemo(() => {
    const list: string[] = []
    if (missingRequiredFields.length > 0) {
      list.push(...missingRequiredFields.map((f) => f.label))
    }
    if (!hasMappedValue) {
      list.push('Ao menos um campo de valor: "Valor Total (USD $)" ou "Valor Total (R$)"')
    }
    return list
  }, [missingRequiredFields, hasMappedValue])

  const isValidToImport = useMemo(() => {
    return file && validationErrors.length === 0 && !importing
  }, [file, validationErrors, importing])

  const handleConfirmImport = async () => {
    if (!file) return
    if (validationErrors.length > 0) {
      toast.error(`Campos pendentes para importação: ${validationErrors.join(', ')}`)
      return
    }

    setImporting(true)
    setError(null)

    try {
      const res = await importFaturamento(file, mapping, {
        criarClienteNaoEncontrado: autoCreateClients,
      })
      setResult(res)

      if (res.success) {
        toast.success(
          `Importação concluída com sucesso! ${res.criados} pedidos gravados e ${res.clientesAtualizadosNoCRM} clientes atualizados.`,
        )
        // Notifica central de sincronização
        notifyDataChanged('faturamento')
        notifyDataChanged('historico_vendas')
        notifyDataChanged('factories')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar importação no servidor'
      setError(msg)
      toast.error(msg)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header com Navegação e Ações */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary p-2.5 rounded-xl border border-primary/20 shadow-sm">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Importar Faturamento</h1>
              <Badge
                variant="outline"
                className="bg-primary/5 text-primary border-primary/20 text-xs"
              >
                Mapeamento Flexível
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Carregue a planilha de faturamento/pedidos em carteira com mapeamento dinâmico de
              colunas e sincronização automática do CRM.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link to="/importar-clientes">
              <ArrowLeft className="w-4 h-4" /> Importar Clientes
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={downloadFaturamentoTemplate}
          >
            <Download className="w-4 h-4" /> Baixar Planilha Modelo
          </Button>
        </div>
      </div>

      {/* Passo 1: Upload */}
      <Card className="shadow-subtle border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              1
            </span>
            Upload da Planilha de Faturamento
          </CardTitle>
          <CardDescription>
            Selecione o arquivo Excel (.xlsx, .xls ou .csv) contendo os pedidos faturados em
            carteira.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 text-center cursor-pointer hover:border-primary/60 hover:bg-muted/30 transition-all group"
          >
            <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground group-hover:text-primary transition-colors mb-3" />
            <p className="text-sm font-semibold text-foreground">
              {file ? file.name : 'Clique ou arraste a planilha aqui para enviar'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Compatível com .xlsx, .xls ou .csv (sem limites de colunas ou posições fixas)
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loadingFile && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Lendo cabeçalhos e montando prévia...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Passo 2: Mapeamento de Colunas */}
      {file && sheetHeaders.length > 0 && !result && (
        <Card className="shadow-subtle border-border">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    2
                  </span>
                  Mapeamento de Colunas da Planilha para o CRM
                </CardTitle>
                <CardDescription>
                  Associe cada coluna detectada na sua planilha ao campo correspondente do CRM.
                  Campos com marcação de estrela são obrigatórios.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-lg border text-xs">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-muted-foreground">Auto-sugestão inteligente ativa</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Tabela de Mapeamento */}
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[35%] font-semibold">Coluna na sua Planilha</TableHead>
                    <TableHead className="w-[10%] text-center font-semibold">
                      Exemplo (Linha 1)
                    </TableHead>
                    <TableHead className="w-[55%] font-semibold">
                      Campo correspondente no CRM
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sheetHeaders.map((header) => {
                    const currentField = mapping[header] || ''
                    const sampleVal = previewRows[0]?.[header]
                    const fieldDef = FATURAMENTO_FIELDS.find((f) => f.key === currentField)

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
                            <span className="text-muted-foreground/50 italic">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Select
                              value={currentField || 'none'}
                              onValueChange={(val) =>
                                handleMappingChange(header, val as FaturamentoFieldKey | 'none')
                              }
                            >
                              <SelectTrigger className="h-9 w-full sm:w-[320px] text-xs">
                                <SelectValue placeholder="Ignorar esta coluna" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                <SelectItem value="none" className="text-muted-foreground text-xs">
                                  -- Não importar / Ignorar --
                                </SelectItem>
                                {FATURAMENTO_FIELDS.map((f) => {
                                  const isAssignedElsewhere = Object.entries(mapping).some(
                                    ([h, key]) => key === f.key && h !== header,
                                  )

                                  return (
                                    <SelectItem
                                      key={f.key}
                                      value={f.key}
                                      className="text-xs flex items-center justify-between"
                                    >
                                      <span>
                                        {f.label} {f.required && '★'}
                                      </span>
                                      {isAssignedElsewhere && (
                                        <span className="text-[10px] text-amber-600 ml-2">
                                          (já usado)
                                        </span>
                                      )}
                                    </SelectItem>
                                  )
                                })}
                              </SelectContent>
                            </Select>

                            {fieldDef && (
                              <span className="text-[11px] text-muted-foreground hidden md:inline">
                                {fieldDef.description}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Alertas de validação de mapeamento */}
            {validationErrors.length > 0 ? (
              <div className="flex items-start gap-2.5 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/50">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-semibold">Mapeamento pendente:</p>
                  <p className="mt-0.5">
                    Para garantir a consistência das vendas e do CRM, associe colunas para:{' '}
                    <strong>{validationErrors.join(' • ')}</strong>.
                  </p>
                  <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                    Dica: Você pode mapear tanto <strong>Valor Total (USD $)</strong> quanto{' '}
                    <strong>Valor Total (R$)</strong> juntos, ou apenas um deles conforme a
                    estrutura de sua planilha. O faturamento base do Blink é feito em Dólar.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/50">
                <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  Campos essenciais mapeados com sucesso!{' '}
                  {mappedCrmFields.has('valor_usd') && mappedCrmFields.has('valor')
                    ? 'Ambas as moedas (USD e R$) configuradas.'
                    : mappedCrmFields.has('valor_usd')
                      ? 'Base em Dólar (USD $) configurada.'
                      : 'Valor em Real (R$) configurado.'}
                </span>
              </div>
            )}

            {/* Configurações de Vinculação de Clientes */}
            <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="auto-create" className="text-sm font-semibold cursor-pointer">
                      Cadastrar automaticamente novos clientes se não encontrados
                    </Label>
                    <Badge variant="outline" className="text-[10px] bg-background">
                      Recomendado
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O importador busca o cliente primeiro por CNPJ exato e depois por Razão
                    Social/Nome normalizado. Se o cliente não existir no cadastro, cria-o
                    automaticamente avançando para estágio "Fechamento" (Ativo).
                  </p>
                </div>
                <Switch
                  id="auto-create"
                  checked={autoCreateClients}
                  onCheckedChange={setAutoCreateClients}
                />
              </div>

              {!autoCreateClients && (
                <div className="text-xs text-muted-foreground border-t pt-2.5 flex items-center gap-2">
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>
                    Com essa opção desativada, linhas sem cliente correspondente serão registradas
                    no Histórico de Vendas com o nome da planilha, mas marcadas para revisão manual.
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passo 3: Pré-visualização com dados mapeados */}
      {file && previewRows.length > 0 && !result && (
        <Card className="shadow-subtle border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                3
              </span>
              Pré-visualização dos Dados Mapeados
              <span className="text-xs font-normal text-muted-foreground">
                (primeiras {previewRows.length} linhas)
              </span>
            </CardTitle>
            <CardDescription>
              Confira como os valores serão interpretados antes de confirmar a gravação definitiva
              no banco PocketBase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-12 text-center text-xs">#</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">NF / Doc</TableHead>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-xs">CNPJ</TableHead>
                    <TableHead className="text-xs">Produto</TableHead>
                    <TableHead className="text-xs">Família</TableHead>
                    {mappedCrmFields.has('valor_usd') && (
                      <TableHead className="text-xs text-right text-emerald-700 dark:text-emerald-400">
                        Valor USD ($)
                      </TableHead>
                    )}
                    {mappedCrmFields.has('valor') && (
                      <TableHead className="text-xs text-right text-primary">Valor R$</TableHead>
                    )}
                    {!mappedCrmFields.has('valor_usd') && !mappedCrmFields.has('valor') && (
                      <TableHead className="text-xs text-right">Valor</TableHead>
                    )}
                    <TableHead className="text-xs">Vendedor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, idx) => {
                    // Extrair valores com base no mapeamento atual
                    const getValue = (key: FaturamentoFieldKey) => {
                      const header = Object.keys(mapping).find((h) => mapping[h] === key)
                      return header ? row[header] : undefined
                    }

                    // Formatação estrita conforme critérios de aceite do Passo 3:
                    // 1. DATA: docdate formatada DD/MM/AAAA (ou mes/ano se apenas mês)
                    const rawData = getValue('data')
                    const formattedData = parseDateBR(rawData)

                    // 2. NF/DOC: nf_ano (ou nf_ano_mes ou número doc)
                    const rawDoc = getValue('numero_documento')
                    const formattedDoc =
                      rawDoc !== undefined && rawDoc !== null && String(rawDoc).trim() !== ''
                        ? String(rawDoc).trim()
                        : '—'

                    // 3. CLIENTE: nome real do cliente (split no primeiro " - " de cliente_cod_descricao)
                    const rawCliente = getValue('cliente')
                    const formattedCliente = parseClientName(rawCliente)

                    // 4. CNPJ: cnpj ou '—'
                    const rawCnpj = getValue('cnpj')
                    const formattedCnpj =
                      rawCnpj !== undefined && rawCnpj !== null && String(rawCnpj).trim() !== ''
                        ? String(rawCnpj).trim()
                        : '—'

                    // 5. PRODUTO: descrição real do produto (split no primeiro " - " de item_codigo_descricao)
                    const rawProduto = getValue('produto')
                    const formattedProduto = parseProductDesc(rawProduto)

                    // 6. ESPÉCIE: família de produtos (vindo de familia_de_produtos / especie / familia_produto)
                    const rawEspecie = getValue('especie') ?? getValue('familia_produto')
                    const formattedEspecie =
                      rawEspecie !== undefined &&
                      rawEspecie !== null &&
                      String(rawEspecie).trim() !== ''
                        ? String(rawEspecie).trim()
                        : '—'

                    // 7. VALOR USD ($) e VALOR R$: preservar exibição exata
                    const rawUsd = getValue('valor_usd')
                    const rawBrl = getValue('valor')

                    return (
                      <TableRow key={idx}>
                        <TableCell className="text-xs text-muted-foreground text-center font-mono">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="text-xs font-mono whitespace-nowrap font-medium text-foreground">
                          {formattedData}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {formattedDoc}
                        </TableCell>
                        <TableCell
                          className="text-xs font-medium max-w-[200px] truncate"
                          title={formattedCliente}
                        >
                          {formattedCliente}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {formattedCnpj}
                        </TableCell>
                        <TableCell
                          className="text-xs max-w-[180px] truncate"
                          title={formattedProduto}
                        >
                          {formattedProduto}
                        </TableCell>
                        <TableCell className="text-xs">{formattedEspecie}</TableCell>
                        {mappedCrmFields.has('valor_usd') && (
                          <TableCell className="text-xs text-right font-semibold font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {rawUsd !== undefined && rawUsd !== null && String(rawUsd).trim() !== ''
                              ? String(rawUsd)
                              : '—'}
                          </TableCell>
                        )}
                        {mappedCrmFields.has('valor') && (
                          <TableCell className="text-xs text-right font-semibold font-mono text-primary whitespace-nowrap">
                            {rawBrl !== undefined && rawBrl !== null && String(rawBrl).trim() !== ''
                              ? String(rawBrl)
                              : '—'}
                          </TableCell>
                        )}
                        {!mappedCrmFields.has('valor_usd') && !mappedCrmFields.has('valor') && (
                          <TableCell className="text-xs text-right font-mono text-muted-foreground">
                            —
                          </TableCell>
                        )}
                        <TableCell className="text-xs text-muted-foreground">
                          {String(getValue('vendedor') ?? '—')}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <Button
                variant="outline"
                onClick={reset}
                className="gap-2 w-full sm:w-auto"
                disabled={importing}
              >
                <RotateCcw className="w-4 h-4" /> Cancelar / Novo Arquivo
              </Button>

              <Button
                onClick={handleConfirmImport}
                disabled={!isValidToImport}
                className="gap-2 w-full sm:w-auto bg-primary hover:bg-primary/90 shadow-sm font-semibold"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando e Sincronizando CRM...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar e Importar Faturamento
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passo 4: Relatório Detalhado de Importação */}
      {result && (
        <Card className="shadow-subtle border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Relatório Consolidado de Importação</CardTitle>
                <CardDescription>
                  Processamento concluído. O CRM e o Histórico de Vendas foram sincronizados em
                  tempo real.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Cards de Métricas Principais */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-muted/40 rounded-xl p-3.5 border text-center">
                <p className="text-xs text-muted-foreground">Total de Linhas</p>
                <p className="text-2xl font-bold mt-1">{result.totalLinhas}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3.5 border border-emerald-200 dark:border-emerald-900/40 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Faturamento Gravado
                </p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  {result.faturamentoImportados ?? result.criados}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">coleção faturamento</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3.5 border border-blue-200 dark:border-blue-900/40 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5 text-blue-600" /> Duplicatas Ignoradas
                </p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {result.faturamentoDuplicatas ?? result.duplicatasIgnoradas ?? 0}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">idempotência ativa</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-3.5 border border-purple-200 dark:border-purple-900/40 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-purple-600" /> Clientes Vinculados
                </p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {result.clientesVinculados}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">casados com cadastro</p>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-xl p-3.5 border border-indigo-200 dark:border-indigo-900/40 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <UserPlus className="w-3.5 h-3.5 text-indigo-600" /> Clientes Novos
                </p>
                <p className="text-2xl font-bold text-indigo-600 mt-1">{result.clientesCriados}</p>
                <p className="text-[10px] text-muted-foreground mt-1">com nome limpo</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3.5 border border-amber-200 dark:border-amber-900/40 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-amber-600" /> CRM Atualizado
                </p>
                <p className="text-2xl font-bold text-amber-600 mt-1">
                  {result.clientesAtualizadosNoCRM}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">cadastros sincronizados</p>
              </div>
            </div>

            {/* Informações sobre as Moedas Processadas */}
            <div className="rounded-xl border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-semibold text-emerald-950 dark:text-emerald-200 uppercase tracking-wider">
                  Moedas e Base de Faturamento
                </h4>
              </div>
              <p className="text-xs text-muted-foreground">
                A importação salvou os registros de faturamento mantendo colunas distintas de{' '}
                <strong>USD ($)</strong> e <strong>Real (R$)</strong>. Para o cálculo do perfil do
                cliente (<code>valor_atual</code> e <code>valor_medio</code> no CRM), o valor em
                Dólar foi priorizado como base oficial de faturamento do Blink.
              </p>
            </div>
            {/* Detalhamento dos Métodos de Casamento (Matching) */}
            <div className="rounded-xl border bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/40 p-4">
              <h4 className="text-xs font-semibold text-purple-950 dark:text-purple-200 uppercase tracking-wider flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Métricas de Casamento e Vinculação de Clientes (Matching)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-background/80 dark:bg-background/40 rounded-lg p-3 border border-purple-100 dark:border-purple-900/30 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">
                      Por Código de Cliente
                    </p>
                    <p className="text-[11px] text-muted-foreground">Extraído do campo ou nome</p>
                  </div>
                  <span className="text-xl font-bold text-purple-700 dark:text-purple-300 font-mono">
                    {result.clientesVinculadosPorCodigo ?? 0}
                  </span>
                </div>
                <div className="bg-background/80 dark:bg-background/40 rounded-lg p-3 border border-purple-100 dark:border-purple-900/30 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">
                      Por Razão Social / Nome
                    </p>
                    <p className="text-[11px] text-muted-foreground">Normalizado sem acentos</p>
                  </div>
                  <span className="text-xl font-bold text-purple-700 dark:text-purple-300 font-mono">
                    {result.clientesVinculadosPorNome ?? 0}
                  </span>
                </div>
                <div className="bg-background/80 dark:bg-background/40 rounded-lg p-3 border border-purple-100 dark:border-purple-900/30 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Por CNPJ</p>
                    <p className="text-[11px] text-muted-foreground">14 dígitos numéricos</p>
                  </div>
                  <span className="text-xl font-bold text-purple-700 dark:text-purple-300 font-mono">
                    {result.clientesVinculadosPorCnpj ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Resumo dos Efeitos nos Dados do CRM */}
            <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Impacto Automático nos Dados do CRM Blink:
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>
                  <strong>Reconhecimento Inteligente de Clientes:</strong> Separou o código
                  cadastral do nome da empresa (ex: <code>1234 - Master Premix Nutrição Ltda</code>
                  ). Vinculou{' '}
                  <strong>{result.clientesVinculadosPorCodigo ?? 0} clientes por código</strong>,{' '}
                  <strong>
                    {result.clientesVinculadosPorNome ?? 0} clientes por nome normalizado
                  </strong>{' '}
                  e <strong>{result.clientesVinculadosPorCnpj ?? 0} por CNPJ</strong>.
                </li>
                <li>
                  <strong>Atualização do Último Pedido:</strong> O campo <code>ultimo_pedido</code>{' '}
                  dos clientes foi atualizado com a data calculada (incluindo meses anteriores de
                  2025).
                </li>
                <li>
                  <strong>Avanço de Estágio do Funil:</strong> Clientes com pedidos avançaram para{' '}
                  <code>Fechamento</code> e status <strong>Ativo</strong>.
                </li>
                <li>
                  <strong>Valores nas Moedas USD e R$:</strong> Gravação independente de{' '}
                  <code>valor_usd</code> (base de faturamento em Dólar) e <code>valor</code> (R$),{' '}
                  assegurando integridade das métricas do cliente e comparativos comerciais.
                </li>
                <li>
                  <strong>População da Coleção de Faturamento:</strong> Os registros foram gravados
                  diretamente na coleção <code>faturamento</code> (
                  <strong>{result.faturamentoImportados ?? result.criados} importados</strong> e{' '}
                  <strong>{result.faturamentoDuplicatas ?? 0} duplicatas ignoradas</strong>),
                  alimentando os painéis executivos, Resumo de Vendas, Maestro Semanal e Maestro
                  Mensal.
                </li>
                <li>
                  <strong>Reflexo em Relatórios e Dashboards:</strong> Os pedidos alimentam o
                  Histórico de Vendas, agrupados pelos meses/anos correspondentes (ex:
                  Janeiro/2025), refletindo nas análises de faturamento e comparativos anuais.
                </li>
                <li>
                  <strong>Log de Auditoria Consolidado:</strong> 1 único evento de auditoria
                  consolidado foi gravado, preservando a performance do sistema.
                </li>
              </ul>
            </div>

            {/* Tabela de Erros / Alertas se houver */}
            {result.erros && result.erros.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Linhas que não puderam ser importadas (
                  {result.erros.length}):
                </p>
                <div className="max-h-56 overflow-y-auto space-y-1 border rounded-lg p-2 bg-destructive/5">
                  {result.erros.map((err, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-destructive flex items-start gap-2 py-0.5"
                    >
                      <span className="font-mono font-semibold">Linha {err.linha}:</span>
                      <span>{err.erro}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ações pós-importação */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button onClick={reset} variant="outline" className="gap-2">
                <RotateCcw className="w-4 h-4" /> Importar Outro Arquivo
              </Button>
              <Button asChild variant="default" className="gap-2">
                <Link to="/historico-vendas">
                  <TrendingUp className="w-4 h-4" /> Acessar Histórico de Vendas
                </Link>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link to="/funil-vendas">
                  <Layers className="w-4 h-4" /> Conferir Funil de Vendas
                </Link>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link to="/cadastro">
                  <Building2 className="w-4 h-4" /> Ver Clientes (Cadastro)
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
