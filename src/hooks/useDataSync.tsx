/**
 * Re-export para migração suave: useRealtimeData é o hook canônico único.
 */
export * from './useRealtimeData'
export { GlobalDataProvider, useGlobalData } from '@/store/GlobalDataProvider'
export { useRealtimeData as default } from './useRealtimeData'
