// UI fixtures — shapes pending SRS/data-model review; replaced at integration.
// Seed data from the Bool Admin design (.design/login/Bool Workspace/Bool Admin.dc.html).
import type { AppDef, AppName, OrgType, EntityType, Plan, TenantProfile } from './types'

export const APP_CATALOG: AppDef[] = [
  { name: 'Inventory Management', note: 'Stock, purchase orders, transfers across sites', modules: ['Stock', 'Purchase orders', 'Transfers', 'Reports'] },
  { name: 'Directory', note: 'People, units and org structure', modules: ['People', 'Org chart', 'Attendance'] },
  { name: 'Calendar', note: 'Shared bookings and leave', modules: ['Bookings', 'Leave'] },
  { name: 'Scan', note: 'Mobile stock counting', modules: ['Mobile scan'] },
  { name: 'Control Centre', note: 'Tenant-side settings — always included', modules: ['Settings'] },
]

/** Apps every tenant gets included: Control Centre and Calendar. */
export const CORE_APPS: AppName[] = ['Control Centre', 'Calendar']

export const PLANS: Plan[] = [
  { name: 'Starter', seats: 40, base: 1200, perSeat: 22, note: 'One app plus Control Centre' },
  { name: 'Basic', seats: 120, base: 3500, perSeat: 19, note: 'Up to three apps, standard support' },
  { name: 'Pro', seats: 300, base: 8900, perSeat: 16, note: 'Every app, priority support' },
  { name: 'Enterprise', seats: 800, base: 19500, perSeat: 12, note: 'Custom seats, child tenants, SLA' },
]

export const ORG_TYPES: OrgType[] = ['Government', 'Local government', 'Public company', 'Private company', 'NGO', 'International']
export const ENTITY_TYPES: EntityType[] = ['Ministry', 'Statutory body', 'Council', 'Hospital', 'School', 'Education', 'Transport', 'Telecom', 'Other']

export const TENANT_PROFILES: TenantProfile[] = [
  {
    slug: 'ncit', name: 'National Centre for Information Technology', abbr: 'NCIT', regNo: 'CO123456', orgType: 'Government', entityType: 'Statutory body',
    parentSlug: null, plan: 'Basic', status: 'Active', activeFrom: '25 Oct 2024', contact: '3324568', email: 'ncit@gov.mv', country: 'Maldives', district: 'Malé City',
    addr: 'NCIT, Kalaafaanu Hingun', mail: 'Same as registered address', seatsUsed: 38, seatLimit: 120,
    apps: { 'Inventory Management': ['Stock', 'Purchase orders', 'Reports'], Directory: ['People', 'Org chart'], 'Control Centre': ['Settings'] },
    admins: [
      { name: 'Fathimath Mohamed', idNo: 'A154788', email: 'fathimath@ncit.gov.mv', invite: 'Accepted', last: 'Signed in 2 days ago' },
      { name: 'Ahmed Rasheed', idNo: 'A201877', email: 'ahmed.r@ncit.gov.mv', invite: 'Accepted', last: 'Signed in 6 hours ago' },
      { name: 'Hawwa Nazlee', idNo: 'A339021', email: 'hawwa@ncit.gov.mv', invite: 'Invited', last: 'Invited 3 days ago' },
    ],
    activity: [
      { when: '12 Sep 2026', what: 'Plan changed from Starter to Basic', who: 'Mariyam Ahmed' },
      { when: '02 Sep 2026', what: 'Directory app enabled, Org chart module added', who: 'Mariyam Ahmed' },
      { when: '28 Aug 2026', what: 'Hawwa Nazlee invited as tenant admin', who: 'Fathimath Mohamed' },
      { when: '25 Oct 2024', what: 'Tenant created and activated', who: 'Ahmed Shifaz' },
    ],
  },
  {
    slug: 'vc', name: 'Villa College', abbr: 'VC', regNo: 'C-0921/2011', orgType: 'Private company', entityType: 'Education',
    parentSlug: null, plan: 'Pro', status: 'Active', activeFrom: '14 Mar 2025', contact: '3301616', email: 'info@villacollege.edu.mv', country: 'Maldives', district: 'Malé City',
    addr: 'Villa College, Ameenee Magu', mail: 'PO Box 2073, Malé', seatsUsed: 122, seatLimit: 300,
    apps: { Directory: ['People', 'Org chart', 'Attendance'], Calendar: ['Bookings', 'Leave'], 'Control Centre': ['Settings'] },
    admins: [
      { name: 'Raj Kumar', idNo: 'P-8823441', email: 'raj@villacollege.edu.mv', invite: 'Expired', last: 'Invited 21 days ago' },
      { name: 'Aminath Shiuna', idNo: 'A440192', email: 'shiuna@villacollege.edu.mv', invite: 'Accepted', last: 'Signed in yesterday' },
    ],
    activity: [
      { when: '08 Sep 2026', what: 'Invite to Raj Kumar expired', who: 'System' },
      { when: '14 Mar 2025', what: 'Tenant created and activated', who: 'Mariyam Ahmed' },
    ],
  },
  {
    slug: 'mtcc', name: 'Maldives Transport and Contracting Company', abbr: 'MTCC', regNo: 'C-0112/1980', orgType: 'Public company', entityType: 'Transport',
    parentSlug: null, plan: 'Enterprise', status: 'Active', activeFrom: '03 Jan 2024', contact: '3001200', email: 'info@mtcc.com.mv', country: 'Maldives', district: 'Malé City',
    addr: 'MTCC Tower, Boduthakurufaanu Magu', mail: 'Same as registered address', seatsUsed: 410, seatLimit: 800,
    apps: { 'Inventory Management': ['Stock', 'Purchase orders', 'Transfers', 'Reports'], Directory: ['People', 'Org chart', 'Attendance'], Scan: ['Mobile scan'], 'Control Centre': ['Settings'] },
    admins: [
      { name: 'Ibrahim Nasir', idNo: 'A118844', email: 'i.nasir@mtcc.com.mv', invite: 'Invited', last: 'Invited 9 days ago' },
      { name: 'Mohamed Zahir', idNo: 'A093311', email: 'zahir@mtcc.com.mv', invite: 'Accepted', last: 'Signed in 3 days ago' },
    ],
    activity: [
      { when: '01 Sep 2026', what: 'Seat limit raised to 800', who: 'Mariyam Ahmed' },
      { when: '03 Jan 2024', what: 'Tenant created and activated', who: 'Ahmed Shifaz' },
    ],
  },
  {
    slug: 'moh', name: 'Ministry of Health', abbr: 'MOH', regNo: 'G-0004', orgType: 'Government', entityType: 'Ministry',
    parentSlug: null, plan: 'Enterprise', status: 'Active', activeFrom: '18 Feb 2024', contact: '3014444', email: 'admin@health.gov.mv', country: 'Maldives', district: 'Malé City',
    addr: 'Roshanee Building, Sosun Magu', mail: 'Same as registered address', seatsUsed: 212, seatLimit: 800,
    apps: { Directory: ['People', 'Org chart'], 'Inventory Management': ['Stock', 'Reports'], 'Control Centre': ['Settings'] },
    admins: [{ name: 'Aishath Rifga', idNo: 'A128877', email: 'rifga@health.gov.mv', invite: 'Accepted', last: 'Signed in today' }],
    activity: [
      { when: '07 Aug 2025', what: 'Kulhudhuffushi Regional Hospital added as a child tenant', who: 'Mariyam Ahmed' },
      { when: '18 Feb 2024', what: 'Tenant created and activated', who: 'Ahmed Shifaz' },
    ],
  },
  {
    slug: 'acc', name: 'Addu City Council', abbr: 'ACC', regNo: 'LG-0021', orgType: 'Local government', entityType: 'Council',
    parentSlug: null, plan: 'Basic', status: 'Active', activeFrom: '19 Jun 2025', contact: '6885555', email: 'info@adducity.gov.mv', country: 'Maldives', district: 'Addu City',
    addr: 'Addu City Council, Hithadhoo', mail: 'Same as registered address', seatsUsed: 64, seatLimit: 120,
    apps: { 'Inventory Management': ['Stock', 'Reports'], Directory: ['People', 'Attendance'], 'Control Centre': ['Settings'] },
    admins: [{ name: 'Ali Shareef', idNo: 'A551200', email: 'ali.s@adducity.gov.mv', invite: 'Accepted', last: 'Signed in today' }],
    activity: [{ when: '19 Jun 2025', what: 'Tenant created and activated', who: 'Mariyam Ahmed' }],
  },
  {
    slug: 'dhi', name: 'Dhiraagu', abbr: 'DHI', regNo: 'C-0056/1988', orgType: 'Public company', entityType: 'Telecom',
    parentSlug: null, plan: 'Pro', status: 'Suspended', activeFrom: '11 Feb 2024', contact: '3323323', email: 'care@dhiraagu.com.mv', country: 'Maldives', district: 'Malé City',
    addr: 'Dhiraagu Head Office, Ameenee Magu', mail: 'PO Box 2082, Malé', seatsUsed: 0, seatLimit: 300,
    apps: { Directory: ['People'], 'Control Centre': ['Settings'] },
    admins: [{ name: 'Shifza Ibrahim', idNo: 'A662001', email: 'shifza@dhiraagu.com.mv', invite: 'Accepted', last: 'Locked out — tenant suspended' }],
    activity: [
      { when: '04 Sep 2026', what: 'Tenant suspended — billing on hold. All sign-ins blocked.', who: 'Mariyam Ahmed' },
      { when: '11 Feb 2024', what: 'Tenant created and activated', who: 'Ahmed Shifaz' },
    ],
  },
  {
    slug: 'krh', name: 'Kulhudhuffushi Regional Hospital', abbr: 'KRH', regNo: 'G-0221', orgType: 'Government', entityType: 'Hospital',
    parentSlug: 'moh', plan: 'Basic', status: 'Active', activeFrom: '07 Aug 2025', contact: '6528610', email: 'admin@krh.gov.mv', country: 'Maldives', district: 'Kulhudhuffushi City',
    addr: 'KRH, Hospital Road', mail: 'Same as registered address', seatsUsed: 91, seatLimit: 120,
    apps: { 'Inventory Management': ['Stock', 'Purchase orders', 'Transfers'], Scan: ['Mobile scan'], 'Control Centre': ['Settings'] },
    admins: [{ name: 'Aishath Nadha', idNo: 'A770315', email: 'nadha@krh.gov.mv', invite: 'Accepted', last: 'Signed in 4 hours ago' }],
    activity: [{ when: '07 Aug 2025', what: 'Tenant created under Ministry of Health', who: 'Mariyam Ahmed' }],
  },
  {
    slug: 'igmh', name: 'Indhira Gandhi Memorial Hospital', abbr: 'IGMH', regNo: 'G-0208', orgType: 'Government', entityType: 'Hospital',
    parentSlug: 'moh', plan: 'Pro', status: 'Pending activation', activeFrom: '—', contact: '3335335', email: 'admin@igmh.gov.mv', country: 'Maldives', district: 'Malé City',
    addr: 'IGMH, Kanbaa Aisarani Hingun', mail: 'Same as registered address', seatsUsed: 0, seatLimit: 300,
    apps: { 'Inventory Management': ['Stock'], 'Control Centre': ['Settings'] },
    admins: [],
    activity: [{ when: '10 Sep 2026', what: 'Tenant saved as pending — no admin user yet', who: 'Mariyam Ahmed' }],
  },
  {
    slug: 'baec', name: 'Baa Atoll Education Centre', abbr: 'BAEC', regNo: 'G-0410', orgType: 'Government', entityType: 'School',
    parentSlug: null, plan: 'Starter', status: 'Draft', activeFrom: '—', contact: '—', email: '—', country: 'Maldives', district: 'Eydhafushi',
    addr: '—', mail: '—', seatsUsed: 0, seatLimit: 40,
    apps: { 'Control Centre': ['Settings'] },
    admins: [],
    activity: [{ when: '13 Sep 2026', what: 'Draft started', who: 'Mariyam Ahmed' }],
  },
]

/** The operator shown as the actor on activity lines written by fixture mutations. */
export const CURRENT_OPERATOR = 'Mariyam Ahmed'
/** The design's "today". */
export const TODAY = '16 Sep 2026'
