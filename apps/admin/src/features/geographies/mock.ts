// UI fixtures — shapes pending SRS/data-model review; replaced at integration.
// Seed data from the Bool Admin design (.design/login/Bool Workspace/Bool Admin.dc.html).
import type { Country, Geography, GeographyType } from './types'

export const COUNTRIES: Country[] = [
  { code: 'MV', name: 'Maldives', dial: '+960', added: '25 Aug 2024', status: 'Active', geographyCount: 14 },
  { code: 'LK', name: 'Sri Lanka', dial: '+94', added: '25 Aug 2024', status: 'Active', geographyCount: 3 },
  { code: 'IN', name: 'India', dial: '+91', added: '02 Feb 2025', status: 'Active', geographyCount: 2 },
  { code: 'SG', name: 'Singapore', dial: '+65', added: '14 Jul 2025', status: 'Inactive', geographyCount: 0 },
]

export const GEOGRAPHIES: Geography[] = [
  { name: 'Kaafu', type: 'Atoll', country: 'Maldives', parent: 'Maldives', postal: '—', status: 'Active', use: 5, depth: 0 },
  { name: 'Malé City', type: 'City', country: 'Maldives', parent: 'Kaafu', postal: '20026', status: 'Active', use: 23, depth: 1 },
  { name: 'Hulhumalé', type: 'Island', country: 'Maldives', parent: 'Kaafu', postal: '23000', status: 'Active', use: 7, depth: 1 },
  { name: 'Seenu', type: 'Atoll', country: 'Maldives', parent: 'Maldives', postal: '—', status: 'Active', use: 2, depth: 0 },
  { name: 'Addu City', type: 'City', country: 'Maldives', parent: 'Seenu', postal: '19020', status: 'Active', use: 4, depth: 1 },
  { name: 'Haa Dhaalu', type: 'Atoll', country: 'Maldives', parent: 'Maldives', postal: '—', status: 'Active', use: 1, depth: 0 },
  { name: 'Kulhudhuffushi City', type: 'City', country: 'Maldives', parent: 'Haa Dhaalu', postal: '02020', status: 'Active', use: 2, depth: 1 },
  { name: 'Baa', type: 'Atoll', country: 'Maldives', parent: 'Maldives', postal: '—', status: 'Active', use: 1, depth: 0 },
  { name: 'Eydhafushi', type: 'Island', country: 'Maldives', parent: 'Baa', postal: '06040', status: 'Draft', use: 0, depth: 1 },
  { name: 'Western Province', type: 'State', country: 'Sri Lanka', parent: 'Sri Lanka', postal: '—', status: 'Active', use: 1, depth: 0 },
  { name: 'Colombo', type: 'City', country: 'Sri Lanka', parent: 'Western Province', postal: '00100', status: 'Active', use: 1, depth: 1 },
  { name: 'Kerala', type: 'State', country: 'India', parent: 'India', postal: '—', status: 'Active', use: 0, depth: 0 },
  { name: 'Trivandrum', type: 'City', country: 'India', parent: 'Kerala', postal: '695001', status: 'Inactive', use: 0, depth: 1 },
]

export const GEOGRAPHY_TYPES: GeographyType[] = ['Atoll', 'State', 'City', 'Island', 'Ward']
export const TODAY = '16 Sep 2026'
