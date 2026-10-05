import pb from '@/lib/pocketbase/client'
import { notifyDataChanged } from '@/hooks/useRealtimeData'

export type ImportHistoryStatus = 'sucesso' | 'parcial' | 'erro'

export interface ImportHistoryRecord {
  id: string
  file_name: string
  file_type: string
  imported_at: string
  total_rows: number
  imported_rows: number
  error_rows: number
  total_value?: number
  skipped_rows?: number
  duplicate_rows?: number
  status: ImportHistoryStatus
  details?: string
  created: string
  updated: string
}

export interface CreateImportHistoryInput {
  file_name: string
  file_type?: string
  imported_at?: string
  total_rows?: number
  imported_rows?: number
  error_rows?: number
  total_value?: number
  skipped_rows?: number
  duplicate_rows?: number
  status: ImportHistoryStatus
  details?: string
}

/**
 * Busca todo o histórico de importações ordenado da mais recente para a mais antiga.
 */
export async function getImportHistory(): Promise<ImportHistoryRecord[]> {
  const records = await pb.collection('import_history').getFullList<ImportHistoryRecord>({
    sort: '-imported_at,-created',
  })

  return records.map((r) => {
    // Normalizar status para "sucesso" | "parcial" | "erro"
    let status: ImportHistoryStatus = 'sucesso'
    const rawStatus = (r.status || '').toLowerCase()
    if (rawStatus === 'erro' || rawStatus.includes('erro')) {
      status = 'erro'
    } else if (rawStatus === 'parcial' || rawStatus.includes('parcial')) {
      status = 'parcial'
    } else {
      status = 'sucesso'
    }

    return {
      ...r,
      status,
      file_name: r.file_name || 'arquivo_importacao.xlsx',
      file_type: r.file_type || 'xlsx',
      imported_at: r.imported_at || r.created,
      total_rows: typeof r.total_rows === 'number' ? r.total_rows : 0,
      imported_rows: typeof r.imported_rows === 'number' ? r.imported_rows : 0,
      error_rows: typeof r.error_rows === 'number' ? r.error_rows : 0,
      total_value: typeof r.total_value === 'number' ? r.total_value : 0,
      skipped_rows: typeof r.skipped_rows === 'number' ? r.skipped_rows : 0,
      duplicate_rows: typeof r.duplicate_rows === 'number' ? r.duplicate_rows : 0,
      details: r.details || '',
    }
  })
}

/**
 * Cria um registro em import_history e emite evento de sincronização em tempo real.
 */
export async function createImportHistory(
  input: CreateImportHistoryInput,
): Promise<ImportHistoryRecord> {
  const fileParts = (input.file_name || '').split('.')
  const inferredType =
    input.file_type ||
    (fileParts.length > 1 ? fileParts[fileParts.length - 1].toLowerCase() : 'xlsx')

  const record = await pb.collection('import_history').create<ImportHistoryRecord>({
    file_name: input.file_name,
    file_type: inferredType,
    imported_at: input.imported_at || new Date().toISOString(),
    total_rows: input.total_rows ?? 0,
    imported_rows: input.imported_rows ?? 0,
    error_rows: input.error_rows ?? 0,
    total_value: input.total_value ?? 0,
    skipped_rows: input.skipped_rows ?? 0,
    duplicate_rows: input.duplicate_rows ?? 0,
    status: input.status,
    details: input.details ?? '',
  })

  notifyDataChanged('import_history')

  return record
}
