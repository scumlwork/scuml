// Official EFCC/SCUML "Administrative Sanctions for DNFBPs" schedule —
// each offence carries a separate fine depending on whether the sanctioned
// entity is a Profession or a Business. `amount` is the numeric fine only
// (0 for a non-monetary sanction like a bare warning letter); `label` is
// the full text shown to the user, including any non-monetary conditions.

export type ViolationFineOption = {
  amount: number;
  label: string;
};

export type ViolationEntry = {
  sn: number;
  offence: string;
  professions: ViolationFineOption;
  businesses: ViolationFineOption;
};

export const VIOLATIONS_LIST: ViolationEntry[] = [
  {
    sn: 1,
    offence: 'Acceptance or receipt of cash payments above the stipulated thresholds in section 2 of ML(PP)A 2022.',
    professions: { amount: 4000000, label: 'A fine of N4,000,000' },
    businesses: { amount: 2000000, label: 'A fine of N2,000,000' },
  },
  {
    sn: 2,
    offence: 'Failure to obtain valid official identification documents before commencement of business transaction.',
    professions: { amount: 2000000, label: 'A fine of N2,000,000' },
    businesses: { amount: 1000000, label: 'A fine of N1,000,000' },
  },
  {
    sn: 3,
    offence: 'Failure to make declaration of business activities to SCUML.',
    professions: { amount: 200000, label: 'A fine of N200,000' },
    businesses: { amount: 100000, label: 'A fine of N100,000' },
  },
  {
    sn: 4,
    offence: 'Failure to report cash transactions in excess of $1,000 or its equivalent in other currencies.',
    professions: { amount: 50000, label: 'A fine of N50,000 for each unreported transaction.' },
    businesses: { amount: 50000, label: 'A fine of N50,000 for each unreported transaction.' },
  },
  {
    sn: 5,
    offence: 'Failure to put in place policy, procedures and control to detect and report suspicious transaction.',
    professions: { amount: 2000000, label: 'A fine of N2,000,000' },
    businesses: { amount: 1000000, label: 'A fine of N1,000,000' },
  },
  {
    sn: 6,
    offence: 'Failure to file Suspicious Transaction Report.',
    professions: { amount: 2000000, label: 'A fine of N2,000,000' },
    businesses: { amount: 1000000, label: 'A fine of N1,000,000' },
  },
  {
    sn: 7,
    offence: 'Failure to report any transactions, lodgment or transfer of funds in excess of N5million or its equivalent in the case of an individual or N10,000,000 or its equivalent in the case of body corporate, within seven(7) days of completion.',
    professions: { amount: 100000, label: 'A fine of N100,000 for each unreported transaction.' },
    businesses: { amount: 100000, label: 'A fine of N100,000 for each unreported transaction.' },
  },
  {
    sn: 8,
    offence: 'Failure to Screen their customers and customer transactions in line with United Nations Consolidated List and Nigeria Sanctions List to ensure that proscribed individuals and entities do not have control and access to DNFBPs whether directly or indirectly.',
    professions: { amount: 1000000, label: 'A fine of N1,000,000' },
    businesses: { amount: 500000, label: 'A fine of N500,000' },
  },
  {
    sn: 9,
    offence: 'Failure to register for the Nigeria Sanction Committee Alert System.',
    professions: { amount: 500000, label: 'A fine of N500,000' },
    businesses: { amount: 300000, label: 'A fine of N300,000' },
  },
  {
    sn: 10,
    offence: 'Operating a Designated Non-Financial Business and Profession without a requisite business or profession license.',
    professions: { amount: 2000000, label: 'A fine of N2,000,000' },
    businesses: { amount: 2000000, label: 'A fine of N2,000,000' },
  },
  {
    sn: 11,
    offence: 'Maintenance of records in a manner that permits reconstruction of individual transaction.',
    professions: { amount: 300000, label: 'N300,000 and a warning letter.' },
    businesses: { amount: 200000, label: 'N200,000 and a warning letter.' },
  },
  {
    sn: 12,
    offence: "Failure to ensure that every employee is trained on the DNFBP's written AML/CFT/CPF policies and procedure with evidence of assigned undertaken of understanding.",
    professions: { amount: 200000, label: 'A fine of N200,000 with evidence of a revised AML, CFT and CPF policies and procedures.' },
    businesses: { amount: 100000, label: 'A fine of N100,000 with evidence of a revised AML, CFT and CPF policies and procedures.' },
  },
  {
    sn: 13,
    offence: 'Failure to appoint a compliance officer at management level with clearly defined roles and responsibilities.',
    professions: { amount: 150000, label: 'A fine of N150,000 with evidence of a appointment of compliance officer at management level.' },
    businesses: { amount: 150000, label: 'A fine of N150,000 with evidence of a appointment of compliance officer at management level.' },
  },
  {
    sn: 14,
    offence: 'Failure to implement an approved annual AML, CFT and CPF training for all categories of employees.',
    professions: { amount: 300000, label: 'N300,000' },
    businesses: { amount: 150000, label: 'N150,000' },
  },
  {
    sn: 15,
    offence: 'Failure to classify customers into Risk Categories and apply Customer Due Diligence accordingly.',
    professions: { amount: 0, label: 'Warning letter' },
    businesses: { amount: 0, label: 'Warning letter' },
  },
  {
    sn: 16,
    offence: 'Failure to classify ML, TF and PF risks. Failure to put in place guidelines for risk assessment and profiling of customers. Failure to carry out risk assessment and profiling of each customer.',
    professions: { amount: 250000, label: 'N250,000' },
    businesses: { amount: 250000, label: 'N250,000' },
  },
  {
    sn: 17,
    offence: 'Failure to obtain information on beneficial owners in transactions where the customer is an intermediary or representative of another party in all circumstances or form such representation may take.',
    professions: { amount: 500000, label: 'N500,000' },
    businesses: { amount: 250000, label: 'N250,000' },
  },
  {
    sn: 18,
    offence: 'Failure to prepare and maintain records of observed deficiencies in the AML, CFT and CPF policies and procedures of the DNFBPs and records of remedial actions.',
    professions: { amount: 100000, label: 'N100,000 and a warning letter.' },
    businesses: { amount: 50000, label: 'N50,000 and a warning letter.' },
  },
  {
    sn: 19,
    offence: 'Override of AML/CFT/CPF controls by the management or compliance officer.',
    professions: { amount: 500000, label: 'N500,000' },
    businesses: { amount: 250000, label: 'N250,000' },
  },
  {
    sn: 20,
    offence: 'Failure put in place mechanisms to monitor transactions linked to PEPs.',
    professions: { amount: 500000, label: 'N500,000' },
    businesses: { amount: 300000, label: 'N300,000' },
  },
  {
    sn: 21,
    offence: 'Failure of the internal audit department to competently conduct oversight of the compliance function.',
    professions: { amount: 250000, label: 'N250,000' },
    businesses: { amount: 150000, label: 'N150,000' },
  },
  {
    sn: 22,
    offence: 'Failure of the Internal audit to periodically review and conduct independent testing of compliance policies and procedures and follow up on the finding.',
    professions: { amount: 150000, label: 'N150,000' },
    businesses: { amount: 100000, label: 'N100,000' },
  },
  {
    sn: 23,
    offence: 'Failure to review and update AML/CFT/CPF Policies and Procedures after three (3) years.',
    professions: { amount: 200000, label: 'A fine of N200,000 with evidence of a revised AML, CFT and CPF policies and procedures.' },
    businesses: { amount: 100000, label: 'A fine of N100,000 with evidence of a revised AML, CFT and CPF policies and procedures.' },
  },
];
