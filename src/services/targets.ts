import pb from '@/lib/pocketbase/client'
import { Target } from '@/types'

export const getTargets = () => pb.collection('targets').getFullList<Target>()
