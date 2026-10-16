import { Mail, MapPin } from 'lucide-react'
import { ContactForm } from './contact-form'

/** "Let's talk": where every call to action on the site leads. A few lines and the ways to reach us, beside the form. */
export function Contact() {
  return (
    <section className="relative flex grow flex-col justify-center overflow-hidden">
      <div aria-hidden="true" className="office-grid grid-fade-top pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid w-full max-w-7xl section-t-header section-b items-start gap-14 px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] 2xl:max-w-[88rem]">
        <div>
          <p className="text-overline tracking-[0.28em] text-muted-foreground">Contact</p>
          <h1 className="mt-4 text-[clamp(2.5rem,3.9vw,3.6rem)] font-light leading-[1.05] tracking-[-0.035em] text-foreground">
            Let’s talk
            <br />
            <span className="text-(--brand)">about how you work.</span>
          </h1>
          <p className="section-lead mt-6 max-w-md text-muted-foreground">Tell us about your organisation and we’ll show you Bool set up for it. No obligation, just a conversation.</p>
          <ul className="mt-10 grid gap-4 text-[15px]">
            <li className="flex items-center gap-3">
              <Mail className="size-5 text-(--brand)" strokeWidth={1.6} />
              <a href="mailto:sales@bool.mv" className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
                sales@bool.mv
              </a>
            </li>
            <li className="flex items-center gap-3 text-foreground">
              <MapPin className="size-5 text-(--brand)" strokeWidth={1.6} />
              Malé, Maldives
            </li>
          </ul>
        </div>
        <ContactForm />
      </div>
    </section>
  )
}
