//  @ts-check

/** @type {import('prettier').Config} */
const config = {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  // FindCare's components are written to wider lines than the workspace's
  printWidth: 180,
}

export default config
