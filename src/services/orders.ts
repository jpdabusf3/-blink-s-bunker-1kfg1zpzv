import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { notifyDataChanged } from '@/hooks/useRealtimeData'
import type { Order } from '@/types'

export interface OrderRecord {
  id: string
  user_id: string
  client_name?: string
  product: string
  quantity: number
  unit_value: number
  total_value: number
  status: string
  order_date: string
  notes?: string
  factoryId?: string
  line?: string
  unitValue?: number
  totalValue?: number
  orderDate?: string
  region?: string
  country?: string
  created?: string
  updated?: string
}

export interface CreateOrderInput {
  user_id?: string
  client_name?: string
  product: string
  quantity: number
  unit_value?: number
  unitValue?: number
  total_value?: number
  totalValue?: number
  status?: string
  order_date?: string
  orderDate?: string
  notes?: string
  factoryId?: string
  line?: string
  region?: string
  country?: string
}

export interface UpdateOrderInput {
  client_name?: string
  product?: string
  quantity?: number
  unit_value?: number
  unitValue?: number
  total_value?: number
  totalValue?: number
  status?: string
  order_date?: string
  orderDate?: string
  notes?: string
  factoryId?: string
  line?: string
  region?: string
  country?: string
}

/**
 * Converte um registro retornado do PocketBase para a interface Order da aplicação,
 * mantendo compatibilidade tanto com os nomes de campos canônicos do banco quanto com camelCase.
 */
export function mapOrderRecord(r: any): Order {
  const unit = Number(r.unit_value ?? r.unitValue ?? 0)
  const qty = Number(r.quantity ?? 0)
  const total = Number(r.total_value ?? r.totalValue ?? qty * unit)
  const dateStr = r.order_date || r.orderDate || r.created || new Date().toISOString()

  return {
    id: r.id,
    user_id: r.user_id || undefined,
    client_name: r.client_name || undefined,
    factoryId: r.factoryId || r.related_factory_id || '',
    country: r.country || 'Brasil',
    product: r.product || '',
    line: r.line || undefined,
    quantity: qty,
    unitValue: unit,
    totalValue: total,
    orderDate: dateStr,
    status: r.status || 'aberto',
    notes: r.notes || '',
    unit_value: unit,
    total_value: total,
    order_date: dateStr,
    created: r.created,
    updated: r.updated,
  }
}

/**
 * Lista todos os pedidos cadastrados na collection orders.
 */
export async function listOrders(): Promise<Order[]> {
  try {
    const records = await pb.collection('orders').getFullList({
      sort: '-order_date,-created',
      requestKey: null,
    })
    return records.map(mapOrderRecord)
  } catch (err: unknown) {
    const msg = getErrorMessage(err)
    throw new Error(`Não foi possível listar os pedidos: ${msg}`)
  }
}

/**
 * Alias compatível com os componentes legados que importam getOrders().
 */
export const getOrders = listOrders

/**
 * Cria um novo pedido no PocketBase.
 */
export async function createOrder(data: CreateOrderInput): Promise<Order> {
  try {
    const authId = pb.authStore.record?.id
    const finalUserId = data.user_id || authId
    if (!finalUserId) {
      throw new Error('Usuário autenticado não encontrado para vincular ao pedido.')
    }

    const qty = Number(data.quantity || 0)
    const unit = Number(data.unit_value ?? data.unitValue ?? 0)
    const total = Number(data.total_value ?? data.totalValue ?? qty * unit)
    const orderDate = data.order_date || data.orderDate || new Date().toISOString()

    const payload: Record<string, unknown> = {
      user_id: finalUserId,
      client_name: data.client_name || '',
      product: data.product,
      quantity: qty,
      unit_value: unit,
      total_value: total,
      status: data.status || 'aberto',
      order_date: orderDate,
      notes: data.notes || '',
      // Campos de compatibilidade com schema legado
      factoryId: data.factoryId || null,
      line: data.line || '',
      unitValue: unit,
      totalValue: total,
      orderDate: orderDate,
      country: data.country || 'Brasil',
      region: data.region || '',
    }

    const created = await pb.collection('orders').create(payload)
    notifyDataChanged('orders')
    return mapOrderRecord(created)
  } catch (err: unknown) {
    const msg = getErrorMessage(err)
    throw new Error(`Falha ao cadastrar pedido: ${msg}`)
  }
}

/**
 * Atualiza um pedido existente no PocketBase.
 */
export async function updateOrder(id: string, data: UpdateOrderInput): Promise<Order> {
  try {
    const payload: Record<string, unknown> = {}

    if (data.client_name !== undefined) payload.client_name = data.client_name
    if (data.product !== undefined) payload.product = data.product
    if (data.quantity !== undefined) payload.quantity = Number(data.quantity)
    if (data.status !== undefined) payload.status = data.status
    if (data.notes !== undefined) payload.notes = data.notes
    if (data.factoryId !== undefined) payload.factoryId = data.factoryId || null
    if (data.line !== undefined) payload.line = data.line
    if (data.country !== undefined) payload.country = data.country
    if (data.region !== undefined) payload.region = data.region

    const unit = data.unit_value ?? data.unitValue
    if (unit !== undefined) {
      payload.unit_value = Number(unit)
      payload.unitValue = Number(unit)
    }

    const orderDate = data.order_date ?? data.orderDate
    if (orderDate !== undefined) {
      payload.order_date = orderDate
      payload.orderDate = orderDate
    }

    const total = data.total_value ?? data.totalValue
    if (total !== undefined) {
      payload.total_value = Number(total)
      payload.totalValue = Number(total)
    } else if (payload.quantity !== undefined && payload.unit_value !== undefined) {
      const calcTotal = Number(payload.quantity) * Number(payload.unit_value)
      payload.total_value = calcTotal
      payload.totalValue = calcTotal
    }

    const updated = await pb.collection('orders').update(id, payload)
    notifyDataChanged('orders')
    return mapOrderRecord(updated)
  } catch (err: unknown) {
    const msg = getErrorMessage(err)
    throw new Error(`Falha ao atualizar pedido: ${msg}`)
  }
}

/**
 * Remove um pedido do PocketBase.
 */
export async function removeOrder(id: string): Promise<boolean> {
  try {
    await pb.collection('orders').delete(id)
    notifyDataChanged('orders')
    return true
  } catch (err: unknown) {
    const msg = getErrorMessage(err)
    throw new Error(`Falha ao excluir pedido: ${msg}`)
  }
}

/**
 * Exporta padrão com list, create, update, remove
 */
export const ordersService = {
  list: listOrders,
  create: createOrder,
  update: updateOrder,
  remove: removeOrder,
}
