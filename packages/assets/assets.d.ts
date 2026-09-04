// Module typings for the artwork this package exports, so TypeScript projects that import
// `@workspace/assets/...` outside a Vite program (e.g. packages/auth on its own) still type-check.
declare module '*.png' {
  const src: string
  export default src
}
declare module '*.jpg' {
  const src: string
  export default src
}
declare module '*.webp' {
  const src: string
  export default src
}
declare module '*.svg' {
  const src: string
  export default src
}
