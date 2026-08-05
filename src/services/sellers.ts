import pb from '@/lib/pocketbase/client'

export interface SellerRegistration {
  name: string
  email: string
  geographicArea?: string
  country?: string
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
