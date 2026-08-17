import pb from '@/lib/pocketbase/client'
import type { RecordSubscription } from 'pocketbase'

export interface LayoutVersion {
  id: string
  user: string
  page_name: string
  config_data: string
  version_label: string
  is_active: boolean
  created: string
  updated: string
}

const PAGE_SIZE = 10

export const PAGE_NAME_OPTIONS = [
  '/dashboard',
  '/funil',
  '/clientes',
  '/planos',
  '/metas',
  '/equipe',
]

export const layoutVersionService = {
  async getByPage(pageName: string, page: number = 1, pageSize: number = PAGE_SIZE) {
    const userId = pb.authStore.record?.id
    const filter = `user = "${userId}" && page_name = "${pageName}"`
    return pb.collection('layout_versions').getList<LayoutVersion>(page, pageSize, {
      sort: '-created',
      filter,
    })
  },

  async getActive(pageName: string): Promise<LayoutVersion | null> {
    const userId = pb.authStore.record?.id
    const filter = `user = "${userId}" && page_name = "${pageName}" && is_active = true`
    const list = await pb
      .collection('layout_versions')
      .getList<LayoutVersion>(1, 1, { sort: '-created', filter })
    return list.items[0] || null
  },

  async create(versionData: {
    page_name: string
    config_data: string
    version_label?: string
  }): Promise<LayoutVersion> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Sem permissao')

    // Deactivate previous active versions for this user+page, then create the
    // new one as active. Wrap in a try/catch: if deactivation fails we still
    // surface the error.
    const existing = await this.getActive(versionData.page_name)
    if (existing) {
      try {
        await pb.collection('layout_versions').update(existing.id, { is_active: false })
      } catch (err) {
        // The unique partial index will reject the new active insert if the old
        // one remains active; surface as "Ja existe uma versao ativa".
        console.error('failed to deactivate previous active version', err)
        throw new Error('Ja existe uma versao ativa para esta pagina')
      }
    }

    try {
      return await pb.collection('layout_versions').create<LayoutVersion>({
        user: userId,
        page_name: versionData.page_name,
        config_data: versionData.config_data,
        version_label: versionData.version_label || '',
        is_active: true,
      })
    } catch (err: any) {
      // Map common PocketBase constraint errors to Portuguese messages.
      const msg = err?.response?.message || err?.message || ''
      if (msg.includes('unique') || msg.includes('UNIQUE')) {
        throw new Error('Ja existe uma versao ativa para esta pagina')
      }
      if (msg.includes('required') || msg.includes('cannot be blank')) {
        throw new Error('Valor invalido')
      }
      throw err
    }
  },

  async setActive(versionId: string, pageName: string): Promise<void> {
    const userId = pb.authStore.record?.id
    // Find current active (if any) and deactivate.
    const currentActive = await this.getActive(pageName)
    if (currentActive && currentActive.id !== versionId) {
      try {
        await pb.collection('layout_versions').update(currentActive.id, { is_active: false })
      } catch (err) {
        console.error('failed to deactivate during restore', err)
        throw new Error('Nao foi possivel restaurar esta versao. Tente novamente.')
      }
    }
    try {
      await pb.collection('layout_versions').update(versionId, { is_active: true })
    } catch (err: any) {
      const msg = err?.response?.message || err?.message || ''
      if (msg.includes('unique') || msg.includes('UNIQUE')) {
        throw new Error('Ja existe uma versao ativa para esta pagina')
      }
      throw new Error('Nao foi possivel restaurar esta versao. Tente novamente.')
    }
  },

  async deleteById(versionId: string): Promise<void> {
    // Reject if the version is active.
    let rec: LayoutVersion | null = null
    try {
      rec = await pb.collection('layout_versions').getOne<LayoutVersion>(versionId)
    } catch {
      throw new Error('Registro nao encontrado')
    }
    if (rec && rec.is_active) {
      throw new Error('Nao e possivel excluir a versao ativa.')
    }
    try {
      await pb.collection('layout_versions').delete(versionId)
    } catch (err: any) {
      const msg = err?.response?.message || err?.message || ''
      if (msg.includes('foreign key') || msg.includes('FOREIGN KEY')) {
        throw new Error('Referencia invalida')
      }
      throw err
    }
  },

  subscribe(callback: (data: RecordSubscription<LayoutVersion>) => void) {
    return pb.collection('layout_versions').subscribe<LayoutVersion>('*', (e) => {
      try {
        callback(e)
      } catch (err) {
        console.error('layout version subscribe error', err)
      }
    })
  },
}
