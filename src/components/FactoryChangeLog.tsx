import { FactoryHistoryView } from '@/components/FactoryHistoryView'

export function FactoryChangeLog({ factoryId }: { factoryId: string }) {
  return <FactoryHistoryView factoryId={factoryId} />
}
