import pb from '@/lib/pocketbase/client'

export interface DocumentItem {
  id: string
  collectionId?: string
  collectionName?: string
  title: string
  file: string
  category: string
  min_access_level: string
  created: string
  updated: string
}

export const getDocuments = (): Promise<DocumentItem[]> =>
  pb.send('/backend/v1/documents', { method: 'GET' })

export const createDocument = (data: FormData) => pb.collection('documents').create(data)

export const deleteDocument = (id: string) => pb.collection('documents').delete(id)

export const getFileUrl = (doc: DocumentItem): string =>
  `${import.meta.env.VITE_POCKETBASE_URL}/api/files/documents/${doc.id}/${doc.file}`

export const downloadDocument = async (doc: DocumentItem) => {
  const url = getFileUrl(doc)
  const res = await fetch(url, {
    headers: { Authorization: pb.authStore.token },
  })
  if (!res.ok) throw new Error('Download failed')
  const blob = await res.blob()
  const downloadUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = downloadUrl
  a.download = doc.file
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(downloadUrl)
}
