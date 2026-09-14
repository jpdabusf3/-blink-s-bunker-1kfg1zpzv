import React, { useState, useEffect, useMemo, useId } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { usePedidoVenda } from '@/hooks/usePedidoVenda'
import type { PedidoFormData } from '@/services/pedidoService'
import { toast } from '@/hooks/use-toast'
import {
  FilePlus,
  Download,
  Mail,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Building2,
  Users2,
  Package,
  Receipt,
  Truck,
  Layers,
  Calculator,
  ChevronRight,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

const ESTADO_OPTIONS = ['Parana', 'Outros Estados'] as const
const ESPECIE_FISCAL_OPTIONS = ['PET', 'AVES', 'SUINOS', 'RUMINANTES', 'DISTRIBUICAO'] as const
const CANAL_VENDAS_OPTIONS = [
  'Direto',
  'Distribuidor',
  'Industria',
  'Premixera',
  'Cooperativa',
  'Online',
] as const
const ESPECIE_DESTINO_OPTIONS = ['PET', 'AVES', 'SUINOS', 'RUMINANTES', 'AQUA', 'OUTRO'] as const

function formatBRL(value: number): string {
  if (value == null || isNaN(value)) return 'R$ 0,00'
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function NovoPedido() {
  const { user } = useAuth()
  const {
    produtos,
    gestoresTecnicos,
    vendedores,
    loading: initialLoading,
    fetchMatrizFiscal,
    fetchAtribuicaoCliente,
    calcularPedido,
    gerarDocumento,
    salvarAtribuicao,
    createPedido,
    logPedido,
  } = usePedidoVenda()

  // IDs para acessibilidade
  const clienteNomeId = useId()
  const clienteEmailId = useId()
  const clienteDocId = useId()
  const clienteEndId = useId()
  const solicitanteId = useId()
  const quantidadeId = useId()
  const descontoId = useId()
  const freteValorId = useId()
  const impostosAdicId = useId()
  const obsId = useId()

  // Form State
  const [clienteNome, setClienteNome] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [clienteDocumento, setClienteDocumento] = useState('')
  const [clienteEndereco, setClienteEndereco] = useState('')
  const [solicitante, setSolicitante] = useState('')

  // Passo 2
  const [gestorTecnicoId, setGestorTecnicoId] = useState('')
  const [vendedorId, setVendedorId] = useState('')
  const [temAtribuicaoPrevia, setTemAtribuicaoPrevia] = useState(false)
  const [salvarAtribuicaoCheck, setSalvarAtribuicaoCheck] = useState(false)
  const [buscandoAtribuicao, setBuscandoAtribuicao] = useState(false)

  // Passo 3
  const [produtoId, setProdutoId] = useState('')
  const [quantidade, setQuantidade] = useState<number>(1)
  const [descontoPercent, setDescontoPercent] = useState<number>(0)

  // Passo 4
  const [estado, setEstado] = useState<'Parana' | 'Outros Estados' | ''>('')
  const [especie, setEspecie] = useState<
    'PET' | 'AVES' | 'SUINOS' | 'RUMINANTES' | 'DISTRIBUICAO' | ''
  >('')
  const [aliquotaIcms, setAliquotaIcms] = useState<number>(0)
  const [aliquotaPis, setAliquotaPis] = useState<number>(0)
  const [aliquotaCofins, setAliquotaCofins] = useState<number>(0)
  const [freteFobPercent, setFreteFobPercent] = useState<number>(0)
  const [freteCifPercent, setFreteCifPercent] = useState<number>(0)
  const [modalidadeFrete, setModalidadeFrete] = useState<'FOB' | 'CIF'>('FOB')
  const [freteAutomatico, setFreteAutomatico] = useState<boolean>(true)
  const [freteValorManual, setFreteValorManual] = useState<number>(0)
  const [impostosAdicionais, setImpostosAdicionais] = useState<number>(0)
  const [matrizFiscalErro, setMatrizFiscalErro] = useState<string | null>(null)
  const [buscandoMatriz, setBuscandoMatriz] = useState(false)

  // Passo 5
  const [canalVendas, setCanalVendas] = useState<
    'Direto' | 'Distribuidor' | 'Industria' | 'Premixera' | 'Cooperativa' | 'Online' | ''
  >('')
  const [especieDestino, setEspecieDestino] = useState<
    'PET' | 'AVES' | 'SUINOS' | 'RUMINANTES' | 'AQUA' | 'OUTRO' | ''
  >('')
  const [observacoes, setObservacoes] = useState('')

  // Edição manual de valores calculados (Passo 6)
  const [manualPrecoBase, setManualPrecoBase] = useState<number | null>(null)
  const [manualIcmsValor, setManualIcmsValor] = useState<number | null>(null)
  const [manualPisValor, setManualPisValor] = useState<number | null>(null)
  const [manualCofinsValor, setManualCofinsValor] = useState<number | null>(null)
  const [manualFreteValor, setManualFreteValor] = useState<number | null>(null)
  const [manualPrecoFob, setManualPrecoFob] = useState<number | null>(null)
  const [manualPrecoCif, setManualPrecoCif] = useState<number | null>(null)
  const [manualTotalGeral, setManualTotalGeral] = useState<number | null>(null)

  // Status de geração e sucesso
  const [gerando, setGerando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [ultimoPedidoGerado, setUltimoPedidoGerado] = useState<PedidoFormData | null>(null)
  const [ultimoDownloadUrl, setUltimoDownloadUrl] = useState<string | null>(null)
  const [ultimoFileName, setUltimoFileName] = useState<string>('')
  const [ultimoBlob, setUltimoBlob] = useState<Blob | null>(null)

  // Inicializar Solicitante a partir do usuário autenticado
  useEffect(() => {
    if (user && !solicitante) {
      setSolicitante(user.name || user.email || '')
    }
  }, [user, solicitante])

  // Produto selecionado
  const selectedProduto = useMemo(() => {
    return produtos.find((p) => p.id === produtoId) || null
  }, [produtos, produtoId])

  // Auto preenchimento da Matriz Fiscal quando estado e espécie mudam
  useEffect(() => {
    if (!estado || !especie) {
      setAliquotaIcms(0)
      setAliquotaPis(0)
      setAliquotaCofins(0)
      setFreteFobPercent(0)
      setFreteCifPercent(0)
      setMatrizFiscalErro(null)
      return
    }

    let active = true
    setBuscandoMatriz(true)
    fetchMatrizFiscal(estado, especie)
      .then((mf) => {
        if (!active) return
        if (mf) {
          setAliquotaIcms(Number(mf.aliquota_icms) || 0)
          setAliquotaPis(Number(mf.aliquota_pis) || 0)
          setAliquotaCofins(Number(mf.aliquota_cofins) || 0)
          setFreteFobPercent(Number(mf.frete_fob_percent) || 0)
          setFreteCifPercent(Number(mf.frete_cif_percent) || 0)
          setMatrizFiscalErro(null)
        } else {
          setMatrizFiscalErro('Combinação de estado e espécie não encontrada na matriz fiscal.')
        }
      })
      .catch(() => {
        if (active) {
          setMatrizFiscalErro('Combinação de estado e espécie não encontrada na matriz fiscal.')
        }
      })
      .finally(() => {
        if (active) setBuscandoMatriz(false)
      })

    return () => {
      active = false
    }
  }, [estado, especie, fetchMatrizFiscal])

  // Percentual de frete ativo com base na modalidade (FOB vs CIF)
  const fretePercentualAtivo = useMemo(() => {
    return modalidadeFrete === 'CIF' ? freteCifPercent : freteFobPercent
  }, [modalidadeFrete, freteCifPercent, freteFobPercent])

  // Auto consulta de atribuição de clientes por nome
  useEffect(() => {
    const nomeLimpo = clienteNome.trim()
    if (nomeLimpo.length < 3) {
      setTemAtribuicaoPrevia(false)
      return
    }

    const timer = setTimeout(() => {
      setBuscandoAtribuicao(true)
      fetchAtribuicaoCliente(nomeLimpo)
        .then((atrib) => {
          if (atrib) {
            setTemAtribuicaoPrevia(true)
            if (atrib.gestor_tecnico_id) setGestorTecnicoId(atrib.gestor_tecnico_id)
            if (atrib.vendedor_id) setVendedorId(atrib.vendedor_id)
          } else {
            setTemAtribuicaoPrevia(false)
          }
        })
        .finally(() => setBuscandoAtribuicao(false))
    }, 400)

    return () => clearTimeout(timer)
  }, [clienteNome, fetchAtribuicaoCliente])

  // Cálculo automático ao vivo
  const calculoAuto = useMemo(() => {
    const precoLiquido = selectedProduto?.preco_base || 0
    return calcularPedido({
      quantidade,
      preco_liquido: precoLiquido,
      desconto_percent: descontoPercent,
      aliquota_icms: aliquotaIcms,
      aliquota_pis: aliquotaPis,
      aliquota_cofins: aliquotaCofins,
      modalidade_frete: modalidadeFrete,
      frete_automatico: freteAutomatico,
      frete_percentual: fretePercentualAtivo,
      frete_valor: freteValorManual,
      impostos_adicionais: impostosAdicionais,
    })
  }, [
    calcularPedido,
    selectedProduto,
    quantidade,
    descontoPercent,
    aliquotaIcms,
    aliquotaPis,
    aliquotaCofins,
    modalidadeFrete,
    freteAutomatico,
    fretePercentualAtivo,
    freteValorManual,
    impostosAdicionais,
  ])

  // Valores finais (se o usuário editou manualmente ou usa o automático)
  const finalPrecoBase = manualPrecoBase !== null ? manualPrecoBase : calculoAuto.preco_base
  const finalIcmsValor = manualIcmsValor !== null ? manualIcmsValor : calculoAuto.icms_valor
  const finalPisValor = manualPisValor !== null ? manualPisValor : calculoAuto.pis_valor
  const finalCofinsValor = manualCofinsValor !== null ? manualCofinsValor : calculoAuto.cofins_valor
  const finalFreteValor = manualFreteValor !== null ? manualFreteValor : calculoAuto.frete_valor
  const finalPrecoFob =
    manualPrecoFob !== null
      ? manualPrecoFob
      : finalPrecoBase + finalIcmsValor + finalPisValor + finalCofinsValor + impostosAdicionais
  const finalPrecoCif = manualPrecoCif !== null ? manualPrecoCif : finalPrecoFob + finalFreteValor
  const finalTotalGeral = manualTotalGeral !== null ? manualTotalGeral : finalPrecoCif

  // Validação dos campos
  const emailValido = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clienteEmail.trim())
  }, [clienteEmail])

  const formValido = useMemo(() => {
    if (!clienteNome.trim() || clienteNome.trim().length < 3) return false
    if (!clienteEmail.trim() || !emailValido) return false
    if (!solicitante.trim()) return false
    if (!vendedorId) return false
    if (!produtoId) return false
    if (quantidade < 1 || !Number.isInteger(Number(quantidade))) return false
    if (!estado) return false
    if (!especie) return false
    if (!modalidadeFrete) return false
    if (!freteAutomatico && (freteValorManual == null || freteValorManual < 0)) return false
    if (!canalVendas) return false
    if (!especieDestino) return false
    return true
  }, [
    clienteNome,
    clienteEmail,
    emailValido,
    solicitante,
    vendedorId,
    produtoId,
    quantidade,
    estado,
    especie,
    modalidadeFrete,
    freteAutomatico,
    freteValorManual,
    canalVendas,
    especieDestino,
  ])

  // Reset do formulário para novo pedido
  const handleNovoPedidoReset = () => {
    setClienteNome('')
    setClienteEmail('')
    setClienteDocumento('')
    setClienteEndereco('')
    setGestorTecnicoId('')
    setVendedorId('')
    setSalvarAtribuicaoCheck(false)
    setProdutoId('')
    setQuantidade(1)
    setDescontoPercent(0)
    setEstado('')
    setEspecie('')
    setModalidadeFrete('FOB')
    setFreteAutomatico(true)
    setFreteValorManual(0)
    setImpostosAdicionais(0)
    setCanalVendas('')
    setEspecieDestino('')
    setObservacoes('')
    setManualPrecoBase(null)
    setManualIcmsValor(null)
    setManualPisValor(null)
    setManualCofinsValor(null)
    setManualFreteValor(null)
    setManualPrecoFob(null)
    setManualPrecoCif(null)
    setManualTotalGeral(null)
    setSucesso(false)
    setUltimoPedidoGerado(null)
    setUltimoDownloadUrl(null)
    setUltimoFileName('')
    setUltimoBlob(null)
  }

  // Ação de Gerar Pedido
  const handleGerarPedido = async () => {
    if (!formValido) {
      toast({
        title: 'Formulário Incompleto',
        description: 'Por favor, preencha todos os campos obrigatórios corretamente.',
        variant: 'destructive',
      })
      return
    }

    const gtNome = gestoresTecnicos.find((g) => g.id === gestorTecnicoId)?.nome || ''
    const vNome = vendedores.find((v) => v.id === vendedorId)?.nome || ''
    const pNome = selectedProduto?.nome || ''
    const pCodigo = selectedProduto?.codigo || ''
    const pLinha = selectedProduto?.linha || ''

    const pedidoData: PedidoFormData = {
      cliente_nome: clienteNome.trim(),
      cliente_email: clienteEmail.trim(),
      cliente_documento: clienteDocumento.trim(),
      cliente_endereco: clienteEndereco.trim(),
      solicitante: solicitante.trim(),

      gestor_tecnico_id: gestorTecnicoId,
      gestor_tecnico_nome: gtNome,
      vendedor_id: vendedorId,
      vendedor_nome: vNome,
      salvar_atribuicao: salvarAtribuicaoCheck,

      produto_id: produtoId,
      produto_codigo: pCodigo,
      produto_nome: pNome,
      produto_linha: pLinha,
      preco_liquido: selectedProduto?.preco_base || 0,
      base_calculo: selectedProduto?.preco_base || 0,
      quantidade,
      desconto_percent: descontoPercent,

      estado,
      especie,
      aliquota_icms: aliquotaIcms,
      aliquota_pis: aliquotaPis,
      aliquota_cofins: aliquotaCofins,
      modalidade_frete: modalidadeFrete,
      frete_percentual: fretePercentualAtivo,
      frete_automatico: freteAutomatico,
      frete_valor: finalFreteValor,
      impostos_adicionais: impostosAdicionais,

      canal_vendas: canalVendas,
      especie_destino: especieDestino,
      observacoes: observacoes.trim(),

      preco_base: finalPrecoBase,
      icms_valor: finalIcmsValor,
      pis_valor: finalPisValor,
      cofins_valor: finalCofinsValor,
      preco_fob: finalPrecoFob,
      preco_cif: finalPrecoCif,
      total_geral: finalTotalGeral,
    }

    setGerando(true)
    try {
      // 1. Revogar URL anterior se houver para evitar vazamento de memória
      if (ultimoDownloadUrl) {
        URL.revokeObjectURL(ultimoDownloadUrl)
        setUltimoDownloadUrl(null)
      }

      // 2. Gerar documento .docx e disparar download
      const { blob, fileName, downloadUrl } = await gerarDocumento(pedidoData)
      setUltimoBlob(blob)
      setUltimoFileName(fileName)
      setUltimoDownloadUrl(downloadUrl)
      setUltimoPedidoGerado(pedidoData)

      // 3. Salvar atribuição se o checkbox foi marcado
      if (salvarAtribuicaoCheck && !temAtribuicaoPrevia) {
        await salvarAtribuicao({
          cliente_nome: clienteNome.trim(),
          gestor_tecnico_id: gestorTecnicoId,
          vendedor_id: vendedorId,
        })
      }

      // 4. Salvar registro na coleção pedidos (se existir)
      await createPedido(pedidoData)

      // 5. Registrar log no funnel_activity_log
      await logPedido({
        cliente_nome: clienteNome.trim(),
        produto_nome: pNome,
        gestor_tecnico_nome: gtNome,
        vendedor_nome: vNome,
      })

      setSucesso(true)
      toast({
        title: 'Pedido gerado com sucesso!',
        description: 'O documento .docx foi gerado e baixado automaticamente.',
      })
    } catch (err: any) {
      console.error('Erro completo na geração do documento Word:', err)
      toast({
        title: 'Erro ao gerar relatorio. Tente novamente.',
        description: 'Erro ao gerar documento. Verifique os dados e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setGerando(false)
    }
  }

  // Re-download do documento
  const handleBaixarNovamente = () => {
    try {
      if (ultimoBlob && ultimoFileName) {
        if (ultimoDownloadUrl) {
          URL.revokeObjectURL(ultimoDownloadUrl)
        }
        const url = URL.createObjectURL(ultimoBlob)
        setUltimoDownloadUrl(url)
        const a = document.createElement('a')
        a.href = url
        a.download = ultimoFileName
        a.rel = 'noopener noreferrer'
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        toast({
          title: 'Download iniciado',
          description: ultimoFileName,
        })
      } else if (ultimoPedidoGerado) {
        setGerando(true)
        gerarDocumento(ultimoPedidoGerado)
          .then(({ blob, fileName, downloadUrl }) => {
            setUltimoBlob(blob)
            setUltimoFileName(fileName)
            setUltimoDownloadUrl(downloadUrl)
            toast({
              title: 'Download iniciado',
              description: fileName,
            })
          })
          .catch((err) => {
            console.error('Erro completo ao re-gerar documento Word:', err)
            toast({
              title: 'Erro ao gerar relatorio. Tente novamente.',
              description: 'Erro ao gerar documento. Verifique os dados e tente novamente.',
              variant: 'destructive',
            })
          })
          .finally(() => {
            setGerando(false)
          })
      }
    } catch (err) {
      console.error('Erro inesperado no download:', err)
      toast({
        title: 'Erro ao gerar relatorio. Tente novamente.',
        description: 'Erro ao gerar documento. Verifique os dados e tente novamente.',
        variant: 'destructive',
      })
    }
  }

  // Enviar por e-mail via mailto:
  const handleEnviarEmail = () => {
    if (!ultimoPedidoGerado) return
    try {
      const d = ultimoPedidoGerado
      const hoje = new Date().toLocaleDateString('pt-BR')
      const subject = encodeURIComponent(`Pedido Blink Biotech - ${d.cliente_nome} - ${hoje}`)

      const corpo = `Olá, ${d.cliente_nome}!
	
Segue em anexo o documento oficial do seu Pedido de Venda da Blink Biotech.
	
RESUMO DO PEDIDO:
----------------------------------------
- Solicitante: ${d.solicitante}
- Vendedor Responsável: ${d.vendedor_nome}- Produto: ${d.produto_nome} (${d.produto_codigo} - ${d.produto_linha})
- Quantidade: ${d.quantidade} UN
- Preço Base: ${formatBRL(d.preco_base)}
- Modalidade de Frete: ${d.modalidade_frete} (${formatBRL(d.frete_valor)})
- Preço FOB: ${formatBRL(d.preco_fob)}
- Preço CIF: ${formatBRL(d.preco_cif)}
- TOTAL GERAL: ${formatBRL(d.total_geral)}

Canal de Vendas: ${d.canal_vendas} | Espécie Destino: ${d.especie_destino}
${d.observacoes ? `Observações: ${d.observacoes}\n` : ''}
----------------------------------------
* Nota: O documento .docx foi salvo em seus downloads. Por favor, anexe o arquivo baixado neste e-mail antes de enviar.

Blink Biotech - Inteligência Comercial
Hernandarias - PY | Indaiatuba - SP`

      const mailtoUrl = `mailto:${encodeURIComponent(d.cliente_email)}?subject=${subject}&body=${encodeURIComponent(corpo)}`
      window.location.href = mailtoUrl
    } catch {
      toast({
        title: 'Erro ao abrir cliente de e-mail',
        description: 'Não foi possível abrir o e-mail. Baixe o documento e anexe manualmente.',
        variant: 'destructive',
      })
    }
  }

  // ESTADO 1: LOADING
  if (initialLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  // ESTADO 2: EMPTY (se não houver produtos ou equipe)
  if (produtos.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-6 h-6" />
              <CardTitle>Nenhum produto cadastrado</CardTitle>
            </div>
            <CardDescription className="text-amber-700/80 dark:text-amber-300/80">
              Nenhum produto ativo foi encontrado no catálogo da Blink Biotech. Adicione produtos
              primeiro para emitir novos pedidos.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (vendedores.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-6 h-6" />
              <CardTitle>Nenhum vendedor cadastrado</CardTitle>
            </div>
            <CardDescription className="text-amber-700/80 dark:text-amber-300/80">
              Nenhum vendedor está ativo na equipe comercial. Adicione vendedores primeiro no painel
              de equipe.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <FilePlus className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Novo Pedido</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gere um documento de pedido para enviar ao cliente
          </p>
        </div>
        {sucesso && (
          <Button
            variant="outline"
            onClick={handleNovoPedidoReset}
            className="flex items-center gap-2 self-start sm:self-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Criar Outro Pedido
          </Button>
        )}
      </div>

      {/* ESTADO 4: SUCCESS BANNER */}
      {sucesso && ultimoPedidoGerado && (
        <Card className="border-green-300 bg-green-50/70 dark:bg-green-950/30 text-green-900 dark:text-green-100 shadow-sm animate-in fade-in duration-300">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-lg text-green-800 dark:text-green-300">
                    Pedido gerado com sucesso!
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300/90 mt-0.5">
                    O documento <strong className="font-medium">{ultimoFileName}</strong> foi gerado
                    e o download automático foi disparado.
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Destinatário: {ultimoPedidoGerado.cliente_email} | Total:{' '}
                    {formatBRL(ultimoPedidoGerado.total_geral)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                <Button
                  onClick={handleBaixarNovamente}
                  variant="outline"
                  disabled={gerando}
                  className="bg-white dark:bg-card border-green-300 text-green-800 dark:text-green-200 hover:bg-green-100 flex-1 md:flex-none flex items-center gap-2"
                >
                  {gerando ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Gerando relatorio...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Baixar documento
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleEnviarEmail}
                  className="bg-green-600 hover:bg-green-700 text-white flex-1 md:flex-none flex items-center gap-2 shadow"
                >
                  <Mail className="w-4 h-4" />
                  Enviar por email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid Principal: Formulário à esquerda, Resumo ao Vivo à direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Formulário (7 passos) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {/* PASSO 1: DADOS DO CLIENTE */}
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary font-semibold text-base">
                <Building2 className="w-5 h-5" />
                <span>Passo 1: Dados do Cliente</span>
              </div>
              <CardDescription>Informações principais do destinatário do pedido</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor={clienteNomeId} className="text-xs font-medium">
                    Nome do Cliente <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={clienteNomeId}
                    placeholder="Nome do cliente"
                    value={clienteNome}
                    onChange={(e) => setClienteNome(e.target.value)}
                    className={
                      clienteNome.trim() && clienteNome.trim().length < 3
                        ? 'border-destructive'
                        : ''
                    }
                  />
                  {clienteNome.trim() && clienteNome.trim().length < 3 && (
                    <p className="text-xs text-destructive">Mínimo 3 caracteres.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={clienteEmailId} className="text-xs font-medium">
                    E-mail do Cliente <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={clienteEmailId}
                    type="email"
                    placeholder="cliente@email.com"
                    value={clienteEmail}
                    onChange={(e) => setClienteEmail(e.target.value)}
                    className={clienteEmail.trim() && !emailValido ? 'border-destructive' : ''}
                  />
                  {clienteEmail.trim() && !emailValido && (
                    <p className="text-xs text-destructive">Email inválido.</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor={clienteDocId} className="text-xs font-medium">
                    CNPJ ou CPF <span className="text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input
                    id={clienteDocId}
                    placeholder="CNPJ ou CPF"
                    value={clienteDocumento}
                    onChange={(e) => setClienteDocumento(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={clienteEndId} className="text-xs font-medium">
                    Endereço de Entrega <span className="text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input
                    id={clienteEndId}
                    placeholder="Endereço de entrega"
                    value={clienteEndereco}
                    onChange={(e) => setClienteEndereco(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={solicitanteId} className="text-xs font-medium">
                  Solicitante do Pedido <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={solicitanteId}
                  placeholder="Nome do usuário solicitante"
                  value={solicitante}
                  onChange={(e) => setSolicitante(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Pré-preenchido com seu usuário logado da sessão auth, editável se necessário.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* PASSO 2: ATRIBUIÇÃO DE VENDEDOR */}
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary font-semibold text-base">
                <Users2 className="w-5 h-5" />
                <span>Passo 2: Atribuição de Vendedor</span>
              </div>
              <CardDescription>Vendedor comercial vinculado a este cliente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Vendedor Responsável <span className="text-destructive">*</span>
                </Label>
                <Select value={vendedorId} onValueChange={setVendedorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o vendedor" />
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

              {/* Status de auto atribuição / Checkbox de salvar atribuição */}
              {buscandoAtribuicao && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Buscando atribuição cadastrada para {clienteNome}...
                </div>
              )}

              {temAtribuicaoPrevia && (
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-blue-50/80 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 text-xs border border-blue-200">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>
                    Atribuição existente recuperada automaticamente para o cliente{' '}
                    <strong>{clienteNome}</strong>.
                  </span>
                </div>
              )}

              {!temAtribuicaoPrevia && clienteNome.trim().length >= 3 && (
                <div className="flex items-center space-x-2.5 pt-1">
                  <Checkbox
                    id="salvar-atribuicao"
                    checked={salvarAtribuicaoCheck}
                    onCheckedChange={(c) => setSalvarAtribuicaoCheck(!!c)}
                  />
                  <Label
                    htmlFor="salvar-atribuicao"
                    className="text-xs font-normal text-muted-foreground cursor-pointer leading-tight"
                  >
                    Salvar atribuição para este cliente (vincular Vendedor para próximos pedidos)
                  </Label>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PASSO 3: SELEÇÃO DE PRODUTO */}
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary font-semibold text-base">
                <Package className="w-5 h-5" />
                <span>Passo 3: Seleção de Produto</span>
              </div>
              <CardDescription>Catálogo de produtos da Blink Biotech</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Produto <span className="text-destructive">*</span>
                </Label>
                <Select value={produtoId} onValueChange={setProdutoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto do catálogo" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {produtos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo} - {p.nome} ({p.linha})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Detalhes do Produto Selecionado (Somente Leitura) */}
              {selectedProduto && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-muted/50 rounded-lg border text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Linha de Produto
                    </span>
                    <span className="font-semibold text-foreground">{selectedProduto.linha}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Preço Líquido (Tabela)
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatBRL(selectedProduto.preco_base || 0)} /{' '}
                      {selectedProduto.unidade_medida || 'KG'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Espécie Padrão</span>
                    <span className="font-semibold text-foreground">
                      {selectedProduto.especie_padrao || '-'}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor={quantidadeId} className="text-xs font-medium">
                    Quantidade <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={quantidadeId}
                    type="number"
                    min={1}
                    step={1}
                    value={quantidade}
                    onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  {quantidade < 1 && (
                    <p className="text-xs text-destructive">Quantidade deve ser maior que zero.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={descontoId} className="text-xs font-medium">
                    Desconto Comercial (%)
                  </Label>
                  <Input
                    id={descontoId}
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    placeholder="Desconto %"
                    value={descontoPercent}
                    onChange={(e) =>
                      setDescontoPercent(
                        Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)),
                      )
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PASSO 4: CONFIGURAÇÃO FISCAL E DE FRETE */}
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary font-semibold text-base">
                <Receipt className="w-5 h-5" />
                <span>Passo 4: Configuração Fiscal e de Frete</span>
              </div>
              <CardDescription>
                Matriz tributária aplicável conforme localização e segmento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Estado (Origem/Destino) <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={estado}
                    onValueChange={(val) => setEstado(val as 'Parana' | 'Outros Estados')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADO_OPTIONS.map((est) => (
                        <SelectItem key={est} value={est}>
                          {est === 'Parana' ? 'Paraná' : 'Outros Estados'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Espécie Fiscal <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={especie}
                    onValueChange={(val) =>
                      setEspecie(val as 'PET' | 'AVES' | 'SUINOS' | 'RUMINANTES' | 'DISTRIBUICAO')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a espécie fiscal" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESPECIE_FISCAL_OPTIONS.map((esp) => (
                        <SelectItem key={esp} value={esp}>
                          {esp}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Erro ou Loading da Matriz Fiscal */}
              {buscandoMatriz && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Consultando matriz fiscal...
                </div>
              )}

              {matrizFiscalErro && (
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-destructive/10 text-destructive text-xs border border-destructive/20">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{matrizFiscalErro}</span>
                </div>
              )}

              {/* Alíquotas Carregadas da Matriz Fiscal (Somente Leitura) */}
              {estado && especie && !matrizFiscalErro && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-muted/50 rounded-lg border text-center text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">ICMS</span>
                    <span className="font-bold text-foreground">{aliquotaIcms.toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">PIS</span>
                    <span className="font-bold text-foreground">{aliquotaPis.toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">COFINS</span>
                    <span className="font-bold text-foreground">{aliquotaCofins.toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Frete FOB</span>
                    <span className="font-bold text-foreground">{freteFobPercent.toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Frete CIF</span>
                    <span className="font-bold text-foreground">{freteCifPercent.toFixed(2)}%</span>
                  </div>
                </div>
              )}

              {/* Modalidade de Frete e Opções */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Modalidade de Frete <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={modalidadeFrete}
                    onValueChange={(val) => setModalidadeFrete(val as 'FOB' | 'CIF')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione FOB ou CIF" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FOB">
                        FOB (Cliente retira / Frete por conta do cliente)
                      </SelectItem>
                      <SelectItem value="CIF">CIF (Entrega inclusa no preço)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={impostosAdicId} className="text-xs font-medium">
                    Impostos Adicionais (R$){' '}
                    <span className="text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input
                    id={impostosAdicId}
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Impostos adicionais em R$"
                    value={impostosAdicionais || ''}
                    onChange={(e) => setImpostosAdicionais(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex items-center space-x-2.5">
                  <Checkbox
                    id="frete-auto"
                    checked={freteAutomatico}
                    onCheckedChange={(c) => setFreteAutomatico(!!c)}
                  />
                  <Label
                    htmlFor="frete-auto"
                    className="text-xs font-medium text-foreground cursor-pointer"
                  >
                    Calcular frete automaticamente pelo percentual da matriz ({fretePercentualAtivo}
                    %)
                  </Label>
                </div>

                {!freteAutomatico && (
                  <div className="space-y-1.5 max-w-sm pl-6 animate-in fade-in duration-200">
                    <Label htmlFor={freteValorId} className="text-xs font-medium">
                      Valor do Frete Manual (R$) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={freteValorId}
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="Valor do frete em R$"
                      value={freteValorManual || ''}
                      onChange={(e) => setFreteValorManual(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* PASSO 5: CANAL E ESPÉCIE */}
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary font-semibold text-base">
                <Layers className="w-5 h-5" />
                <span>Passo 5: Canal e Espécie</span>
              </div>
              <CardDescription>Segmentação comercial e observações do pedido</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Canal de Vendas <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={canalVendas}
                    onValueChange={(val) =>
                      setCanalVendas(
                        val as
                          | 'Direto'
                          | 'Distribuidor'
                          | 'Industria'
                          | 'Premixera'
                          | 'Cooperativa'
                          | 'Online',
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o canal" />
                    </SelectTrigger>
                    <SelectContent>
                      {CANAL_VENDAS_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Espécie de Destino <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={especieDestino}
                    onValueChange={(val) =>
                      setEspecieDestino(
                        val as 'PET' | 'AVES' | 'SUINOS' | 'RUMINANTES' | 'AQUA' | 'OUTRO',
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a espécie de destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESPECIE_DESTINO_OPTIONS.map((esp) => (
                        <SelectItem key={esp} value={esp}>
                          {esp}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={obsId} className="text-xs font-medium">
                  Observações Comerciais <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <Textarea
                  id={obsId}
                  rows={3}
                  placeholder="Observações comerciais, prazos de entrega, instrução de faturamento..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* PASSO 6 & 7: RESUMO AO VIVO & GERAR DOCUMENTO (Coluna Fixa à Direita) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6 lg:sticky lg:top-6">
          {/* Card Resumo de Cálculo ao Vivo */}
          <Card className="shadow-md border-border bg-card">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary font-semibold text-base">
                  <Calculator className="w-5 h-5" />
                  <span>Resumo do Pedido</span>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold uppercase tracking-wider"
                >
                  Ao Vivo
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Valores calculados em tempo real (editáveis antes de emitir)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-xs">
              {/* Preço Base */}
              <div className="flex items-center justify-between py-1 border-b border-border/60">
                <div>
                  <span className="font-medium text-foreground block">Preço Base</span>
                  <span className="text-[10px] text-muted-foreground">
                    {quantidade} UN x {formatBRL(selectedProduto?.preco_base || 0)}
                    {descontoPercent > 0 ? ` (-${descontoPercent}%)` : ''}
                  </span>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  className="w-28 h-7 text-right text-xs font-semibold"
                  value={
                    manualPrecoBase !== null
                      ? manualPrecoBase
                      : Number(calculoAuto.preco_base.toFixed(2))
                  }
                  onChange={(e) =>
                    setManualPrecoBase(
                      e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                    )
                  }
                />
              </div>

              {/* ICMS */}
              <div className="flex items-center justify-between py-1 border-b border-border/60">
                <div>
                  <span className="font-medium text-foreground block">ICMS</span>
                  <span className="text-[10px] text-muted-foreground">
                    Alíquota: {aliquotaIcms.toFixed(2)}%
                  </span>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  className="w-28 h-7 text-right text-xs"
                  value={
                    manualIcmsValor !== null
                      ? manualIcmsValor
                      : Number(calculoAuto.icms_valor.toFixed(2))
                  }
                  onChange={(e) =>
                    setManualIcmsValor(
                      e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                    )
                  }
                />
              </div>

              {/* PIS */}
              <div className="flex items-center justify-between py-1 border-b border-border/60">
                <div>
                  <span className="font-medium text-foreground block">PIS</span>
                  <span className="text-[10px] text-muted-foreground">
                    Alíquota: {aliquotaPis.toFixed(2)}%
                  </span>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  className="w-28 h-7 text-right text-xs"
                  value={
                    manualPisValor !== null
                      ? manualPisValor
                      : Number(calculoAuto.pis_valor.toFixed(2))
                  }
                  onChange={(e) =>
                    setManualPisValor(
                      e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                    )
                  }
                />
              </div>

              {/* COFINS */}
              <div className="flex items-center justify-between py-1 border-b border-border/60">
                <div>
                  <span className="font-medium text-foreground block">COFINS</span>
                  <span className="text-[10px] text-muted-foreground">
                    Alíquota: {aliquotaCofins.toFixed(2)}%
                  </span>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  className="w-28 h-7 text-right text-xs"
                  value={
                    manualCofinsValor !== null
                      ? manualCofinsValor
                      : Number(calculoAuto.cofins_valor.toFixed(2))
                  }
                  onChange={(e) =>
                    setManualCofinsValor(
                      e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                    )
                  }
                />
              </div>

              {/* Frete */}
              <div className="flex items-center justify-between py-1 border-b border-border/60">
                <div>
                  <span className="font-medium text-foreground block">
                    Frete ({modalidadeFrete})
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {freteAutomatico ? `Auto (${fretePercentualAtivo}%)` : 'Manual'}
                  </span>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  className="w-28 h-7 text-right text-xs"
                  value={
                    manualFreteValor !== null
                      ? manualFreteValor
                      : Number(calculoAuto.frete_valor.toFixed(2))
                  }
                  onChange={(e) =>
                    setManualFreteValor(
                      e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                    )
                  }
                />
              </div>

              {/* Impostos Adicionais */}
              {impostosAdicionais > 0 && (
                <div className="flex items-center justify-between py-1 border-b border-border/60">
                  <div>
                    <span className="font-medium text-foreground block">Impostos Adicionais</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {formatBRL(impostosAdicionais)}
                  </span>
                </div>
              )}

              {/* Preço FOB */}
              <div className="flex items-center justify-between py-1.5 border-b border-border bg-muted/30 px-2 rounded">
                <div>
                  <span className="font-semibold text-foreground block">Preço FOB</span>
                  <span className="text-[10px] text-muted-foreground">Base + Impostos</span>
                </div>
                <span className="font-bold text-foreground text-sm">
                  {formatBRL(finalPrecoFob)}
                </span>
              </div>

              {/* Preço CIF */}
              <div className="flex items-center justify-between py-1.5 border-b border-border bg-muted/30 px-2 rounded">
                <div>
                  <span className="font-semibold text-foreground block">Preço CIF</span>
                  <span className="text-[10px] text-muted-foreground">FOB + Frete</span>
                </div>
                <span className="font-bold text-foreground text-sm">
                  {formatBRL(finalPrecoCif)}
                </span>
              </div>

              {/* Total Geral Destacado */}
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-primary">
                  <span>TOTAL GERAL DO PEDIDO</span>
                  <span className="text-base font-extrabold">{formatBRL(finalTotalGeral)}</span>
                </div>
                <div className="text-[10px] text-muted-foreground text-right">
                  {modalidadeFrete === 'CIF' ? 'Frete CIF incluso' : 'Modalidade FOB'}
                </div>
              </div>

              {/* PASSO 7: BOTÃO GERAR DOCUMENTO */}
              <div className="pt-3 space-y-2">
                <Button
                  onClick={handleGerarPedido}
                  disabled={!formValido || gerando}
                  className="w-full h-11 text-sm font-semibold shadow flex items-center justify-center gap-2"
                >
                  {gerando ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Gerando relatorio...
                    </>
                  ) : (
                    <>
                      <FilePlus className="w-4 h-4" />
                      Enviar Pedido
                    </>
                  )}
                </Button>

                {!formValido && (
                  <p className="text-[11px] text-center text-muted-foreground">
                    Preencha todos os campos obrigatórios (*) para habilitar o envio.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
