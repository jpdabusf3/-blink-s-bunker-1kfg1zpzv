import pb from '@/lib/pocketbase/client'
import { notifyDataChanged } from '@/hooks/useRealtimeData'

export type ImportHistoryStatus = 'sucesso' | 'parcial' | 'erro' | 'desfeita'

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
  batch_id?: string
  can_rollback?: boolean
  rolled_back_at?: string
  error_report_json?: any
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
  batch_id?: string
  can_rollback?: boolean
  error_report_json?: any
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
    batch_id: input.batch_id || `batch_${Date.now()}`,
    can_rollback: input.can_rollback !== undefined ? input.can_rollback : true,
    error_report_json: input.error_report_json || null,
  })

  notifyDataChanged('import_history')

  return record
}

/**
 * UC4: Desfazer importação inteira (Rollback de lote)
 * Remove ou marca soft delete apenas os registros criados por esta importação dentro de 30 dias.
 */
export async function rollbackImportBatch(
  batchIdOrHistoryId: string,
): Promise<{ success: boolean; removedCount: number; message: string }> {
  try {
    let historyRecord: any = null
    try {
      historyRecord = await pb.collection('import_history').getOne(batchIdOrHistoryId)
    } catch (_) {
      const records = await pb.collection('import_history').getList(1, 1, {
        filter: `batch_id = '${batchIdOrHistoryId}'`,
      })
      if (records.items.length > 0) {
        historyRecord = records.items[0]
      }
    }

    if (!historyRecord) {
      return {
        success: false,
        removedCount: 0,
        message: 'Lote de importação não encontrado no histórico.',
      }
    }

    // Validação da janela de 30 dias
    const importedAt = new Date(historyRecord.imported_at || historyRecord.created).getTime()
    const now = Date.now()
    const diffDays = (now - importedAt) / (1000 * 60 * 60 * 24)
    if (diffDays > 30) {
      return {
        success: false,
        removedCount: 0,
        message: 'Não é possível desfazer uma importação realizada há mais de 30 dias.',
      }
    }

    if (historyRecord.status === 'desfeita' || historyRecord.rolled_back_at) {
      return {
        success: false,
        removedCount: 0,
        message: 'Esta importação já foi desfeita anteriormente.',
      }
    }

    const batchKey = historyRecord.batch_id || historyRecord.id
    let removedCount = 0

    // 1. Remove ou soft-deleta registros em faturamento com este batch_id
    try {
      const fatItems = await pb.collection('faturamento').getFullList({
        filter: `batch_id = '${batchKey}'`,
      })
      for (const item of fatItems) {
        try {
          await pb.collection('faturamento').delete(item.id)
          removedCount++
        } catch (_) {
          await pb.collection('faturamento').update(item.id, {
            is_deleted: true,
            deleted_at: new Date().toISOString(),
          })
          removedCount++
        }
      }
    } catch {
      /* intentionally ignored */
    }

    // 2. Remove registros em historico_vendas criados com este batch_id
    try {
      const hvItems = await pb.collection('historico_vendas').getFullList({
        filter: `batch_id = '${batchKey}'`,
      })
      for (const item of hvItems) {
        try {
          await pb.collection('historico_vendas').delete(item.id)
          removedCount++
        } catch (_) {
          await pb.collection('historico_vendas').update(item.id, {
            is_deleted: true,
            deleted_at: new Date().toISOString(),
          })
          removedCount++
        }
      }
    } catch {
      /* intentionally ignored */
    }

    // 3. Atualiza registro em import_history
    await pb.collection('import_history').update(historyRecord.id, {
      status: 'desfeita',
      rolled_back_at: new Date().toISOString(),
      details:
        `${historyRecord.details || ''} [Desfeita em ${new Date().toLocaleString('pt-BR')}]`.trim(),
    })

    notifyDataChanged('faturamento')
    notifyDataChanged('historico_vendas')
    notifyDataChanged('import_history')
    notifyDataChanged('factories')

    return {
      success: true,
      removedCount,
      message: `Importação desfeita com sucesso! ${removedCount} registros criados pelo lote foram revertidos.`,
    }
  } catch (err: any) {
    console.error('[rollbackImportBatch] Erro:', err)
    return {
      success: false,
      removedCount: 0,
      message: err?.message || 'Falha ao processar rollback da importação.',
    }
  }
}
