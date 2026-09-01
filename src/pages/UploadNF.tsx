import React, { useRef, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCw,
  Trash2,
  Save,
  Check,
  ChevronRight,
  Sparkles,
  ArrowRight,
  PackageCheck,
  Layers,
  Plus,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { useUploadNF, type UploadFileItem } from '@/hooks/useUploadNF'
import {
  ESPECIE_DESTINO_OPTIONS,
  CANAL_VENDAS_OPTIONS,
  type ParsedNFData,
  type ParsedItem,
} from '@/services/nfService'
import { formatCurrency } from '@/lib/utils'

export function UploadNF() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [activeTab, setActiveTab] = useState<'upload' | 'revisao' | 'resumo'>('upload')

  const {
    files,
    currentFileIndex,
    activeFile,
    gestoresTecnicos,
    vendedores,
    catalogCodes,
    error,
    addFiles,
    removeFile,
    retryFile,
    setCurrentFileIndex,
    updateExtractedData,
    saveNF,
    discardFile,
  } = useUploadNF()

  // Handle Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files)
      addFiles(droppedFiles)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files)
      addFiles(selected)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Active file data shortcuts
  const extracted = activeFile?.extractedData || null

  // Check if CRM required fields are completed
  const isCrmComplete = useMemo(() => {
    if (!extracted) return false
    return !!(
      extracted.especie_destino &&
      extracted.canal_vendas &&
      extracted.gestor_tecnico_id &&
      extracted.vendedor_id &&
      extracted.numero_nf &&
      extracted.valor_total_nota !== null &&
      extracted.valor_total_nota !== undefined &&
      extracted.valor_total_nota > 0
    )
  }, [extracted])

  // Batch summary calculations
  const totalProcessadas = files.filter((f) => f.status === 'concluido').length
  const totalErros = files.filter((f) => f.status === 'error').length
  const totalValorImportado = useMemo(() => {
    return files
      .filter((f) => f.status === 'concluido' && f.extractedData)
      .reduce((sum, f) => sum + (f.extractedData?.valor_total_nota || 0), 0)
  }, [files])

  // Handlers for confirming import / draft / discard
  const handleConfirmarImportacao = async (fileItem: UploadFileItem) => {
    try {
      await saveNF(fileItem.id, false)
      toast({
        title: 'Sucesso!',
        description: `Nota fiscal ${fileItem.extractedData?.numero_nf || ''} importada com sucesso!`,
      })
      // If there are other ready files, jump to next or summary
      const nextIndex = files.findIndex((f) => f.id !== fileItem.id && f.status === 'ready')
      if (nextIndex !== -1) {
        setCurrentFileIndex(nextIndex)
      } else {
        setActiveTab('resumo')
      }
    } catch (err: unknown) {
      const msg =
        (err instanceof Error ? err.message : '') ||
        'Preencha todos os campos obrigatorios antes de confirmar.'
      toast({
        title: 'Erro na importação',
        description: msg,
        variant: 'destructive',
      })
    }
  }

  const handleSalvarRascunho = async (fileItem: UploadFileItem) => {
    try {
      await saveNF(fileItem.id, true)
      toast({
        title: 'Rascunho salvo',
        description: `Nota fiscal ${fileItem.extractedData?.numero_nf || ''} salva como rascunho.`,
      })
      const nextIndex = files.findIndex((f) => f.id !== fileItem.id && f.status === 'ready')
      if (nextIndex !== -1) {
        setCurrentFileIndex(nextIndex)
      } else {
        setActiveTab('resumo')
      }
    } catch (err: unknown) {
      const msg =
        (err instanceof Error ? err.message : '') ||
        'Erro ao gravar no banco de dados. Verifique os dados e tente novamente.'
      toast({
        title: 'Erro ao salvar rascunho',
        description: msg,
        variant: 'destructive',
      })
    }
  }

  const handleDescartar = async (fileItem: UploadFileItem) => {
    try {
      await discardFile(fileItem.id)
      toast({
        title: 'Arquivo descartado',
        description: 'O PDF enviado foi removido do armazenamento.',
      })
    } catch (err: unknown) {
      console.warn('Erro ao descartar:', err)
    } finally {
      const remaining = files.filter((f) => f.id !== fileItem.id)
      if (remaining.length === 0) {
        setActiveTab('upload')
      } else {
        setCurrentFileIndex(0)
      }
    }
  }

  // Update item in table
  const handleItemChange = (index: number, field: keyof ParsedItem, val: string | number) => {
    if (!activeFile || !extracted) return
    const currentItens = [...(extracted.itens || [])]
    const item = { ...currentItens[index], [field]: val }
    if (field === 'produto_quantidade' || field === 'produto_valor_unitario') {
      const q =
        field === 'produto_quantidade' ? Number(val) || 0 : Number(item.produto_quantidade) || 0
      const u =
        field === 'produto_valor_unitario'
          ? Number(val) || 0
          : Number(item.produto_valor_unitario) || 0
      item.produto_valor_total = q * u
    }
    currentItens[index] = item
    updateExtractedData(activeFile.id, { itens: currentItens })
  }

  const handleAddItem = () => {
    if (!activeFile || !extracted) return
    const currentItens = [...(extracted.itens || [])]
    currentItens.push({
      produto_codigo: 'BPMI.NOVO',
      produto_descricao: 'Novo Item Adicionado',
      produto_ncm: '2309.90.90',
      produto_cst: '100',
      produto_cfop: '6102',
      produto_unidade: 'KG',
      produto_quantidade: 1,
      produto_valor_unitario: 0,
      produto_valor_total: 0,
      bc_icms: 0,
      valor_icms: 0,
      aliq_icms: 0,
      valor_ipi: 0,
      aliq_ipi: 0,
      lotes: [],
    })
    updateExtractedData(activeFile.id, { itens: currentItens })
  }

  const handleRemoveItem = (index: number) => {
    if (!activeFile || !extracted) return
    const currentItens = [...(extracted.itens || [])]
    currentItens.splice(index, 1)
    updateExtractedData(activeFile.id, { itens: currentItens })
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Upload de Notas Fiscais (NF-e DANFE)
            </h1>
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold"
            >
              Skip Cloud AI
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Importação e extração automática de DANFE em PDF com auto-atribuição de equipe e
            cadastro imediato no sistema.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === 'upload' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('upload')}
            className="gap-1.5"
          >
            <Upload className="w-4 h-4" /> Arquivos ({files.length})
          </Button>
          {files.length > 0 && (
            <Button
              variant={activeTab === 'revisao' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('revisao')}
              className="gap-1.5"
            >
              <FileText className="w-4 h-4" /> Revisão
            </Button>
          )}
          {files.some((f) => f.status === 'concluido') && (
            <Button
              variant={activeTab === 'resumo' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('resumo')}
              className="gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Resumo do Lote
            </Button>
          )}
        </div>
      </div>

      {/* Global error banner */}
      {error && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SEÇÃO 1: ÁREA DE UPLOAD (DRAG & DROP E LISTA) */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          <Card className="border-dashed border-2 transition-colors duration-150">
            <CardContent
              className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center transition-colors cursor-pointer ${
                isDragging ? 'bg-primary/5 border-primary' : 'bg-card'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Arraste arquivos PDF de notas fiscais aqui
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mb-4">
                Aceita apenas arquivos PDF de NF-e formato DANFE (máximo 10MB por arquivo). Suporta
                processamento em lote.
              </p>
              <Button
                type="button"
                variant="default"
                className="gap-2 shadow-sm pointer-events-none"
              >
                <Upload className="w-4 h-4" /> Selecionar arquivos
              </Button>
            </CardContent>
          </Card>

          {/* Lista de Arquivos no Lote */}
          {files.length > 0 && (
            <Card className="shadow-subtle">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Arquivos no Lote ({files.length})</CardTitle>
                  <CardDescription>
                    Status do processamento individual de cada DANFE
                  </CardDescription>
                </div>
                {files.some((f) => f.status === 'ready') && (
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      const idx = files.findIndex((f) => f.status === 'ready')
                      if (idx !== -1) setCurrentFileIndex(idx)
                      setActiveTab('revisao')
                    }}
                  >
                    Ir para Revisão <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {files.map((item, index) => {
                  const isCur = index === currentFileIndex
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg border transition-all ${
                        isCur
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border bg-card hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="p-2 rounded bg-muted shrink-0 text-muted-foreground mt-0.5">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-foreground truncate max-w-xs sm:max-w-md">
                                {item.file.name}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                ({(item.file.size / (1024 * 1024)).toFixed(2)} MB)
                              </span>
                            </div>

                            {/* Status badge */}
                            <div className="flex items-center gap-2 mt-1">
                              {item.status === 'uploading' && (
                                <Badge
                                  variant="secondary"
                                  className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 animate-pulse text-[11px]"
                                >
                                  Enviando...
                                </Badge>
                              )}
                              {item.status === 'parsing' && (
                                <Badge
                                  variant="secondary"
                                  className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 animate-pulse text-[11px]"
                                >
                                  <RotateCw className="w-3 h-3 animate-spin mr-1" /> Processando...
                                </Badge>
                              )}
                              {item.status === 'ready' && (
                                <Badge
                                  variant="secondary"
                                  className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[11px]"
                                >
                                  <Check className="w-3 h-3 mr-1" /> Pronto para Revisão
                                </Badge>
                              )}
                              {item.status === 'saving' && (
                                <Badge
                                  variant="secondary"
                                  className="bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 animate-pulse text-[11px]"
                                >
                                  Gravando...
                                </Badge>
                              )}
                              {item.status === 'concluido' && (
                                <Badge
                                  variant="secondary"
                                  className="bg-emerald-500 text-white text-[11px]"
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Concluido
                                </Badge>
                              )}
                              {item.status === 'error' && (
                                <Badge variant="destructive" className="text-[11px]">
                                  <AlertCircle className="w-3 h-3 mr-1" /> Erro
                                </Badge>
                              )}

                              {item.extractedData?.numero_nf && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  NF #{item.extractedData.numero_nf}
                                </span>
                              )}
                              {item.extractedData?.destinatario_nome && (
                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  · {item.extractedData.destinatario_nome}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {item.status === 'ready' && (
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-1.5 h-8 text-xs"
                              onClick={() => {
                                setCurrentFileIndex(index)
                                setActiveTab('revisao')
                              }}
                            >
                              Revisar <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          )}

                          {item.status === 'error' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 h-8 text-xs text-destructive border-destructive/20 hover:bg-destructive/10"
                              onClick={() => retryFile(item.id)}
                            >
                              <RotateCw className="w-3.5 h-3.5" /> Tentar novamente
                            </Button>
                          )}

                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeFile(item.id)}
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Progress bar or error message */}
                      {item.status !== 'ready' &&
                        item.status !== 'concluido' &&
                        item.status !== 'error' && (
                          <div className="mt-3">
                            <Progress value={item.progress} className="h-1.5" />
                          </div>
                        )}

                      {item.status === 'error' && (
                        <div className="mt-2 text-xs text-destructive flex items-center gap-1.5 bg-destructive/5 p-2 rounded">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{item.errorMessage || `Erro ao processar ${item.file.name}.`}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* SEÇÃO 3: FORMULÁRIO DE REVISÃO (POR NF) */}
      {activeTab === 'revisao' && (
        <div className="space-y-6">
          {/* File selector pill tabs if multiple files */}
          {files.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {files.map((f, idx) => (
                <Button
                  key={f.id}
                  variant={idx === currentFileIndex ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentFileIndex(idx)}
                  className="gap-1.5 shrink-0 text-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[140px]">{f.file.name}</span>
                  {f.status === 'concluido' && <Check className="w-3 h-3 text-emerald-300" />}
                  {f.status === 'error' && <AlertCircle className="w-3 h-3 text-red-300" />}
                </Button>
              ))}
            </div>
          )}

          {!activeFile ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Nenhum arquivo selecionado para revisão.
              </CardContent>
            </Card>
          ) : activeFile.status === 'uploading' || activeFile.status === 'parsing' ? (
            // UX STATE 1: LOADING SKELETON
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-72" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            </div>
          ) : !extracted ? (
            // UX STATE 3: ERROR
            <Card className="border-destructive/30">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Erro ao extrair dados da NF
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                    {activeFile.errorMessage ||
                      'Erro ao extrair dados da NF. Verifique se o arquivo e um DANFE valido.'}
                  </p>
                </div>
                <div className="flex justify-center gap-3">
                  <Button variant="outline" onClick={() => retryFile(activeFile.id)}>
                    <RotateCw className="w-4 h-4 mr-2" /> Tentar novamente
                  </Button>
                  <Button variant="destructive" onClick={() => handleDescartar(activeFile)}>
                    <Trash2 className="w-4 h-4 mr-2" /> Descartar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            // FULL REVIEW FORM
            <div className="space-y-6">
              {/* Summary Bar */}
              <div className="p-4 rounded-lg bg-card border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-subtle">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-foreground">
                        DANFE NF-e #{extracted.numero_nf || 'Sem número'}
                      </h2>
                      <Badge variant="outline" className="font-mono text-xs">
                        Série {extracted.serie || '1'}
                      </Badge>
                      {activeFile.status === 'concluido' && (
                        <Badge className="bg-emerald-500 text-white text-xs">Importada</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Arquivo: {activeFile.file.name} ·{' '}
                      {extracted.destinatario_nome || 'Cliente não identificado'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <span className="text-xs text-muted-foreground block">Valor Total</span>
                    <span className="text-xl font-bold text-primary">
                      {formatCurrency(extracted.valor_total_nota || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* BLOCO D — CAMPOS CRM (MANDATÓRIO ANTES DE CONFIRMAR) */}
              <Card className="border-primary/40 bg-gradient-to-b from-primary/[0.03] to-card shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                      <CardTitle className="text-base font-semibold">
                        Bloco D — Classificação CRM & Atribuição de Equipe
                      </CardTitle>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Obrigatório para Confirmação
                    </Badge>
                  </div>
                  <CardDescription>
                    Defina a espécie animal, o canal de vendas e os responsáveis da equipe
                    técnica/comercial.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Especie Destino */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      Espécie de Destino <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={extracted.especie_destino || ''}
                      onValueChange={(val) =>
                        updateExtractedData(activeFile.id, {
                          especie_destino: val as ParsedNFData['especie_destino'],
                        })
                      }
                    >
                      <SelectTrigger
                        className={
                          !extracted.especie_destino
                            ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20'
                            : ''
                        }
                      >
                        <SelectValue placeholder="Selecione a espécie..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ESPECIE_DESTINO_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Canal de Vendas */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      Canal de Vendas <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={extracted.canal_vendas || ''}
                      onValueChange={(val) =>
                        updateExtractedData(activeFile.id, {
                          canal_vendas: val as ParsedNFData['canal_vendas'],
                        })
                      }
                    >
                      <SelectTrigger
                        className={
                          !extracted.canal_vendas
                            ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20'
                            : ''
                        }
                      >
                        <SelectValue placeholder="Selecione o canal..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CANAL_VENDAS_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Gestor Técnico */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      Gestor Técnico <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={extracted.gestor_tecnico_id || ''}
                      onValueChange={(val) =>
                        updateExtractedData(activeFile.id, { gestor_tecnico_id: val })
                      }
                    >
                      <SelectTrigger
                        className={
                          !extracted.gestor_tecnico_id
                            ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20'
                            : ''
                        }
                      >
                        <SelectValue placeholder="Selecione o gestor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {gestoresTecnicos.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Vendedor */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      Vendedor <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={extracted.vendedor_id || ''}
                      onValueChange={(val) =>
                        updateExtractedData(activeFile.id, { vendedor_id: val })
                      }
                    >
                      <SelectTrigger
                        className={
                          !extracted.vendedor_id
                            ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20'
                            : ''
                        }
                      >
                        <SelectValue placeholder="Selecione o vendedor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {vendedores.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* BLOCO A — CABEÇALHO */}
              <Card className="shadow-subtle">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">
                    Bloco A — Cabeçalho da Nota Fiscal
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Número NF</Label>
                    <Input
                      value={extracted.numero_nf || ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, { numero_nf: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Série</Label>
                    <Input
                      value={extracted.serie || ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, { serie: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data de Emissão</Label>
                    <Input
                      type="date"
                      value={extracted.data_emissao || ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, { data_emissao: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Natureza da Operação</Label>
                    <Input
                      value={extracted.natureza_operacao || ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, { natureza_operacao: e.target.value })
                      }
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4 space-y-1.5">
                    <Label className="text-xs">Chave de Acesso (44 dígitos)</Label>
                    <Input
                      className="font-mono text-xs tracking-wider"
                      value={extracted.chave_acesso || ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, { chave_acesso: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center justify-between">
                      <span>
                        {extracted.valor_total_nota === null ||
                        extracted.valor_total_nota === undefined
                          ? 'Valor Total (preencher manualmente)'
                          : 'Valor Total da Nota'}
                      </span>
                      {(extracted.valor_total_nota === null ||
                        extracted.valor_total_nota === undefined) && (
                        <span className="text-destructive font-bold text-xs">*</span>
                      )}
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Informe o valor total da NF"
                        className={
                          extracted.valor_total_nota === null ||
                          extracted.valor_total_nota === undefined
                            ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30 dark:bg-amber-950/20'
                            : ''
                        }
                        value={extracted.valor_total_nota ?? ''}
                        onChange={(e) => {
                          const val = e.target.value.trim()
                          const parsedVal = val === '' ? null : parseFloat(val)
                          updateExtractedData(activeFile.id, {
                            valor_total_nota: isNaN(parsedVal as number) ? null : parsedVal,
                          })
                        }}
                      />
                      {extracted.valor_total_nota === null ||
                      extracted.valor_total_nota === undefined ? (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium block mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 inline shrink-0" />O valor total nao
                          foi extraido automaticamente. Preencha manualmente.
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground block mt-0.5">
                          {formatCurrency(extracted.valor_total_nota || 0)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor Total dos Produtos</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        value={extracted.valor_total_produtos ?? ''}
                        onChange={(e) =>
                          updateExtractedData(activeFile.id, {
                            valor_total_produtos: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        {formatCurrency(extracted.valor_total_produtos || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Aproximado Tributos</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        value={extracted.valor_aproximado_tributos ?? ''}
                        onChange={(e) =>
                          updateExtractedData(activeFile.id, {
                            valor_aproximado_tributos: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        {formatCurrency(extracted.valor_aproximado_tributos || 0)}
                      </span>
                    </div>
                  </div>{' '}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Protocolo de Autorização</Label>
                    <Input
                      value={extracted.protocolo_autorizacao || ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, {
                          protocolo_autorizacao: e.target.value,
                        })
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* BLOCO B — DESTINATÁRIO */}
              <Card className="shadow-subtle">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">
                    Bloco B — Destinatário / Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs">Nome / Razão Social</Label>
                    <Input
                      value={extracted.destinatario_nome || ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, { destinatario_nome: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">CNPJ</Label>
                    <Input
                      value={extracted.destinatario_cnpj || ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, { destinatario_cnpj: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Inscrição Estadual (IE)</Label>
                    <Input
                      value={extracted.destinatario_ie || ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, { destinatario_ie: e.target.value })
                      }
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs">Endereço</Label>
                    <Input
                      value={extracted.destinatario_endereco || ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, {
                          destinatario_endereco: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Bairro</Label>
                    <Input
                      value={extracted.destinatario_bairro || ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, { destinatario_bairro: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Município</Label>
                    <Input
                      value={extracted.destinatario_municipio || ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, {
                          destinatario_municipio: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">UF</Label>
                    <Input
                      maxLength={2}
                      className="uppercase"
                      value={extracted.destinatario_uf || ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, { destinatario_uf: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">CEP</Label>
                    <Input
                      value={extracted.destinatario_cep || ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, { destinatario_cep: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Telefone</Label>
                    <Input
                      value={extracted.destinatario_fone || ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, { destinatario_fone: e.target.value })
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* BLOCO C — IMPOSTOS, FRETE E FATURA */}
              <Card className="shadow-subtle">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">
                    Bloco C — Impostos, Frete, Transporte & Fatura
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Base de Cálculo ICMS</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        value={extracted.bc_icms ?? ''}
                        onChange={(e) =>
                          updateExtractedData(activeFile.id, {
                            bc_icms: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        {formatCurrency(extracted.bc_icms || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor ICMS</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        value={extracted.valor_icms ?? ''}
                        onChange={(e) =>
                          updateExtractedData(activeFile.id, {
                            valor_icms: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        {formatCurrency(extracted.valor_icms || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor Frete</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        value={extracted.valor_frete ?? ''}
                        onChange={(e) =>
                          updateExtractedData(activeFile.id, {
                            valor_frete: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        {formatCurrency(extracted.valor_frete || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor Seguro</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        value={extracted.valor_seguro ?? ''}
                        onChange={(e) =>
                          updateExtractedData(activeFile.id, {
                            valor_seguro: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        {formatCurrency(extracted.valor_seguro || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Desconto</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        value={extracted.desconto ?? ''}
                        onChange={(e) =>
                          updateExtractedData(activeFile.id, {
                            desconto: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        {formatCurrency(extracted.desconto || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Outras Despesas</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        value={extracted.outras_despesas ?? ''}
                        onChange={(e) =>
                          updateExtractedData(activeFile.id, {
                            outras_despesas: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        {formatCurrency(extracted.outras_despesas || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor IPI</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        value={extracted.valor_ipi ?? ''}
                        onChange={(e) =>
                          updateExtractedData(activeFile.id, {
                            valor_ipi: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        {formatCurrency(extracted.valor_ipi || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Modalidade do Frete</Label>
                    <Select
                      value={extracted.frete_modalidade || 'CIF'}
                      onValueChange={(val: 'CIF' | 'FOB') =>
                        updateExtractedData(activeFile.id, { frete_modalidade: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CIF">CIF (Emitente)</SelectItem>
                        <SelectItem value="FOB">FOB (Destinatário)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Qtd Volumes</Label>
                    <Input
                      type="number"
                      value={extracted.volumes_quantidade ?? ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, {
                          volumes_quantidade: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Espécie Volumes</Label>
                    <Input
                      value={extracted.volumes_especie || ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, { volumes_especie: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Peso Bruto (Kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={extracted.peso_bruto ?? ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, {
                          peso_bruto: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Peso Líquido (Kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={extracted.peso_liquido ?? ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, {
                          peso_liquido: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Número Fatura</Label>
                    <Input
                      value={extracted.fatura_numero || ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, { fatura_numero: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Vencimento Fatura</Label>
                    <Input
                      type="date"
                      value={extracted.fatura_vencimento || ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, { fatura_vencimento: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor Fatura</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        value={extracted.fatura_valor ?? ''}
                        onChange={(e) =>
                          updateExtractedData(activeFile.id, {
                            fatura_valor: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        {formatCurrency(extracted.fatura_valor || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Ordem de Compra</Label>
                    <Input
                      placeholder="Ex: OC 15040"
                      value={extracted.ordem_compra || ''}
                      onChange={(e) =>
                        updateExtractedData(activeFile.id, { ordem_compra: e.target.value })
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* BLOCO E — TABELA DE ITENS E LOTES */}
              <Card className="shadow-subtle">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Bloco E — Itens de Produtos & Lotes
                    </CardTitle>
                    <CardDescription>
                      Cada linha representa um item da DANFE com verificação automática no catálogo
                      da Blink.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddItem}
                    className="gap-1 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Linha
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px]">Código</TableHead>
                          <TableHead className="min-w-[200px]">Descrição</TableHead>
                          <TableHead className="w-[100px]">NCM</TableHead>
                          <TableHead className="w-[70px]">CST</TableHead>
                          <TableHead className="w-[70px]">CFOP</TableHead>
                          <TableHead className="w-[70px]">UN</TableHead>
                          <TableHead className="w-[90px] text-right">Qtd</TableHead>
                          <TableHead className="w-[110px] text-right">Vl. Unit</TableHead>
                          <TableHead className="w-[110px] text-right">Vl. Total</TableHead>
                          <TableHead className="w-[80px] text-right">BC ICMS</TableHead>
                          <TableHead className="w-[80px] text-right">Vl. ICMS</TableHead>
                          <TableHead className="w-[70px] text-right">Aliq %</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(extracted.itens || []).map((it, idx) => {
                          const cleanCode = (it.produto_codigo || '').trim().toUpperCase()
                          const isInCatalog = catalogCodes.has(cleanCode)

                          return (
                            <React.Fragment key={idx}>
                              <TableRow className="hover:bg-muted/30">
                                <TableCell className="font-mono text-xs">
                                  <div className="flex items-center gap-1.5">
                                    {isInCatalog ? (
                                      <span title="Produto cadastrado no catálogo">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                      </span>
                                    ) : (
                                      <span title="Produto nao cadastrado no catalogo">
                                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                      </span>
                                    )}
                                    <Input
                                      className="h-8 text-xs font-mono"
                                      value={it.produto_codigo}
                                      onChange={(e) =>
                                        handleItemChange(idx, 'produto_codigo', e.target.value)
                                      }
                                    />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    className="h-8 text-xs"
                                    value={it.produto_descricao}
                                    onChange={(e) =>
                                      handleItemChange(idx, 'produto_descricao', e.target.value)
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    className="h-8 text-xs font-mono"
                                    value={it.produto_ncm || ''}
                                    onChange={(e) =>
                                      handleItemChange(idx, 'produto_ncm', e.target.value)
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    className="h-8 text-xs font-mono"
                                    value={it.produto_cst || ''}
                                    onChange={(e) =>
                                      handleItemChange(idx, 'produto_cst', e.target.value)
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    className="h-8 text-xs font-mono"
                                    value={it.produto_cfop || ''}
                                    onChange={(e) =>
                                      handleItemChange(idx, 'produto_cfop', e.target.value)
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    className="h-8 text-xs uppercase"
                                    value={it.produto_unidade || 'KG'}
                                    onChange={(e) =>
                                      handleItemChange(idx, 'produto_unidade', e.target.value)
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-8 text-xs text-right"
                                    value={it.produto_quantidade}
                                    onChange={(e) =>
                                      handleItemChange(idx, 'produto_quantidade', e.target.value)
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-8 text-xs text-right"
                                    value={it.produto_valor_unitario}
                                    onChange={(e) =>
                                      handleItemChange(
                                        idx,
                                        'produto_valor_unitario',
                                        e.target.value,
                                      )
                                    }
                                  />
                                </TableCell>
                                <TableCell className="text-right font-medium text-xs">
                                  <div>
                                    <span>{formatCurrency(it.produto_valor_total || 0)}</span>
                                    <span className="text-[10px] text-muted-foreground block">
                                      Unit: {formatCurrency(it.produto_valor_unitario || 0)}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-8 text-xs text-right"
                                    value={it.bc_icms ?? ''}
                                    onChange={(e) =>
                                      handleItemChange(idx, 'bc_icms', Number(e.target.value) || 0)
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-8 text-xs text-right"
                                    value={it.valor_icms ?? ''}
                                    onChange={(e) =>
                                      handleItemChange(
                                        idx,
                                        'valor_icms',
                                        Number(e.target.value) || 0,
                                      )
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-8 text-xs text-right"
                                    value={it.aliq_icms ?? ''}
                                    onChange={(e) =>
                                      handleItemChange(
                                        idx,
                                        'aliq_icms',
                                        Number(e.target.value) || 0,
                                      )
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleRemoveItem(idx)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>

                              {/* Sub-row for lotes extraídos */}
                              {it.lotes && it.lotes.length > 0 && (
                                <TableRow className="bg-muted/20">
                                  <TableCell colSpan={13} className="py-2 px-4 text-xs">
                                    <div className="flex items-center gap-4 flex-wrap text-muted-foreground">
                                      <span className="font-semibold text-foreground flex items-center gap-1">
                                        <Layers className="w-3.5 h-3.5 text-primary" /> Lotes
                                        Extraídos:
                                      </span>
                                      {it.lotes.map((lot, lIdx) => (
                                        <Badge
                                          key={lIdx}
                                          variant="outline"
                                          className="font-mono text-[11px] bg-background"
                                        >
                                          Lote: {lot.lote_codigo} — Qtde: {lot.lote_quantidade}
                                        </Badge>
                                      ))}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* SEÇÃO 4: AÇÕES DA REVISÃO */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-card border shadow-sm">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="text-destructive border-destructive/20 hover:bg-destructive/10"
                    onClick={() => handleDescartar(activeFile)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Descartar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSalvarRascunho(activeFile)}
                    className="gap-2"
                  >
                    <Save className="w-4 h-4" /> Salvar Rascunho
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  {!isCrmComplete && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      {extracted &&
                      (extracted.valor_total_nota === null ||
                        extracted.valor_total_nota === undefined ||
                        extracted.valor_total_nota <= 0)
                        ? 'O valor total e obrigatorio para salvar a NF.'
                        : 'Preencha todos os campos do Bloco D para confirmar'}
                    </span>
                  )}
                  <Button
                    variant="default"
                    disabled={!isCrmComplete || activeFile.status === 'saving'}
                    onClick={() => handleConfirmarImportacao(activeFile)}
                    className="gap-2 bg-primary hover:bg-primary/90 shadow-md min-w-[180px]"
                  >
                    {activeFile.status === 'saving' ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" /> Gravando...
                      </>
                    ) : (
                      <>
                        <PackageCheck className="w-4 h-4" /> Confirmar Importação
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SEÇÃO 5: RESUMO DO LOTE */}
      {activeTab === 'resumo' && (
        <div className="space-y-6">
          <Card className="shadow-subtle">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" /> Resumo do Lote de
                    Importação
                  </CardTitle>
                  <CardDescription>
                    Visão geral de todos os arquivos processados na sessão
                  </CardDescription>
                </div>
                <Button asChild variant="default" className="gap-2 shadow-sm">
                  <Link to="/historico-vendas">
                    Ir para Histórico <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground font-medium">
                      Total de NFs Processadas com Sucesso
                    </p>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {totalProcessadas}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-destructive/5 border-destructive/20">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground font-medium">
                      Total de NFs com Erro
                    </p>
                    <p className="text-3xl font-bold text-destructive mt-1">{totalErros}</p>
                  </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground font-medium">
                      Valor Total Importado
                    </p>
                    <p className="text-2xl font-bold text-primary mt-1">
                      {formatCurrency(totalValorImportado)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Table of Imported NFs */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  Notas Fiscais Importadas no Sistema
                </h4>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número NF</TableHead>
                        <TableHead>Destinatário / Cliente</TableHead>
                        <TableHead>Espécie Destino</TableHead>
                        <TableHead>Canal Vendas</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {files
                        .filter((f) => f.status === 'concluido' && f.extractedData)
                        .map((f) => (
                          <TableRow key={f.id}>
                            <TableCell className="font-mono font-bold text-primary">
                              #{f.extractedData?.numero_nf}
                            </TableCell>
                            <TableCell className="font-medium">
                              {f.extractedData?.destinatario_nome}
                            </TableCell>
                            <TableCell>{f.extractedData?.especie_destino || '-'}</TableCell>
                            <TableCell>{f.extractedData?.canal_vendas || '-'}</TableCell>
                            <TableCell className="text-right font-bold">
                              {formatCurrency(f.extractedData?.valor_total_nota || 0)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-emerald-500 text-white text-xs">
                                <Check className="w-3 h-3 mr-1" /> Importada
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      {files.filter((f) => f.status === 'concluido').length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Nenhuma nota fiscal foi confirmada ainda.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setActiveTab('upload')
                  }}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" /> Importar Mais Notas
                </Button>
                <Button asChild variant="default" className="gap-2">
                  <Link to="/historico-vendas">
                    Ver no Histórico Geral <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default UploadNF
