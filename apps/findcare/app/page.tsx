'use client'

import { useSearchParams } from 'next/navigation'
import { Page } from '@/components/shell/page'
import { AdvancedList } from '@/components/find/advanced-list'
import { FindHome } from '@/components/find/find-home'
import { FindFooter } from '@/components/find/idle-sections'
import { isListKind } from '@/components/find/list-kind'

/** Find care: the search home, or with ?all= one of its full lists (doctors, services, clinics). */
export default function FindCarePage() {
  const all = useSearchParams().get('all')
  return (
    // At least a screen tall, so the footer sits at the very bottom when the content is short.
    <Page className="min-h-[calc(100svh-var(--header-h))] gap-0 pb-0 min-[760px]:pb-0">
      <div className="flex-1 pb-16">{isListKind(all) ? <AdvancedList initial={all} /> : <FindHome />}</div>
      <FindFooter />
    </Page>
  )
}
