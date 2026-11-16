import pb from '@/lib/pocketbase/client'
import { DEFAULT_DASHBOARD_BLOCKS, MONITOR_EXTRA_BLOCK_IDS } from '@/services/dashboard-preferences'

/** Duração padrão (30s) e opções de duração por seção. */
export const DEFAULT_MONITOR_DURATION_S = 30
export const MONITOR_DURATION_OPTIONS_S = [15, 30, 60, 120]

export type MonitorDurationMap = Record<string, number>

export interface MonitorSectionPref {
  id: string
  visible: boolean
}

export interface MonitorPreferences {
  /** Ordem e visibilidade de cada seção do monitor. */
  sections: MonitorSectionPref[]
  /** Duração (s) por seção; ausente ⇒ DEFAULT_MONITOR_DURATION_S. */
  durations: MonitorDurationMap
}

/** Ordem/visibilidade padrão: todos os blocos do Painel + extras do monitor. */
export const DEFAULT_MONITOR_SECTIONS: MonitorSectionPref[] = [
  ...DEFAULT_DASHBOARD_BLOCKS.filter(
    (id) => !(MONITOR_EXTRA_BLOCK_IDS as readonly string[]).includes(id),
  ).map((id) => ({ id, visible: true })),
  ...MONITOR_EXTRA_BLOCK_IDS.map((id) => ({ id, visible: true })),
]

const DEFAULTS: MonitorPreferences = {
  sections: DEFAULT_MONITOR_SECTIONS.map((s) => ({ ...s })),
  durations: {},
}

const STORAGE_KEY = 'blink-monitor-prefs'

function currentUserId(): string | undefined {
  try {
    return pb.authStore.record?.id
  } catch {
    return undefined
  }
}

/** Chave por usuário para não misturar preferências entre contas. */
function storageKey(): string {
  const uid = currentUserId()
  return uid ? `${STORAGE_KEY}:${uid}` : STORAGE_KEY
}

function normalize(raw: unknown): MonitorPreferences | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Partial<MonitorPreferences>
  if (!Array.isArray(obj.sections)) return null
  const known = new Set(DEFAULT_MONITOR_SECTIONS.map((s) => s.id))
  const saved = obj.sections.filter(
    (s): s is MonitorSectionPref =>
      !!s && typeof s.id === 'string' && known.has(s.id) && typeof s.visible === 'boolean',
  )
  // Merge: seções novas (nunca salvas) entram no fim, ativas — mesmo padrão
  // do merge de prefs do dashboard.
  const missing = DEFAULT_MONITOR_SECTIONS.filter((d) => !saved.some((s) => s.id === d.id))
  const durations: MonitorDurationMap = {}
  if (obj.durations && typeof obj.durations === 'object') {
    for (const [id, v] of Object.entries(obj.durations)) {
      if (known.has(id) && typeof v === 'number' && v > 0) durations[id] = v
    }
  }
  return { sections: [...saved, ...missing], durations }
}

/** Fallback local (cache rápido / storage indisponível no servidor). */
function loadLocal(): MonitorPreferences | null {
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) return null
    return normalize(JSON.parse(raw))
  } catch {
    return null
  }
}

function saveLocal(prefs: MonitorPreferences): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(prefs))
  } catch {
    /* storage indisponível: segue em memória */
  }
}

/** Carrega as preferências: PocketBase (campo monitor_prefs) com fallback local. */
export async function fetchMonitorPreferences(): Promise<MonitorPreferences> {
  const local = loadLocal()
  try {
    const rec = await pb
      .collection('dashboard_preferences')
      .getList<{ monitor_prefs?: unknown }>(1, 1, {
        filter: `userId = "${pb.authStore.record?.id}"`,
      })
    const saved = normalize(rec.items[0]?.monitor_prefs)
    if (saved) {
      saveLocal(saved) // mantém o cache local em sincronia
      return saved
    }
  } catch {
    /* sem backend/auth: usa o que houver localmente */
  }
  return local ?? { ...DEFAULTS, sections: DEFAULTS.sections.map((s) => ({ ...s })), durations: {} }
}

/** Salva no PocketBase (campo monitor_prefs) e no cache local. */
export async function persistMonitorPreferences(prefs: MonitorPreferences): Promise<void> {
  saveLocal(prefs)
  try {
    const list = await pb.collection('dashboard_preferences').getList(1, 1, {
      filter: `userId = "${pb.authStore.record?.id}"`,
    })
    const existing = list.items[0]
    if (existing) {
      await pb.collection('dashboard_preferences').update(existing.id, { monitor_prefs: prefs })
    } else {
      await pb.collection('dashboard_preferences').create({
        userId: pb.authStore.record?.id,
        blocks: DEFAULT_DASHBOARD_BLOCKS,
        monitor_prefs: prefs,
      })
    }
  } catch {
    /* segue com o cache local */
  }
}

/** Duração efetiva de uma seção (padrão 30s). */
export function sectionDuration(prefs: MonitorPreferences, id: string): number {
  const d = prefs.durations[id]
  return typeof d === 'number' && d > 0 ? d : DEFAULT_MONITOR_DURATION_S
}
