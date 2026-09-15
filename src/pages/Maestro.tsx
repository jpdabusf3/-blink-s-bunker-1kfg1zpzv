import React, { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  Paperclip,
  Send,
  X,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Loader2,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  UserPlus,
  FileCheck,
  Bot,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useMaestroChat, type ChatMessage } from '@/hooks/useMaestroChat'
import { cn } from '@/lib/utils'

export function Maestro() {
  const navigate = useNavigate()
  const {
    messages,
    attachedFile,
    inputText,
    isSending,
    isAnalyzing,
    isExecuting,
    isLoadingHistory,
    lastFailedFile,
    setInputText,
    handleAttachFile,
    handleRemoveAttachment,
    sendMessage,
    handleConfirmAction,
    handleCancelAction,
    handleRetryAnalysis,
    handleSelectQuickAction,
    startNewChat,
  } = useMaestroChat()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isAnalyzing, isExecuting])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        handleAttachFile(file)
      } catch (err: unknown) {
        alert((err as Error).message)
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto px-2 sm:px-4 pb-2">
      {/* Top Header */}
      <div className="flex items-center justify-between py-3 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-foreground">Maestro AI</h1>
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-xs px-2 py-0.5"
              >
                Operacional
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Assistente inteligente para importação de NFs, cadastro de clientes e relatórios
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={startNewChat}
            disabled={isSending || isAnalyzing || isExecuting}
            className="h-8 text-xs gap-1.5 border-border/70 hover:border-amber-500/50 hover:text-amber-500 bg-card/60"
            title="Iniciar nova conversa limpa"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nova conversa</span>
          </Button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {/* Loading state ao restaurar histórico */}
        {isLoadingHistory && messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 max-w-lg mx-auto py-12">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500 mb-3" />
            <p className="text-sm text-muted-foreground animate-pulse">
              Carregando conversa do Maestro...
            </p>
          </div>
        )}

        {/* STATE 2: EMPTY STATE */}
        {!isLoadingHistory && messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 max-w-lg mx-auto py-12">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/30 flex items-center justify-center text-amber-500 mb-6 shadow-xl shadow-amber-500/5">
              <Sparkles className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-2 text-foreground">
              Olá! Sou o Maestro
            </h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-md">
              Anexe um PDF ou planilha e eu cuido do resto. Também posso responder dúvidas sobre
              vendas e faturamento da sua operação.
            </p>

            {/* Chips de Sugestão */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-card/60 hover:bg-card border-border/60 hover:border-amber-500/50 text-xs gap-1.5 h-9 rounded-full px-4 transition-all"
                onClick={() => {
                  fileInputRef.current?.click()
                }}
              >
                <FileCheck className="h-3.5 w-3.5 text-amber-500" />
                Importar NFs
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="bg-card/60 hover:bg-card border-border/60 hover:border-amber-500/50 text-xs gap-1.5 h-9 rounded-full px-4 transition-all"
                onClick={() => {
                  fileInputRef.current?.click()
                }}
              >
                <UserPlus className="h-3.5 w-3.5 text-amber-500" />
                Cadastrar clientes
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="bg-card/60 hover:bg-card border-border/60 hover:border-amber-500/50 text-xs gap-1.5 h-9 rounded-full px-4 transition-all"
                onClick={() => {
                  sendMessage('Gerar relatório com o resumo de faturamento e vendas recente')
                }}
              >
                <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                Gerar relatório
              </Button>
            </div>
          </div>
        )}

        {/* List of Messages */}
        {messages.map((message) => {
          const isUser = message.role === 'user'

          return (
            <div
              key={message.id}
              className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}
            >
              <div
                className={cn(
                  'flex gap-2 max-w-[90%] md:max-w-[80%]',
                  isUser ? 'flex-row-reverse' : 'flex-row',
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    'h-8 w-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-semibold shadow-sm mt-0.5',
                    isUser
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-amber-500/20 text-amber-500 border border-amber-500/30',
                  )}
                >
                  {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                {/* Message Bubble */}
                <div className="flex flex-col gap-1.5">
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-3 text-sm shadow-sm transition-all',
                      isUser
                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                        : 'bg-card border border-border/60 rounded-tl-none text-foreground',
                    )}
                  >
                    {/* Anexo dentro da bolha de mensagem */}
                    {message.attachment && (
                      <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-background/30 border border-border/40 text-xs">
                        {message.attachment.name.endsWith('.pdf') ? (
                          <FileText className="h-4 w-4 text-red-400 shrink-0" />
                        ) : (
                          <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
                        )}
                        <span className="truncate max-w-[200px] font-medium">
                          {message.attachment.name}
                        </span>
                        <span className="text-muted-foreground ml-auto shrink-0">
                          {formatFileSize(message.attachment.size)}
                        </span>
                      </div>
                    )}

                    {/* STATE 1: LOADING (Analisando...) */}
                    {message.isAnalyzing && (
                      <div className="flex items-center gap-2.5 py-1 text-amber-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="font-medium animate-pulse">Analisando arquivo...</span>
                      </div>
                    )}

                    {/* Conteúdo de Texto */}
                    {message.content && !message.isAnalyzing && (
                      <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
                    )}

                    {/* STATE 3: ERROR STATE COM BOTÃO TENTAR NOVAMENTE */}
                    {message.error && (
                      <div className="mt-2 pt-2 border-t border-border/40 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-red-400 text-xs">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>Não foi possível concluir a análise do arquivo.</span>
                        </div>
                        {lastFailedFile && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleRetryAnalysis}
                            className="w-fit text-xs h-8 gap-1.5 border-red-500/40 text-red-400 hover:bg-red-500/10"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Tentar novamente
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Botões de Resposta Rápida (quando documento for desconhecido) */}
                    {message.quickReplies && message.quickReplies.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/40 flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Selecione o que deseja fazer:
                        </span>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {message.quickReplies.map((qr, idx) => (
                            <Button
                              key={idx}
                              size="sm"
                              variant="outline"
                              onClick={qr.action}
                              className="text-xs h-8 bg-background/50 hover:bg-amber-500/10 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
                            >
                              {qr.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. CONFIRMATION CARD (Após análise do arquivo) */}
                  {message.confirmationCard && (
                    <div className="w-full max-w-xl bg-card border border-border/70 rounded-xl p-4 shadow-lg animate-in fade-in-50 duration-300">
                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-border/40">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
                            {message.confirmationCard.actionType === 'invoice_pdf' ? (
                              <FileText className="h-4 w-4" />
                            ) : (
                              <FileSpreadsheet className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm text-foreground">
                              {message.confirmationCard.title}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {message.confirmationCard.summary}
                            </p>
                          </div>
                        </div>

                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] px-2 py-0.5',
                            message.confirmationCard.status === 'confirmed' &&
                              'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
                            message.confirmationCard.status === 'executing' &&
                              'bg-amber-500/10 text-amber-500 border-amber-500/30 animate-pulse',
                            message.confirmationCard.status === 'cancelled' &&
                              'bg-muted text-muted-foreground border-border',
                            message.confirmationCard.status === 'pending' &&
                              'bg-blue-500/10 text-blue-400 border-blue-500/30',
                          )}
                        >
                          {message.confirmationCard.status === 'confirmed' && 'Concluído'}
                          {message.confirmationCard.status === 'executing' && 'Executando...'}
                          {message.confirmationCard.status === 'cancelled' && 'Cancelado'}
                          {message.confirmationCard.status === 'pending' &&
                            'Aguardando confirmação'}
                        </Badge>
                      </div>

                      {/* Tabela de Preview (primeiras 5 linhas) */}
                      {message.confirmationCard.previewRows.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Prévia dos dados identificados:
                          </p>
                          <div className="overflow-x-auto border border-border/40 rounded-lg max-h-48 text-xs bg-background/50">
                            <table className="w-full text-left border-collapse">
                              <thead className="bg-muted/50 border-b border-border/40 sticky top-0">
                                <tr>
                                  {Object.keys(message.confirmationCard.previewRows[0] || {})
                                    .slice(0, 5)
                                    .map((colKey) => (
                                      <th
                                        key={colKey}
                                        className="p-2 font-medium text-muted-foreground whitespace-nowrap"
                                      >
                                        {colKey.replace(/_/g, ' ')}
                                      </th>
                                    ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/20 font-mono text-[11px]">
                                {message.confirmationCard.previewRows
                                  .slice(0, 5)
                                  .map((row, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-muted/30">
                                      {Object.keys(message.confirmationCard.previewRows[0] || {})
                                        .slice(0, 5)
                                        .map((colKey) => {
                                          const val = row[colKey]
                                          return (
                                            <td
                                              key={colKey}
                                              className="p-2 whitespace-nowrap max-w-[150px] truncate"
                                            >
                                              {typeof val === 'object'
                                                ? JSON.stringify(val)
                                                : String(val ?? '-')}
                                            </td>
                                          )
                                        })}
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* STATE 4: SUCCESS RESULT OU BOTÕES DE AÇÃO */}
                      {message.confirmationCard.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isExecuting}
                            onClick={() => handleCancelAction(message.id)}
                            className="text-xs h-9 px-3"
                          >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            disabled={isExecuting}
                            onClick={() => handleConfirmAction(message.id)}
                            className="text-xs h-9 px-4 bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-sm"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                            Confirmar
                          </Button>
                        </div>
                      )}

                      {message.confirmationCard.status === 'executing' && (
                        <div className="flex items-center justify-center gap-2 py-2 text-amber-500 font-medium text-xs">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Executando tarefa no sistema...</span>
                        </div>
                      )}

                      {message.confirmationCard.status === 'confirmed' &&
                        message.confirmationCard.executionResult && (
                          <div className="pt-2 border-t border-border/40 animate-in fade-in duration-300">
                            <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium mb-3">
                              <CheckCircle2 className="h-4 w-4 shrink-0" />
                              <span>{message.confirmationCard.executionResult.message}</span>
                            </div>

                            {/* Detalhes de Falhas Parciais se houver */}
                            {message.confirmationCard.executionResult.errorDetails &&
                              message.confirmationCard.executionResult.errorDetails.length > 0 && (
                                <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                                  <p className="font-semibold mb-1">
                                    Avisos / Linhas com problemas (
                                    {message.confirmationCard.executionResult.errorDetails.length}):
                                  </p>
                                  <ul className="list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto font-mono text-[11px]">
                                    {message.confirmationCard.executionResult.errorDetails.map(
                                      (err, eIdx) => (
                                        <li key={eIdx}>
                                          Linha {err.row}: {err.reason}
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </div>
                              )}

                            <Button
                              size="sm"
                              className="w-full h-9 bg-card hover:bg-muted border border-border text-foreground font-medium text-xs justify-between"
                              onClick={() => {
                                if (message.confirmationCard?.executionResult?.navigationTab) {
                                  navigate(message.confirmationCard.executionResult.navigationTab)
                                }
                              }}
                            >
                              <span className="flex items-center gap-2">
                                <ExternalLink className="h-3.5 w-3.5 text-amber-500" />
                                {message.confirmationCard.executionResult.navigationLabel}
                              </span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        )}

                      {message.confirmationCard.status === 'cancelled' && (
                        <div className="flex items-center gap-2 text-muted-foreground text-xs pt-1">
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Esta ação foi cancelada pelo usuário.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timestamp */}
                  <span
                    className={cn(
                      'text-[10px] text-muted-foreground px-1',
                      isUser ? 'text-right' : 'text-left',
                    )}
                  >
                    {formatTimestamp(message.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area (Bottom) */}
      <div className="shrink-0 pt-2 border-t border-border/40 bg-background/95 backdrop-blur">
        {/* Attached File Preview Card above Input */}
        {attachedFile && (
          <div className="mb-2 p-2.5 rounded-xl bg-card border border-amber-500/30 flex items-center justify-between text-xs animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                {attachedFile.name.endsWith('.pdf') ? (
                  <FileText className="h-4 w-4" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
              </div>
              <div className="truncate">
                <p className="font-medium text-foreground truncate max-w-[260px] sm:max-w-md">
                  {attachedFile.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatFileSize(attachedFile.size)} • Pronto para envio
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 rounded-full"
              onClick={handleRemoveAttachment}
              title="Remover anexo"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Input Bar */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.xlsx,.xls,.csv"
            className="hidden"
          />

          {/* Paperclip Attach Button (min 44px touch target) */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending || isAnalyzing || isExecuting}
            className="h-11 w-11 rounded-xl text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 shrink-0 transition-colors"
            title="Anexar PDF, XLSX, XLS ou CSV (máx 20MB)"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          {/* Text Input */}
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Peça uma tarefa ao Maestro..."
            disabled={isSending || isAnalyzing}
            className="h-11 rounded-xl bg-card/70 border-border/60 focus-visible:ring-amber-500/40 text-sm"
          />

          {/* Send Button (min 44px touch target) */}
          <Button
            type="button"
            onClick={() => sendMessage()}
            disabled={(!inputText.trim() && !attachedFile) || isSending || isAnalyzing}
            className="h-11 w-11 rounded-xl bg-amber-600 hover:bg-amber-500 text-white shrink-0 shadow-md shadow-amber-600/20 transition-all disabled:opacity-50"
            title="Enviar mensagem"
          >
            {isSending || isAnalyzing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/70 text-center mt-1.5 pb-1">
          Suporta PDF de notas fiscais (DANFE), planilhas XLSX/XLS/CSV de clientes e vendas (até 20
          MB).
        </p>
      </div>
    </div>
  )
}

export default Maestro
