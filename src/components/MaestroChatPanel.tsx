import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Sparkles,
  Send,
  RefreshCw,
  AlertCircle,
  Bot,
  User,
  X,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  sendMaestroMessageStream,
  sendMaestroMessageSync,
  extractReportConfigFromText,
  type MaestroReportConfig,
} from '@/services/maestro-service'
import { fetchResumoVendas, type ResumoVendasResponse } from '@/services/resumo-vendas'
import { MaestroReportView } from '@/components/MaestroReportView'

export interface MaestroChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isTyping?: boolean
  reportConfig?: MaestroReportConfig | null
}

interface MaestroChatPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPeriodInfo?: {
    mode: 'month' | 'week'
    ano: number
    mes?: number
    semana?: number
  }
}

export function MaestroChatPanel({ open, onOpenChange, initialPeriodInfo }: MaestroChatPanelProps) {
  // Estado EMPTY inicial com a saudação obrigatória:
  // "Ola! Vou montar seu relatorio de vendas. Como voce gostaria de personaliza-lo?"
  const initialGreeting: MaestroChatMessage = {
    id: 'initial-greeting',
    role: 'assistant',
    content: 'Olá! Vou montar seu relatório de vendas. Como você gostaria de personalizá-lo?',
    timestamp: new Date(),
  }

  const [messages, setMessages] = useState<MaestroChatMessage[]>([initialGreeting])
  const [inputText, setInputText] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState<boolean>(false)
  const [hasError, setHasError] = useState<boolean>(false)
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)

  // Estado do relatório gerado
  const [generatedReport, setGeneratedReport] = useState<{
    data: ResumoVendasResponse
    config: MaestroReportConfig | null
    generatedAt: Date
  } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(scrollToBottom, 100)
    }
  }, [messages, isTyping, open, scrollToBottom])

  // Resetar ao reabrir se necessário, preservando a conversa ativa
  const handleResetChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setConversationId(null)
    setMessages([
      {
        id: `greeting-${Date.now()}`,
        role: 'assistant',
        content: 'Olá! Vou montar seu relatório de vendas. Como você gostaria de personalizá-lo?',
        timestamp: new Date(),
      },
    ])
    setGeneratedReport(null)
    setHasError(false)
    setLastFailedMessage(null)
    setInputText('')
  }

  // Dispara a busca dos dados do relatório quando o MAESTRO emite o bloco de configuração
  const handleProcessGeneratedReport = useCallback(
    async (config: MaestroReportConfig) => {
      try {
        const mode = config.modo === 'week' ? 'week' : 'month'
        const ano =
          config.ano ||
          initialPeriodInfo?.ano ||
          (config.periodo ? parseInt(config.periodo.split('-')[0], 10) : new Date().getFullYear())

        let mes: number | undefined
        let semana: number | undefined

        if (mode === 'month') {
          if (config.mes) {
            mes = config.mes
          } else if (config.periodo && config.periodo.includes('-')) {
            const parts = config.periodo.split('-')
            if (parts[1]) mes = parseInt(parts[1], 10)
          } else {
            mes = initialPeriodInfo?.mes || new Date().getMonth() + 1
          }
        } else {
          semana = config.semana || initialPeriodInfo?.semana || 1
        }

        const res = await fetchResumoVendas({
          mode,
          ano,
          mes,
          semana,
        })

        setGeneratedReport({
          data: res,
          config,
          generatedAt: new Date(),
        })

        // Toast obrigatório no estado de SUCCESS:
        toast.success('Relatório gerado com sucesso.')
      } catch (err) {
        console.error('Erro ao buscar dados do relatório MAESTRO:', err)
        toast.error('Não foi possível carregar os dados de vendas para o relatório.')
      }
    },
    [initialPeriodInfo],
  )

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim()
    if (!text || isTyping) return

    setHasError(false)
    setLastFailedMessage(null)

    const userMessage: MaestroChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    if (!textToSend) setInputText('')
    setIsTyping(true)

    const assistantMsgId = `assistant-${Date.now()}`
    const placeholderAssistantMsg: MaestroChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isTyping: true,
    }
    setMessages((prev) => [...prev, placeholderAssistantMsg])

    const controller = new AbortController()
    abortControllerRef.current = controller

    let streamedContent = ''

    try {
      const result = await sendMaestroMessageStream(text, conversationId, {
        signal: controller.signal,
        onChunk: (_delta, full) => {
          streamedContent = full
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: full,
                    isTyping: false,
                  }
                : m,
            ),
          )
        },
        onError: (err) => {
          console.error('Erro no stream do MAESTRO:', err)
        },
      })

      if (result.conversationId) {
        setConversationId(result.conversationId)
      }

      const finalContent = result.content || streamedContent
      const extractedConfig = extractReportConfigFromText(finalContent)

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: finalContent,
                isTyping: false,
                reportConfig: extractedConfig,
              }
            : m,
        ),
      )

      if (extractedConfig) {
        await handleProcessGeneratedReport(extractedConfig)
      }
    } catch (streamErr: unknown) {
      console.warn('Falha no streaming do MAESTRO, tentando fallback síncrono:', streamErr)

      try {
        const syncResult = await sendMaestroMessageSync(text, conversationId)
        if (syncResult.conversationId) {
          setConversationId(syncResult.conversationId)
        }

        const finalContent = syncResult.content
        const extractedConfig = extractReportConfigFromText(finalContent)

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: finalContent,
                  isTyping: false,
                  reportConfig: extractedConfig,
                }
              : m,
          ),
        )

        if (extractedConfig) {
          await handleProcessGeneratedReport(extractedConfig)
        }
      } catch (fallbackErr: unknown) {
        console.error('Falha no MAESTRO:', fallbackErr)
        // Remove a mensagem vazia de assistente e aciona estado ERROR
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId))
        setHasError(true)
        setLastFailedMessage(text)
      }
    } finally {
      setIsTyping(false)
      abortControllerRef.current = null
    }
  }

  const handleRetry = () => {
    if (lastFailedMessage) {
      handleSendMessage(lastFailedMessage)
    }
  }

  // Limpar bloco de código JSON para apresentação visual agradável da resposta de texto
  const formatAssistantContent = (raw: string) => {
    // Remove o bloco ```json ... ``` se for puramente a configuração técnica
    const cleaned = raw.replace(/```(?:json)?\s*[\s\S]*?```/gi, '').trim()
    return cleaned || raw
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'p-0 gap-0 overflow-hidden flex flex-col',
          // Responsivo: vira tela cheia no mobile, janela generosa no desktop
          'w-full max-w-full h-full sm:h-[88vh] sm:max-w-3xl sm:rounded-xl border border-border/80 shadow-2xl bg-background',
        )}
      >
        {/* Cabeçalho do Painel MAESTRO */}
        <DialogHeader className="p-4 sm:px-6 sm:py-4 border-b border-border/60 bg-gradient-to-r from-card via-card to-primary/5 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold text-foreground">MAESTRO</DialogTitle>
                <Badge className="bg-primary/20 text-primary border-primary/40 text-[10px] uppercase font-bold tracking-wider hover:bg-primary/30">
                  Agente Nativo Blink
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Assistente inteligente para criação de relatórios de vendas customizados
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetChat}
              className="h-8 text-xs gap-1.5 border-border/70 hover:border-primary/40 bg-card/60"
              title="Reiniciar conversa"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nova conversa</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Corpo: Chat Scrollable + Relatório Gerado */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Mensagens da conversa */}
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-3 text-sm animate-fade-in',
                  msg.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary/15 text-primary border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 space-y-2',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-xs shadow-xs ml-auto'
                      : 'bg-card/90 border border-border/60 text-foreground rounded-tl-xs shadow-xs',
                  )}
                >
                  <div className="whitespace-pre-wrap leading-relaxed text-xs sm:text-sm">
                    {msg.role === 'assistant' ? formatAssistantContent(msg.content) : msg.content}
                  </div>

                  {/* Indicador de typing no balão se estiver em progresso */}
                  {msg.isTyping && (
                    <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                      <span className="text-[11px] font-medium ml-1">Digitando resposta...</span>
                    </div>
                  )}

                  <div
                    className={cn(
                      'text-[10px] text-right pt-0.5',
                      msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground',
                    )}
                  >
                    {msg.timestamp.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5 text-muted-foreground">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {/* ESTADO DE TYPING geral enquanto aguarda primeiro byte */}
            {isTyping && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3 items-center text-sm text-muted-foreground animate-fade-in">
                <div className="w-8 h-8 rounded-full bg-primary/15 text-primary border border-primary/30 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-card/80 border border-border/60 rounded-2xl rounded-tl-xs px-4 py-2.5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                  <span className="text-xs font-medium ml-1">MAESTRO está digitando...</span>
                </div>
              </div>
            )}

            {/* ESTADO ERROR obrigatório:
                Mensagem em português: "Não foi possível gerar o relatório. Tente novamente." com botão de tentar novamente */}
            {hasError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 flex items-center justify-between gap-3 animate-fade-in text-destructive">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Não foi possível gerar o relatório. Tente novamente.</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRetry}
                  className="h-7 text-xs border-destructive/40 hover:bg-destructive/20 text-destructive shrink-0"
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Tentar novamente
                </Button>
              </div>
            )}

            {/* ESTADO SUCCESS:
                Relatório renderizado com fade-in */}
            {generatedReport && (
              <div className="pt-2 animate-fade-in border-t border-border/50">
                <MaestroReportView
                  reportData={generatedReport.data}
                  config={generatedReport.config}
                  generatedAt={generatedReport.generatedAt}
                />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Rodapé com campo de entrada */}
        <div className="p-3 sm:p-4 border-t border-border/60 bg-card/60 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Digite sua resposta para o MAESTRO..."
              disabled={isTyping}
              className="h-10 text-xs sm:text-sm bg-background border-border/80 focus-visible:ring-primary"
            />
            <Button
              type="submit"
              disabled={!inputText.trim() || isTyping}
              className="h-10 px-4 bg-primary text-primary-foreground font-semibold shrink-0 gap-1.5"
            >
              {isTyping ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Enviar</span>
                </>
              )}
            </Button>
          </form>

          {/* Sugestões rápidas no rodapé */}
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5 text-[11px] text-muted-foreground">
            <span className="shrink-0 font-medium text-foreground/70">Sugestões rápidas:</span>
            <button
              type="button"
              onClick={() => handleSendMessage('Quero o mês atual')}
              disabled={isTyping}
              className="px-2 py-0.5 rounded-md bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            >
              Mês atual
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('Todos os filtros e resumo na tela')}
              disabled={isTyping}
              className="px-2 py-0.5 rounded-md bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            >
              Visão geral
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('Sim, pode gerar o relatório!')}
              disabled={isTyping}
              className="px-2 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary shrink-0 transition-colors font-medium"
            >
              Confirmar geração
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
