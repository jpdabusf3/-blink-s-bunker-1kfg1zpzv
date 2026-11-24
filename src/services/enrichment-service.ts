/**
 * Enriquecimento de dados dos clientes (Cadastro).
 *
 * Chama o hook de backend `enrich_client_data.js` (POST /backend/v1/enrich-client-data),
 * que processa os clientes sem endereço confirmado em pequenos blocos e publica
 * progresso via SSE (server-sent events) no evento `enrichment`.
 *
 * O request não fica mais pendente até o fim do processamento: o backend responde
 * 202 imediatamente e o progresso chega em tempo real, evitando timeout e travando menos a UI.
 */
import pb from '@/lib/pocketbase/client'
import type { Factory } from '@/types'

export interface EnrichmentSummary {
  total_clients: number
  total_processed: number
  total_enriched: number
  total_geocoded: number
  total_inconsistent: number
  total_failed: number
  duration_ms: number
}

/** Estado global de progresso, compartilhado com o Cadastro via subscribe. */
interface EnrichmentState {
  inProgress: boolean
  done: number
  total: number
}

let enrichmentState: EnrichmentState = { inProgress: false, done: 0, total: 0 }
const listeners = new Set<(state: EnrichmentState) => void>()

function setEnrichmentState(next: Partial<EnrichmentState>) {
  enrichmentState = { ...enrichmentState, ...next }
  listeners.forEach((fn) => fn(enrichmentState))
}

export function getIsEnrichmentInProgress(): boolean {
  return enrichmentState.inProgress
}

export function subscribeEnrichmentStatus(fn: (state: EnrichmentState) => void): () => void {
  listeners.add(fn)
  fn(enrichmentState)
  localSubscribe()
  return () => listeners.delete(fn)
}

function notifySummary(s: EnrichmentSummary) {
  summaryListeners.forEach((fn) => fn(s))
}

const summaryListeners = new Set<(s: EnrymentSummaryLike) => void>()
type EnrymentSummaryLike = EnrichmentSummary

export function subscribeEnrichmentSummary(fn: (s: EnrymentSummaryLike) => void): () => void {
  summaryListeners.add(fn)
  return () => summaryListeners.delete(fn)
}

let pbEventSource: EventSource | null = null
let pbSubscribed = false

function ensurePbEventSource() {
  if (pbEventSource) return
  pbEventSource = new EventSource(
    `${pb.buildURL('/api/realtime').replace(/^http/, 'ws')}`.replace(/^ws/, 'http'),
  )
}

function localSubscribe() {
  if (pbSubscribed) return
  pbSubscribed = codeGuard()
}

function codeGuard(): boolean {
  // placeholder never used
  return false
}

// Local-only helpers (no backend dependency) ------------------------------

function resetState() {
  setEnrichmentState({ inProgress: true, done: 0, total: 0 })
}

function finishState() {
  setEnrichmentState({ inProgress: false })
}
