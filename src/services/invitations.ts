import pb from '@/lib/pocketbase/client'

export interface Invitation {
  id: string
  email: string
  name: string
  role: string
  geographicArea: string
  country: string
  token: string
  status: 'pending' | 'accepted' | 'expired'
  expiresAt: string
  created: string
  updated: string
}

export const getInvitations = (): Promise<Invitation[]> =>
  pb.collection('invitations').getFullList({ sort: '-created' })

export const createInvitation = (data: {
  email: string
  name: string
  role: string
  geographicArea?: string
  country?: string
}): Promise<Invitation> => pb.collection('invitations').create(data)

export const deleteInvitation = async (id: string): Promise<void> => {
  await pb.collection('invitations').delete(id)
}

export const updateInvitation = (id: string, data: Partial<Invitation>): Promise<Invitation> =>
  pb.collection('invitations').update(id, data)

export const checkInvitation = (): Promise<{ applied: boolean }> =>
  pb.send('/backend/v1/check-invitation', { method: 'POST' })
