// Shared Kratos browser-flow auth: router-agnostic client + hook + generic form/shell.
// Consumed by apps/app (tenant) and apps/admin (operator) — each supplies its own routes.
export * from './kratos'
export { identityPhoto } from './identity-photo'
export * from './use-flow'
export { KratosForm } from './kratos-form'
export { AuthShell } from './auth-shell'
