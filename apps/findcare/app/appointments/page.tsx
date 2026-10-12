import type { Metadata } from 'next'
import { AppointmentsScreen } from '@/components/appointments/appointments-screen'

export const metadata: Metadata = { title: 'Appointments' }

export default function AppointmentsPage() {
  return <AppointmentsScreen />
}
