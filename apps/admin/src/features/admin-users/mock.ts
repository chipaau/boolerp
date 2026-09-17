// UI fixtures — shapes pending SRS/data-model review; replaced at integration.
// Seed data from the Bool Admin design (.design/login/Bool Workspace/Bool Admin.dc.html).
import avatar5 from '@workspace/assets/avatars/avatar-5.jpg'
import type { AdminUser, RoleDef } from './types'

export const ADMIN_USERS: AdminUser[] = [
  { name: 'Mariyam Ahmed', idNo: 'A100234', email: 'mariyam@bool.co', contact: '7778899', role: 'Platform admin', scope: 'All tenants', invite: 'Accepted', activeFrom: '01 Jan 2024', nationality: 'Maldivian' },
  { name: 'Ahmed Shifaz', idNo: 'A114500', email: 'shifaz@bool.co', contact: '7712233', role: 'Support', scope: 'All tenants', invite: 'Accepted', activeFrom: '01 Jan 2024', nationality: 'Maldivian' },
  { name: 'Fathimath Mohamed', idNo: 'A154788', email: 'fathimath@ncit.gov.mv', contact: '9991122', role: 'Tenant admin', scope: 'NCIT', invite: 'Accepted', activeFrom: '25 Oct 2024', nationality: 'Maldivian' },
  { name: 'Ibrahim Nasir', idNo: 'A118844', email: 'i.nasir@mtcc.com.mv', contact: '7734455', role: 'Tenant admin', scope: 'MTCC', invite: 'Invited', activeFrom: '—', nationality: 'Maldivian' },
  { name: 'Raj Kumar', idNo: 'P-8823441', email: 'raj@villacollege.edu.mv', contact: '7790011', role: 'Tenant admin', scope: 'VC', invite: 'Expired', activeFrom: '—', nationality: 'Expatriate' },
  { name: 'Aishath Leena', idNo: 'A166702', email: 'leena@bool.co', contact: '7756677', role: 'Read only', scope: 'All tenants', invite: 'Accepted', activeFrom: '11 Mar 2025', nationality: 'Maldivian' },
  { name: 'Hawwa Nazlee', idNo: 'A339021', email: 'hawwa@ncit.gov.mv', contact: '9903344', role: 'Tenant admin', scope: 'NCIT', invite: 'Invited', activeFrom: '—', nationality: 'Maldivian' },
]

export const ROLES: RoleDef[] = [
  { key: 'Platform admin', note: 'Full control of every tenant, geography and admin user.' },
  { key: 'Tenant admin', note: 'Runs one tenant. Cannot see or touch the others.' },
  { key: 'Support', note: 'Reads everything, resends invites, nothing destructive.' },
  { key: 'Read only', note: 'Looks at tenants and reports. No changes at all.' },
]

/**
 * Operator photos by email (or name when the session has no email). The same person has the same
 * picture as in the workspace app (org fixture EMP-017). At integration this goes: the avatar comes
 * from the identity's picture trait instead.
 */
export const OPERATOR_AVATARS: { email: string; name: string; src: string }[] = [
  { email: 'mariyam@bool.co', name: 'Mariyam Ahmed', src: avatar5 },
]
