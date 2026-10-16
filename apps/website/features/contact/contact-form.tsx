'use client'

import { useState } from 'react'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { SelectField } from '@workspace/ui/components/select'
import { CTA, CTA_ARROW } from '@/components/cta'

const SALES = 'sales@bool.mv'
// the form's fields: one off-white fill and height for the inputs, the message and the topic picker
const FIELD = 'h-11 bg-[#fffdf9] shadow-[inset_0_0_0_1px_rgb(168_148_118/0.3)]'
const LABEL = 'text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/70'
const TOPICS = ['A demo of Bool', 'Plans and pricing', 'Running Bool ourselves', 'Something else']

/**
 * The contact form. There is no form service yet, so sending opens the visitor's own email, addressed
 * to sales with what they wrote; nothing is stored or sent from the page itself.
 */
export function ContactForm() {
  const [topic, setTopic] = useState(TOPICS[0])

  const send = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const get = (k: string) => String(f.get(k) ?? '').trim()
    const body = [get('message'), '', `${get('name')}${get('organisation') ? `, ${get('organisation')}` : ''}`, get('email')].join('\n')
    location.href = `mailto:${SALES}?subject=${encodeURIComponent(`${topic} (bool.mv)`)}&body=${encodeURIComponent(body)}`
  }

  return (
    <form onSubmit={send} className="glass-card grid gap-5 p-7 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label className={LABEL} htmlFor="contact-name">Your name</Label>
        <Input id="contact-name" name="name" required autoComplete="name" className={FIELD} />
      </div>
      <div className="grid gap-2">
        <Label className={LABEL} htmlFor="contact-organisation">Organisation</Label>
        <Input id="contact-organisation" name="organisation" autoComplete="organization" className={FIELD} />
      </div>
      <div className="grid gap-2 sm:col-span-2">
        <Label className={LABEL} htmlFor="contact-email">Email</Label>
        <Input id="contact-email" name="email" type="email" required autoComplete="email" className={FIELD} />
      </div>
      <div className="grid gap-2 sm:col-span-2">
        <Label className={LABEL} htmlFor="contact-topic">What would you like to talk about?</Label>
        <SelectField id="contact-topic" value={topic} onValueChange={setTopic} options={TOPICS} className={`${FIELD} rounded-md px-3.5 text-ui-lg font-normal`} contentClassName="bg-[#fffdf9]" />
      </div>
      <div className="grid gap-2 sm:col-span-2">
        <Label className={LABEL} htmlFor="contact-message">Tell us a little about how you work</Label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          className="w-full resize-y rounded-md bg-[#fffdf9] px-3.5 py-2.5 text-ui-lg text-foreground shadow-[inset_0_0_0_1px_rgb(168_148_118/0.3)] outline-none placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <Button type="submit" size="lg" variant="brand" className={CTA}>
          Send message
          <ButtonArrow className={CTA_ARROW} />
        </Button>
        <p className="text-[13px] text-muted-foreground">Opens your email, addressed to {SALES}.</p>
      </div>
    </form>
  )
}
