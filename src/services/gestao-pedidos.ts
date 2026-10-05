import pb from '@/lib/pocketbase/client'
import { notifyDataChanged } from '@/hooks/useRealtimeData'

export type PedidoStatus = 'ABERTO' | 'FATURADO' | 'CANCELADO'

export interface PedidoRecord {
  id: string
  clienteId?: string
  cliente_id?: string
  cliente?: string
  produtoId?: string
  quantidade?: number
  valorUnitario?: number
  valorTotal?: number
  status: PedidoStatus
  dataPedido?: string
  data_pedido?: string
  dataEntregaPrevista?: string
  nfNumero?: string
  numeroPedido?: string
  envio?: string
  dataSolicitada?: string
  entregaConfirmada?: string
  observacoes?: string
  created: string
  updated: string
  expand?: {
    clienteId?: {
      id: string
      name: string
      city?: string
      state?: string
    }
    cliente_id?: {
      id: string
      name: string
      city?: string
      state?: string
    }
    produtoId?: {
      id: string
      codigo?: string
      nome: string
      linha?: string
      preco_base?: number
      unidade_medida?: string
    }
  }
}

export interface PedidoInput {
  clienteId: string
  produtoId: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  status: PedidoStatus
  dataPedido: string
  dataEntregaPrevista?: string
  nfNumero?: string
}

export interface ClienteOption {
  id: string
  name: string
  city?: string
  state?: string
}

export interface ProdutoOption {
  id: string
  codigo?: string
  nome: string
  linha?: string
  preco_base?: number
  unidade_medida?: string
}

export const gestaoPedidosService = {
  /**
   * Busca todos os pedidos cadastrados com expansão de clienteId e produtoId
   */
  async listPedidos(): Promise<PedidoRecord[]> {
    return pb.collection('pedidos').getFullList<PedidoRecord>({
      expand: 'clienteId,produtoId',
      sort: '-dataPedido,-created',
    })
  },

  /**
   * Busca clientes (factories) disponíveis para seleção
   */
  async listClientes(): Promise<ClienteOption[]> {
    return pb.collection('factories').getFullList<ClienteOption>({
      fields: 'id,name,city,state',
      sort: 'name',
    })
  },

  /**
   * Busca produtos disponíveis para seleção
   */
  async listProdutos(): Promise<ProdutoOption[]> {
    return pb.collection('produtos').getFullList<ProdutoOption>({
      filter: 'ativo = true',
      fields: 'id,codigo,nome,linha,preco_base,unidade_medida',
      sort: 'nome',
    })
  },

  /**
   * Cria um novo pedido
   */
  async createPedido(data: PedidoInput): Promise<PedidoRecord> {
    const userId = pb.authStore.record?.id
    const created = await pb.collection('pedidos').create<PedidoRecord>(
      {
        ...data,
        user_id: userId || '',
      },
      {
        expand: 'clienteId,produtoId',
      },
    )
    notifyDataChanged('pedidos')
    return created
  },

  /**
   * Atualiza um pedido existente
   */
  async updatePedido(id: string, data: Partial<PedidoInput>): Promise<PedidoRecord> {
    const updated = await pb.collection('pedidos').update<PedidoRecord>(id, data, {
      expand: 'clienteId,produtoId',
    })
    notifyDataChanged('pedidos')
    return updated
  },

  /**
   * Atualiza apenas o status de um pedido diretamente na linha
   */
  async updateStatus(id: string, status: PedidoStatus): Promise<PedidoRecord> {
    const updated = await pb.collection('pedidos').update<PedidoRecord>(
      id,
      { status },
      {
        expand: 'clienteId,produtoId',
      },
    )
    notifyDataChanged('pedidos')
    return updated
  },

  /**
   * Exclui um pedido
   */
  async deletePedido(id: string): Promise<boolean> {
    const res = await pb.collection('pedidos').delete(id)
    notifyDataChanged('pedidos')
    return res
  },
}
