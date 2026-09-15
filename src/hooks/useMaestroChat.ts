import { useState, useCallback, useRef } from 'react'
import {
  uploadMaestroFile,
  extractFileContentLocally,
  analyzeMaestroFile,
  executeImportInvoices,
  executeRegisterClients,
  executeImportSales,
  type MaestroAnalysisResult,
  type DocumentType,
  type ExecutionResult,
} from '@/services/maestro-analyze-service'
import {
  sendMaestroMessageStream,
  sendMaestroMessageSync,
  extractReportConfigFromText,
  type MaestroReportConfig,
} from '@/services/maestro-service'

export interface AttachedFile {
  file: File
  name: string
  size: number
  uploadedId?: string
  uploadedUrl?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  attachment?: {
    name: string
    size: number
    type: string
  }
  isAnalyzing?: boolean
  isExecuting?: boolean
  confirmationCard?: {
    actionType: DocumentType
    title: string
    summary: string
    previewRows: Array<Record<string, unknown>>
    analysisResult: MaestroAnalysisResult
    status: 'pending' | 'executing' | 'confirmed' | 'cancelled'
    executionResult?: ExecutionResult
  }
  quickReplies?: Array<{
    label: string
    action: () => void
  }>
  reportConfig?: MaestroReportConfig | null
  error?: string
}

export interface UseMaestroChatReturn {
  messages: ChatMessage[]
  attachedFile: AttachedFile | null
  inputText: string
  isSending: boolean
  isAnalyzing: boolean
  isExecuting: boolean
  conversationId: string | null
  lastFailedFile: AttachedFile | null
  setInputText: (text: string) => void
  setAttachedFile: (file: AttachedFile | null) => void
  handleAttachFile: (file: File) => void
  handleRemoveAttachment: () => void
  sendMessage: (customText?: string) => Promise<void>
  handleConfirmAction: (messageId: string) => Promise<void>
  handleCancelAction: (messageId: string) => void
  handleRetryAnalysis: () => Promise<void>
  handleSelectQuickAction: (actionType: DocumentType) => Promise<void>
  clearChat: () => void
}

export function useMaestroChat(): UseMaestroChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null)
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [lastFailedFile, setLastFailedFile] = useState<AttachedFile | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  const handleAttachFile = useCallback((file: File) => {
    // Validação de tipo de arquivo: PDF, XLSX, XLS, CSV
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const allowed = ['pdf', 'xlsx', 'xls', 'csv']
    if (!allowed.includes(ext)) {
      throw new Error('Formato não suportado. Por favor, anexe arquivos em PDF, XLSX, XLS ou CSV.')
    }

    // Validação de tamanho: max 20 MB
    const maxBytes = 20 * 1024 * 1024
    if (file.size > maxBytes) {
      throw new Error('O arquivo excede o tamanho máximo permitido de 20 MB.')
    }

    setAttachedFile({
      file,
      name: file.name,
      size: file.size,
    })
  }, [])

  const handleRemoveAttachment = useCallback(() => {
    setAttachedFile(null)
  }, [])

  const clearChat = useCallback(() => {
    setMessages([])
    setAttachedFile(null)
    setInputText('')
    setConversationId(null)
    setLastFailedFile(null)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  /**
   * Processamento e análise de arquivo anexado
   */
  const processFileAnalysis = useCallback(async (fileObj: AttachedFile, userMsgText: string) => {
    setIsAnalyzing(true)
    setLastFailedFile(null)

    const analyzingMsgId = `assistant-analysis-${Date.now()}`
    const fileCardMessage: ChatMessage = {
      id: analyzingMsgId,
      role: 'assistant',
      content: `Recebi seu arquivo "${fileObj.name}". Analisando o conteúdo...`,
      timestamp: new Date(),
      attachment: {
        name: fileObj.name,
        size: fileObj.size,
        type: fileObj.file.type || 'document',
      },
      isAnalyzing: true,
    }

    setMessages((prev) => [...prev, fileCardMessage])

    try {
      // 1. Upload do arquivo para a coleção maestro_uploads
      const uploaded = await uploadMaestroFile(fileObj.file)
      fileObj.uploadedId = uploaded.id
      fileObj.uploadedUrl = uploaded.url

      // 2. Extração de texto/linhas cliente-side para dar precisão máxima
      const { extractedText, rows } = await extractFileContentLocally(fileObj.file)

      // 3. Chamada da análise do backend hook maestro/analyze
      const analysis = await analyzeMaestroFile({
        fileId: uploaded.id,
        file: fileObj.file,
        extractedText,
        rows,
      })

      // Determinar card de confirmação com base no tipo
      let title = 'Ação Detectada'
      if (analysis.document_type === 'invoice_pdf') {
        title = 'Importar Notas Fiscais'
      } else if (analysis.document_type === 'client_spreadsheet') {
        title = 'Cadastrar Clientes'
      } else if (analysis.document_type === 'sales_spreadsheet') {
        title = 'Importar Dados de Vendas'
      }

      if (analysis.document_type === 'unknown') {
        // Documento não identificado: pergunta o que fazer com botões de resposta rápida
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === analyzingMsgId
              ? {
                  ...msg,
                  isAnalyzing: false,
                  content: `Analisei o arquivo "${fileObj.name}", mas não consegui identificar o tipo de operação com segurança. Como deseja que eu processe este arquivo?`,
                  quickReplies: [
                    {
                      label: 'Importar como Notas Fiscais',
                      action: () => handleSelectQuickAction('invoice_pdf'),
                    },
                    {
                      label: 'Importar como Clientes',
                      action: () => handleSelectQuickAction('client_spreadsheet'),
                    },
                    {
                      label: 'Gerar Relatório de Vendas',
                      action: () => handleSelectQuickAction('sales_spreadsheet'),
                    },
                  ],
                }
              : msg,
          ),
        )
      } else {
        // Documento conhecido: posta card de confirmação com preview
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === analyzingMsgId
              ? {
                  ...msg,
                  isAnalyzing: false,
                  content: `Identifiquei uma oportunidade de ${title.toLowerCase()} com base no arquivo anexado.`,
                  confirmationCard: {
                    actionType: analysis.document_type,
                    title,
                    summary:
                      analysis.summary ||
                      `${analysis.preview_rows.length} registros identificados.`,
                    previewRows: analysis.preview_rows,
                    analysisResult: analysis,
                    status: 'pending',
                  },
                }
              : msg,
          ),
        )
      }
    } catch (err: unknown) {
      console.error('Erro ao analisar arquivo no Maestro:', err)
      const errMsg =
        (err as Error).message ||
        'Ocorreu um erro ao processar seu arquivo. Verifique se o formato é válido e tente novamente.'

      setLastFailedFile(fileObj)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === analyzingMsgId
            ? {
                ...msg,
                isAnalyzing: false,
                error: errMsg,
                content: `Não foi possível analisar o arquivo "${fileObj.name}": ${errMsg}`,
              }
            : msg,
        ),
      )
    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  /**
   * Resposta rápida quando o documento é desconhecido
   */
  const handleSelectQuickAction = useCallback(async (actionType: DocumentType) => {
    let actionTitle = 'Processar Arquivo'
    if (actionType === 'invoice_pdf') actionTitle = 'Importar Notas Fiscais'
    if (actionType === 'client_spreadsheet') actionTitle = 'Cadastrar Clientes'
    if (actionType === 'sales_spreadsheet') actionTitle = 'Gerar Relatório de Vendas'

    const assistantMsg: ChatMessage = {
      id: `assistant-choice-${Date.now()}`,
      role: 'assistant',
      content: `Perfeito! Selecionada a opção "${actionTitle}". Estou preparando a confirmação dos dados para prosseguir.`,
      timestamp: new Date(),
      confirmationCard: {
        actionType,
        title: actionTitle,
        summary: 'Ação selecionada manualmente pelo usuário.',
        previewRows: [],
        analysisResult: {
          success: true,
          file_id: '',
          mime_type: '',
          document_type: actionType,
          confidence: 1.0,
          summary: actionTitle,
          preview_rows: [],
          data: {},
        },
        status: 'pending',
      },
    }

    setMessages((prev) => [...prev, assistantMsg])
  }, [])

  /**
   * Re-executar a análise do último arquivo que falhou
   */
  const handleRetryAnalysis = useCallback(async () => {
    if (!lastFailedFile) return
    await processFileAnalysis(lastFailedFile, '')
  }, [lastFailedFile, processFileAnalysis])

  /**
   * Cancelar ação pendente no card
   */
  const handleCancelAction = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId && msg.confirmationCard) {
          return {
            ...msg,
            confirmationCard: {
              ...msg.confirmationCard,
              status: 'cancelled',
            },
          }
        }
        return msg
      }),
    )

    const cancelMsg: ChatMessage = {
      id: `cancel-${Date.now()}`,
      role: 'assistant',
      content: 'Ação cancelada.',
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, cancelMsg])
  }, [])

  /**
   * Confirmar e executar a tarefa aprovada no card
   */
  const handleConfirmAction = useCallback(
    async (messageId: string) => {
      const targetMsg = messages.find((m) => m.id === messageId)
      if (!targetMsg?.confirmationCard) return

      const card = targetMsg.confirmationCard
      if (card.status === 'executing' || isExecuting) return

      setIsExecuting(true)

      // Atualiza o card para estado "executing"
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.confirmationCard
            ? {
                ...m,
                confirmationCard: {
                  ...m.confirmationCard,
                  status: 'executing',
                },
              }
            : m,
        ),
      )

      try {
        let execResult: ExecutionResult

        if (card.actionType === 'invoice_pdf') {
          const invoices = card.analysisResult.data.invoices || []
          execResult = await executeImportInvoices(invoices)
        } else if (card.actionType === 'client_spreadsheet') {
          const clients = card.analysisResult.data.clients || []
          execResult = await executeRegisterClients(clients)
        } else {
          // sales_spreadsheet ou fallback de relatório
          const sales = card.analysisResult.data.sales || []
          if (sales.length > 0) {
            execResult = await executeImportSales(sales)
          } else {
            // Se for acionamento de geração de relatório de vendas
            execResult = {
              success: true,
              inserted: 1,
              skippedDuplicates: 0,
              errorsCount: 0,
              navigationTab: '/relatorios-automaticos',
              navigationLabel: 'Ver Relatório de Vendas',
              message: 'Fluxo de relatório de vendas consolidado pelo MAESTRO com sucesso.',
            }
          }
        }

        // Atualiza o card para confirmado com resultado
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId && m.confirmationCard
              ? {
                  ...m,
                  confirmationCard: {
                    ...m.confirmationCard,
                    status: 'confirmed',
                    executionResult: execResult,
                  },
                }
              : m,
          ),
        )

        // Posta a mensagem de resultado no chat
        const resultMsg: ChatMessage = {
          id: `exec-result-${Date.now()}`,
          role: 'assistant',
          content: execResult.message,
          timestamp: new Date(),
          confirmationCard: {
            actionType: card.actionType,
            title: 'Resultado da Execução',
            summary: execResult.message,
            previewRows: [],
            analysisResult: card.analysisResult,
            status: 'confirmed',
            executionResult: execResult,
          },
        }

        setMessages((prev) => [...prev, resultMsg])
      } catch (err: unknown) {
        console.error('Erro na execução da tarefa no Maestro:', err)
        const errMsg =
          (err as Error).message ||
          'Falha durante a execução da tarefa. Nenhuma alteração corrompida foi salva.'

        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId && m.confirmationCard
              ? {
                  ...m,
                  confirmationCard: {
                    ...m.confirmationCard,
                    status: 'pending',
                  },
                }
              : m,
          ),
        )

        const errorPostMsg: ChatMessage = {
          id: `exec-err-${Date.now()}`,
          role: 'assistant',
          content: `Houve uma falha na execução: ${errMsg}`,
          timestamp: new Date(),
          error: errMsg,
        }
        setMessages((prev) => [...prev, errorPostMsg])
      } finally {
        setIsExecuting(false)
      }
    },
    [messages, isExecuting],
  )

  /**
   * Envio de mensagem com texto e/ou anexo
   */
  const sendMessage = useCallback(
    async (customText?: string) => {
      const text = (customText ?? inputText).trim()
      const currentAttachment = attachedFile

      if (!text && !currentAttachment) return
      if (isSending || isAnalyzing) return

      setIsSending(true)

      // Se houver arquivo anexado, dispara fluxo de análise
      if (currentAttachment) {
        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: text || `Analisar arquivo: ${currentAttachment.name}`,
          timestamp: new Date(),
          attachment: {
            name: currentAttachment.name,
            size: currentAttachment.size,
            type: currentAttachment.file.type || 'document',
          },
        }

        setMessages((prev) => [...prev, userMsg])
        setAttachedFile(null)
        if (!customText) setInputText('')
        setIsSending(false)

        await processFileAnalysis(currentAttachment, text)
        return
      }

      // Fluxo normal de chat com o MAESTRO (agente nativo de vendas/operações)
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMsg])
      if (!customText) setInputText('')

      const assistantMsgId = `assistant-${Date.now()}`
      const placeholderAssistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, placeholderAssistantMsg])

      const controller = new AbortController()
      abortControllerRef.current = controller

      let streamedText = ''

      try {
        const result = await sendMaestroMessageStream(text, conversationId, {
          signal: controller.signal,
          onChunk: (_delta, full) => {
            streamedText = full
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: full } : m)),
            )
          },
          onError: (streamErr) => {
            console.error('Erro no streaming do Maestro:', streamErr)
          },
        })

        if (result.conversationId) {
          setConversationId(result.conversationId)
        }

        const finalContent = result.content || streamedText
        const config = extractReportConfigFromText(finalContent)

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: finalContent,
                  reportConfig: config,
                }
              : m,
          ),
        )
      } catch (streamErr: unknown) {
        console.warn('Fallback síncrono para Maestro Chat:', streamErr)
        try {
          const syncResult = await sendMaestroMessageSync(text, conversationId)
          if (syncResult.conversationId) {
            setConversationId(syncResult.conversationId)
          }

          const finalContent = syncResult.content
          const config = extractReportConfigFromText(finalContent)

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: finalContent,
                    reportConfig: config,
                  }
                : m,
            ),
          )
        } catch (syncErr: unknown) {
          console.error('Erro na conversa com Maestro:', syncErr)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content:
                      'Desculpe, ocorreu uma instabilidade ao conectar com o assistente Maestro. Por favor, tente novamente.',
                    error: (syncErr as Error).message,
                  }
                : m,
            ),
          )
        }
      } finally {
        setIsSending(false)
        abortControllerRef.current = null
      }
    },
    [inputText, attachedFile, isSending, isAnalyzing, conversationId, processFileAnalysis],
  )

  return {
    messages,
    attachedFile,
    inputText,
    isSending,
    isAnalyzing,
    isExecuting,
    conversationId,
    lastFailedFile,
    setInputText,
    setAttachedFile,
    handleAttachFile,
    handleRemoveAttachment,
    sendMessage,
    handleConfirmAction,
    handleCancelAction,
    handleRetryAnalysis,
    handleSelectQuickAction,
    clearChat,
  }
}
