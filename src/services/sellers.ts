import pb from '@/lib/pocketbase/client'

import type { GestaoFuncao } from '@/services/gestao-tecnica'

export interface SellerRegistration {
  name: string
  email: string
  geographicArea?: string
  country?: string
  funcao?: GestaoFuncao
  subclassificacao?: 'indiretos' | 'diretos' | string
  canal_vendas?: 'indireto' | 'direto' | string
  whatsapp?: string
  whatsapp_validated?: boolean
}

export interface SellerRegistrationResult {
  success: boolean
  id: string
  password: string
}

export const createSeller = (data: SellerRegistration): Promise<SellerRegistrationResult> =>
  pb.send('/backend/v1/sellers/create', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
