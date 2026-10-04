'use client'

import { createContext, useContext, useState, type PropsWithChildren } from 'react'
import { FlowType } from '@ory/client-fetch'
import {
  useOryFlow,
  type OryFlowComponentOverrides,
  type OryMessageContentProps,
  type OryNodeButtonProps,
  type OryNodeInputProps,
  type OryNodeLabelProps,
  type OryNodeSsoButtonProps,
  type OryNodeTextProps,
  type OryFormRootProps,
  type OryFormSectionContentProps,
  type OryFormSectionFooterProps,
  type OryCardAuthMethodListItemProps,
  type OryNodeAnchorProps,
} from '@ory/elements-react'
import logo from '@workspace/assets/logos/bool-logo.png'
import { Button, ButtonArrow, buttonVariants } from '@workspace/ui/components/button'
import { HexGlyph } from '@workspace/ui/components/hex-glyph'
import { Hexagon } from '@workspace/ui/components/hexagon'
import { Input } from '@workspace/ui/components/input'
import { MadeBy } from '@workspace/ui/components/made-by'
import { cn } from '@workspace/ui/lib/utils'

// The Bool login design (C84), rebuilt from @workspace/ui for Ory Elements: the same
// canvas, fields, buttons, and messages as the existing sign-in screens, so the look
// is unchanged. Elements supplies the Kratos flow handling; these components only
// draw it. This is the default design; each client can get its own set later.

const BRAND = 'Bool'

/** Page title and intro per flow. */
function useHeading(): { title: string; subtitle?: string } {
  const { flowType } = useOryFlow()
  switch (flowType) {
    case FlowType.Registration:
      return { title: 'Create your account', subtitle: 'One account for every Bool service.' }
    case FlowType.Recovery:
      return { title: 'Reset your password', subtitle: 'We will email you a code to get back in.' }
    case FlowType.Verification:
      return { title: 'Verify your email', subtitle: 'Enter the code we sent you.' }
    case FlowType.Settings:
      return { title: 'Your account' }
    default:
      return { title: 'Sign in', subtitle: 'Sign in to continue to Bool.' }
  }
}

/** The sign-in canvas: Warm Ivory page, three faded hexagons, a 408px column that rises in. */
function Shell({ children }: PropsWithChildren) {
  const year = new Date().getFullYear()
  return (
    <div className="relative flex min-h-svh flex-col items-center overflow-hidden bg-background">
      {/* decorative honeycomb, faded so it never competes with the form */}
      <Hexagon
        aria-hidden="true"
        size="860px"
        className="pointer-events-none absolute -top-[260px] left-1/2 -translate-x-1/2 text-card opacity-60"
      />
      <Hexagon
        aria-hidden="true"
        size="590px"
        className="pointer-events-none absolute -bottom-[240px] -left-[220px] text-card opacity-70"
      />
      <Hexagon
        aria-hidden="true"
        size="490px"
        className="pointer-events-none absolute -right-[190px] -bottom-[160px] text-primary opacity-30"
      />
      <div className="relative flex w-full max-w-[408px] flex-1 flex-col justify-center px-6 pt-14 pb-8">
        <div className="animate-rise">{children}</div>
      </div>
      <div className="relative flex w-full max-w-[408px] flex-wrap items-center gap-[18px] px-6 pb-[34px] text-meta text-muted-foreground">
        <span>
          © {year} {BRAND}
        </span>
        <MadeBy />
      </div>
    </div>
  )
}

/**
 * The account page. Elements' settings screen does not use the card, so the page
 * puts it in the same canvas and heading itself.
 */
export function AccountShell({ children, logoutUrl }: PropsWithChildren<{ logoutUrl?: string }>) {
  return (
    <Shell>
      <Brand />
      <h1 className="mt-[38px] text-display-sm font-normal text-foreground">Your account</h1>
      {children}
      {logoutUrl && <SignOut href={logoutUrl} />}
    </Shell>
  )
}

/** Kratos's logout link (with its one-time token, fetched by the page). */
function SignOut({ href }: { href: string }) {
  return (
    <div className="mt-[18px] flex text-ui-sm">
      <a href={href} className="ms-auto text-link hover:underline hover:underline-offset-[3px]">
        Sign out
      </a>
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img src={logo.src} alt="" aria-hidden="true" width={34} height={39} className="h-[39px] w-[34px] object-contain" />
      <span className="text-2xl tracking-[-0.015em] text-foreground">{BRAND}</span>
    </div>
  )
}

function Header() {
  const { title, subtitle } = useHeading()
  return (
    <>
      <Brand />
      <h1 className="mt-[38px] text-display-sm font-normal text-foreground">{title}</h1>
      {subtitle && <p className="mt-2.5 text-ui-lg leading-[1.55] text-pretty text-muted-foreground">{subtitle}</p>}
    </>
  )
}

function Content({ children }: PropsWithChildren) {
  return <div className="mt-[30px] flex flex-col gap-[13px]">{children}</div>
}

/** Links under the form, per flow (the design's "Forgot password?" row). */
function Footer() {
  const { flowType } = useOryFlow()
  const link = 'text-link hover:underline hover:underline-offset-[3px]'
  const row = (children: React.ReactNode) => (
    <div className="mt-[18px] flex flex-wrap items-center justify-between gap-4 text-ui-sm">{children}</div>
  )
  switch (flowType) {
    case FlowType.Login:
      return row(
        <>
          <a href="/registration" className={link}>
            Create an account
          </a>
          <a href="/recovery" className={cn('ms-auto', link)}>
            Forgot password?
          </a>
        </>
      )
    case FlowType.Registration:
    case FlowType.Recovery:
    case FlowType.Verification:
      return row(
        <a href="/login" className={cn('ms-auto', link)}>
          Back to sign in
        </a>
      )
    default:
      return null
  }
}

function FormRoot({ children, onSubmit, action, method }: OryFormRootProps) {
  return (
    <form action={action} method={method} onSubmit={onSubmit} className="flex flex-col gap-[13px]" noValidate>
      {children}
    </form>
  )
}

function Group({ children }: PropsWithChildren) {
  return <div className="flex flex-col gap-[13px]">{children}</div>
}

/** "or" between Google and the password form. */
function Divider() {
  return (
    <div className="my-1 flex items-center gap-3 text-meta text-muted-foreground" aria-hidden="true">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

// The picture trait is filled only from Google's profile (oidc.google.jsonnet), never
// typed: it is sent as a hidden field so Google's value survives the step that asks
// for the phone.
const PICTURE = 'traits.picture'

// A password's Show/Hide sits in its label but changes its input's type.
const RevealContext = createContext<{ reveal: boolean; toggle: () => void } | null>(null)

/** Overline label (with Show/Hide on passwords), the field, then its messages. */
function Label({ node, attributes, children }: OryNodeLabelProps) {
  const [reveal, setReveal] = useState(false)
  // Kratos labels the login field "ID" whatever the schema says; login is by email
  // only (C85).
  const label = attributes.name === 'identifier' ? 'Email' : node.meta.label?.text
  const isPassword = attributes.type === 'password'
  if (attributes.type === 'hidden' || attributes.name === PICTURE) return <>{children}</>
  return (
    <RevealContext.Provider value={{ reveal, toggle: () => setReveal((r) => !r) }}>
      <label className="block">
        {label && (
          <span className="mb-2 flex items-center justify-between">
            <span className="text-fine font-bold tracking-[0.12em] text-faint uppercase">{label}</span>
            {isPassword && (
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                className="text-xs text-link hover:underline hover:underline-offset-[3px]"
              >
                {reveal ? 'Hide' : 'Show'}
              </button>
            )}
          </span>
        )}
        {children}
        {node.messages?.map((m) => (
          <span
            key={m.id}
            className={cn('mt-2 block text-xs', m.type === 'error' ? 'font-bold text-destructive' : 'text-muted-foreground')}
          >
            {m.text}
          </span>
        ))}
      </label>
    </RevealContext.Provider>
  )
}

/** The 52px cream pill field. */
function FieldInput({ node, inputProps }: OryNodeInputProps) {
  const reveal = useContext(RevealContext)
  const hasError = node.messages?.some((m) => m.type === 'error')
  if (inputProps.type === 'hidden') return <input {...inputProps} />
  if (inputProps.name === PICTURE) return <input {...inputProps} type="hidden" />
  const type = inputProps.type === 'password' && reveal?.reveal ? 'text' : inputProps.type
  return (
    <Input
      {...inputProps}
      // The design labels fields above them and uses no placeholders.
      placeholder={undefined}
      type={type}
      aria-invalid={hasError || undefined}
      className={cn(
        'h-[52px] rounded-full bg-card px-[21px] hover:bg-surface-soft focus-visible:bg-surface-soft focus-visible:ring-inset focus-visible:ring-ring-warm',
        hasError && 'ring-2 ring-destructive ring-inset'
      )}
    />
  )
}

/** The main action is the amber CTA with the circle arrow; anything else is a cream pill. */
function FlowButton({ node, attributes, isSubmitting, buttonProps }: OryNodeButtonProps) {
  // Kratos labels the login field "ID" whatever the schema says; login is by email
  // only (C85).
  const label = attributes.name === 'identifier' ? 'Email' : node.meta.label?.text || 'Continue'
  // The flow's main submit (method=...), or continuing a Google sign-up that asked
  // for a missing field (provider=..., handed over by SsoButton).
  const primary = attributes.type === 'submit' && (attributes.name === 'method' || attributes.name === 'provider')
  if (primary) {
    return (
      <Button {...buttonProps} disabled={buttonProps.disabled || isSubmitting} variant="brand" size="xl" className="mt-[13px] w-full justify-between">
        {isSubmitting ? 'Checking…' : label}
        <ButtonArrow>
          {isSubmitting ? (
            <span className="size-3.5 animate-spin-fast rounded-full border-2 border-brand-soft/30 border-t-brand-cta-hover" />
          ) : undefined}
        </ButtonArrow>
      </Button>
    )
  }
  return (
    <Button
      {...buttonProps}
      disabled={buttonProps.disabled || isSubmitting}
      variant="secondary"
      className="h-[52px] w-full bg-card text-ui hover:bg-surface-soft"
    >
      {label}
    </Button>
  )
}

// Kratos's labels for a provider button: sign in, sign up, link, unlink with {provider}.
const PROVIDER_LABEL_IDS = new Set([1010002, 1040002, 1050002, 1050003])

/**
 * "Sign in with Google" as a cream secondary pill. When a Google sign-up asked for a
 * missing field, the same button is the flow's "Continue", so it is the amber CTA.
 */
function SsoButton({ node, attributes, isSubmitting, buttonProps }: OryNodeSsoButtonProps) {
  const label = node.meta.label
  if (label && !PROVIDER_LABEL_IDS.has(label.id)) {
    return <FlowButton node={node} attributes={attributes} isSubmitting={isSubmitting} buttonProps={buttonProps} />
  }
  return (
    <Button
      {...buttonProps}
      disabled={buttonProps.disabled || isSubmitting}
      variant="secondary"
      className="h-[52px] w-full bg-card text-ui hover:bg-surface-soft"
    >
      {node.meta.label?.text ?? 'Continue with Google'}
    </Button>
  )
}

/** A link Kratos offers as the next step (such as "Continue" after verifying), as the amber CTA. */
function Anchor({ attributes, node, ...rest }: OryNodeAnchorProps) {
  return (
    <a
      {...rest}
      href={attributes.href}
      className={cn(buttonVariants({ variant: 'brand', size: 'xl' }), 'mt-[13px] w-full justify-between')}
      data-variant="brand"
    >
      {node.meta.label?.text ?? attributes.title.text}
      <ButtonArrow />
    </a>
  )
}

function Text({ node }: OryNodeTextProps) {
  const text = node.meta.label?.text
  return text ? <p className="text-ui-lg leading-[1.55] text-muted-foreground">{text}</p> : null
}

/** Errors shake in as a rose pill; other messages stay quiet. */
function Message({ message }: OryMessageContentProps) {
  if (message.type === 'error') {
    return (
      <div role="alert" className="flex animate-shake items-center gap-2.5 rounded-full bg-destructive-soft px-[18px] py-3">
        <HexGlyph size={11} className="text-destructive" />
        <span className="text-ui-sm text-destructive">{message.text}</span>
      </div>
    )
  }
  return <p className="text-ui-sm text-muted-foreground">{message.text}</p>
}

function MessageRoot({ children }: PropsWithChildren) {
  return <div className="flex flex-col gap-[13px]">{children}</div>
}

/** Settings sections (password, linked Google account) in the same column. */
function SettingsSection({ children }: PropsWithChildren) {
  return <section className="mt-[30px] flex w-full flex-col gap-[13px] self-stretch">{children}</section>
}

function SettingsSectionContent({ title, description, children }: OryFormSectionContentProps) {
  return (
    <div className="flex flex-col gap-[13px]">
      {title && <h2 className="text-ui-lg text-foreground">{title}</h2>}
      {description && <p className="text-ui-sm text-muted-foreground">{description}</p>}
      {children}
    </div>
  )
}

function SettingsSectionFooter({ text, children }: OryFormSectionFooterProps) {
  return (
    <div className="flex flex-col gap-[13px]">
      {text && <p className="text-ui-sm text-muted-foreground">{text}</p>}
      {children}
    </div>
  )
}

const METHOD_LABELS: Record<string, string> = {
  password: 'Continue with a password',
  code: 'Continue with a code',
}

/** A sign-in method to choose (for example "Continue with a password"), as a cream pill. */
function AuthMethod({ onClick, group, disabled }: OryCardAuthMethodListItemProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      variant="secondary"
      className="h-[52px] w-full bg-card text-ui hover:bg-surface-soft"
    >
      {METHOD_LABELS[group] ?? 'Continue'}
    </Button>
  )
}

function Nothing() {
  return null
}

export const boolComponents: OryFlowComponentOverrides = {
  Card: {
    Root: Shell,
    Header,
    Content,
    Footer,
    Divider,
    Logo: Nothing,
    AuthMethodListContainer: Group,
    AuthMethodListItem: AuthMethod,
    SettingsSection,
    SettingsSectionContent,
    SettingsSectionFooter,
  },
  Form: { Root: FormRoot, Group },
  // One-time codes use the same pill field as everything else, not separate boxes.
  Node: { Label, Input: FieldInput, CodeInput: FieldInput, Button: FlowButton, SsoButton, Anchor, Text },
  Message: { Root: MessageRoot, Content: Message },
  Page: { Header: Nothing },
}
