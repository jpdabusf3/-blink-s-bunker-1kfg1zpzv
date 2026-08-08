import pb from '@/lib/pocketbase/client'

export interface IntegrationTestResult {
  status: string
  banco: string
  collections: Record<string, boolean>
  allCollectionsExist: boolean
}

export const testIntegration = (): Promise<IntegrationTestResult> =>
  pb.send('/backend/v1/teste-integracao', { method: 'GET' })
