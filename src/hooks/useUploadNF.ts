import { useState, useCallback, useEffect } from 'react'
import {
  nfService,
  type ParsedNFData,
  type EquipeOption,
  type AtribuicaoClienteRecord,
} from '@/services/nfService'
import { deriveDateParts, derivePais } from '@/services/historico-vendas'
import pb from '@/lib/pocketbase/client'
import { extrairTextoPdf } from '@/services/nfe-service'

export interface UploadFileItem {
  id: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'parsing' | 'ready' | 'saving' | 'concluido' | 'error'
  pdfUrl?: string
  fileRecordId?: string
  extractedData?: ParsedNFData
  errorMessage?: string
  importedNfId?: string
}

export interface UseUploadNFReturn {
  files: UploadFileItem[]
  currentFileIndex: number
  activeFile: UploadFileItem | null
  gestoresTecnicos: EquipeOption[]
  vendedores: EquipeOption[]
  catalogCodes: Set<string>
  loadingTeam: boolean
  error: string | null
  addFiles: (newFiles: File[]) => void
  removeFile: (id: string) => Promise<void>
  retryFile: (id: string) => Promise<void>
  setCurrentFileIndex: (index: number) => void
  updateExtractedData: (fileId: string, updated: Partial<ParsedNFData>) => void
  saveNF: (fileId: string, asDraft?: boolean) => Promise<string | null>
  discardFile: (fileId: string) => Promise<void>
  fetchAtribuicao: (destinatarioNome: string) => Promise<AtribuicaoClienteRecord | null>
  fetchGestoresTecnicos: () => Promise<EquipeOption[]>
  fetchVendedores: () => Promise<EquipeOption[]>
  uploadPDF: (file: File) => Promise<{ url: string; fileRecordId: string }>
  parseNF: (pdfUrl: string, rawText?: string) => Promise<ParsedNFData>
}

export function useUploadNF(): UseUploadNFReturn {
  const [files, setFiles] = useState<UploadFileItem[]>([])
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(0)
  const [gestoresTecnicos, setGestoresTecnicos] = useState<EquipeOption[]>([])
  const [vendedores, setVendedores] = useState<EquipeOption[]>([])
  const [catalogCodes, setCatalogCodes] = useState<Set<string>>(new Set())
  const [loadingTeam, setLoadingTeam] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Load equipe lists and catalog codes on mount
  useEffect(() => {
    let isMounted = true
    const loadInitial = async () => {
      try {
        setLoadingTeam(true)
        setError(null)
        const [gestores, vends, codes] = await Promise.all([
          nfService.getGestoresTecnicosEquipe(),
          nfService.getVendedoresEquipe(),
          nfService.checkCatalogProducts(),
        ])
        if (isMounted) {
          setGestoresTecnicos(gestores)
          setVendedores(vends)
          setCatalogCodes(codes)
        }
      } catch (err: unknown) {
        console.warn('Erro ao carregar dados auxiliares:', err)
        if (isMounted) {
          setError('Erro ao conectar com o banco de dados.')
        }
      } finally {
        if (isMounted) setLoadingTeam(false)
      }
    }
    loadInitial().catch((e) => {
      console.error('Unhandled loadInitial error:', e)
    })
    return () => {
      isMounted = false
    }
  }, [])

  const fetchAtribuicao = useCallback(async (destinatarioNome: string) => {
    return nfService.getAtribuicao(destinatarioNome)
  }, [])

  const fetchGestoresTecnicos = useCallback(async () => {
    const list = await nfService.getGestoresTecnicosEquipe()
    setGestoresTecnicos(list)
    return list
  }, [])

  const fetchVendedores = useCallback(async () => {
    const list = await nfService.getVendedoresEquipe()
    setVendedores(list)
    return list
  }, [])

  const uploadPDF = useCallback(async (file: File) => {
    return nfService.uploadToStorage(file)
  }, [])

  const parseNF = useCallback(async (pdfUrl: string, rawText?: string) => {
    return nfService.callParseFunction(pdfUrl, rawText)
  }, [])

  // Process a single file pipeline
  const processPipeline = useCallback(
    async (item: UploadFileItem) => {
      try {
        // Step 1: Uploading
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: 'uploading', progress: 25, errorMessage: undefined }
              : f,
          ),
        )

        // Read text in browser first as fallback / companion (FIX 7.1, 7.2, 7.3)
        let rawText = ''
        try {
          rawText = await extrairTextoPdf(item.file)
          console.log(
            `[useUploadNF] rawText obtido para ${item.file.name}: ${rawText.length} caracteres`,
          )
        } catch (extractErr) {
          console.warn('Erro na extração local de texto do PDF:', extractErr)
        }
        // FIX 7.1: Se o texto for muito grande (acima de 50.000 caracteres), registre warning mas envie completo
        if (rawText && rawText.length > 50000) {
          console.warn(
            `Texto da NF muito grande (${rawText.length} caracteres), enviando texto completo.`,
          )
        }

        // FIX 7.3: Verificação de qualidade do texto
        if (rawText && rawText.length > 0) {
          const hasMinLength = rawText.length >= 100
          const hasDigit = /\d/.test(rawText)
          const hasDanfeKeyword = /NOTA\s+FISCAL|DANFE|NF-e|NFe/i.test(rawText)

          if (!hasMinLength || !hasDigit || !hasDanfeKeyword) {
            console.warn(
              'Qualidade do texto extraído abaixo do esperado. O backend fará extração complementar.',
              {
                hasMinLength,
                hasDigit,
                hasDanfeKeyword,
                length: rawText.length,
              },
            )
          }
        }

        setFiles((prev) => prev.map((f) => (f.id === item.id ? { ...f, progress: 45 } : f)))

        const { url, fileRecordId } = await nfService.uploadToStorage(item.file)

        // Step 2: Parsing
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'parsing',
                  progress: 75,
                  pdfUrl: url,
                  fileRecordId,
                }
              : f,
          ),
        )

        const extracted = await nfService.callParseFunction(url, rawText || undefined)
        if (rawText && !extracted.raw_text) {
          extracted.raw_text = rawText
        }

        // Step 3: Match Atribuicao if possible, or fallback to first available team members
        if (extracted.destinatario_nome) {
          const match = await nfService.getAtribuicao(extracted.destinatario_nome)
          if (match) {
            if (match.gestor_tecnico_id && !extracted.gestor_tecnico_id) {
              extracted.gestor_tecnico_id = match.gestor_tecnico_id
            }
            if (match.vendedor_id && !extracted.vendedor_id) {
              extracted.vendedor_id = match.vendedor_id
            }
          }
        }

        // Auto-assign default gestor / vendedor / especie / canal if empty to ease UX
        if (!extracted.gestor_tecnico_id && gestoresTecnicos.length > 0) {
          extracted.gestor_tecnico_id = gestoresTecnicos[0].id
        }
        if (!extracted.vendedor_id && vendedores.length > 0) {
          extracted.vendedor_id = vendedores[0].id
        }
        if (!extracted.especie_destino) {
          extracted.especie_destino = 'RUMINANTES'
        }
        if (!extracted.canal_vendas) {
          extracted.canal_vendas = 'Direto'
        }

        extracted.arquivo_pdf_url = url
        extracted.file_record_id = fileRecordId

        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'ready',
                  progress: 100,
                  extractedData: extracted,
                }
              : f,
          ),
        )
      } catch (err: unknown) {
        console.error('Erro na pipeline do arquivo:', item.file.name, err)
        const errMsg =
          (err instanceof Error ? err.message : '') ||
          'Erro ao processar arquivo. Verifique se o arquivo e um DANFE valido.'
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'error',
                  progress: 100,
                  errorMessage: errMsg,
                }
              : f,
          ),
        )
      }
    },
    [gestoresTecnicos, vendedores],
  )

  // Add files to batch
  const addFiles = useCallback(
    (newFiles: File[]) => {
      setError(null)
      const validFiles: UploadFileItem[] = []

      for (const file of newFiles) {
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
          setError('Apenas arquivos PDF sao aceitos.')
          continue
        }
        if (file.size > 10 * 1024 * 1024) {
          setError('Arquivo muito grande. Maximo 10MB.')
          continue
        }

        const item: UploadFileItem = {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          file,
          progress: 0,
          status: 'pending',
        }
        validFiles.push(item)
      }

      if (validFiles.length > 0) {
        setFiles((prev) => [...prev, ...validFiles])
        // Trigger pipeline for new files
        validFiles.forEach((item) => {
          processPipeline(item).catch((err) => {
            console.error('Erro na execução da pipeline:', err)
          })
        })
      }
    },
    [processPipeline],
  )

  const retryFile = useCallback(
    async (id: string) => {
      const item = files.find((f) => f.id === id)
      if (item) {
        try {
          await processPipeline(item)
        } catch (err: unknown) {
          console.error('Erro ao retentar arquivo:', err)
        }
      }
    },
    [files, processPipeline],
  )

  const removeFile = useCallback(
    async (id: string) => {
      try {
        const item = files.find((f) => f.id === id)
        if (item && item.fileRecordId) {
          await nfService.deleteFromStorage(item.fileRecordId)
        }
      } catch (err: unknown) {
        console.warn('Erro ao remover arquivo do storage:', err)
      } finally {
        setFiles((prev) => prev.filter((f) => f.id !== id))
      }
    },
    [files],
  )

  const discardFile = useCallback(
    async (fileId: string) => {
      await removeFile(fileId)
    },
    [removeFile],
  )

  const updateExtractedData = useCallback((fileId: string, updated: Partial<ParsedNFData>) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id === fileId && f.extractedData) {
          return {
            ...f,
            extractedData: {
              ...f.extractedData,
              ...updated,
            },
          }
        }
        return f
      }),
    )
  }, [])

  const saveNF = useCallback(
    async (fileId: string, asDraft = false): Promise<string | null> => {
      const item = files.find((f) => f.id === fileId)
      if (!item || !item.extractedData) return null

      const data = item.extractedData

      if (!asDraft) {
        // Strict CRM validation
        if (!data.numero_nf) {
          throw new Error('Preencha todos os campos obrigatorios antes de confirmar.')
        }
        if (!data.valor_total_nota || data.valor_total_nota <= 0) {
          throw new Error('Preencha todos os campos obrigatorios antes de confirmar.')
        }
        if (
          !data.especie_destino ||
          !data.canal_vendas ||
          !data.gestor_tecnico_id ||
          !data.vendedor_id
        ) {
          throw new Error('Preencha todos os campos obrigatorios antes de confirmar.')
        }
      }

      setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, status: 'saving' } : f)))

      try {
        const currentUserId = pb.authStore.model?.id || ''

        // Format dates properly
        let dataEmissaoDoc = data.data_emissao || new Date().toISOString().substring(0, 10)
        if (dataEmissaoDoc.includes('/')) {
          const p = dataEmissaoDoc.split('/')
          if (p.length === 3) {
            dataEmissaoDoc = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`
          }
        }

        const nfId = await nfService.insertNF({
          ...data,
          data_emissao: dataEmissaoDoc,
          status: asDraft ? 'importada' : 'confirmada',
        })

        // Insert items into nf_itens
        const insertedItens = await nfService.insertItens(nfId, data.itens || [])

        // Insert lotes into nf_lotes
        for (const insItem of insertedItens) {
          if (insItem.lotes && insItem.lotes.length > 0) {
            await nfService.insertLotes(nfId, insItem.id, insItem.lotes)
          }
        }

        // Check if there are separate global lotes that weren't inside item objects
        if (data.lotes && data.lotes.length > 0) {
          for (const lote of data.lotes) {
            let matchedItemId = ''
            if (lote.item_index !== undefined && insertedItens[lote.item_index]) {
              matchedItemId = insertedItens[lote.item_index].id
            } else if (lote.produto_codigo) {
              const fIt = insertedItens.find((i) => i.produto_codigo === lote.produto_codigo)
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

        // 2. Se for confirmação final (não rascunho), gravar UMA linha por item em historico_vendas
        if (!asDraft) {
          const { mes, ano, trimestre } = deriveDateParts(dataEmissaoDoc)
          const pais = derivePais(data.destinatario_uf)

          // Obter nomes de gestor e vendedor
          const gestorNome =
            gestoresTecnicos.find((g) => g.id === data.gestor_tecnico_id)?.nome || ''
          const vendedorNome = vendedores.find((v) => v.id === data.vendedor_id)?.nome || ''

          // Catálogo de produtos para derivar família
          const catalogMap = await nfService.getCatalogProductsMap()

          const itensToSave =
            data.itens && data.itens.length > 0
              ? data.itens
              : [
                  {
                    produto_codigo: 'ND',
                    produto_descricao: 'Produtos da NF ' + (data.numero_nf || ''),
                    produto_quantidade: 1,
                    produto_valor_unitario: data.valor_total_nota || 0,
                    produto_valor_total: data.valor_total_nota || 0,
                  },
                ]

          for (const item of itensToSave) {
            const prodCod = (item.produto_codigo || '').trim()
            const catInfo = catalogMap.get(prodCod.toUpperCase())
            const produtoFamilia = catInfo?.linha || ''

            const itemQtd = Number(item.produto_quantidade) || 1
            const itemUnit = Number(item.produto_valor_unitario) || 0
            const itemTotal = Number(item.produto_valor_total) || itemQtd * itemUnit

            const historicoPayload: Record<string, string | number | null> = {
              origem: 'nf',
              numero_documento: String(data.numero_nf || '').trim(),
              data_documento: dataEmissaoDoc,
              mes: Number(mes) || 1,
              ano: Number(ano) || new Date().getFullYear(),
              trimestre: String(trimestre || 'T1'),
              destinatario_nome: String(data.destinatario_nome || '').trim(),
              destinatario_uf: String(data.destinatario_uf || '')
                .toUpperCase()
                .trim(),
              pais: String(pais || 'Brasil'),
              especie_destino: data.especie_destino || '',
              canal_vendas: data.canal_vendas || '',
              gestor_tecnico: gestorNome,
              vendedor: vendedorNome,
              produto_codigo: prodCod,
              produto_descricao: String(item.produto_descricao || '').trim(),
              produto_familia: produtoFamilia,
              produto_quantidade: itemQtd,
              produto_valor_unitario: itemUnit,
              produto_valor_total: itemTotal,
              valor_total_nota: Number(data.valor_total_nota) || 0,
              frete_modalidade: data.frete_modalidade || 'CIF',
              status: 'realizado',
              user_id: currentUserId,

              // Campos legados para dashboards compatíveis
              data: dataEmissaoDoc,
              cliente: String(data.destinatario_nome || '').trim(),
              especie: data.especie_destino || '',
              gestor_tecnico_id: data.gestor_tecnico_id || '',
              vendedor_id: data.vendedor_id || '',
              valor: itemTotal,
              observacoes: `NF #${data.numero_nf || ''}`,
              atualizado_em: new Date().toISOString(),
            }

            try {
              await pb.collection('historico_vendas').create(historicoPayload)
            } catch (hvErr) {
              console.error('Erro ao gravar linha em historico_vendas:', hvErr)
            }
          }
        }

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: 'concluido', importedNfId: nfId } : f,
          ),
        )

        return nfId
      } catch (saveErr: unknown) {
        console.error('Erro ao salvar nota fiscal:', saveErr)
        const errMsg =
          (saveErr instanceof Error ? saveErr.message : '') ||
          'Erro ao gravar no banco de dados. Verifique os dados e tente novamente.'
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  status: 'ready',
                  errorMessage: errMsg,
                }
              : f,
          ),
        )
        throw saveErr
      }
    },
    [files, gestoresTecnicos, vendedores],
  )

  const activeFile = files[currentFileIndex] || null

  return {
    files,
    currentFileIndex,
    activeFile,
    gestoresTecnicos,
    vendedores,
    catalogCodes,
    loadingTeam,
    error,
    addFiles,
    removeFile,
    retryFile,
    setCurrentFileIndex,
    updateExtractedData,
    saveNF,
    discardFile,
    fetchAtribuicao,
    fetchGestoresTecnicos,
    fetchVendedores,
    uploadPDF,
    parseNF,
  }
}

export default useUploadNF
