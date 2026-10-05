import pb from '@/lib/pocketbase/client'
import { notifyDataChanged } from '@/hooks/useRealtimeData'

export interface FactoryChangeLogItem {
  id: string
  factory_id: string
  user_id?: string
  user_name?: string
  field?: string
  old_value?: string
  new_value?: string
  change_summary: string
  created: string
  updated: string
  expand?: {
    user_id?: {
      id: string
      name?: string
      email?: string
    }
  }
}

/**
 * Obtém os logs de alteração de um cliente ordenados do mais recente para o mais antigo.
 */
export async function getFactoryChangeLogs(factoryId: string): Promise<FactoryChangeLogItem[]> {
  try {
    const records = await pb.collection('factory_change_logs').getFullList({
      filter: `factory_id = '${factoryId}'`,
      sort: '-created',
      expand: 'user_id',
    })
    return records.map((r: any) => ({
      id: r.id,
      factory_id: r.factory_id,
      user_id: r.user_id || undefined,
      user_name: r.user_name || r.expand?.user_id?.name || r.expand?.user_id?.email || 'Sistema',
      field: r.field || undefined,
      old_value: r.old_value !== undefined ? String(r.old_value) : undefined,
      new_value: r.new_value !== undefined ? String(r.new_value) : undefined,
      change_summary: r.change_summary || 'Alteração realizada',
      created: r.created,
      updated: r.updated,
      expand: r.expand,
    }))
  } catch (err) {
    console.warn('[factory-change-logs] Falha ao listar histórico:', err)
    return []
  }
}

/**
 * Grava um log de alteração de cliente.
 * Se falhar, nunca quebra a operação chamadora.
 */
export async function recordFactoryChangeLog(params: {
  factory_id: string
  field?: string
  old_value?: string | null
  new_value?: string | null
  change_summary: string
  user_id?: string
  user_name?: string
}): Promise<void> {
  try {
    const authRecord = pb.authStore.record as { id?: string; name?: string; email?: string } | null
    const finalUserId = params.user_id || authRecord?.id || undefined
    const finalUserName =
      params.user_name || authRecord?.name || authRecord?.email || 'Usuário autenticado'

    await pb.collection('factory_change_logs').create({
      factory_id: params.factory_id,
      user_id: finalUserId || null,
      user_name: finalUserName,
      field: params.field || '',
      old_value: params.old_value ?? '',
      new_value: params.new_value ?? '',
      change_summary: params.change_summary,
    })
    notifyDataChanged('factory_change_logs')
  } catch (err) {
    console.warn('[factory-change-logs] Falha ao registrar log de alteração:', err)
  }
}

/**
 * Formata um valor para exibição amigável no histórico.
 */
function stringifyValue(val: any): string {
  if (val === null || val === undefined || val === '') return ''
  if (Array.isArray(val)) {
    return val.filter(Boolean).join(', ')
  }
  return String(val).trim()
}

/**
 * Nomes amigáveis dos campos do cadastro de clientes para o resumo.
 */
const FIELD_LABELS: Record<string, string> = {
  name: 'Razão Social',
  cnpj: 'CNPJ',
  city: 'Cidade',
  state: 'UF',
  carteira: 'Segmento (Espécie)',
  profile_type: 'Categoria / Perfil',
  vendedor_id: 'Vendedor',
  vendedor_name: 'Nome do Vendedor',
  contato: 'Contato',
  contactName: 'Nome de Contato',
  contactPhone: 'Telefone',
  telefone: 'Telefone',
  contact_email: 'E-mail',
  observacoes: 'Observações',
  notes: 'Notas',
  suggested_approach: 'Abordagem Sugerida',
  tipo: 'Tipo de Cadastro',
  status_funil: 'Status do Funil',
}

/**
 * Compara o estado anterior e o novo do cliente e grava os logs correspondentes.
 * Não grava nada se nada tiver mudado.
 */
export async function diffAndRecordFactoryChanges(
  factoryId: string,
  before: Record<string, any>,
  after: Record<string, any>,
): Promise<void> {
  try {
    const fieldsToTrack = [
      'name',
      'cnpj',
      'city',
      'state',
      'carteira',
      'profile_type',
      'vendedor_id',
      'vendedor_name',
      'contato',
      'telefone',
      'contact_email',
      'observacoes',
      'notes',
      'suggested_approach',
      'tipo',
      'status_funil',
    ]

    for (const field of fieldsToTrack) {
      if (!(field in after)) continue

      const oldRaw = before[field]
      const newRaw = after[field]

      const oldStr = stringifyValue(oldRaw)
      const newStr = stringifyValue(newRaw)

      // Se ambos são vazios ou iguais, pula
      if (oldStr === newStr) continue

      const label = FIELD_LABELS[field] || field
      const oldDisplay = oldStr ? `'${oldStr}'` : "''(vazio)"
      const newDisplay = newStr ? `'${newStr}'` : "''(vazio)"
      const summary = `${label} alterado de ${oldDisplay} para ${newDisplay}`

      await recordFactoryChangeLog({
        factory_id: factoryId,
        field,
        old_value: oldStr,
        new_value: newStr,
        change_summary: summary,
      })
    }
  } catch (err) {
    console.warn('[factory-change-logs] Falha no diff de alterações:', err)
  }
}
