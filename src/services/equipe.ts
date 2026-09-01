import pb from '@/lib/pocketbase/client'

export type EquipeCargo = 'Gestor Tecnico' | 'Vendedor'

export interface EquipeMember {
  id: string
  nome: string
  cargo: EquipeCargo
  email?: string
  regiao?: string
  ativo: boolean
  user_id?: string
  created?: string
  updated?: string
}

export async function getEquipe(): Promise<EquipeMember[]> {
  try {
    const records = await pb.collection('equipe').getFullList<EquipeMember>({
      sort: 'nome',
    })
    return records
  } catch (err) {
    console.error('Erro ao buscar equipe:', err)
    return []
  }
}

export async function getGestoresTecnicosEquipe(): Promise<EquipeMember[]> {
  try {
    const records = await pb.collection('equipe').getFullList<EquipeMember>({
      filter: "cargo = 'Gestor Tecnico' && ativo = true",
      sort: 'nome',
    })
    return records
  } catch (err) {
    console.error('Erro ao buscar gestores tecnicos da equipe:', err)
    return []
  }
}

export async function getVendedoresEquipe(): Promise<EquipeMember[]> {
  try {
    const records = await pb.collection('equipe').getFullList<EquipeMember>({
      filter: "cargo = 'Vendedor' && ativo = true",
      sort: 'nome',
    })
    return records
  } catch (err) {
    console.error('Erro ao buscar vendedores da equipe:', err)
    return []
  }
}

export async function createEquipeMember(data: Partial<EquipeMember>): Promise<EquipeMember> {
  const payload = {
    ...data,
    user_id: data.user_id || pb.authStore.record?.id || '',
  }
  return await pb.collection('equipe').create<EquipeMember>(payload)
}

export async function updateEquipeMember(
  id: string,
  data: Partial<EquipeMember>,
): Promise<EquipeMember> {
  return await pb.collection('equipe').update<EquipeMember>(id, data)
}

export async function deleteEquipeMember(id: string): Promise<boolean> {
  return await pb.collection('equipe').delete(id)
}
