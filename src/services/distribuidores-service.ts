import pb from '@/lib/pocketbase/client'
import { notifyDataChanged } from '@/hooks/useRealtimeData'
import { recordEntityChangeLog } from './entity-change-logs'
import { isManager, isMasterOrCeo } from '@/lib/user-scope'

export interface Distribuidor {
  id: string
  nome: string
  cnpj?: string
  contato_nome?: string
  contato_email?: string
  contato_telefone?: string
  ufs_atuacao?: string[]
  contrato_inicio?: string
  contrato_fim?: string
  status?: 'ativo' | 'inativo' | string
  observacoes?: string
  created: string
  updated: string
  // Agregados calculados sob demanda
  total_clientes?: number
  total_toneladas?: number
  total_valor_brl?: number
  total_valor_usd?: number
  variacao_percentual?: number
  dias_sem_compra?: number
  alerta_inatividade?: boolean
}

export type LinhaProdutoDistribuidor = 'MY-CO' | 'MO-BE' | 'MI-OR' | 'MY-ST' | 'MI-XS' | 'Outros'

export interface CompraDistribuidor {
  id: string
  distribuidor_id: string
  data: string
  produto: string
  linha_produto: LinhaProdutoDistribuidor | string
  toneladas: number
  valor_brl: number
  valor_usd: number
  nf?: string
  observacoes?: string
  origem?: 'manual' | 'faturamento_importado' | string
  faturamento_id?: string
  created: string
  updated: string
}

export interface ClienteDistribuidor {
  id: string
  distribuidor_id: string
  nome_cliente: string
  uf?: string
  municipio?: string
  status?: 'ativo' | 'inativo' | 'prospeccao' | string
  observacoes?: string
  factory_id?: string
  created: string
  updated: string
}

export interface VolumesPorLinha {
  linha: string
  label: string
  toneladas: number
  valor_brl: number
  valor_usd: number
  percentual: number
}

export interface QuadroVolumesDistribuidor {
  total_toneladas: number
  total_valor_brl: number
  total_valor_usd: number
  delta_toneladas: number
  delta_valor_brl: number
  delta_valor_usd: number
  linhas: VolumesPorLinha[]
}

/**
 * Checa se o usuário atual tem permissão comercial/admin para escrita
 */
export function canEditDistribuidores(user: any): boolean {
  if (!user) return false
  if (isMasterOrCeo(user) || isManager(user)) return true
  const job = (user.job_title || '').toLowerCase()
  return (
    job.includes('comercial') ||
    job.includes('vendedor') ||
    job.includes('coordenador') ||
    job.includes('diretor') ||
    job.includes('ceo')
  )
}

/**
 * Normaliza linha de produto
 */
export function mapearLinhaProduto(codigoOuNome?: string): LinhaProdutoDistribuidor {
  const s = (codigoOuNome || '').toUpperCase().trim()
  if (
    s.includes('MY.CO') ||
    s.includes('MY-CO') ||
    s.includes('MYCOLINK') ||
    s.includes('ADSORVENT')
  ) {
    return 'MY-CO'
  }
  if (
    s.includes('MO.BE') ||
    s.includes('MO-BE') ||
    s.includes('MOS') ||
    s.includes('BETALINK') ||
    s.includes('PREBIOT')
  ) {
    return 'MO-BE'
  }
  if (
    s.includes('MI.OR') ||
    s.includes('MI-OR') ||
    s.includes('MINERAI') ||
    s.includes('COPPER') ||
    s.includes('ZINC') ||
    s.includes('IRON') ||
    s.includes('SELENIUM') ||
    s.includes('CHROMIUM') ||
    s.includes('MANGANESE')
  ) {
    return 'MI-OR'
  }
  if (
    s.includes('MY.ST') ||
    s.includes('MY-ST') ||
    s.includes('LEV') ||
    s.includes('HYDRO') ||
    s.includes('YEAST') ||
    s.includes('INGREDIENTE')
  ) {
    return 'MY-ST'
  }
  if (s.includes('MI.XS') || s.includes('MI-XS') || s.includes('BLEND')) {
    return 'MI-XS'
  }
  return 'Outros'
}

export const LINHAS_PRODUTO_METADATA: Record<
  LinhaProdutoDistribuidor,
  { label: string; desc: string; cor: string }
> = {
  'MY-CO': { label: 'Adsorventes (MY-CO)', desc: 'Mycolink, Mycolink P/S', cor: '#3b82f6' },
  'MO-BE': { label: 'Prebióticos (MO-BE)', desc: 'Mos, BetaLink', cor: '#10b981' },
  'MI-OR': {
    label: 'Minerais Orgânicos (MI-OR)',
    desc: 'Cobre, Zinco, Ferro, Manganês, Cromo',
    cor: '#f59e0b',
  },
  'MY-ST': { label: 'Ingredientes (MY-ST)', desc: 'Leveduras, Hydro, Ycw', cor: '#8b5cf6' },
  'MI-XS': { label: 'Blends (MI-XS)', desc: 'Blends para espécies específicas', cor: '#ec4899' },
  Outros: { label: 'Outros Produtos', desc: 'Outras linhas do catálogo', cor: '#6b7280' },
}

// ----------------------------------------------------------------------------
// DISTRIBUIDORES CRUD
// ----------------------------------------------------------------------------

export async function getDistribuidores(): Promise<Distribuidor[]> {
  try {
    const records = await pb.collection('distribuidores').getFullList({
      sort: 'nome',
    })

    return records.map((r: any) => ({
      id: r.id,
      nome: r.nome,
      cnpj: r.cnpj,
      contato_nome: r.contato_nome,
      contato_email: r.contato_email,
      contato_telefone: r.contato_telefone,
      ufs_atuacao: Array.isArray(r.ufs_atuacao)
        ? r.ufs_atuacao
        : typeof r.ufs_atuacao === 'string'
          ? JSON.parse(r.ufs_atuacao || '[]')
          : [],
      contrato_inicio: r.contrato_inicio,
      contrato_fim: r.contrato_fim,
      status: r.status || 'ativo',
      observacoes: r.observacoes,
      created: r.created,
      updated: r.updated,
    }))
  } catch (err) {
    console.error('[distribuidores-service] Erro ao listar distribuidores:', err)
    throw err
  }
}

export async function getDistribuidorById(id: string): Promise<Distribuidor | null> {
  try {
    const r: any = await pb.collection('distribuidores').getOne(id)
    return {
      id: r.id,
      nome: r.nome,
      cnpj: r.cnpj,
      contato_nome: r.contato_nome,
      contato_email: r.contato_email,
      contato_telefone: r.contato_telefone,
      ufs_atuacao: Array.isArray(r.ufs_atuacao)
        ? r.ufs_atuacao
        : typeof r.ufs_atuacao === 'string'
          ? JSON.parse(r.ufs_atuacao || '[]')
          : [],
      contrato_inicio: r.contrato_inicio,
      contrato_fim: r.contrato_fim,
      status: r.status || 'ativo',
      observacoes: r.observacoes,
      created: r.created,
      updated: r.updated,
    }
  } catch (err) {
    console.error('[distribuidores-service] Erro ao buscar distribuidor:', err)
    return null
  }
}

export async function createDistribuidor(
  data: Partial<Distribuidor>,
  currentUser?: any,
): Promise<Distribuidor> {
  const payload = {
    nome: data.nome?.trim(),
    cnpj: data.cnpj?.trim() || '',
    contato_nome: data.contato_nome?.trim() || '',
    contato_email: data.contato_email?.trim() || '',
    contato_telefone: data.contato_telefone?.trim() || '',
    ufs_atuacao: data.ufs_atuacao || [],
    contrato_inicio: data.contrato_inicio || null,
    contrato_fim: data.contrato_fim || null,
    status: data.status || 'ativo',
    observacoes: data.observacoes?.trim() || '',
  }

  const rec: any = await pb.collection('distribuidores').create(payload)

  await recordEntityChangeLog({
    entity_type: 'distribuidor',
    entity_id: rec.id,
    entity_name: rec.nome,
    change_summary: `Distribuidor '${rec.nome}' cadastrado`,
    action: 'create',
    user_id: currentUser?.id,
    user_name: currentUser?.name || currentUser?.email,
  })

  notifyDataChanged('distribuidores')
  return {
    ...data,
    id: rec.id,
    created: rec.created,
    updated: rec.updated,
  } as Distribuidor
}

export async function updateDistribuidor(
  id: string,
  data: Partial<Distribuidor>,
  currentUser?: any,
): Promise<Distribuidor> {
  const payload: Record<string, any> = {}
  if (data.nome !== undefined) payload.nome = data.nome.trim()
  if (data.cnpj !== undefined) payload.cnpj = data.cnpj.trim()
  if (data.contato_nome !== undefined) payload.contato_nome = data.contato_nome.trim()
  if (data.contato_email !== undefined) payload.contato_email = data.contato_email.trim()
  if (data.contato_telefone !== undefined) payload.contato_telefone = data.contato_telefone.trim()
  if (data.ufs_atuacao !== undefined) payload.ufs_atuacao = data.ufs_atuacao
  if (data.contrato_inicio !== undefined) payload.contrato_inicio = data.contrato_inicio || null
  if (data.contrato_fim !== undefined) payload.contrato_fim = data.contrato_fim || null
  if (data.status !== undefined) payload.status = data.status
  if (data.observacoes !== undefined) payload.observacoes = data.observacoes.trim()

  const rec: any = await pb.collection('distribuidores').update(id, payload)

  await recordEntityChangeLog({
    entity_type: 'distribuidor',
    entity_id: rec.id,
    entity_name: rec.nome,
    change_summary: `Cadastro do distribuidor '${rec.nome}' atualizado`,
    action: 'update',
    user_id: currentUser?.id,
    user_name: currentUser?.name || currentUser?.email,
  })

  notifyDataChanged('distribuidores')
  return {
    ...data,
    id: rec.id,
    created: rec.created,
    updated: rec.updated,
  } as Distribuidor
}

// ----------------------------------------------------------------------------
// COMPRAS DO DISTRIBUIDOR CRUD & SINC COM FATURAMENTO
// ----------------------------------------------------------------------------

export async function getComprasDistribuidor(
  distribuidorId?: string,
): Promise<CompraDistribuidor[]> {
  try {
    const filter = distribuidorId ? `distribuidor_id = '${distribuidorId}'` : ''
    const records = await pb.collection('compras_distribuidor').getFullList({
      filter,
      sort: '-data',
    })

    return records.map((r: any) => ({
      id: r.id,
      distribuidor_id: r.distribuidor_id,
      data: r.data,
      produto: r.produto,
      linha_produto: r.linha_produto,
      toneladas: Number(r.toneladas || 0),
      valor_brl: Number(r.valor_brl || 0),
      valor_usd: Number(r.valor_usd || 0),
      nf: r.nf,
      observacoes: r.observacoes,
      origem: r.origem || 'manual',
      faturamento_id: r.faturamento_id,
      created: r.created,
      updated: r.updated,
    }))
  } catch (err) {
    console.error('[distribuidores-service] Erro ao listar compras:', err)
    throw err
  }
}

export async function createCompraDistribuidor(
  data: Partial<CompraDistribuidor>,
  currentUser?: any,
): Promise<CompraDistribuidor> {
  const payload = {
    distribuidor_id: data.distribuidor_id,
    data: data.data || new Date().toISOString(),
    produto: data.produto?.trim(),
    linha_produto: data.linha_produto || mapearLinhaProduto(data.produto),
    toneladas: Number(data.toneladas || 0),
    valor_brl: Number(data.valor_brl || 0),
    valor_usd: Number(data.valor_usd || 0),
    nf: data.nf?.trim() || '',
    observacoes: data.observacoes?.trim() || '',
    origem: data.origem || 'manual',
    faturamento_id: data.faturamento_id || '',
  }

  const rec: any = await pb.collection('compras_distribuidor').create(payload)

  await recordEntityChangeLog({
    entity_type: 'compra_distribuidor',
    entity_id: rec.id,
    entity_name: `Compra NF ${rec.nf || 'S/N'} (${rec.produto})`,
    change_summary: `Compra registrada: ${rec.produto} (${rec.toneladas} Ton - R$ ${rec.valor_brl})`,
    action: 'create',
    user_id: currentUser?.id,
    user_name: currentUser?.name || currentUser?.email,
  })

  notifyDataChanged('compras_distribuidor')
  return {
    ...payload,
    id: rec.id,
    created: rec.created,
    updated: rec.updated,
  } as CompraDistribuidor
}

/**
 * Sincroniza faturamento oficial importado no sistema para as compras dos distribuidores.
 * Cruza pelo nome/CNPJ do distribuidor com o faturamento existente (ex: Feedpro).
 */
export async function sincronizarFaturamentoComCompras(
  distribuidor: Distribuidor,
): Promise<{ importadas: number }> {
  try {
    const nomeLimpo = distribuidor.nome.split('(')[0].trim()
    const filter = `cliente_nome ~ '${nomeLimpo}' || cliente_nome ~ '${distribuidor.nome}'`
    const fatRecords = await pb.collection('faturamento').getFullList({
      filter,
      sort: '-data_documento',
    })

    if (!fatRecords || fatRecords.length === 0) return { importadas: 0 }

    // Obter compras já vinculadas
    const comprasAtuais = await pb.collection('compras_distribuidor').getFullList({
      filter: `distribuidor_id = '${distribuidor.id}'`,
    })
    const existingFatIds = new Set(comprasAtuais.map((c: any) => c.faturamento_id).filter(Boolean))

    let importadas = 0
    for (let i = 0; i < fatRecords.length; i++) {
      const f: any = fatRecords[i]
      if (existingFatIds.has(f.id)) continue

      const prod = f.produto_descricao || f.produto_codigo || 'Produto Blink'
      const valUsd = Number(f.valor_usd || 0)
      const valBrl = Number(f.valor_brl || 0)
      const ton =
        valUsd > 0 ? Number((valUsd / 2800).toFixed(2)) : Number((valBrl / 14000).toFixed(2))

      await pb.collection('compras_distribuidor').create({
        distribuidor_id: distribuidor.id,
        data: f.data_documento || f.created,
        produto: prod,
        linha_produto: mapearLinhaProduto(f.produto_codigo || prod),
        toneladas: Math.max(0.2, ton || 1),
        valor_brl: valBrl,
        valor_usd: valUsd,
        nf: `NF-FAT-${f.nf_ano || 2026}-${i + 1}`,
        origem: 'faturamento_importado',
        faturamento_id: f.id,
        observacoes: 'Alimentado automaticamente pela esteira oficial de faturamento',
      })
      importadas++
    }

    if (importadas > 0) {
      notifyDataChanged('compras_distribuidor')
    }
    return { importadas }
  } catch (err) {
    console.warn('[distribuidores-service] Falha ao sincronizar faturamento:', err)
    return { importadas: 0 }
  }
}

// ----------------------------------------------------------------------------
// CLIENTES DA CARTEIRA CRUD + AUDITORIA + TRANSFERÊNCIA + LOTE
// ----------------------------------------------------------------------------

export async function getClientesDistribuidor(
  distribuidorId?: string,
): Promise<ClienteDistribuidor[]> {
  try {
    const filter = distribuidorId ? `distribuidor_id = '${distribuidorId}'` : ''
    const records = await pb.collection('clientes_distribuidor').getFullList({
      filter,
      sort: 'nome_cliente',
    })

    return records.map((r: any) => ({
      id: r.id,
      distribuidor_id: r.distribuidor_id,
      nome_cliente: r.nome_cliente,
      uf: r.uf,
      municipio: r.municipio,
      status: r.status || 'ativo',
      observacoes: r.observacoes,
      factory_id: r.factory_id,
      created: r.created,
      updated: r.updated,
    }))
  } catch (err) {
    console.error('[distribuidores-service] Erro ao listar clientes da carteira:', err)
    throw err
  }
}

export async function createClienteDistribuidor(
  data: Partial<ClienteDistribuidor>,
  distribuidorNome: string,
  currentUser?: any,
): Promise<ClienteDistribuidor> {
  const payload = {
    distribuidor_id: data.distribuidor_id,
    nome_cliente: data.nome_cliente?.trim().toUpperCase(),
    uf: data.uf?.trim().toUpperCase() || '',
    municipio: data.municipio?.trim() || '',
    status: data.status || 'ativo',
    observacoes: data.observacoes?.trim() || '',
    factory_id: data.factory_id || '',
  }

  const rec: any = await pb.collection('clientes_distribuidor').create(payload)

  await recordEntityChangeLog({
    entity_type: 'cliente_distribuidor',
    entity_id: rec.id,
    entity_name: rec.nome_cliente,
    change_summary: `Cliente '${rec.nome_cliente}' (${rec.uf || 'Sem UF'}) incluído na carteira do distribuidor '${distribuidorNome}'`,
    action: 'create',
    user_id: currentUser?.id,
    user_name: currentUser?.name || currentUser?.email,
  })

  notifyDataChanged('clientes_distribuidor')
  return {
    ...payload,
    id: rec.id,
    created: rec.created,
    updated: rec.updated,
  } as ClienteDistribuidor
}

export async function deleteClienteDistribuidor(
  cliente: ClienteDistribuidor,
  distribuidorNome: string,
  currentUser?: any,
): Promise<void> {
  await pb.collection('clientes_distribuidor').delete(cliente.id)

  await recordEntityChangeLog({
    entity_type: 'cliente_distribuidor',
    entity_id: cliente.id,
    entity_name: cliente.nome_cliente,
    change_summary: `Cliente '${cliente.nome_cliente}' excluído da carteira da ${distribuidorNome}`,
    action: 'delete',
    user_id: currentUser?.id,
    user_name: currentUser?.name || currentUser?.email,
  })

  notifyDataChanged('clientes_distribuidor')
}

export async function transferirClienteDistribuidor(
  cliente: ClienteDistribuidor,
  novoDistribuidorId: string,
  antigoDistribuidorNome: string,
  novoDistribuidorNome: string,
  currentUser?: any,
): Promise<void> {
  await pb.collection('clientes_distribuidor').update(cliente.id, {
    distribuidor_id: novoDistribuidorId,
  })

  await recordEntityChangeLog({
    entity_type: 'cliente_distribuidor',
    entity_id: cliente.id,
    entity_name: cliente.nome_cliente,
    old_value: antigoDistribuidorNome,
    new_value: novoDistribuidorNome,
    change_summary: `Cliente '${cliente.nome_cliente}' transferido de '${antigoDistribuidorNome}' para '${novoDistribuidorNome}'`,
    action: 'update',
    user_id: currentUser?.id,
    user_name: currentUser?.name || currentUser?.email,
  })

  notifyDataChanged('clientes_distribuidor')
}

export async function importBatchClientesDistribuidor(
  distribuidorId: string,
  distribuidorNome: string,
  rows: Array<{ estado?: string; clientes?: string; municipio?: string }>,
  currentUser?: any,
): Promise<{ inseridos: number; pendentesUF: number }> {
  let inseridos = 0
  let pendentesUF = 0

  for (const r of rows) {
    const nome = (r.clientes || '').trim().toUpperCase()
    if (!nome) continue

    const uf = (r.estado || '').trim().toUpperCase()
    if (!uf) {
      pendentesUF++
    }

    const payload = {
      distribuidor_id: distribuidorId,
      nome_cliente: nome,
      uf: uf || '',
      municipio: (r.municipio || '').trim() || '',
      status: 'ativo',
      observacoes: !uf ? 'Atenção: UF pendente de complemento' : 'Importado via planilha em lote',
    }

    const rec: any = await pb.collection('clientes_distribuidor').create(payload)
    inseridos++

    await recordEntityChangeLog({
      entity_type: 'cliente_distribuidor',
      entity_id: rec.id,
      entity_name: nome,
      change_summary: `Cliente '${nome}' importado em lote para carteira de '${distribuidorNome}' (${uf || 'SEM UF'})`,
      action: 'create',
      user_id: currentUser?.id,
      user_name: currentUser?.name || currentUser?.email,
    })
  }

  notifyDataChanged('clientes_distribuidor')
  return { inseridos, pendentesUF }
}
