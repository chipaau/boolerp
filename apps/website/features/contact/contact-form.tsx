'use client'

import { useEffect, useState } from 'react'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { SelectField } from '@workspace/ui/components/select'
import { CTA, CTA_ARROW } from '@/components/cta'

const SALES = 'sales@bool.mv'
// a slimmer focus ring on the form's fields than the shared 2px
const THIN = 'focus-visible:ring-[1.5px] data-popup-open:ring-[1.5px]'
// the pickers, the same fill, height and type as the inputs
const PICKER = 'h-[42px] rounded-md bg-field px-3.5 text-ui-lg font-normal'
const TOPICS = ['A demo of Bool', 'Plans and pricing', 'Running Bool ourselves', 'Something else']
// how many people would sign in: optional, and the first thing a quote (per seat) needs
const SIZES = ['Up to 25', '26–100', '101–500', 'More than 500', 'Not sure yet']
// the topic a link can choose ahead (/contact?topic=demo, from Book a demo)
const PRESET: Record<string, string> = { demo: TOPICS[0], pricing: TOPICS[1], 'self-hosting': TOPICS[2] }

/**
 * The contact form. There is no form service yet, so sending opens the visitor's own email, addressed
 * to sales with what they wrote; nothing is stored or sent from the page itself.
 */
export function ContactForm() {
  const [topic, setTopic] = useState(TOPICS[0])
  const [size, setSize] = useState('')
  useEffect(() => {
    const preset = PRESET[new URLSearchParams(location.search).get('topic') ?? '']
    if (preset) setTopic(preset)
  }, [])

  const send = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const get = (k: string) => String(f.get(k) ?? '').trim()
    const body = [
      get('message'),
      '',
      `${get('name')}${get('organisation') ? `, ${get('organisation')}` : ''}`,
      get('email'),
      ...(size ? [`People who would use Bool: ${size}`] : []),
    ].join('\n')
    location.href = `mailto:${SALES}?subject=${encodeURIComponent(`${topic} (bool.mv)`)}&body=${encodeURIComponent(body)}`
  }

  return (
    <form onSubmit={send} className="glass-card grid gap-5 p-7 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="contact-name">Your name</Label>
        <Input id="contact-name" name="name" required autoComplete="name" className={THIN} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contact-organisation">Organisation</Label>
        <Input id="contact-organisation" name="organisation" autoComplete="organization" className={THIN} />
      </div>
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="contact-email">Email</Label>
        <Input id="contact-email" name="email" type="email" required autoComplete="email" className={THIN} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contact-topic">What would you like to talk about?</Label>
        <SelectField id="contact-topic" value={topic} onValueChange={setTopic} options={TOPICS} className={`${PICKER} ${THIN}`} contentClassName="bg-[#f6f1e7]" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contact-size">
          How many people would use Bool? <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <SelectField id="contact-size" value={size} onValueChange={setSize} options={SIZES} placeholder="Choose a range" className={`${PICKER} ${THIN}`} contentClassName="bg-[#f6f1e7]" />
      </div>
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="contact-message">Tell us a little about how you work</Label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          className="w-full resize-y rounded-md bg-field px-3.5 py-2.5 text-ui-lg text-foreground outline-none placeholder:text-placeholder focus-visible:ring-[1.5px] focus-visible:ring-ring"
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
