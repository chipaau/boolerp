// Inventory resource shapes. Mirrors what the API will return; once `packages/api-client` is
// generated from the OpenAPI spec these become re-exports of the generated types.

export type ItemStatus = 'In stock' | 'Low stock' | 'Out of stock' | 'On order'

export type Item = {
  name: string
  sku: string
  location: string
  onHand: number
  issued: number
  /** Unit cost in the tenant currency, used for stock valuation. */
  unitCost: number
  status: ItemStatus
}

export type ItemFilter = 'All' | 'Low stock' | 'Issued' | 'On order'

export type Period = '7d' | '30d' | '90d'
export type Series = { labels: string[]; inn: number[]; out: number[]; onHand: number[]; low: number[]; issued: number[] }

export type LowStockItem = { name: string; meta: string; tag: 'Critical' | 'Low' }
export type Category = { name: string; value: number; pct: number; risk: number }
export type Approval = { id: string; title: string; meta: string; who: string; age: string; urgent: boolean }
export type Movement = { text: string; time: string }
