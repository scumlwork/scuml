// The On-Site Inspection form's fixed checklists, taken from the Exam
// Report template (AML/CFT + Terrorism Prevention and Prohibition Act
// requirements, and the standard documents-requested list). Single source
// of truth — the add/edit form and every display surface read from here
// instead of repeating this text in four places.

export const DOCUMENTS_REQUESTED_LIST = [
  'General Ledgers (daily ledger)',
  'Daily journals and registers (cash & cheques)',
  'Bank Statements',
  'AML/CFT policy manuals',
  'Customer records',
  'Training manuals',
];

// The main AML/CFT Requirements table in "OBSERVATIONS".
export const AML_CFT_REQUIREMENTS = [
  'Section 1: Understanding of ML/TF/PF risk and Categorization',
  'Section 2: Limitation to make or accept cash payment',
  'Section 3: Duty to report International transfer of funds and securities.',
  'Section 4: Identification of customers.',
  'Section 4(c): Identification of beneficial Ownership Regulation & section 34(1&2) of EFCC Regulation, 2022',
  'Section 4(1)7: PEP Identification and Due Diligence',
  'Section 6a: Declaration of activities to SCUML',
  'Section 6b: Occasional cash transactions by DNFBPs',
  'Section 7: Suspicious transaction reporting',
  'Section 8: Reservation of record',
  'Section 10: Internal procedures, policies and controls.',
  'Section 10(a): Designation of Compliance Officer at management level',
  'Section 10(b): Regular training programs for employees',
  'Section 10(d): Establishment of internal audit unit',
  'Section 11: Mandatory disclosure DNFBPs',
];

// The second, Terrorism Prevention and Prohibition Act, 2022 table —
// continues the same OBSERVATIONS columns under its own sub-heading.
export const TPPA_REQUIREMENTS = [
  'Section 54(1): Freezing order in respect of designated persons or entities.',
  'Part VII TPPA, 2022: Implementation of Targeted Financial Sanction related to Terrorism and Terrorism Financing and Proliferation Financing',
  'Section 83 TPPA, 2022: Obligation to develop FT programs and strategies',
  'Section 84 TPPA, 2022: Obligation to report TF related to STR',
];

export type ObservationRow = { requirement: string; observation: string; recommendation: string };
export type DocumentRequestRow = { document: string; provided: string };

export function blankObservations(list: string[]): ObservationRow[] {
  return list.map((requirement) => ({ requirement, observation: '', recommendation: '' }));
}

export function blankDocumentsRequested(): DocumentRequestRow[] {
  return DOCUMENTS_REQUESTED_LIST.map((document) => ({ document, provided: '' }));
}
