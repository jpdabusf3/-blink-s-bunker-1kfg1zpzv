import { useState, useCallback, useEffect } from 'react'
import {
  nfService,
  type ParsedNFData,
  type EquipeOption,
  type AtribuicaoClienteRecord,
} from '@/services/nfService'
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
      } catch (err) {
        console.warn('Erro ao carregar dados auxiliares:', err)
      } finally {
        if (isMounted) setLoadingTeam(false)
      }
    }
    loadInitial()
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
  const processPipeline = useCallback(async (item: UploadFileItem) => {
    try {
      // Step 1: Uploading
      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? { ...f, status: 'uploading', progress: 25, errorMessage: undefined }
            : f,
        ),
      )

      // Read text in browser first as fallback / companion
      let rawText = ''
      try {
        rawText = await extrairTextoPdf(item.file)
      } catch {
        /* intentionally ignored */
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

      const extracted = await nfService.callParseFunction(url, rawText)

      // Step 3: Match Atribuicao if possible
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
    } catch (err: any) {
      console.error('Erro na pipeline do arquivo:', item.file.name, err)
      const errMsg =
        err?.message || 'Erro ao processar arquivo. Verifique se o arquivo e um DANFE valido.'
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
  }, [])

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
          processPipeline(item)
        })
      }
    },
    [processPipeline],
  )

  const retryFile = useCallback(
    async (id: string) => {
      const item = files.find((f) => f.id === id)
      if (item) {
        await processPipeline(item)
      }
    },
    [files, processPipeline],
  )

  const removeFile = useCallback(
    async (id: string) => {
      const item = files.find((f) => f.id === id)
      if (item && item.fileRecordId) {
        await nfService.deleteFromStorage(item.fileRecordId)
      }
      setFiles((prev) => prev.filter((f) => f.id !== id))
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
        const nfId = await nfService.insertNF({
          ...data,
          status: 'importada',
        })

        // Insert items
        const insertedItens = await nfService.insertItens(nfId, data.itens || [])

        // Insert lotes
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

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: 'concluido', importedNfId: nfId } : f,
          ),
        )

        return nfId
      } catch (saveErr: any) {
        console.error('Erro ao salvar nota fiscal:', saveErr)
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  status: 'ready',
                  errorMessage: saveErr?.message || 'Erro ao gravar dados da nota fiscal.',
                }
              : f,
          ),
        )
        throw saveErr
      }
    },
    [files],
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
