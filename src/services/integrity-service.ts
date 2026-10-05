import pb from '@/lib/pocketbase/client'
import { normalizeName } from '@/lib/vendedorFilterHelper'

export interface IntegrityCheckResult {
  canDelete: boolean
  hasBillingLinked: boolean
  billingCount: number
  message?: string
  deactivateActionLabel?: string
}

/**
 * Normaliza vendedor canônico para "João Figueiredo"
 */
export function normalizeCanonicalSellerName(name?: string | null): string {
  if (!name) return ''
  const trimmed = name.trim()
  const lower = trimmed.toLowerCase()
  if (
    lower === 'joão pedro' ||
    lower === 'joao pedro' ||
    lower === 'joão figueiredo' ||
    lower === 'joao figueiredo' ||
    lower.startsWith('joão pedro ') ||
    lower.startsWith('joao pedro ')
  ) {
    return 'João Figueiredo'
  }
  return trimmed
}

/**
 * UC6: Verifica integridade de Cliente antes de exclusão.
 * Bloqueia se possuir faturamento vinculado e oferece desativação.
 */
export async function checkClientIntegrity(
  clientId: string,
  clientName?: string,
): Promise<IntegrityCheckResult> {
  try {
    let count = 0
    // 1. Checa faturamento direto por factory_id em historico_vendas
    try {
      const hv = await pb.collection('historico_vendas').getList(1, 1, {
        filter: `factory_id = '${clientId}' && is_deleted != true`,
      })
      count += hv.totalItems
    } catch {
      /* intentionally ignored */
    }

    // 2. Checa faturamento por nome em faturamento
    if (clientName && count === 0) {
      const escaped = clientName.replace(/'/g, "\\'")
      try {
        const fat = await pb.collection('faturamento').getList(1, 1, {
          filter: `cliente_nome = '${escaped}' && is_deleted != true`,
        })
        count += fat.totalItems
      } catch {
        /* intentionally ignored */
      }
    }

    if (count > 0) {
      return {
        canDelete: false,
        hasBillingLinked: true,
        billingCount: count,
        message: `Não é possível excluir este cliente porque existem ${count} registro(s) de faturamento vinculado(s) a ele no histórico. Você pode desativá-lo para preservar a integridade dos dados fiscais e gerenciais.`,
        deactivateActionLabel: 'Desativar cliente',
      }
    }

    return {
      canDelete: true,
      hasBillingLinked: false,
      billingCount: 0,
    }
  } catch (err) {
    console.warn('[Integrity] Erro ao checar integridade do cliente:', err)
    return { canDelete: true, hasBillingLinked: false, billingCount: 0 }
  }
}

/**
 * UC6: Verifica integridade de Produto antes de exclusão.
 * Bloqueia se possuir faturamento vinculado e oferece desativação.
 */
export async function checkProductIntegrity(
  produtoId: string,
  codigo?: string,
  nome?: string,
): Promise<IntegrityCheckResult> {
  try {
    let count = 0
    if (codigo) {
      const escapedCod = codigo.replace(/'/g, "\\'")
      try {
        const fat = await pb.collection('faturamento').getList(1, 1, {
          filter: `produto_codigo = '${escapedCod}' && is_deleted != true`,
        })
        count += fat.totalItems
      } catch {
        /* intentionally ignored */
      }

      try {
        const hv = await pb.collection('historico_vendas').getList(1, 1, {
          filter: `produto_codigo = '${escapedCod}' && is_deleted != true`,
        })
        count += hv.totalItems
      } catch {
        /* intentionally ignored */
      }
    }

    if (count > 0) {
      return {
        canDelete: false,
        hasBillingLinked: true,
        billingCount: count,
        message: `Não é possível excluir o produto ${nome || codigo} porque existem ${count} registro(s) de faturamento e vendas vinculados a este código. Recomendamos desativar o produto no catálogo.`,
        deactivateActionLabel: 'Desativar produto',
      }
    }

    return {
      canDelete: true,
      hasBillingLinked: false,
      billingCount: 0,
    }
  } catch (err) {
    console.warn('[Integrity] Erro ao checar integridade do produto:', err)
    return { canDelete: true, hasBillingLinked: false, billingCount: 0 }
  }
}

/**
 * UC6: Verifica integridade de Vendedor antes de exclusão.
 * Bloqueia se possuir faturamento vinculado e oferece desativação.
 */
export async function checkSellerIntegrity(
  vendedorId: string,
  vendedorNome?: string,
): Promise<IntegrityCheckResult> {
  try {
    let count = 0
    try {
      const hv = await pb.collection('historico_vendas').getList(1, 1, {
        filter: `vendedor_id = '${vendedorId}' && is_deleted != true`,
      })
      count += hv.totalItems
    } catch {
      /* intentionally ignored */
    }

    if (vendedorNome && count === 0) {
      const canonical = normalizeCanonicalSellerName(vendedorNome)
      const escaped = canonical.replace(/'/g, "\\'")
      try {
        const fat = await pb.collection('faturamento').getList(1, 1, {
          filter: `vendedor = '${escaped}' && is_deleted != true`,
        })
        count += fat.totalItems
      } catch {
        /* intentionally ignored */
      }
    }

    if (count > 0) {
      return {
        canDelete: false,
        hasBillingLinked: true,
        billingCount: count,
        message: `Não é possível excluir o vendedor ${vendedorNome} porque existem ${count} registro(s) de faturamento vinculado(s) à sua carteira. Você pode desativar este membro para preservar os relatórios históricos.`,
        deactivateActionLabel: 'Desativar vendedor',
      }
    }

    return {
      canDelete: true,
      hasBillingLinked: false,
      billingCount: 0,
    }
  } catch (err) {
    console.warn('[Integrity] Erro ao checar integridade do vendedor:', err)
    return { canDelete: true, hasBillingLinked: false, billingCount: 0 }
  }
}
