import pb from '@/lib/pocketbase/client'
import type { EquipeMember } from '@/services/equipe'
import type { ProdutoCatalogo } from '@/services/nfe-service'
import { deriveDateParts, derivePais } from '@/services/historico-vendas'

export interface MatrizFiscal {
  id: string
  estado: 'Parana' | 'Outros Estados'
  especie: 'PET' | 'AVES' | 'SUINOS' | 'RUMINANTES' | 'DISTRIBUICAO'
  aliquota_icms: number
  aliquota_pis: number
  aliquota_cofins: number
  frete_fob_percent: number
  frete_cif_percent: number
  created?: string
  updated?: string
}

export interface AtribuicaoCliente {
  id: string
  cliente_nome: string
  gestor_tecnico_id: string
  vendedor_id: string
  observacoes?: string
  user_id?: string
  expand?: {
    gestor_tecnico_id?: EquipeMember
    vendedor_id?: EquipeMember
  }
}

export interface PedidoFormData {
  // Passo 1: Cliente
  cliente_nome: string
  cliente_email: string
  cliente_documento?: string
  cliente_endereco?: string
  solicitante: string

  // Passo 2: Equipe
  gestor_tecnico_id: string
  gestor_tecnico_nome?: string
  vendedor_id: string
  vendedor_nome?: string
  salvar_atribuicao?: boolean

  // Passo 3: Produto
  produto_id: string
  produto_codigo?: string
  produto_nome?: string
  produto_linha?: string
  preco_liquido: number
  base_calculo?: number
  quantidade: number
  desconto_percent: number

  // Passo 4: Fiscal e Frete
  estado: 'Parana' | 'Outros Estados' | ''
  especie: 'PET' | 'AVES' | 'SUINOS' | 'RUMINANTES' | 'DISTRIBUICAO' | ''
  aliquota_icms: number
  aliquota_pis: number
  aliquota_cofins: number
  modalidade_frete: 'FOB' | 'CIF'
  frete_percentual: number
  frete_automatico: boolean
  frete_valor: number
  impostos_adicionais: number

  // Passo 5: Canal e Espécie Destino
  canal_vendas:
    | 'Direto'
    | 'Distribuidor'
    | 'Industria'
    | 'Premixera'
    | 'Cooperativa'
    | 'Online'
    | ''
  especie_destino: 'PET' | 'AVES' | 'SUINOS' | 'RUMINANTES' | 'AQUA' | 'OUTRO' | ''
  observacoes?: string

  // Resumo ao vivo / Calculados
  preco_base: number
  icms_valor: number
  pis_valor: number
  cofins_valor: number
  preco_fob: number
  preco_cif: number
  total_geral: number
}

export interface PedidoCalculoResumo {
  preco_base: number
  icms_valor: number
  pis_valor: number
  cofins_valor: number
  frete_valor: number
  frete_percentual: number
  impostos_adicionais: number
  preco_fob: number
  preco_cif: number
  total_geral: number
}

export const pedidoService = {
  /** Busca todos os produtos ativos do catálogo */
  async getProdutos(): Promise<ProdutoCatalogo[]> {
    return pb.collection('produtos').getFullList<ProdutoCatalogo>({
      filter: 'ativo = true',
      sort: 'linha,nome',
    })
  },

  /** Busca matriz fiscal por estado e espécie */
  async getMatrizFiscal(estado: string, especie: string): Promise<MatrizFiscal | null> {
    if (!estado || !especie) return null
    try {
      const records = await pb.collection('matriz_fiscal').getFullList<MatrizFiscal>({
        filter: `estado = "${estado}" && especie = "${especie}"`,
      })
      return records[0] || null
    } catch (err) {
      console.error('Erro ao buscar matriz fiscal:', err)
      return null
    }
  },

  /** Busca todos os gestores técnicos da equipe */
  async getGestoresTecnicos(): Promise<EquipeMember[]> {
    return pb.collection('equipe').getFullList<EquipeMember>({
      filter: 'cargo = "Gestor Tecnico" && ativo = true',
      sort: 'nome',
    })
  },

  /** Busca todos os vendedores da equipe */
  async getVendedores(): Promise<EquipeMember[]> {
    return pb.collection('equipe').getFullList<EquipeMember>({
      filter: 'cargo = "Vendedor" && ativo = true',
      sort: 'nome',
    })
  },

  /** Busca atribuição existente por nome do cliente */
  async getAtribuicaoCliente(cliente_nome: string): Promise<AtribuicaoCliente | null> {
    if (!cliente_nome || cliente_nome.trim().length < 2) return null
    try {
      const records = await pb.collection('atribuicao_clientes').getFullList<AtribuicaoCliente>({
        filter: `cliente_nome ~ "${cliente_nome.trim()}"`,
        sort: '-created',
        expand: 'gestor_tecnico_id,vendedor_id',
      })
      return records[0] || null
    } catch (err) {
      console.error('Erro ao buscar atribuicao cliente:', err)
      return null
    }
  },

  /** Salva ou atualiza atribuição de cliente */
  async saveAtribuicao(data: {
    cliente_nome: string
    gestor_tecnico_id: string
    vendedor_id: string
    observacoes?: string
  }): Promise<AtribuicaoCliente> {
    const userId = pb.authStore.record?.id
    // Verificar se já existe atribuição exata para atualizar ou criar
    try {
      const existing = await pb.collection('atribuicao_clientes').getFullList<AtribuicaoCliente>({
        filter: `cliente_nome = "${data.cliente_nome.trim()}"`,
      })
      if (existing.length > 0) {
        return await pb
          .collection('atribuicao_clientes')
          .update<AtribuicaoCliente>(existing[0].id, {
            gestor_tecnico_id: data.gestor_tecnico_id,
            vendedor_id: data.vendedor_id,
            observacoes: data.observacoes || '',
            user_id: userId || '',
          })
      }
    } catch {
      /* ignore */
    }

    return await pb.collection('atribuicao_clientes').create<AtribuicaoCliente>({
      cliente_nome: data.cliente_nome.trim(),
      gestor_tecnico_id: data.gestor_tecnico_id,
      vendedor_id: data.vendedor_id,
      observacoes: data.observacoes || '',
      user_id: userId || '',
    })
  },

  /** Cria registro na coleção pedidos se existir, senão retorna dados */
  async createPedido(pedidoData: PedidoFormData): Promise<any> {
    const userId = pb.authStore.record?.id
    let pedidoRecord: any = null
    try {
      pedidoRecord = await pb.collection('pedidos').create({
        ...pedidoData,
        user_id: userId || '',
      })
    } catch (err) {
      console.warn('Colecao pedidos nao persistida ou erro menor, prosseguindo:', err)
      pedidoRecord = pedidoData
    }

    // Gravar também em historico_vendas (origem='pedido', status='projetado')
    try {
      const hojeIso = new Date().toISOString().substring(0, 10)
      const { mes, ano, trimestre } = deriveDateParts(hojeIso)
      const pais = derivePais(pedidoData.estado)

      const numDoc = pedidoRecord?.id
        ? `PED-${pedidoRecord.id.substring(0, 8).toUpperCase()}`
        : `PED-${Date.now()}`
      const itemQtd = Number(pedidoData.quantidade) || 1
      const itemUnit = Number(pedidoData.preco_base) / (itemQtd || 1) || 0
      const itemTotal = Number(pedidoData.preco_base) || 0
      const totalGeral = Number(pedidoData.total_geral) || itemTotal

      const historicoPayload: Record<string, any> = {
        origem: 'pedido',
        numero_documento: numDoc,
        data_documento: hojeIso,
        mes,
        ano,
        trimestre,
        destinatario_nome: String(pedidoData.cliente_nome || '').trim(),
        destinatario_uf: pedidoData.estado === 'Parana' ? 'PR' : '',
        pais,
        especie_destino: pedidoData.especie_destino || pedidoData.especie || '',
        canal_vendas: pedidoData.canal_vendas || '',
        gestor_tecnico: pedidoData.gestor_tecnico_nome || '',
        vendedor: pedidoData.vendedor_nome || '',
        produto_codigo: pedidoData.produto_codigo || '',
        produto_descricao: pedidoData.produto_nome || '',
        produto_familia: pedidoData.produto_linha || '',
        produto_quantidade: itemQtd,
        produto_valor_unitario: itemUnit,
        produto_valor_total: itemTotal,
        valor_total_nota: totalGeral,
        frete_modalidade: pedidoData.modalidade_frete || 'FOB',
        status: 'projetado',
        user_id: userId || '',

        // Compatibilidade retroativa
        data: hojeIso,
        cliente: String(pedidoData.cliente_nome || '').trim(),
        especie: pedidoData.especie_destino || pedidoData.especie || '',
        gestor_tecnico_id: pedidoData.gestor_tecnico_id || '',
        vendedor_id: pedidoData.vendedor_id || '',
        valor: totalGeral,
        observacoes: `Pedido ${numDoc} - ${pedidoData.produto_nome || ''}`,
        atualizado_em: new Date().toISOString(),
      }

      await pb.collection('historico_vendas').create(historicoPayload)
    } catch (hvErr) {
      console.error('Erro ao gravar pedido em historico_vendas:', hvErr)
    }

    return pedidoRecord
  },

  /** Registra log na tabela funnel_activity_log */
  async logPedido(pedidoData: {
    cliente_nome: string
    produto_nome: string
    gestor_tecnico_nome: string
    vendedor_nome: string
  }): Promise<void> {
    const userId = pb.authStore.record?.id
    const descricao = `Gerou pedido para ${pedidoData.cliente_nome} - ${pedidoData.produto_nome} - Gestor: ${pedidoData.gestor_tecnico_nome} - Vendedor: ${pedidoData.vendedor_nome}`
    try {
      await pb.collection('funnel_activity_log').create({
        user: userId || '',
        action_type: 'create',
        entity_type: 'deal',
        entity_id: '',
        entity_name: pedidoData.cliente_nome,
        old_value: '',
        new_value: '',
        description: descricao,
      })
    } catch (err) {
      console.error('Erro ao registrar log do pedido:', err)
    }
  },

  /** Chama hook backend para gerar .docx e retorna o Blob */
  async gerarDocumento(pedidoData: PedidoFormData): Promise<Blob> {
    const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/pedidos/docx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: pb.authStore.token,
      },
      body: JSON.stringify(pedidoData),
    })

    if (!res.ok) {
      let errMsg = 'Erro ao gerar relatorio. Tente novamente.'
      try {
        const d = await res.json()
        if (d && d.error) errMsg = d.error
      } catch {
        /* noop */
      }
      throw new Error(errMsg)
    }

    const rawBlob = await res.blob()
    if (!rawBlob || rawBlob.size === 0) {
      throw new Error('Erro ao gerar relatorio. Tente novamente.')
    }

    // Garantir MIME type correto para o arquivo .docx
    const docxBlob = new Blob([rawBlob], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    return docxBlob
  },
}
