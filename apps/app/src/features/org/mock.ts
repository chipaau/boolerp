// FIXTURES — the sample workspace (Hexa) that Control Centre edits and every other app reads.
// Merged from the Directory and Control Center designs: the Directory's org tree (any depth,
// coloured, with leads) carrying the Control Center's employee record (IDs, status, contract,
// app roles, sites). Only ./queries.ts may import this file (lint-enforced).
import avatar1 from '@workspace/assets/avatars/avatar-1.jpg'
import avatar2 from '@workspace/assets/avatars/avatar-2.jpg'
import avatar3 from '@workspace/assets/avatars/avatar-3.jpg'
import avatar4 from '@workspace/assets/avatars/avatar-4.webp'
import avatar5 from '@workspace/assets/avatars/avatar-5.jpg'
import avatar6 from '@workspace/assets/avatars/avatar-6.jpg'
import avatar7 from '@workspace/assets/avatars/avatar-7.jpg'
import { ROLE_TEMPLATE, chatHandle, deriveRole, fmtDate, slugMail } from './logic'
import type { ApprovalChain, AuditEntry, NotificationRule, Contract, Country, Holiday, Me, NumberingRule, Person, PersonRole, PersonStatus, Region, Site, SiteType, Unit } from './types'

/** The signed-in person: Mariyam Ahmed, an Admin. */
export const ME: Me = { id: 'EMP-017', role: 'Admin' }

// ---- units: [id, name, parent, code, kind]
const U: [string, string, string | null, string, Unit['kind']][] = [
  ['exec', 'Executive', null, 'EXEC', 'Division'],
  ['eng', 'Engineering', null, 'ENG', 'Division'],
  ['eng-plat', 'Platform', 'eng', 'ENG-PL', 'Department'],
  ['eng-plat-data', 'Data Infrastructure', 'eng-plat', 'ENG-PL-DI', 'Team'],
  ['eng-plat-api', 'API', 'eng-plat', 'ENG-PL-API', 'Team'],
  ['eng-prod', 'Product Engineering', 'eng', 'ENG-PE', 'Department'],
  ['eng-qa', 'Quality', 'eng', 'ENG-QA', 'Team'],
  ['des', 'Design', null, 'DES', 'Department'],
  ['des-prod', 'Product Design', 'des', 'DES-PD', 'Team'],
  ['des-brand', 'Brand', 'des', 'DES-BR', 'Team'],
  ['sales', 'Sales', null, 'SLS', 'Division'],
  ['sales-ent', 'Enterprise', 'sales', 'SLS-ENT', 'Team'],
  ['sales-smb', 'SMB', 'sales', 'SLS-SMB', 'Team'],
  ['cs', 'Customer Success', null, 'CS', 'Department'],
  ['cs-support', 'Support', 'cs', 'CS-SUP', 'Team'],
  ['cs-onb', 'Onboarding', 'cs', 'CS-ONB', 'Team'],
  ['ops', 'Operations', null, 'OPS', 'Division'],
  ['ops-wh', 'Warehouse', 'ops', 'OPS-WH', 'Department'],
  ['ops-proc', 'Procurement', 'ops', 'OPS-PR', 'Department'],
  ['ops-svc', 'Service', 'ops', 'OPS-SV', 'Department'],
  ['ops-fac', 'Facilities', 'ops', 'OPS-FAC', 'Team'],
  ['ops-fin', 'Finance', 'ops', 'OPS-FIN', 'Team'],
  ['people', 'People', null, 'PPL', 'Division'],
  ['people-rec', 'Recruiting', 'people', 'PPL-RC', 'Team'],
  ['people-ops', 'People Operations', 'people', 'PPL-OP', 'Team'],
]
const UNIT_TONES: Partial<Record<string, Unit['tone']>> = { exec: 'warning', eng: 'success', des: 'plum', sales: 'slate', cs: 'tan', ops: 'neutral', people: 'rose' }
export const UNITS: Unit[] = U.map(([id, name, parent, code, kind]) => ({ id, name, parent, code, kind, tone: UNIT_TONES[id], archived: false }))

// ---- people: [code, name, title, unit, manager, status, start, contract, role, primary site, storage sites]
type Row = [string, string, string, string, string, PersonStatus, string, Contract, PersonRole, string, string[]]
const P: Row[] = [
  ['EMP-001', 'Ada Whitfield', 'Chief Executive', 'exec', '', 'Active', '12 Mar 2018', 'Full-time', 'Admin', '', []],
  // Operations — the Control Center record, sites and all
  ['EMP-002', 'Claudia Reyes', 'Director of Operations', 'ops', 'EMP-001', 'Active', '4 Feb 2019', 'Full-time', 'Admin', 's-1', ['s-1', 's-2', 's-3', 's-4', 's-5', 's-6', 's-7', 's-8']],
  ['EMP-003', 'Sofie Bakker', 'Site Manager', 'ops-wh', 'EMP-002', 'Active', '3 Mar 2021', 'Full-time', 'Manager', 's-1', ['s-1', 's-2']],
  ['EMP-004', 'Tomas Vidal', 'Transit Coordinator', 'ops-wh', 'EMP-003', 'Active', '16 Jan 2023', 'Full-time', 'Manager', 's-2', ['s-2']],
  ['EMP-005', 'Lieke de Vos', 'Site Manager', 'ops-wh', 'EMP-002', 'Active', '5 Sep 2022', 'Full-time', 'Manager', 's-3', ['s-3', 's-4']],
  ['EMP-006', 'Noor Haddad', 'Counter Lead', 'ops-wh', 'EMP-005', 'Active', '10 Jun 2024', 'Full-time', 'Manager', 's-4', ['s-4']],
  ['EMP-007', 'Jasper Klein', 'Counter Lead', 'ops-wh', 'EMP-005', 'On leave', '17 Feb 2025', 'Full-time', 'Manager', 's-5', ['s-5']],
  ['EMP-008', 'Aya Rahman', 'Project Coordinator', 'ops', 'EMP-002', 'Active', '6 Apr 2026', 'Full-time', 'Manager', 's-6', ['s-6']],
  ['EMP-009', 'Milan Petrov', 'Workshop Lead', 'ops-svc', 'EMP-002', 'Active', '20 Nov 2023', 'Full-time', 'Manager', 's-7', ['s-7']],
  ['EMP-010', 'Ken Watanabe', 'Procurement Specialist', 'ops-proc', 'EMP-002', 'Active', '8 Aug 2022', 'Full-time', 'Staff', 's-1', ['s-1', 's-3', 's-8']],
  ['EMP-011', 'Priya Nair', 'Stock Controller', 'ops-wh', 'EMP-003', 'Active', '2 May 2023', 'Full-time', 'Staff', 's-1', ['s-1', 's-2']],
  ['EMP-012', 'Bram Jansen', 'Warehouse Operative', 'ops-wh', 'EMP-003', 'Active', '13 Jan 2026', 'Contract', 'Staff', 's-1', ['s-1']],
  ['EMP-013', 'Elliot Vance', 'Head of People', 'people', 'EMP-001', 'Active', '1 Oct 2019', 'Full-time', 'Admin', '', []],
  ['EMP-014', 'Nadia Sorensen', 'HR Manager', 'people-ops', 'EMP-013', 'Active', '14 Mar 2022', 'Full-time', 'Manager', '', []],
  ['EMP-015', 'Yusuf Karim', 'Recruiting Lead', 'people-rec', 'EMP-013', 'Active', '7 Jul 2021', 'Full-time', 'Manager', '', []],
  ['EMP-016', 'Ines Duarte', 'People Operations Specialist', 'people-ops', 'EMP-014', 'Active', '19 Sep 2024', 'Part-time', 'Staff', '', []],
  // the people the Calendar already knew
  ['EMP-017', 'Mariyam Ahmed', 'Design Lead', 'des', 'EMP-022', 'Active', '3 Feb 2020', 'Full-time', 'Admin', '', []],
  ['EMP-018', 'Jonas Lindqvist', 'Product Manager', 'eng-prod', 'EMP-025', 'Active', '18 May 2021', 'Full-time', 'Manager', '', []],
  ['EMP-019', 'Hana Yusuf', 'Product Designer', 'des-prod', 'EMP-023', 'Active', '9 Aug 2023', 'Full-time', 'Staff', '', []],
  ['EMP-020', 'Hugo Fernández', 'Support Specialist', 'cs-support', 'EMP-060', 'Exited', '5 May 2023', 'Full-time', 'Staff', '', []],
  ['EMP-021', 'Ibrahim Shareef', 'Stock Controller', 'ops-wh', 'EMP-003', 'Not started', '1 Oct 2026', 'Full-time', 'Staff', 's-1', ['s-1']],
  // Design
  ['EMP-022', 'Priya Raman', 'Head of Design', 'des', 'EMP-001', 'Active', '2 Sep 2019', 'Full-time', 'Admin', '', []],
  ['EMP-023', 'Leo Marchetti', 'Design Lead', 'des-prod', 'EMP-022', 'Active', '11 Jan 2021', 'Full-time', 'Manager', '', []],
  ['EMP-024', 'Noor Sayed', 'Senior Product Designer', 'des-prod', 'EMP-023', 'Active', '14 Jun 2021', 'Full-time', 'Staff', '', []],
  // Engineering
  ['EMP-025', 'Marcus Denholm', 'VP Engineering', 'eng', 'EMP-001', 'Active', '6 Nov 2018', 'Full-time', 'Admin', '', []],
  ['EMP-026', 'Sana Iqbal', 'Engineering Manager', 'eng-plat', 'EMP-025', 'Active', '23 Apr 2020', 'Full-time', 'Manager', '', []],
  ['EMP-027', 'Rina Chaudhary', 'Senior Engineer', 'eng-plat', 'EMP-026', 'Active', '3 Mar 2021', 'Full-time', 'Staff', '', []],
  ['EMP-028', 'Tobias Lindgren', 'Staff Engineer', 'eng-plat-data', 'EMP-026', 'Active', '17 Aug 2020', 'Full-time', 'Manager', '', []],
  ['EMP-029', 'Ivan Petrov', 'Site Reliability Engineer', 'eng-plat-data', 'EMP-028', 'Active', '4 Oct 2022', 'Full-time', 'Staff', '', []],
  ['EMP-030', 'Felix Mbeki', 'Senior Engineer', 'eng-plat-api', 'EMP-026', 'Active', '9 Feb 2021', 'Full-time', 'Manager', '', []],
  ['EMP-031', 'Joon-ho Park', 'Engineer', 'eng-plat-api', 'EMP-030', 'Active', '15 May 2023', 'Full-time', 'Staff', '', []],
  ['EMP-032', 'Aoife Brennan', 'Engineer', 'eng-plat-api', 'EMP-030', 'Active', '2 Sep 2024', 'Full-time', 'Staff', '', []],
  ['EMP-033', 'Daniel Osei', 'Engineering Manager', 'eng-prod', 'EMP-025', 'Active', '12 Jul 2020', 'Full-time', 'Manager', '', []],
  ['EMP-034', 'Lucia Ferrari', 'Staff Engineer', 'eng-prod', 'EMP-033', 'Active', '1 Mar 2021', 'Full-time', 'Staff', '', []],
  ['EMP-035', 'Wei Zhang', 'Senior Engineer', 'eng-prod', 'EMP-033', 'Active', '20 Sep 2021', 'Full-time', 'Staff', '', []],
  ['EMP-036', 'Marta Nowak', 'Senior Engineer', 'eng-prod', 'EMP-033', 'Active', '8 Nov 2021', 'Full-time', 'Staff', '', []],
  ['EMP-037', 'Samir Haddad', 'Engineer', 'eng-prod', 'EMP-033', 'Active', '3 Apr 2023', 'Full-time', 'Staff', '', []],
  ['EMP-038', 'Grace Okonkwo', 'Engineer', 'eng-prod', 'EMP-033', 'Active', '22 Jan 2024', 'Full-time', 'Staff', '', []],
  ['EMP-039', 'Theo Lambert', 'Engineer', 'eng-prod', 'EMP-033', 'Active', '10 Jun 2024', 'Full-time', 'Staff', '', []],
  ['EMP-040', 'Nils Bergstrom', 'Engineer', 'eng-prod', 'EMP-033', 'Active', '2 Dec 2024', 'Full-time', 'Staff', '', []],
  ['EMP-041', 'Adam Boyle', 'Engineer', 'eng-prod', 'EMP-033', 'Active', '19 Feb 2025', 'Full-time', 'Staff', '', []],
  ['EMP-042', 'Hana Kimura', 'QA Lead', 'eng-qa', 'EMP-025', 'Active', '5 May 2020', 'Full-time', 'Manager', '', []],
  ['EMP-043', 'Diego Salazar', 'QA Engineer', 'eng-qa', 'EMP-042', 'Active', '14 Feb 2022', 'Full-time', 'Staff', '', []],
  ['EMP-044', 'Bea Fontaine', 'QA Engineer', 'eng-qa', 'EMP-042', 'Active', '30 Aug 2022', 'Full-time', 'Staff', '', []],
  ['EMP-045', 'Kofi Mensah', 'Automation Engineer', 'eng-qa', 'EMP-042', 'Active', '11 Apr 2023', 'Full-time', 'Staff', '', []],
  ['EMP-046', 'Elena Popa', 'QA Analyst', 'eng-qa', 'EMP-042', 'Active', '7 Oct 2024', 'Contract', 'Staff', '', []],
  // Design, continued
  ['EMP-047', 'Cassie Byrne', 'Product Designer', 'des-prod', 'EMP-023', 'Active', '21 Mar 2022', 'Full-time', 'Staff', '', []],
  ['EMP-048', 'Ravi Chandran', 'Product Designer', 'des-prod', 'EMP-023', 'Active', '6 Nov 2023', 'Full-time', 'Staff', '', []],
  ['EMP-049', 'Signe Dahl', 'Design Researcher', 'des-prod', 'EMP-023', 'On leave', '15 Aug 2022', 'Full-time', 'Staff', '', []],
  ['EMP-050', 'Fern Adebayo', 'Brand Lead', 'des-brand', 'EMP-022', 'Active', '4 Jan 2021', 'Full-time', 'Manager', '', []],
  ['EMP-051', 'Otto Kraus', 'Brand Designer', 'des-brand', 'EMP-050', 'Active', '13 Jun 2022', 'Full-time', 'Staff', '', []],
  ['EMP-052', 'Mei Lin', 'Motion Designer', 'des-brand', 'EMP-050', 'Active', '8 Jan 2024', 'Part-time', 'Staff', '', []],
  // Sales
  ['EMP-053', 'Tomas Ferreira', 'VP Sales', 'sales', 'EMP-001', 'Active', '3 Jun 2019', 'Full-time', 'Admin', '', []],
  ['EMP-054', 'Grace Lindqvist', 'Enterprise Sales Manager', 'sales-ent', 'EMP-053', 'Active', '10 Feb 2020', 'Full-time', 'Manager', '', []],
  ['EMP-055', 'Hugh Barrington', 'Enterprise Account Executive', 'sales-ent', 'EMP-054', 'Active', '6 Jul 2020', 'Full-time', 'Staff', '', []],
  ['EMP-056', 'Amara Diallo', 'Enterprise Account Executive', 'sales-ent', 'EMP-054', 'Active', '1 Mar 2022', 'Full-time', 'Staff', '', []],
  ['EMP-057', 'Jesper Holm', 'Account Executive', 'sales-ent', 'EMP-054', 'Active', '18 Sep 2023', 'Full-time', 'Staff', '', []],
  ['EMP-058', 'Camila Rojas', 'Solutions Consultant', 'sales-ent', 'EMP-054', 'Active', '12 Jun 2023', 'Full-time', 'Staff', '', []],
  ['EMP-059', 'Peter Vaughn', 'Sales Engineer', 'sales-ent', 'EMP-054', 'Active', '3 Feb 2025', 'Full-time', 'Staff', '', []],
  // Customer Success
  ['EMP-060', 'Jonah Weiss', 'Support Manager', 'cs-support', 'EMP-066', 'Active', '25 Oct 2021', 'Full-time', 'Manager', '', []],
  ['EMP-061', 'Alina Dumitru', 'Senior Support Specialist', 'cs-support', 'EMP-060', 'Active', '7 Feb 2022', 'Full-time', 'Staff', '', []],
  ['EMP-062', 'Kelvin Boateng', 'Support Specialist', 'cs-support', 'EMP-060', 'Active', '3 Jul 2023', 'Full-time', 'Staff', '', []],
  ['EMP-063', 'Yara Khalil', 'Support Specialist', 'cs-support', 'EMP-060', 'Active', '15 Jan 2024', 'Full-time', 'Staff', '', []],
  ['EMP-064', 'Sam Whitaker', 'Support Specialist', 'cs-support', 'EMP-060', 'Active', '9 Sep 2024', 'Contract', 'Staff', '', []],
  ['EMP-065', 'Ilse Vermeer', 'Technical Support Engineer', 'cs-support', 'EMP-060', 'Active', '4 Nov 2024', 'Full-time', 'Staff', '', []],
  ['EMP-066', 'Ngozi Adeyemi', 'Director, Customer Success', 'cs', 'EMP-001', 'Active', '13 Jan 2020', 'Full-time', 'Admin', '', []],
  ['EMP-067', 'Mira Halvorsen', 'Onboarding Manager', 'cs-onb', 'EMP-066', 'Active', '2 Aug 2021', 'Full-time', 'Manager', '', []],
  ['EMP-068', 'Rafael Costa', 'Customer Success Manager', 'cs-onb', 'EMP-067', 'Active', '16 May 2022', 'Full-time', 'Staff', '', []],
  ['EMP-069', 'Devika Nair', 'Customer Success Manager', 'cs-onb', 'EMP-067', 'Active', '20 Feb 2023', 'Full-time', 'Staff', '', []],
  ['EMP-070', 'Anton Melnyk', 'Implementation Specialist', 'cs-onb', 'EMP-067', 'Active', '11 Dec 2023', 'Full-time', 'Staff', '', []],
  ['EMP-071', 'Beth Cordell', 'Onboarding Specialist', 'cs-onb', 'EMP-067', 'Active', '8 Jul 2024', 'Part-time', 'Staff', '', []],
  // Sales, SMB
  ['EMP-072', 'Owen Pryce', 'SMB Sales Manager', 'sales-smb', 'EMP-053', 'Active', '9 Mar 2021', 'Full-time', 'Manager', '', []],
  ['EMP-073', 'Lily Chen', 'Account Executive', 'sales-smb', 'EMP-072', 'Active', '17 Oct 2022', 'Full-time', 'Staff', '', []],
  ['EMP-074', 'Ade Salami', 'Account Executive', 'sales-smb', 'EMP-072', 'Active', '6 Mar 2023', 'Full-time', 'Staff', '', []],
  ['EMP-075', 'Zoe Kaplan', 'Sales Development Rep', 'sales-smb', 'EMP-072', 'Active', '19 Aug 2024', 'Full-time', 'Staff', '', []],
  ['EMP-076', 'Tariq Nasser', 'Sales Development Rep', 'sales-smb', 'EMP-072', 'Active', '3 Mar 2025', 'Full-time', 'Staff', '', []],
  ['EMP-077', 'Hedda Solheim', 'Sales Operations Analyst', 'sales-smb', 'EMP-072', 'Active', '14 Apr 2025', 'Full-time', 'Staff', '', []],
  // Operations, continued
  ['EMP-078', 'Tom Kean', 'Operations Manager', 'ops', 'EMP-002', 'Active', '27 Jan 2020', 'Full-time', 'Manager', 's-1', ['s-1', 's-7']],
  ['EMP-079', 'Boris Tan', 'Facilities Manager', 'ops-fac', 'EMP-002', 'Active', '6 Apr 2021', 'Full-time', 'Manager', 's-1', ['s-1']],
  ['EMP-080', 'Nora Espinoza', 'Workplace Coordinator', 'ops-fac', 'EMP-079', 'Active', '2 May 2022', 'Full-time', 'Staff', 's-1', []],
  ['EMP-081', 'Emeka Nwosu', 'Facilities Technician', 'ops-fac', 'EMP-079', 'Active', '18 Sep 2023', 'Full-time', 'Staff', 's-1', ['s-1']],
  ['EMP-082', 'Suvi Lahti', 'Workplace Coordinator', 'ops-fac', 'EMP-079', 'Active', '5 Feb 2024', 'Part-time', 'Staff', 's-3', []],
  ['EMP-083', 'Victor Almeida', 'Finance Manager', 'ops-fin', 'EMP-002', 'Active', '11 Mar 2019', 'Full-time', 'Manager', '', []],
  ['EMP-084', 'Hannah Sturgess', 'Accountant', 'ops-fin', 'EMP-083', 'Active', '4 Oct 2021', 'Full-time', 'Staff', '', []],
  ['EMP-085', 'Ruben Cole', 'Financial Analyst', 'ops-fin', 'EMP-083', 'Active', '8 Jan 2024', 'Full-time', 'Staff', '', []],
  // People, continued
  ['EMP-086', 'Sofia Bianchi', 'Technical Recruiter', 'people-rec', 'EMP-015', 'Active', '22 Mar 2022', 'Full-time', 'Staff', '', []],
  ['EMP-087', 'Dominic Frost', 'Recruiting Coordinator', 'people-rec', 'EMP-015', 'Active', '15 Jan 2024', 'Full-time', 'Staff', '', []],
  ['EMP-088', 'Elena Marsh', 'Senior Recruiter', 'people-rec', 'EMP-015', 'Active', '3 Jun 2024', 'Full-time', 'Staff', '', []],
  ['EMP-089', 'Ola Adeyinka', 'People Partner', 'people-ops', 'EMP-014', 'Active', '9 Aug 2022', 'Full-time', 'Staff', '', []],
]
const PHOTOS: Partial<Record<string, string>> = { 'EMP-017': avatar5, 'EMP-018': avatar2, 'EMP-022': avatar1, 'EMP-019': avatar4, 'EMP-041': avatar6, 'EMP-078': avatar7 }
// everyone else borrows from the same seven sample photos, so no list reads as a wall of initials
const SAMPLE_PHOTOS = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6, avatar7]
const ENDS: Partial<Record<string, string>> = { 'EMP-020': '31 Jul 2026' }
const BADGES: Partial<Record<string, string>> = { 'EMP-003': 'NFC-3A91', 'EMP-011': 'NFC-3B04', 'EMP-012': 'NFC-3B22', 'EMP-004': 'NFC-2C17' }
const EMERGENCY: Partial<Record<string, Person['emergency']>> = {
  'EMP-002': { name: 'Mateo Reyes', relationship: 'Spouse', phone: '+960 771 4402' },
  'EMP-003': { name: 'Anneke Bakker', relationship: 'Sister', phone: '+31 6 2233 8891' },
  'EMP-005': { name: 'Joost de Vos', relationship: 'Spouse', phone: '+960 772 1180' },
  'EMP-010': { name: 'Rina Watanabe', relationship: 'Spouse', phone: '+960 773 9021' },
  'EMP-011': { name: 'Arun Nair', relationship: 'Father', phone: '+91 98 4410 2277' },
  'EMP-014': { name: 'Lars Sorensen', relationship: 'Spouse', phone: '+960 774 5510' },
}
// away spells sit relative to today so the sample always reads as live: [days from, days to, reason]
const today = new Date()
const rel = (d: number) => fmtDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + d))
const AWAY: Partial<Record<string, [number, number, string]>> = {
  'EMP-027': [-4, 6, 'Annual leave'],
  'EMP-036': [9, 13, 'Conference'],
  'EMP-044': [-2, 3, 'Sick leave'],
  'EMP-049': [-12, 76, 'Parental leave'],
  'EMP-057': [-1, 2, 'Annual leave'],
  'EMP-063': [0, 0, 'Annual leave'],
  'EMP-084': [-3, 4, 'Annual leave'],
  'EMP-007': [-6, 16, 'Annual leave'],
}

const EXTERNAL: Person[] = [
  // a client's people appear in meetings but never in the org tree
  { id: 'EXT-001', name: 'Sofia Duarte', title: 'Operations Director, Acme', unitId: null, managerId: null, status: 'Active', start: '', end: '', contract: 'Contract', role: 'Staff', primarySite: null, access: [], phone: '+351 21 340 2210', email: 'sofia.duarte@acme.example', chat: '@sofia.duarte', photo: avatar3, perms: { Inventory: 'None', Calendar: 'None', Directory: 'None', Scan: 'None' }, external: true },
]

export const PEOPLE: Person[] = P.map(([id, name, title, unitId, managerId, status, start, contract, role, primary, access], i): Person => {
  const n = 300 + i
  // Admins administer setup without operating a site, so they keep the full template;
  // site-less Staff and Managers get read-only stock apps instead
  const perms = primary || role === 'Admin' ? { ...ROLE_TEMPLATE[role] } : { ...ROLE_TEMPLATE[role], Inventory: 'Viewer', Scan: 'None' }
  const away = AWAY[id]
  return {
    id, name, title, unitId, managerId: managerId || null, status, start, end: ENDS[id] ?? '', contract,
    role: deriveRole(perms), primarySite: primary || null, access,
    phone: `+960 ${n} 1${n}`, email: slugMail(name), chat: chatHandle(name),
    photo: PHOTOS[id] ?? SAMPLE_PHOTOS[i % SAMPLE_PHOTOS.length], perms, badge: BADGES[id], emergency: EMERGENCY[id],
    away: away ? { from: rel(away[0]), to: rel(away[1]), type: away[2] } : undefined,
  }
}).concat(EXTERNAL)

// ---- site types and sites
export const SITE_TYPES: SiteType[] = [
  { id: 't-1', name: 'Main warehouse', mode: 'Storage', desc: 'Full racked facility. Counted in every stock take and used as a replenishment source.', issue: true, bins: true, negative: false, cadence: 'Monthly' },
  { id: 't-2', name: 'Transit hub', mode: 'Transit', desc: 'Goods pass through in under 48 hours. Nothing is held long term.', issue: true, bins: false, negative: false, cadence: 'None' },
  { id: 't-3', name: 'Retail counter', mode: 'Storage', desc: 'Front-of-house stock issued against walk-in requests.', issue: true, bins: true, negative: true, cadence: 'Weekly' },
  { id: 't-4', name: 'Project site', mode: 'None', desc: 'Consumption point. Stock is booked out on arrival, never held.', issue: false, bins: false, negative: false, cadence: 'None' },
  { id: 't-5', name: 'Repair bay', mode: 'Transit', desc: 'Holds items awaiting service. Not counted as sellable stock.', issue: false, bins: true, negative: false, cadence: 'Quarterly' },
]
export const SITES: Site[] = [
  { id: 's-1', name: 'Malé central', code: 'MLE-01', typeId: 't-1', parent: null, country: 'Maldives', region: 'Kaafu', place: 'Malé', addr: 'Boduthakurufaanu Magu 220', ownerId: 'EMP-003', status: 'Active', opened: 'Mar 2021', bins: 48, aisles: 12, per: 4, lines: 1284, value: 'MVR 6.4m', counted: '2 Sep 2026', util: 74, cadence: null },
  { id: 's-2', name: 'Hulhumalé depot', code: 'HLM-02', typeId: 't-2', parent: 's-1', country: 'Maldives', region: 'Kaafu', place: 'Hulhumalé', addr: 'Nirolhu Magu, Unit C', ownerId: 'EMP-004', status: 'Active', opened: 'Jan 2023', bins: 0, aisles: 0, per: 0, lines: 96, value: 'MVR 590k', counted: '—', util: 22, cadence: null },
  { id: 's-3', name: 'Hithadhoo overflow', code: 'HTD-01', typeId: 't-1', parent: null, country: 'Maldives', region: 'Addu City', place: 'Hithadhoo', addr: 'Link Road 88', ownerId: 'EMP-005', status: 'Active', opened: 'Sep 2022', bins: 32, aisles: 8, per: 4, lines: 640, value: 'MVR 2.7m', counted: '18 Aug 2026', util: 91, cadence: null },
  { id: 's-4', name: 'Kulhudhuffushi counter', code: 'KLH-04', typeId: 't-3', parent: null, country: 'Maldives', region: 'Haa Dhaalu', place: 'Kulhudhuffushi', addr: 'Bandaara Magu 12', ownerId: 'EMP-006', status: 'Active', opened: 'Jun 2024', bins: 12, aisles: 3, per: 4, lines: 210, value: 'MVR 400k', counted: '29 Aug 2026', util: 58, cadence: null },
  { id: 's-5', name: 'Eydhafushi counter', code: 'EYD-05', typeId: 't-3', parent: null, country: 'Maldives', region: 'Baa', place: 'Eydhafushi', addr: 'Hiya Magu 41', ownerId: 'EMP-007', status: 'Paused', opened: 'Feb 2025', bins: 8, aisles: 2, per: 4, lines: 74, value: 'MVR 140k', counted: '11 Jul 2026', util: 34, cadence: null },
  { id: 's-6', name: 'Fonadhoo build', code: 'FND-11', typeId: 't-4', parent: null, country: 'Maldives', region: 'Laamu', place: 'Fonadhoo', addr: 'Main Road 3', ownerId: 'EMP-008', status: 'Active', opened: 'Apr 2026', bins: 0, aisles: 0, per: 0, lines: 0, value: '—', counted: '—', util: 0, cadence: null },
  { id: 's-7', name: 'Villimalé workshop', code: 'VLM-01', typeId: 't-5', parent: null, country: 'Maldives', region: 'Kaafu', place: 'Villimalé', addr: 'Industrial Zone 5', ownerId: 'EMP-009', status: 'Active', opened: 'Nov 2023', bins: 16, aisles: 4, per: 4, lines: 143, value: 'MVR 940k', counted: '5 Aug 2026', util: 46, cadence: null },
  { id: 's-8', name: 'Colombo hub', code: 'CMB-01', typeId: 't-2', parent: null, country: 'Sri Lanka', region: 'Colombo operations', place: 'Colombo', addr: 'Galle Road 145', ownerId: 'EMP-010', status: 'Active', opened: 'Feb 2026', bins: 0, aisles: 0, per: 0, lines: 318, value: 'LKR 18.2m', counted: '—', util: 63, cadence: null },
]
/** Where goods arrive unless a receipt says otherwise. */
export const DEFAULT_SITE = 's-1'

// ---- geography: Hexa ships the country list; surveyed countries bring their regions with them
export const COUNTRIES: Country[] = [
  { id: 'r-mv', name: 'Maldives', code: 'MV', tz: 'Indian/Maldives', cur: 'MVR', seeded: true, on: true },
  { id: 'r-lk', name: 'Sri Lanka', code: 'LK', tz: 'Asia/Colombo', cur: 'LKR', seeded: false, on: true },
  { id: 'r-ae', name: 'United Arab Emirates', code: 'AE', tz: 'Asia/Dubai', cur: 'AED', seeded: false, on: false },
  { id: 'r-in', name: 'India', code: 'IN', tz: 'Asia/Kolkata', cur: 'INR', seeded: false, on: false },
  { id: 'r-sg', name: 'Singapore', code: 'SG', tz: 'Asia/Singapore', cur: 'SGD', seeded: false, on: false },
  { id: 'r-my', name: 'Malaysia', code: 'MY', tz: 'Asia/Kuala_Lumpur', cur: 'MYR', seeded: false, on: false },
  { id: 'r-gb', name: 'United Kingdom', code: 'GB', tz: 'Europe/London', cur: 'GBP', seeded: false, on: false },
  { id: 'r-au', name: 'Australia', code: 'AU', tz: 'Australia/Sydney', cur: 'AUD', seeded: false, on: false },
]
export const REGIONS: Region[] = [
  { id: 'g-ha', country: 'Maldives', name: 'Haa Alif', origin: 'system', places: ['Dhidhdhoo', 'Ihavandhoo', 'Filladhoo'] },
  { id: 'g-hdh', country: 'Maldives', name: 'Haa Dhaalu', origin: 'system', places: ['Kulhudhuffushi', 'Hanimaadhoo', 'Nolhivaram'] },
  { id: 'g-k', country: 'Maldives', name: 'Kaafu', origin: 'system', places: ['Malé', 'Hulhumalé', 'Villimalé', 'Maafushi', 'Thulusdhoo'] },
  { id: 'g-b', country: 'Maldives', name: 'Baa', origin: 'system', places: ['Eydhafushi', 'Thulhaadhoo', 'Dharavandhoo'] },
  { id: 'g-l', country: 'Maldives', name: 'Laamu', origin: 'system', places: ['Fonadhoo', 'Gan', 'Maabaidhoo'] },
  { id: 'g-ga', country: 'Maldives', name: 'Gaafu Alif', origin: 'system', places: ['Villingili', 'Dhaandhoo', 'Kolamaafushi'] },
  { id: 'g-s', country: 'Maldives', name: 'Addu City', origin: 'system', places: ['Hithadhoo', 'Feydhoo', 'Maradhoo', 'Gan'] },
  { id: 'g-cmb', country: 'Sri Lanka', name: 'Colombo operations', origin: 'custom', places: ['Colombo', 'Negombo'] },
]

// ---- public holidays (Maldives)
const H: [string, string, string, boolean?][] = [
  ['2026-01-01', 'New Year\'s Day', 'އާ އަހަރު ދުވަސް'],
  ['2026-02-18', 'First day of Ramadan', 'ރަމަޟާން މަހުގެ ފުރަތަމަ ދުވަސް'],
  ['2026-03-20', 'Eid al-Fitr', 'ފިތުރު ޢީދު'],
  ['2026-03-21', 'Eid al-Fitr holiday', 'ފިތުރު ޢީދުގެ ބަންދު'],
  ['2026-03-22', 'Eid al-Fitr holiday', 'ފިތުރު ޢީދުގެ ބަންދު'],
  ['2026-05-26', 'Hajj Day', 'ޙައްޖު ދުވަސް'],
  ['2026-05-27', 'Eid al-Adha', 'ޙައްޖު ޢީދު'],
  ['2026-05-28', 'Eid al-Adha holiday', 'ޙައްޖު ޢީދުގެ ބަންދު'],
  ['2026-05-29', 'Eid al-Adha holiday', 'ޙައްޖު ޢީދުގެ ބަންދު'],
  ['2026-06-16', 'Islamic New Year', 'ހިޖުރީ އާ އަހަރު'],
  ['2026-07-26', 'Independence Day', 'މިނިވަން ދުވަސް'],
  ['2026-08-14', 'National Day', 'ޤައުމީ ދުވަސް'],
  ['2026-08-25', 'Mawlid al-Nabi', 'މައުލޫދު'],
  ['2026-09-12', 'The day Maldives embraced Islam', 'ދިވެހިން އިސްލާމްދީން ޤަބޫލުކުރި ދުވަސް'],
  ['2026-11-03', 'Victory Day', 'ނަޞްރު ދުވަސް'],
  ['2026-11-11', 'Republic Day', 'ޖުމްހޫރީ ދުވަސް'],
  ['2027-01-01', 'New Year\'s Day', 'އާ އަހަރު ދުވަސް'],
  ['2027-02-08', 'First day of Ramadan', 'ރަމަޟާން މަހުގެ ފުރަތަމަ ދުވަސް', true],
  ['2027-03-10', 'Eid al-Fitr', 'ފިތުރު ޢީދު', true],
]
const EVERYONE: Holiday['appliesTo'] = { units: [], sites: [] }
export const HOLIDAYS: Holiday[] = [
  ...H.map(([date, name, nameDv]): Holiday => ({ id: `h-${date}`, name, nameDv, date, halfDay: false, origin: 'system', on: true, appliesTo: EVERYONE })),
  // what an Admin added on top of the national list
  { id: 'h-addu-day', name: 'Addu City Day', nameDv: 'އައްޑޫ ސިޓީ ދުވަސް', date: '2026-10-08', halfDay: false, origin: 'custom', on: true, appliesTo: { units: [], sites: ['s-3'] } },
  { id: 'h-stocktake', name: 'Malé stock-take shutdown', nameDv: 'މާލޭ ސްޓޮކް ގުނުމުގެ ބަންދު', date: '2026-10-22', halfDay: false, origin: 'custom', on: true, appliesTo: { units: ['ops-wh'], sites: ['s-1'] } },
  { id: 'h-yearend', name: 'Year-end close, afternoon off', nameDv: 'އަހަރު ނިމުމުގެ ބަންދު', date: '2026-12-31', halfDay: true, origin: 'custom', on: true, appliesTo: EVERYONE },
]

// ---- numbering and the activity log
export const NUMBERING: NumberingRule[] = [
  { id: 'k-1', app: 'Control Centre', label: 'Site code', pattern: 'AAA-##', next: 'MLE-09', note: 'Three letters from the island, then a sequence.' },
  { id: 'k-2', app: 'Control Centre', label: 'Employee ID', pattern: 'EMP-###', next: 'EMP-090', note: 'Never reused, even after someone exits.' },
  { id: 'k-3', app: 'Inventory', label: 'Goods receipt', pattern: 'GRN-YYYY-####', next: 'GRN-2026-0148', note: 'Resets each year.' },
  { id: 'k-4', app: 'Inventory', label: 'Stock issue', pattern: 'ISS-YYYY-####', next: 'ISS-2026-0912', note: 'Resets each year.' },
  { id: 'k-5', app: 'Inventory', label: 'Count sheet', pattern: 'CNT-####', next: 'CNT-0043', note: 'Continuous.' },
  { id: 'k-6', app: 'Calendar', label: 'Shift roster', pattern: 'ROS-YYYY-WW', next: 'ROS-2026-38', note: 'One per site, per week.' },
  { id: 'k-7', app: 'Scan', label: 'Handheld session', pattern: 'SCN-######', next: 'SCN-004182', note: 'Continuous. Ties every scan to a device and a person.' },
]
export const APPROVAL_CHAINS: ApprovalChain[] = [
  { id: 'c-1', name: 'Operations sign-off', threshold: 'MVR 30,000', steps: ['Site manager', 'EMP-002'], used: ['Inventory · stock write-offs', 'Inventory · count variances'] },
  { id: 'c-2', name: 'Capital spend', threshold: 'MVR 400,000', steps: ['Unit lead', 'EMP-002', 'EMP-001'], used: ['Inventory · purchase over budget'] },
  { id: 'c-3', name: 'People changes', threshold: 'Any', steps: ['EMP-014', 'EMP-015'], used: ['Control Centre · role and site access changes'], standIn: 'EMP-089', standInUntil: '2026-09-30' },
  { id: 'c-4', name: 'New site approval', threshold: 'Any', steps: ['EMP-002'], used: [] },
]
export const NOTIFICATION_RULES: NotificationRule[] = [
  { id: 'n-1', sourceApp: 'Inventory', event: 'Stock falls below minimum', recipients: 'Site manager, Procurement', inApp: true, email: true },
  { id: 'n-2', sourceApp: 'Inventory', event: 'Cycle count due', recipients: 'Site manager', inApp: true, email: false },
  { id: 'n-3', sourceApp: 'Inventory', event: 'Count variance over threshold', recipients: 'Director of Operations', inApp: true, email: true },
  { id: 'n-4', sourceApp: 'Control Centre', event: 'Site paused or reopened', recipients: 'All Admins', inApp: true, email: true },
  { id: 'n-5', sourceApp: 'Control Centre', event: 'Employee added or exited', recipients: 'People Operations', inApp: false, email: true },
  { id: 'n-6', sourceApp: 'Inventory', event: 'Bin utilisation over 90%', recipients: 'Site manager', inApp: true, email: false },
  { id: 'n-7', sourceApp: 'Control Centre', event: 'Approval waiting more than 2 days', recipients: 'Requester, next approver', inApp: true, email: true },
  { id: 'n-8', sourceApp: 'Calendar', event: 'Shift published or changed', recipients: 'Everyone on the shift', inApp: true, email: false },
  { id: 'n-9', sourceApp: 'Calendar', event: 'Public holiday added', recipients: 'Site managers', inApp: true, email: true },
  { id: 'n-10', sourceApp: 'Scan', event: 'Handheld offline for over an hour', recipients: 'Site manager', inApp: false, email: false },
]
export const AUDIT: AuditEntry[] = [
  { id: 'a-1', scope: 'Sites', app: 'Control Centre', sev: 'normal', days: 1, text: 'Eydhafushi counter paused', who: 'Claudia Reyes', when: 'Yesterday, 16:40' },
  { id: 'a-2', scope: 'Employees', app: 'Control Centre', sev: 'normal', days: 6, text: 'Bram Jansen added to Warehouse', who: 'Nadia Sorensen', when: '3 Sep, 09:12' },
  { id: 'a-3', scope: 'Stock', app: 'Inventory', sev: 'high', days: 7, text: 'Write-off of MVR 84,000 approved at MLE-01', who: 'Claudia Reyes', when: '2 Sep, 15:48' },
  { id: 'a-4', scope: 'Site types', app: 'Control Centre', sev: 'high', days: 8, text: 'Retail counter now allows negative stock', who: 'Mariyam Ahmed', when: '1 Sep, 11:05' },
  { id: 'a-5', scope: 'Stock', app: 'Scan', sev: 'normal', days: 9, text: '142 bins scanned at HTD-01', who: 'Lieke de Vos', when: '31 Aug, 08:20' },
  { id: 'a-6', scope: 'Admin units', app: 'Control Centre', sev: 'normal', days: 12, text: 'Service department created under Operations', who: 'Claudia Reyes', when: '28 Aug, 14:22' },
  { id: 'a-7', scope: 'Schedule', app: 'Calendar', sev: 'normal', days: 15, text: 'Malé stock-take shutdown added to 14 Aug', who: 'Mariyam Ahmed', when: '25 Aug, 09:30' },
  { id: 'a-8', scope: 'Employees', app: 'Control Centre', sev: 'high', days: 40, text: 'Hugo Fernández marked as exited', who: 'Nadia Sorensen', when: '31 Jul, 17:30' },
]
