import type { Metadata } from 'next'
import { MyCareScreen } from '@/components/my-care/my-care-screen'

export const metadata: Metadata = { title: 'My Care' }

export default function MyCarePage() {
  return <MyCareScreen />
}
