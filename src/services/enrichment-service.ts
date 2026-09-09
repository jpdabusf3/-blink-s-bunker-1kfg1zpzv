import pb from '@/lib/pocketbase/client'

export interface EnrichmentClientDetail {
  client_id: string
  client_name: string
  address_status: 'complete' | 'partial' | 'inconsistent' | 'enriched' | 'failed' | string
  geocode_precision: 'exact' | 'street' | 'city' | 'failed' | string
}

export interface EnrichmentSummary {
  total_processed: number
  total_enriched: number
  total_geocoded: number
  total_failed: number
  total_inconsistent: number
  details?: EnrichmentClientDetail[]
}

export interface EnrichClientDataOptions {
  mode?: 'all' | 'single'
  client_id?: string
}

// Global enrichment-in-progress state listeners
type EnrichmentListener = (inProgress: boolean) => void
const enrichmentListeners = new Set<EnrichmentListener>()
let isEnrichmentInProgress = false

export function getIsEnrichmentInProgress(): boolean {
  return isEnrichmentInProgress
}

export function subscribeEnrichmentStatus(listener: EnrichmentListener): () => void {
  enrichmentListeners.add(listener)
  listener(isEnrichmentInProgress)
  return () => {
    enrichmentListeners.delete(listener)
  }
}

function setEnrichmentInProgress(inProgress: boolean) {
  isEnrichmentInProgress = inProgress
  enrichmentListeners.forEach((fn) => {
    try {
      fn(inProgress)
    } catch {
      /* intentionally ignored */
    }
  })
}

export async function enrichClientData(
  options: EnrichClientDataOptions = { mode: 'all' },
): Promise<EnrichmentSummary> {
  const mode = options.mode || 'all'
  const body: Record<string, any> = { mode }

  if (mode === 'single' && options.client_id) {
    body.client_id = options.client_id
  }

  setEnrichmentInProgress(true)
  try {
    const response = await pb.send<EnrichmentSummary>('/backend/v1/enrich-client-data', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    return {
      total_processed: Number(response?.total_processed || 0),
      total_enriched: Number(response?.total_enriched || 0),
      total_geocoded: Number(response?.total_geocoded || 0),
      total_failed: Number(response?.total_failed || 0),
      total_inconsistent: Number(response?.total_inconsistent || 0),
      details: response?.details || [],
    }
  } finally {
    setEnrichmentInProgress(false)
  }
}
