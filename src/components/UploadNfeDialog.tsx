import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  X,
  FileSpreadsheet,
  Layers,
  HelpCircle,
  Sparkles,
} from 'lucide-react'
import { extrairTextoPdf } from '@/services/nfe-service'
import { nfService, type ParsedNFData } from '@/services/nfService'
import {
  uploadPedido,
  downloadPedidoModel,
  deriveDateParts,
  derivePais,
} from '@/services/historico-vendas'
import pb from '@/lib/pocketbase/client'
import { normalizeNumberBR } from '@/lib/utils'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export interface UploadNfeDialogResult {
  id?: string
  arquivo: string
  numero_nf?: string
  cliente?: string
  cnpj?: string
  valor?: number | null
  itens_count?: number
  status: 'importada' | 'revisada' | 'pendencia_produto' | 'duplicada_ignorada' | 'erro'
  motivo_pendencia?: string
  mensagem: string
}

export interface UploadNfeDialogResponse {
  success: boolean
  importados: number
  pendentes_revisao: number
  pendencias_produto: number
  duplicadas_ignoradas: number
  total: number
  resultados: UploadNfeDialogResult[]
}

interface UploadNfeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  onOpenReviewQueue?: () => void
}

export function UploadNfeDialog({
  open,
  onOpenChange,
  onSuccess,
  onOpenReviewQueue,
}: UploadNfeDialogProps) {
  const [activeTab, setActiveTab] = useState<'nfe' | 'excel'>('nfe')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState<string>('')
  const [response, setResponse] = useState<UploadNfeDialogResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Excel fallback state
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [excelLoading, setExcelLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const excelInputRef = useRef<HTMLInputElement>(null)

  const resetState = () => {
    setFiles([])
    setLoading(false)
    setCurrentStep('')
    setResponse(null)
    setErrorMsg(null)
    setExcelFile(null)
    setExcelLoading(false)
  }

  const handleFilesSelected = (newFiles: FileList | null) => {
    if (!newFiles) return
    const valid: File[] = []
    for (let i = 0; i < newFiles.length; i++) {
      const f = newFiles[i]
      if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        if (f.size <= 25 * 1024 * 1024) {
          valid.push(f)
        } else {
          toast.error(`Arquivo ${f.name} ultrapassa o limite de 25MB`)
        }
      } else {
        toast.error(`Arquivo ${f.name} não é um PDF válido`)
      }
    }
    if (valid.length > 0) {
      setFiles((prev) => [...prev, ...valid])
      setErrorMsg(null)
    }
  }

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleProcessNfe = async () => {
    if (files.length === 0) {
      toast.error('Selecione pelo menos um arquivo PDF de nota fiscal')
      return
    }

    setLoading(true)
    setErrorMsg(null)

    const resultados: UploadNfeDialogResult[] = []
    let importados = 0
    let pendentes_revisao = 0
    let pendencias_produto = 0
    let duplicadas_ignoradas = 0

    try {
      // 1. Carregar produtos do catálogo e membros da equipe em paralelo
      setCurrentStep('Carregando catálogo de produtos e dados de equipe...')
      const [catalogCodes, catalogMap, gestoresEquipe, vendedoresEquipe] = await Promise.all([
        nfService.checkCatalogProducts().catch(() => new Set<string>()),
        nfService.getCatalogProductsMap().catch(() => new Map()),
        nfService.getGestoresTecnicosEquipe().catch(() => []),
        nfService.getVendedoresEquipe().catch(() => []),
      ])

      const currentUserId = pb.authStore.model?.id || ''

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setCurrentStep(`Processando arquivo (${i + 1}/${files.length}): ${file.name}...`)

        try {
          // A. Upload para storage seguro notas_fiscais_files
          setCurrentStep(`Enviando PDF (${i + 1}/${files.length}): ${file.name}...`)
          const { url, fileRecordId } = await nfService.uploadToStorage(file)

          // B. Extração local de texto (completo, sem cortes)
          setCurrentStep(`Extraindo texto (${i + 1}/${files.length}): ${file.name}...`)
          let rawText = ''
          try {
            rawText = await extrairTextoPdf(file)
          } catch (extractErr) {
            console.warn(`[UploadNfeDialog] Extração local falhou para ${file.name}:`, extractErr)
          }

          // C. Parse dos dados da NF via backend parse-nf-pdf
          setCurrentStep(`Analisando estrutura da NF (${i + 1}/${files.length}): ${file.name}...`)
          const parsedData = await nfService.callParseFunction(url, rawText || undefined)

          // Preservar raw_text integral
          if (rawText && !parsedData.raw_text) {
            parsedData.raw_text = rawText
          }
          parsedData.arquivo_pdf_url = url
          parsedData.file_record_id = fileRecordId

          const numeroNf = (parsedData.numero_nf || '').trim() || String(Date.now()).slice(-6)
          const destinatarioNome =
            (parsedData.destinatario_nome || '').trim() || 'Cliente não identificado'
          const dataEmissao = parsedData.data_emissao || new Date().toISOString().substring(0, 10)

          // D. Atribuição de Gestor / Vendedor
          if (destinatarioNome) {
            try {
              const atribuicao = await nfService.getAtribuicao(destinatarioNome)
              if (atribuicao) {
                if (atribuicao.gestor_tecnico_id && !parsedData.gestor_tecnico_id) {
                  parsedData.gestor_tecnico_id = atribuicao.gestor_tecnico_id
                }
                if (atribuicao.vendedor_id && !parsedData.vendedor_id) {
                  parsedData.vendedor_id = atribuicao.vendedor_id
                }
              }
            } catch (atribErr) {
              console.warn('Erro ao buscar atribuição:', atribErr)
            }
          }

          if (!parsedData.gestor_tecnico_id && gestoresEquipe.length > 0) {
            parsedData.gestor_tecnico_id = gestoresEquipe[0].id
          }
          if (!parsedData.vendedor_id && vendedoresEquipe.length > 0) {
            parsedData.vendedor_id = vendedoresEquipe[0].id
          }
          if (!parsedData.especie_destino) {
            parsedData.especie_destino = 'RUMINANTES'
          }
          if (!parsedData.canal_vendas) {
            parsedData.canal_vendas = 'Direto'
          }

          // E. Verificar itens e pendências de catálogo
          const itens = parsedData.itens || []
          let hasCatalogPending = false
          const unknownItems: string[] = []

          for (const item of itens) {
            const code = (item.produto_codigo || '').trim().toUpperCase()
            if (code && code !== 'ND' && !catalogCodes.has(code)) {
              hasCatalogPending = true
              unknownItems.push(code)
            }
          }

          // F. Gravação no banco: notas_fiscais + nf_itens + nf_lotes
          setCurrentStep(`Gravando no banco (${i + 1}/${files.length}): NF ${numeroNf}...`)
          const nfId = await nfService.insertNF({
            ...parsedData,
            numero_nf: numeroNf,
            destinatario_nome: destinatarioNome,
            data_emissao: dataEmissao,
            status: 'importada',
          })

          // Inserir itens com fallback seguro do valor_total_nota
          const insertedItens = await nfService.insertItens(
            nfId,
            itens,
            parsedData.valor_total_nota,
          )

          // Inserir lotes
          for (const insItem of insertedItens) {
            if (insItem.lotes && insItem.lotes.length > 0) {
              await nfService.insertLotes(nfId, insItem.id, insItem.lotes)
            }
          }
          if (parsedData.lotes && parsedData.lotes.length > 0) {
            for (const lote of parsedData.lotes) {
              let matchedItemId = ''
              if (lote.item_index !== undefined && insertedItens[lote.item_index]) {
                matchedItemId = insertedItens[lote.item_index].id
              } else if (lote.produto_codigo) {
                const fIt = insertedItens.find((it) => it.produto_codigo === lote.produto_codigo)
                if (fIt) matchedItemId = fIt.id
              }
              if (matchedItemId) {
                await nfService.insertLotes(nfId, matchedItemId, [
                  {
                    lote_codigo: lote.lote_codigo,
                    lote_quantidade: lote.lote_quantidade,
                  },
                ])
              }
            }
          }

          // G. Gravar também em historico_vendas para exibição imediata na listagem de pedidos
          const { mes, ano, trimestre } = deriveDateParts(dataEmissao)
          const pais = derivePais(parsedData.destinatario_uf)
          const gestorNome =
            gestoresEquipe.find((g) => g.id === parsedData.gestor_tecnico_id)?.nome || ''
          const vendedorNome =
            vendedoresEquipe.find((v) => v.id === parsedData.vendedor_id)?.nome || ''

          // Mapear espécie e canal para historico_vendas
          const mapEspecieHistorico = (
            esp?: string,
          ): 'BOVINO' | 'SUINO' | 'AVE' | 'PET' | 'AQUA' | 'OUTRO' => {
            if (!esp) return 'BOVINO'
            const up = esp.toUpperCase().trim()
            if (up === 'RUMINANTES' || up === 'BOVINO' || up === 'BOVINOS') return 'BOVINO'
            if (up === 'SUINOS' || up === 'SUINO') return 'SUINO'
            if (up === 'AVES' || up === 'AVE') return 'AVE'
            if (up === 'PETS' || up === 'PET') return 'PET'
            if (up === 'AQUA') return 'AQUA'
            return 'OUTRO'
          }

          const mapCanalHistorico = (
            canal?: string,
          ): 'Direto' | 'Distribuidor' | 'Indústria' | 'Premixera' | 'Cooperativa' | 'Online' => {
            if (!canal) return 'Direto'
            const clean = canal.trim()
            if (clean === 'Industria' || clean === 'Indústria') return 'Indústria'
            if (clean === 'Distribuidor') return 'Distribuidor'
            if (clean === 'Premixera') return 'Premixera'
            if (clean === 'Cooperativa') return 'Cooperativa'
            if (clean === 'Online') return 'Online'
            return 'Direto'
          }

          // Buscar gestao_tecnica ids para relacionamentos compatíveis
          let gestaoTecnicoId = ''
          let gestaoVendedorId = ''
          try {
            if (gestorNome) {
              const gtList = await pb.collection('gestao_tecnica').getList(1, 1, {
                filter: `nome ~ "${gestorNome.replace(/['"\\]/g, '')}"`,
              })
              if (gtList.items[0]) gestaoTecnicoId = gtList.items[0].id
            }
            if (vendedorNome) {
              const vendList = await pb.collection('gestao_tecnica').getList(1, 1, {
                filter: `nome ~ "${vendedorNome.replace(/['"\\]/g, '')}"`,
              })
              if (vendList.items[0]) gestaoVendedorId = vendList.items[0].id
            }
          } catch {
            /* intentionally ignored */
          }

          const itensToSave =
            itens.length > 0
              ? itens
              : [
                  {
                    produto_codigo: 'ND',
                    produto_descricao: 'Produtos da NF ' + numeroNf,
                    produto_quantidade: 1,
                    produto_valor_unitario:
                      parsedData.valor_total_nota !== null &&
                      parsedData.valor_total_nota !== undefined
                        ? normalizeNumberBR(parsedData.valor_total_nota)
                        : 0,
                    produto_valor_total:
                      parsedData.valor_total_nota !== null &&
                      parsedData.valor_total_nota !== undefined
                        ? normalizeNumberBR(parsedData.valor_total_nota)
                        : 0,
                  },
                ]

          for (let itemIdx = 0; itemIdx < itensToSave.length; itemIdx++) {
            const it = itensToSave[itemIdx]
            const prodCod = (it.produto_codigo || '').trim()
            const catInfo = catalogMap.get(prodCod.toUpperCase())
            const produtoFamilia = catInfo?.categoria || catInfo?.linha || ''

            const itemQtd = normalizeNumberBR(it.produto_quantidade) || 1
            const itemUnit = normalizeNumberBR(it.produto_valor_unitario)
            let itemTotal = normalizeNumberBR(it.produto_valor_total)
            if (itemTotal === 0 && itemQtd > 0 && itemUnit > 0) {
              itemTotal = itemQtd * itemUnit
            }

            const historicoPayload: Record<string, string | number | null> = {
              origem: 'upload',
              numero_documento: numeroNf,
              data_documento: dataEmissao,
              mes: String(mes),
              ano: Number(ano) || new Date().getFullYear(),
              trimestre: String(trimestre || 'T1'),
              destinatario_nome: destinatarioNome,
              destinatario_uf: String(parsedData.destinatario_uf || '')
                .toUpperCase()
                .trim(),
              pais: String(pais || 'Brasil'),
              especie_destino: parsedData.especie_destino || '',
              canal_vendas: mapCanalHistorico(parsedData.canal_vendas),
              gestor_tecnico: gestorNome,
              vendedor: vendedorNome,
              produto_codigo: prodCod,
              produto_descricao: String(it.produto_descricao || '').trim(),
              produto_familia: produtoFamilia,
              produto_quantidade: itemQtd,
              produto_valor_unitario: itemUnit,
              produto_valor_total: itemTotal,
              valor_total_nota:
                parsedData.valor_total_nota !== null && parsedData.valor_total_nota !== undefined
                  ? normalizeNumberBR(parsedData.valor_total_nota)
                  : null,
              frete_modalidade: parsedData.frete_modalidade || 'CIF',
              status: 'realizado',
              user_id: currentUserId,

              // Campos legados para dashboards e tabela de pedidos
              data: dataEmissao,
              cliente: destinatarioNome,
              especie: mapEspecieHistorico(parsedData.especie_destino),
              gestor_tecnico_id: gestaoTecnicoId || null,
              vendedor_id: gestaoVendedorId || null,
              valor: itemTotal,
              observacoes: `NF #${numeroNf}${itensToSave.length > 1 ? ` (Item ${itemIdx + 1})` : ''}`,
              atualizado_em: new Date().toISOString(),
            }

            try {
              await pb.collection('historico_vendas').create(historicoPayload)
            } catch (hvErr) {
              console.warn(
                `[UploadNfeDialog] Aviso ao gravar historico_vendas para item ${itemIdx + 1}:`,
                hvErr,
              )
            }
          }

          importados++
          if (hasCatalogPending) {
            pendencias_produto++
          } else {
            pendentes_revisao++
          }

          const statusFinal: UploadNfeDialogResult['status'] = hasCatalogPending
            ? 'pendencia_produto'
            : 'importada'

          resultados.push({
            id: nfId,
            arquivo: file.name,
            numero_nf: numeroNf,
            cliente: destinatarioNome,
            cnpj: parsedData.destinatario_cnpj,
            valor:
              parsedData.valor_total_nota !== null && parsedData.valor_total_nota !== undefined
                ? normalizeNumberBR(parsedData.valor_total_nota)
                : null,
            itens_count: itens.length,
            status: statusFinal,
            motivo_pendencia: hasCatalogPending
              ? `Produtos não catalogados: ${unknownItems.join(', ')}`
              : undefined,
            mensagem: hasCatalogPending
              ? 'Nota fiscal importada com itens pendentes de catálogo.'
              : 'Nota fiscal importada e dados gravados com sucesso.',
          })
        } catch (itemErr: any) {
          console.error(`Erro ao processar arquivo ${file.name}:`, itemErr)
          const responseData =
            itemErr?.response?.data?.data ||
            itemErr?.response?.data ||
            itemErr?.data?.data ||
            itemErr?.data
          let detailedFieldErrors = ''
          if (responseData && typeof responseData === 'object') {
            const fieldList: string[] = []
            for (const [key, val] of Object.entries(responseData)) {
              if (val && typeof val === 'object') {
                const fMsg = (val as any).message || (val as any).code || JSON.stringify(val)
                fieldList.push(`campo "${key}": ${fMsg}`)
              } else if (typeof val === 'string') {
                fieldList.push(`campo "${key}": ${val}`)
              }
            }
            if (fieldList.length > 0) {
              detailedFieldErrors = ` (${fieldList.join(', ')})`
            }
          }
          const baseMsg =
            itemErr?.message ||
            itemErr?.data?.message ||
            'Não foi possível extrair os dados da nota fiscal.'
          const msg = detailedFieldErrors ? `${baseMsg}${detailedFieldErrors}` : baseMsg
          resultados.push({
            arquivo: file.name,
            status: 'erro',
            mensagem: msg,
          })
        }
      }

      const finalResponse: UploadNfeDialogResponse = {
        success: importados > 0,
        importados,
        pendentes_revisao,
        pendencias_produto,
        duplicadas_ignoradas,
        total: files.length,
        resultados,
      }

      setResponse(finalResponse)

      if (importados > 0) {
        toast.success(
          `${importados} nota(s) fiscal(is) importada(s) e gravada(s) no banco com sucesso!`,
        )
      } else {
        toast.error('Nenhuma nota fiscal pôde ser gravada. Verifique os arquivos.')
      }

      if (pendencias_produto > 0) {
        toast.info(
          `${pendencias_produto} nota(s) possuem produtos não cadastrados no catálogo e exigem conferência.`,
        )
      }

      if (onSuccess) {
        onSuccess()
      }
    } catch (err: any) {
      const responseData =
        err?.response?.data?.data || err?.response?.data || err?.data?.data || err?.data
      let detailedFieldErrors = ''
      if (responseData && typeof responseData === 'object') {
        const fieldList: string[] = []
        for (const [key, val] of Object.entries(responseData)) {
          if (val && typeof val === 'object') {
            const fMsg = (val as any).message || (val as any).code || JSON.stringify(val)
            fieldList.push(`campo "${key}": ${fMsg}`)
          } else if (typeof val === 'string') {
            fieldList.push(`campo "${key}": ${val}`)
          }
        }
        if (fieldList.length > 0) {
          detailedFieldErrors = ` (${fieldList.join(', ')})`
        }
      }
      const baseMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Não foi possível processar as notas fiscais. Verifique o arquivo.'
      const msg = detailedFieldErrors ? `${baseMsg}${detailedFieldErrors}` : baseMsg
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
      setCurrentStep('')
    }
  }

  const handleProcessExcel = async () => {
    if (!excelFile) {
      toast.error('Selecione uma planilha Excel')
      return
    }
    setExcelLoading(true)
    try {
      const res = await uploadPedido(excelFile)
      if (res.success) {
        toast.success(`${res.importados} pedidos importados via planilha!`)
        if (onSuccess) onSuccess()
        resetState()
        onOpenChange(false)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível salvar o pedido. Tente novamente.')
    } finally {
      setExcelLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                Leitor Automático de Notas Fiscais (PDF)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Importação inteligente com extração de DANFE/NFe (Blink Bioscience), validação de
                catálogo e fila de conferência.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="nfe" className="gap-2">
              <FileText className="w-4 h-4" /> Notas Fiscais (PDF)
            </TabsTrigger>
            <TabsTrigger value="excel" className="gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Modelo Planilha Excel
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: NOTAS FISCAIS EM PDF */}
          <TabsContent value="nfe" className="space-y-4 pt-2">
            {!response && !loading && (
              <>
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleFilesSelected(e.dataTransfer.files)
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-primary/30 hover:border-primary/60 bg-muted/20 hover:bg-muted/40 rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
                >
                  <div className="p-4 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">
                      Arraste PDFs de Nota Fiscal aqui ou clique para selecionar
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Suporta upload único ou em lote (ex: NF 322, 323, 324). Máximo 25MB por
                      arquivo.
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => handleFilesSelected(e.target.files)}
                  />
                </div>

                {/* Lista de arquivos selecionados */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                      <span>{files.length} arquivo(s) preparado(s) para leitura</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] text-destructive hover:text-destructive"
                        onClick={() => setFiles([])}
                      >
                        Limpar todos
                      </Button>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {files.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <FileText className="w-4 h-4 text-primary shrink-0" />
                            <span className="font-medium truncate">{f.name}</span>
                            <span className="text-muted-foreground text-[10px]">
                              ({(f.size / 1024).toFixed(0)} KB)
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFile(i)
                            }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Destaque das regras de negócio */}
                <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground space-y-1 border">
                  <p className="font-medium text-foreground flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-primary" /> O que é extraído e validado:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-1">
                    <li>
                      <strong>Número da NF e Data de Emissão</strong>
                    </li>
                    <li>
                      <strong>Dados do Cliente:</strong> Razão Social, CNPJ/CPF, Endereço de entrega
                    </li>
                    <li>
                      <strong>Produtos:</strong> Código, Nome, Quantidade, Valor Unitário e Total
                    </li>
                    <li>
                      <strong>Impostos & Frete:</strong> ICMS, PIS, COFINS, Modalidade FOB/CIF
                    </li>
                    <li>
                      <strong>Validação Inteligente:</strong> Produtos não encontrados no catálogo e
                      duplicatas são destacados para sua conferência na Fila de Revisão.
                    </li>
                  </ul>
                </div>

                {errorMsg && (
                  <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleProcessNfe}
                    disabled={files.length === 0}
                    className="gap-2 min-w-[140px]"
                  >
                    <Sparkles className="w-4 h-4" /> Processar{' '}
                    {files.length > 0 && `(${files.length})`}
                  </Button>
                </div>
              </>
            )}

            {/* LOADING STATE */}
            {loading && (
              <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
                <div className="relative">
                  <div className="p-4 rounded-full bg-primary/10 text-primary animate-pulse">
                    <Sparkles className="w-10 h-10" />
                  </div>
                  <Loader2 className="w-6 h-6 animate-spin text-primary absolute -bottom-1 -right-1" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h4 className="font-semibold text-base">Lendo e Estruturando Nota Fiscal</h4>
                  <p className="text-xs text-muted-foreground">{currentStep || 'Processando...'}</p>
                </div>
              </div>
            )}

            {/* RESULT STATE */}
            {response && !loading && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-3">
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {response.pendentes_revisao}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Prontos p/ Revisão</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3">
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {response.pendencias_produto}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Pendência de Produto</p>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800/50 border rounded-xl p-3">
                    <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">
                      {response.duplicadas_ignoradas}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Duplicadas Ignoradas</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Detalhes do processamento:
                  </p>
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {response.resultados.map((r, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border text-xs flex flex-col gap-1.5 ${
                          r.status === 'duplicada_ignorada'
                            ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200'
                            : r.status === 'pendencia_produto'
                              ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/40'
                              : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {r.status === 'duplicada_ignorada' ? (
                              <Badge variant="outline" className="text-[10px]">
                                Duplicada
                              </Badge>
                            ) : r.status === 'pendencia_produto' ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-amber-100 text-amber-800 border-amber-300"
                              >
                                Pendência de Produto
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300"
                              >
                                Pronto
                              </Badge>
                            )}
                            <span className="font-semibold">
                              {r.numero_nf ? `NF ${r.numero_nf}` : r.arquivo}
                            </span>
                          </div>
                          {r.valor ? (
                            <span className="font-bold text-primary">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(r.valor)}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground">{r.cliente || r.arquivo}</p>
                        {r.motivo_pendencia && (
                          <div className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400 text-[11px] bg-amber-100/50 dark:bg-amber-950/40 p-2 rounded">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>{r.motivo_pendencia}</span>
                          </div>
                        )}
                        <p className="text-[11px] text-muted-foreground italic">{r.mensagem}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={resetState} className="flex-1">
                    Nova Importação
                  </Button>
                  <Button
                    onClick={() => {
                      onOpenChange(false)
                      if (onOpenReviewQueue) onOpenReviewQueue()
                    }}
                    className="flex-1 gap-2 bg-primary"
                  >
                    <Layers className="w-4 h-4" /> Abrir Fila de Revisão
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: MODELO EXCEL */}
          <TabsContent value="excel" className="space-y-4 pt-2">
            <div
              onClick={() => excelInputRef.current?.click()}
              className="border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 rounded-xl p-8 text-center cursor-pointer bg-muted/10 hover:bg-muted/20 transition-all flex flex-col items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm font-medium">
                {excelFile ? excelFile.name : 'Selecione uma planilha de pedidos (.xlsx ou .csv)'}
              </p>
              <p className="text-xs text-muted-foreground">Importação direta em lote</p>
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="flex justify-between items-center text-xs">
              <Button
                variant="link"
                size="sm"
                onClick={downloadPedidoModel}
                className="gap-1.5 p-0 h-auto"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Baixar modelo de planilha
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleProcessExcel}
                disabled={!excelFile || excelLoading}
                className="gap-2"
              >
                {excelLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Importar Planilha
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
