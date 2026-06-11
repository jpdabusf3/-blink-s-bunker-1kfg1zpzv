import pb from '@/lib/pocketbase/client'
import { Order } from '@/types'

export const getOrders = () => pb.collection('orders').getFullList<Order>()
