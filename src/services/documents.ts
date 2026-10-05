import pb from '@/lib/pocketbase/client'

export interface DocumentItem {
  id: string
  collectionId?: string
  collectionName?: string
  title: string
  file: string
  category: string
  min_access_level: string
  nome_original?: string
  created: string
  updated: string
}

export const getDocuments = (): Promise<DocumentItem[]> =>
  pb.send('/backend/v1/documents', { method: 'GET' })

import { notifyDataChanged } from '@/hooks/useRealtimeData'

export const createDocument = async (data: FormData) => {
  const res = await pb.collection('documents').create(data)
  notifyDataChanged('documents')
  return res
}

export const deleteDocument = async (id: string) => {
  const res = await pb.collection('documents').delete(id)
  notifyDataChanged('documents')
  return res
}

export const getFileUrl = (doc: DocumentItem): string =>
  `${import.meta.env.VITE_POCKETBASE_URL}/api/files/documents/${doc.id}/${doc.file}`

export const downloadDocument = async (doc: DocumentItem, fileNameOverride?: string) => {
  const url = getFileUrl(doc)
  const headers: Record<string, string> = {}
  if (pb.authStore.token) {
    headers.Authorization = pb.authStore.token
  }
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error('Download failed')
  const blob = await res.blob()
  const downloadUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = downloadUrl
  a.download = fileNameOverride || doc.nome_original || doc.file
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(downloadUrl)
}
