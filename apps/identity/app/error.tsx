'use client'

import { FlowUnavailable } from '@/theme/flow-unavailable'

// A page could not load its flow (for example Kratos is unreachable).
export default function PageError() {
  return <FlowUnavailable />
}
