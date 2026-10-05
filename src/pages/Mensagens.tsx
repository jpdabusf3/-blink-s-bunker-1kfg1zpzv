import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  MessageSquare,
  Send,
  Plus,
  Search,
  Check,
  CheckCheck,
  ExternalLink,
  Users,
  User,
  Paperclip,
  RotateCw,
  AlertCircle,
  Building2,
  ShoppingCart,
  FileText,
  Layers,
  BarChart2,
  X,
  ChevronLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useRealtimeData } from '@/hooks/useRealtimeData'
import { chatService } from '@/services/chat-service'
import { getUsers, type UserListItem } from '@/services/users'
import { ChatConversa, ChatMensagem, ChatContextPayload, ChatContextType } from '@/types'
import { formatRelativeTimeBR } from '@/lib/contextNavigation'
import { useAppContext } from '@/store/AppContext'

export default function Mensagens() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const { factories } = useAppContext()

  // Estados de dados
  const [conversas, setConversas] = useState<ChatConversa[]>([])
  const [activeConversaId, setActiveConversaId] = useState<string | null>(null)
  const [mensagens, setMensagens] = useState<ChatMensagem[]>([])
  const [allUsers, setAllUsers] = useState<UserListItem[]>([])

  // Estados de carregamento e erro
  const [isLoadingConversas, setIsLoadingConversas] = useState(true)
  const [isLoadingMensagens, setIsLoadingMensagens] = useState(false)
  const [errorConversas, setErrorConversas] = useState<string | null>(null)
  const [errorMensagens, setErrorMensagens] = useState<string | null>(null)

  // Envio de nova mensagem
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [selectedContext, setSelectedContext] = useState<ChatContextPayload | null>(null)
  const [contextModalOpen, setContextModalOpen] = useState(false)

  // Busca e filtro
  const [searchFilter, setSearchFilter] = useState('')

  // Modal de nova conversa
  const [newChatModalOpen, setNewChatModalOpen] = useState(false)
  const [newChatType, setNewChatType] = useState<'direta' | 'grupo'>('direta')
  const [newChatTitle, setNewChatTitle] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [newChatInitialMsg, setNewChatInitialMsg] = useState('')
  const [isCreatingChat, setIsCreatingChat] = useState(false)

  // Contexto selecionado no modal de contexto
  const [modalContextType, setModalContextType] = useState<ChatContextType>('cliente')
  const [modalContextEntityId, setModalContextEntityId] = useState<string>('')
  const [modalContextCustomTitle, setModalContextCustomTitle] = useState('')

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null)

  const currentUserId = user?.id || ''

  // Scroll até a última mensagem
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end',
      })
    }
  }, [])

  // Carregar usuários para criação de conversas
  useEffect(() => {
    getUsers()
      .then((users) => {
        setAllUsers(users.filter((u) => u.id !== currentUserId && !u.deactivated))
      })
      .catch((err) => {
        console.warn('[Mensagens] Falha ao carregar lista de usuários:', err)
      })
  }, [currentUserId])

  // Carregar conversas do usuário
  const fetchConversas = useCallback(async () => {
    if (!currentUserId) return
    setIsLoadingConversas(true)
    setErrorConversas(null)
    try {
      const list = await chatService.listConversas(currentUserId)
      setConversas(list)

      // Se houver conversa na URL query (?conversa=ID), seleciona ela
      const urlConversaId = searchParams.get('conversa')
      if (urlConversaId && list.some((c) => c.id === urlConversaId)) {
        setActiveConversaId(urlConversaId)
      } else if (!activeConversaId && list.length > 0) {
        setActiveConversaId(list[0].id)
      }
    } catch (err) {
      console.error('[Mensagens] Erro ao buscar conversas:', err)
      setErrorConversas('Não foi possível carregar as conversas da equipe.')
    } finally {
      setIsLoadingConversas(false)
    }
  }, [currentUserId, searchParams, activeConversaId])

  useEffect(() => {
    fetchConversas()
  }, [fetchConversas])

  // Carregar mensagens da conversa ativa
  const fetchMensagens = useCallback(
    async (conversaId: string) => {
      if (!conversaId || !currentUserId) return
      setIsLoadingMensagens(true)
      setErrorMensagens(null)
      try {
        const msgs = await chatService.listMensagens(conversaId, currentUserId)
        setMensagens(msgs)

        // Marca a conversa e suas mensagens como lidas
        void chatService.markConversaAsRead(conversaId, currentUserId)

        setTimeout(() => {
          scrollToBottom(false)
        }, 100)
      } catch (err) {
        console.error('[Mensagens] Erro ao buscar mensagens:', err)
        setErrorMensagens('Não foi possível carregar as mensagens desta conversa.')
      } finally {
        setIsLoadingMensagens(false)
      }
    },
    [currentUserId, scrollToBottom],
  )

  useEffect(() => {
    if (activeConversaId) {
      fetchMensagens(activeConversaId)
    } else {
      setMensagens([])
    }
  }, [activeConversaId, fetchMensagens])

  // Realtime para novas mensagens e novas conversas
  useRealtimeData(['mensagens', 'leituras_mensagens', 'conversas'], (event) => {
    if (event.collection === 'mensagens') {
      const rec = event.record as unknown as ChatMensagem | undefined
      if (rec && rec.conversa_id === activeConversaId) {
        // Atualiza a conversa ativa
        chatService
          .listMensagens(activeConversaId, currentUserId)
          .then((msgs) => {
            setMensagens(msgs)
            scrollToBottom(true)
            void chatService.markConversaAsRead(activeConversaId, currentUserId)
          })
          .catch(() => {})
      }
      // Revalida a lista de conversas para atualizar a última mensagem
      chatService
        .listConversas(currentUserId)
        .then(setConversas)
        .catch(() => {})
    } else if (event.collection === 'leituras_mensagens') {
      if (activeConversaId) {
        chatService
          .listMensagens(activeConversaId, currentUserId)
          .then(setMensagens)
          .catch(() => {})
      }
    } else if (event.collection === 'conversas') {
      chatService
        .listConversas(currentUserId)
        .then(setConversas)
        .catch(() => {})
    }
  })

  // Enviar mensagem
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputText.trim() || !activeConversaId || isSending) return

    const textToSend = inputText.trim()
    const ctxToSend = selectedContext
    setInputText('')
    setSelectedContext(null)
    setIsSending(true)

    try {
      const sent = await chatService.sendMensagem({
        conversa_id: activeConversaId,
        autor_id: currentUserId,
        autor_nome: user?.name || user?.email || 'Membro da Equipe',
        texto: textToSend,
        context: ctxToSend || undefined,
      })

      // Adiciona otimista
      setMensagens((prev) => [
        ...prev,
        {
          ...sent,
          isReadByMe: true,
          readCount: 0,
        },
      ])

      scrollToBottom(true)
      chatInputRef.current?.focus()
    } catch (err) {
      console.error('[Mensagens] Erro ao enviar mensagem:', err)
      toast({
        title: 'Erro ao enviar mensagem',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
      setInputText(textToSend)
      setSelectedContext(ctxToSend)
    } finally {
      setIsSending(false)
    }
  }

  // Criar nova conversa
  const handleCreateConversa = async () => {
    if (selectedUserIds.length === 0) {
      toast({
        title: 'Selecione participantes',
        description: 'Escolha pelo menos um membro da equipe.',
        variant: 'destructive',
      })
      return
    }

    setIsCreatingChat(true)
    try {
      let created: ChatConversa

      if (newChatType === 'direta' && selectedUserIds.length === 1) {
        const otherUser = allUsers.find((u) => u.id === selectedUserIds[0])
        created = await chatService.getOrCreateDirectConversa(
          currentUserId,
          selectedUserIds[0],
          otherUser?.name || 'Colega',
        )
      } else {
        created = await chatService.createConversa({
          tipo: newChatType,
          titulo: newChatTitle.trim() || undefined,
          participantes: selectedUserIds,
          criador_id: currentUserId,
          mensagemInicial: newChatInitialMsg.trim() || undefined,
        })
      }

      toast({
        title: 'Conversa iniciada',
        description: 'Você pode começar a trocar mensagens agora.',
      })

      setNewChatModalOpen(false)
      setNewChatTitle('')
      setSelectedUserIds([])
      setNewChatInitialMsg('')

      await fetchConversas()
      setActiveConversaId(created.id)
      setSearchParams({ conversa: created.id })
    } catch (err) {
      console.error('[Mensagens] Falha ao criar conversa:', err)
      toast({
        title: 'Erro ao criar conversa',
        description: 'Não foi possível iniciar a conversa. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsCreatingChat(false)
    }
  }

  // Adicionar anexo de contexto de negócio
  const handleConfirmContext = () => {
    let titulo = modalContextCustomTitle.trim()
    let link = ''

    if (modalContextType === 'cliente') {
      const match = factories.find((f) => f.id === modalContextEntityId)
      if (match) {
        titulo = titulo || `Cliente: ${match.name}`
        link = `/cadastro?highlight=${match.id}`
      } else {
        titulo = titulo || 'Cliente'
        link = '/cadastro'
      }
    } else if (modalContextType === 'pedido') {
      titulo = titulo || `Pedido ${modalContextEntityId || ''}`.trim()
      link = modalContextEntityId
        ? `/gestao-pedidos?highlight=${modalContextEntityId}`
        : '/gestao-pedidos'
    } else if (modalContextType === 'funil') {
      const match = factories.find((f) => f.id === modalContextEntityId)
      titulo = titulo || (match ? `Oportunidade: ${match.name}` : 'Funil de Vendas')
      link = match ? `/funil?cliente=${match.id}` : '/funil'
    } else if (modalContextType === 'faturamento') {
      titulo = titulo || 'Importação de Faturamento'
      link = '/importar-faturamento'
    } else if (modalContextType === 'relatorio-vendas') {
      titulo = titulo || 'Relatório de Vendas'
      link = '/relatorio-vendas'
    } else if (modalContextType === 'resumo') {
      titulo = titulo || 'Resumo Geral'
      link = '/resumo'
    } else if (modalContextType === 'mapa') {
      titulo = titulo || 'Mapa de Clientes'
      link = '/mapa'
    } else if (modalContextType === 'produtos') {
      titulo = titulo || 'Catálogo de Produtos'
      link = '/produtos'
    } else if (modalContextType === 'equipe') {
      titulo = titulo || 'Gestão da Equipe'
      link = '/equipe'
    } else if (modalContextType === 'usuarios') {
      titulo = titulo || 'Membros & Usuários'
      link = '/usuarios'
    }

    setSelectedContext({
      context_type: modalContextType,
      context_id: modalContextEntityId || undefined,
      context_titulo: titulo,
      context_link: link,
    })

    setContextModalOpen(false)
    setModalContextCustomTitle('')
    setModalContextEntityId('')
  }

  // Navegar contextualmente ao clicar em um card de contexto
  const handleNavigateContext = (link?: string) => {
    if (!link) return
    navigate(link)
  }

  // Obter conversa ativa
  const activeConversa = useMemo(() => {
    return conversas.find((c) => c.id === activeConversaId) || null
  }, [conversas, activeConversaId])

  // Filtrar conversas
  const filteredConversas = useMemo(() => {
    if (!searchFilter.trim()) return conversas
    const term = searchFilter.toLowerCase()
    return conversas.filter((c) => {
      const titleMatch = (c.titulo || '').toLowerCase().includes(term)
      const lastMsgMatch = (c.ultima_mensagem_texto || '').toLowerCase().includes(term)
      const participantsMatch = (c.expand?.participantes || []).some((p) =>
        (p.name || '').toLowerCase().includes(term),
      )
      return titleMatch || lastMsgMatch || participantsMatch
    })
  }, [conversas, searchFilter])

  // Nome exibido da conversa
  const getConversaDisplayName = (conversa: ChatConversa) => {
    if (conversa.tipo === 'grupo') {
      return conversa.titulo || 'Grupo da Equipe'
    }
    // Para conversa direta, exibe o nome do outro participante
    const otherParticipant = (conversa.expand?.participantes || []).find(
      (p) => p.id !== currentUserId,
    )
    if (otherParticipant?.name) {
      return otherParticipant.name
    }
    return conversa.titulo || 'Conversa Direta'
  }

  // Ícone por tipo de contexto
  const renderContextIcon = (type?: string) => {
    switch (type) {
      case 'cliente':
        return <Building2 className="w-4 h-4 text-blue-500" />
      case 'pedido':
        return <ShoppingCart className="w-4 h-4 text-emerald-500" />
      case 'funil':
      case 'funil-vendas':
        return <BarChart2 className="w-4 h-4 text-amber-500" />
      case 'faturamento':
        return <Layers className="w-4 h-4 text-purple-500" />
      default:
        return <FileText className="w-4 h-4 text-primary" />
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] animate-fade-in -mx-4 -my-4 lg:-mx-6 lg:-my-6 bg-background">
      <div className="flex flex-1 overflow-hidden">
        {/* Painel lateral: lista de conversas */}
        <aside
          className={`w-full md:w-80 lg:w-96 border-r border-border flex flex-col bg-card/60 backdrop-blur-sm shrink-0 ${
            activeConversaId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Header da lista */}
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="font-bold text-lg leading-tight">Mensagens</h1>
                  <p className="text-xs text-muted-foreground">Chat interno da equipe</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setNewChatModalOpen(true)}
                className="gap-1.5 h-8 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Nova</span>
              </Button>
            </div>

            {/* Busca */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Buscar conversas ou pessoas..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
          </div>

          {/* Lista de conversas */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/50 custom-scrollbar">
            {isLoadingConversas ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : errorConversas ? (
              <div className="p-6 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <p className="text-sm text-muted-foreground">{errorConversas}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchConversas}
                  className="gap-1.5 text-xs"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Tentar novamente</span>
                </Button>
              </div>
            ) : filteredConversas.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center text-muted-foreground">
                  <MessageSquare className="w-6 h-6 opacity-40" />
                </div>
                <p className="text-sm font-medium text-foreground">Nenhuma mensagem</p>
                <p className="text-xs text-muted-foreground">
                  Inicie uma conversa direta ou em grupo com sua equipe.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewChatModalOpen(true)}
                  className="gap-1.5 text-xs mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Iniciar conversa</span>
                </Button>
              </div>
            ) : (
              filteredConversas.map((c) => {
                const isSelected = c.id === activeConversaId
                const title = getConversaDisplayName(c)
                const isGroup = c.tipo === 'grupo'

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setActiveConversaId(c.id)
                      setSearchParams({ conversa: c.id })
                    }}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors hover:bg-muted/50 ${
                      isSelected ? 'bg-primary/10 border-l-4 border-primary pl-2.5' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 font-bold text-sm">
                      {isGroup ? (
                        <Users className="w-5 h-5" />
                      ) : (
                        title.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-semibold text-sm truncate text-foreground">
                          {title}
                        </span>
                        {c.ultima_mensagem_data && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatRelativeTimeBR(c.ultima_mensagem_data)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.ultima_mensagem_texto || 'Nenhuma mensagem enviada'}
                      </p>
                      {c.context_titulo && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-primary/80 truncate">
                          {renderContextIcon(c.context_type)}
                          <span className="truncate">{c.context_titulo}</span>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* Área da conversa ativa */}
        <main
          className={`flex-1 flex flex-col bg-background ${
            !activeConversaId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activeConversa ? (
            <>
              {/* Header do Chat Ativo */}
              <header className="p-3.5 px-4 border-b border-border flex items-center justify-between bg-card/40 backdrop-blur-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden h-8 w-8"
                    onClick={() => {
                      setActiveConversaId(null)
                      setSearchParams({})
                    }}
                    title="Voltar para a lista"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 font-bold text-xs">
                    {activeConversa.tipo === 'grupo' ? (
                      <Users className="w-4 h-4" />
                    ) : (
                      getConversaDisplayName(activeConversa).substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-sm truncate text-foreground">
                      {getConversaDisplayName(activeConversa)}
                    </h2>
                    <p className="text-xs text-muted-foreground truncate">
                      {activeConversa.tipo === 'grupo'
                        ? `${activeConversa.participantes?.length || 0} membros`
                        : 'Conversa direta'}
                    </p>
                  </div>
                </div>

                {/* Contexto global da conversa (se houver) */}
                {activeConversa.context_titulo && activeConversa.context_link && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNavigateContext(activeConversa.context_link)}
                    className="gap-1.5 text-xs h-8 shadow-sm border-primary/30 text-primary hover:bg-primary/10"
                    title="Abrir contexto associado a esta conversa"
                  >
                    {renderContextIcon(activeConversa.context_type)}
                    <span className="hidden sm:inline truncate max-w-[150px]">
                      {activeConversa.context_titulo}
                    </span>
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                )}
              </header>

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-muted/15">
                {isLoadingMensagens ? (
                  <div className="space-y-4 py-4">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`flex gap-3 max-w-[80%] ${
                          i % 2 === 0 ? 'ml-auto flex-row-reverse' : ''
                        }`}
                      >
                        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                        <div className="space-y-1.5 flex-1">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-12 w-full rounded-lg" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : errorMensagens ? (
                  <div className="p-8 text-center space-y-3">
                    <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <p className="text-sm text-muted-foreground">{errorMensagens}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchMensagens(activeConversa.id)}
                      className="gap-1.5 text-xs"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Tentar novamente</span>
                    </Button>
                  </div>
                ) : mensagens.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                      <MessageSquare className="w-6 h-6 opacity-40" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Nenhuma mensagem</p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Envie uma mensagem abaixo para iniciar a comunicação com sua equipe.
                    </p>
                  </div>
                ) : (
                  mensagens.map((msg) => {
                    const isOwn = msg.autor_id === currentUserId
                    const authorName =
                      msg.expand?.autor_id?.name || msg.autor_nome || (isOwn ? 'Você' : 'Membro')

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-2.5 max-w-[88%] md:max-w-[75%] ${
                          isOwn ? 'ml-auto flex-row-reverse' : 'mr-auto'
                        }`}
                      >
                        {/* Avatar */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-1 shadow-sm ${
                            isOwn
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted border border-border text-foreground'
                          }`}
                        >
                          {authorName.substring(0, 2).toUpperCase()}
                        </div>

                        {/* Balão */}
                        <div
                          className={`rounded-2xl p-3 text-sm shadow-subtle space-y-1.5 ${
                            isOwn
                              ? 'bg-primary text-primary-foreground rounded-tr-none'
                              : 'bg-card border border-border text-foreground rounded-tl-none'
                          }`}
                        >
                          {!isOwn && (
                            <p className="text-[11px] font-semibold text-primary mb-0.5">
                              {authorName}
                            </p>
                          )}

                          <p className="whitespace-pre-wrap leading-relaxed break-words text-sm">
                            {msg.texto}
                          </p>

                          {/* Card de contexto anexado (Navegação Contextual) */}
                          {msg.context_titulo && (
                            <button
                              type="button"
                              onClick={() => handleNavigateContext(msg.context_link)}
                              className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between gap-2 transition-all mt-1.5 ${
                                isOwn
                                  ? 'bg-white/10 border-white/20 hover:bg-white/15 text-white'
                                  : 'bg-muted/40 border-border hover:bg-muted text-foreground'
                              }`}
                              title={`Abrir ${msg.context_titulo}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {renderContextIcon(msg.context_type)}
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold truncate">
                                    {msg.context_titulo}
                                  </p>
                                  <p className="text-[10px] opacity-80 truncate">
                                    Clique para abrir diretamente no app
                                  </p>
                                </div>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" />
                            </button>
                          )}

                          {/* Metadados: Horário e Check de Leitura */}
                          <div
                            className={`flex items-center justify-end gap-1.5 text-[10px] pt-0.5 ${
                              isOwn ? 'text-primary-foreground/80' : 'text-muted-foreground'
                            }`}
                          >
                            <span>
                              {new Date(msg.created).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>

                            {/* Check de leitura (✓) */}
                            {isOwn && (
                              <span
                                title={
                                  (msg.readCount || 0) > 0
                                    ? 'Mensagem visualizada'
                                    : 'Mensagem enviada'
                                }
                                className="inline-flex items-center"
                              >
                                {(msg.readCount || 0) > 0 ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-emerald-300" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 opacity-80" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Anexo de Contexto Ativo no Input */}
              {selectedContext && (
                <div className="px-4 py-2 bg-primary/5 border-t border-primary/20 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-primary font-medium truncate">
                    {renderContextIcon(selectedContext.context_type)}
                    <span>Contexto anexado:</span>
                    <strong className="truncate">{selectedContext.context_titulo}</strong>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedContext(null)}
                    title="Remover anexo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}

              {/* Barra de Envio */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 border-t border-border bg-card/50 flex items-end gap-2"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setContextModalOpen(true)}
                  title="Anexar contexto (Cliente, Pedido, Funil ou Seção)"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>

                <div className="flex-1 min-w-0">
                  <Textarea
                    ref={chatInputRef}
                    placeholder="Digite sua mensagem para a equipe... (Shift+Enter quebra linha)"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    rows={1}
                    className="min-h-[40px] max-h-32 py-2 resize-none text-sm"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="h-10 px-4 gap-1.5 shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Enviar</span>
                </Button>
              </form>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Selecione uma conversa ou inicie uma nova
              </h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Comunique-se em tempo real com os membros da equipe Blink, troque informações sobre
                clientes, pedidos e funil de vendas.
              </p>
              <Button onClick={() => setNewChatModalOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                <span>Nova conversa</span>
              </Button>
            </div>
          )}
        </main>
      </div>

      {/* Modal: Nova Conversa */}
      <Dialog open={newChatModalOpen} onOpenChange={setNewChatModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Conversa</DialogTitle>
            <DialogDescription>
              Inicie uma conversa direta com um colega ou crie um grupo temático da equipe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={newChatType === 'direta' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setNewChatType('direta')}
              >
                <User className="w-4 h-4" />
                <span>Conversa Direta</span>
              </Button>
              <Button
                type="button"
                variant={newChatType === 'grupo' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setNewChatType('grupo')}
              >
                <Users className="w-4 h-4" />
                <span>Grupo de Equipe</span>
              </Button>
            </div>

            {newChatType === 'grupo' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Nome do Grupo</label>
                <Input
                  placeholder="Ex: Comercial Sul, Nutrição Animal, Estratégia..."
                  value={newChatTitle}
                  onChange={(e) => setNewChatTitle(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {newChatType === 'direta' ? 'Selecione o colega' : 'Selecione os participantes'}
              </label>
              <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1 custom-scrollbar">
                {allUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">Nenhum membro encontrado.</p>
                ) : (
                  allUsers.map((u) => {
                    const isSelected = selectedUserIds.includes(u.id)
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          if (newChatType === 'direta') {
                            setSelectedUserIds([u.id])
                          } else {
                            setSelectedUserIds((prev) =>
                              prev.includes(u.id)
                                ? prev.filter((id) => id !== u.id)
                                : [...prev, u.id],
                            )
                          }
                        }}
                        className={`w-full text-left p-2 rounded flex items-center justify-between text-xs transition-colors ${
                          isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-foreground">{u.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {u.job_title || u.email}
                          </p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-primary" />}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Mensagem inicial (opcional)
              </label>
              <Input
                placeholder="Ex: Olá, podemos alinhar sobre o pedido..."
                value={newChatInitialMsg}
                onChange={(e) => setNewChatInitialMsg(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewChatModalOpen(false)}
              disabled={isCreatingChat}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateConversa}
              disabled={isCreatingChat || selectedUserIds.length === 0}
            >
              {isCreatingChat ? 'Iniciando...' : 'Criar Conversa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Anexar Contexto de Negócio */}
      <Dialog open={contextModalOpen} onOpenChange={setContextModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Anexar Contexto</DialogTitle>
            <DialogDescription>
              Vincule um registro ou seção para que a equipe navegue diretamente com um clique.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Tipo de Contexto</label>
              <Select
                value={modalContextType}
                onValueChange={(val: ChatContextType) => setModalContextType(val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente / Fábrica (/cadastro)</SelectItem>
                  <SelectItem value="pedido">Pedido Comercial (/gestao-pedidos)</SelectItem>
                  <SelectItem value="funil">Funil de Vendas (/funil)</SelectItem>
                  <SelectItem value="faturamento">
                    Importação Faturamento (/importar-faturamento)
                  </SelectItem>
                  <SelectItem value="relatorio-vendas">
                    Relatório de Vendas (/relatorio-vendas)
                  </SelectItem>
                  <SelectItem value="resumo">Resumo Executivo (/resumo)</SelectItem>
                  <SelectItem value="mapa">Mapa de Clientes (/mapa)</SelectItem>
                  <SelectItem value="produtos">Produtos (/produtos)</SelectItem>
                  <SelectItem value="equipe">Equipe (/equipe)</SelectItem>
                  <SelectItem value="usuarios">Usuários (/usuarios)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {modalContextType === 'cliente' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Selecione o Cliente</label>
                <Select
                  value={modalContextEntityId}
                  onValueChange={(id) => {
                    setModalContextEntityId(id)
                    const match = factories.find((f) => f.id === id)
                    if (match) {
                      setModalContextCustomTitle(`Cliente: ${match.name}`)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {factories.slice(0, 100).map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {modalContextType === 'pedido' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Número do Pedido ou ID
                </label>
                <Input
                  placeholder="Ex: 1042 ou chave do pedido"
                  value={modalContextEntityId}
                  onChange={(e) => setModalContextEntityId(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Título ou Nota do Contexto
              </label>
              <Input
                placeholder="Ex: Revisar meta deste cliente, Dúvida na NF..."
                value={modalContextCustomTitle}
                onChange={(e) => setModalContextCustomTitle(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setContextModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmContext}>Anexar à Mensagem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
