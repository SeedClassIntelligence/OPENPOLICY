/**
 * Document Intelligence & Source Provenance Engine
 * Extracts, normalizes, and maintains strict evidence audit links
 */

import { Policy, CoverageItem, SourceEvidence, Vehicle, Driver } from '../types/insurance';

export interface SampleDocument {
  id: string;
  name: string;
  carrier: string;
  jurisdiction: string;
  documentType: string;
  fileSize: string;
  uploadDate: string;
  rawTextExcerpt: string;
  policyData: Partial<Policy>;
}

export const SAMPLE_DECLARATIONS_PAGES: SampleDocument[] = [
  {
    id: 'DOC-NV-49281',
    name: 'GEICO_Auto_Dec_Page_NV49281.pdf',
    carrier: 'GEICO Advantage Insurance Co.',
    jurisdiction: 'NV',
    documentType: 'DECLARATIONS_PAGE',
    fileSize: '418 KB',
    uploadDate: '2026-09-18',
    rawTextExcerpt: `POLICY NUMBER: 4928-1029-41-01
INSURED: JANE DOE, 742 EVERGREEN TERRACE, HENDERSON NV 89014
VEHICLE 01: 2024 TOYOTA CAMRY XLE VIN: 4T1B11HK5RU109281
COVERAGES & LIMITS:
BODILY INJURY: $100,000 EACH PERSON / $300,000 EACH ACCIDENT
PROPERTY DAMAGE LIABILITY: $100,000 EACH ACCIDENT
UNINSURED/UNDERINSURED MOTORISTS: $100,000 / $300,000
COMPREHENSIVE DEDUCTIBLE: $250
COLLISION DEDUCTIBLE: $500
RENTAL REIMBURSEMENT: $45/DAY ($1,350 MAX) - INCLUDED
ROADSIDE ASSISTANCE: EMERGENCY ROAD SERVICE - INCLUDED
ANNUAL TOTAL PREMIUM: $2,964.00 ($247.00 / MONTH)
EFFECTIVE: NOV 18, 2025 TO NOV 18, 2026`,
    policyData: {
      policyNumber: '4928-1029-41-01',
      carrier: 'GEICO Advantage Insurance Co.',
      jurisdiction: 'NV',
      namedInsured: 'Jane Doe',
      effectiveDate: '2025-11-18',
      expirationDate: '2026-11-18',
      termMonths: 12,
      annualPremium: 2964,
      monthlyPremium: 247,
      vehicles: [
        {
          vin: '4T1B11HK5RU109281',
          year: 2024,
          make: 'Toyota',
          model: 'Camry',
          trim: 'XLE',
          usage: 'COMMUTE',
          annualMileage: 12000,
          garagingZip: '89014',
          ownership: 'FINANCED'
        }
      ],
      drivers: [
        {
          id: 'DRV-1',
          name: 'Jane Doe',
          isPrimary: true,
          licenseState: 'NV',
          licenseNumberMasked: 'NV•••••8912',
          age: 38
        }
      ],
      coverages: [
        {
          id: 'COV-1',
          code: 'BODILY_INJURY',
          name: 'Bodily Injury Liability',
          category: 'LIABILITY',
          perPersonLimit: 100000,
          perAccidentLimit: 300000,
          isIncluded: true,
          evidence: {
            documentId: 'DOC-NV-49281',
            documentName: 'GEICO_Auto_Dec_Page_NV49281.pdf',
            pageNumber: 1,
            extractedSnippet: 'BODILY INJURY: $100,000 EACH PERSON / $300,000 EACH ACCIDENT',
            confidence: 0.99,
            verifiedByConsumer: false
          }
        },
        {
          id: 'COV-2',
          code: 'PROPERTY_DAMAGE',
          name: 'Property Damage Liability',
          category: 'LIABILITY',
          propertyLimit: 100000,
          isIncluded: true,
          evidence: {
            documentId: 'DOC-NV-49281',
            documentName: 'GEICO_Auto_Dec_Page_NV49281.pdf',
            pageNumber: 1,
            extractedSnippet: 'PROPERTY DAMAGE LIABILITY: $100,000 EACH ACCIDENT',
            confidence: 0.98,
            verifiedByConsumer: false
          }
        },
        {
          id: 'COV-3',
          code: 'UM_UIM',
          name: 'Uninsured/Underinsured Motorist',
          category: 'LIABILITY',
          perPersonLimit: 100000,
          perAccidentLimit: 300000,
          isIncluded: true,
          evidence: {
            documentId: 'DOC-NV-49281',
            documentName: 'GEICO_Auto_Dec_Page_NV49281.pdf',
            pageNumber: 1,
            extractedSnippet: 'UNINSURED/UNDERINSURED MOTORISTS: $100,000 / $300,000',
            confidence: 0.96,
            verifiedByConsumer: false
          }
        },
        {
          id: 'COV-4',
          code: 'COLLISION',
          name: 'Collision Coverage',
          category: 'PHYSICAL_DAMAGE',
          deductible: 500,
          isIncluded: true,
          evidence: {
            documentId: 'DOC-NV-49281',
            documentName: 'GEICO_Auto_Dec_Page_NV49281.pdf',
            pageNumber: 1,
            extractedSnippet: 'COLLISION DEDUCTIBLE: $500',
            confidence: 0.99,
            verifiedByConsumer: false
          }
        },
        {
          id: 'COV-5',
          code: 'COMPREHENSIVE',
          name: 'Comprehensive Coverage',
          category: 'PHYSICAL_DAMAGE',
          deductible: 250,
          isIncluded: true,
          evidence: {
            documentId: 'DOC-NV-49281',
            documentName: 'GEICO_Auto_Dec_Page_NV49281.pdf',
            pageNumber: 1,
            extractedSnippet: 'COMPREHENSIVE DEDUCTIBLE: $250',
            confidence: 0.99,
            verifiedByConsumer: false
          }
        },
        {
          id: 'COV-6',
          code: 'RENTAL_REIMBURSEMENT',
          name: 'Rental Reimbursement',
          category: 'ADDITIONAL',
          isIncluded: true,
          notes: '$45/day ($1,350 maximum)',
          evidence: {
            documentId: 'DOC-NV-49281',
            documentName: 'GEICO_Auto_Dec_Page_NV49281.pdf',
            pageNumber: 2,
            extractedSnippet: 'RENTAL REIMBURSEMENT: $45/DAY ($1,350 MAX) - INCLUDED',
            confidence: 0.94,
            verifiedByConsumer: false
          }
        },
        {
          id: 'COV-7',
          code: 'ROADSIDE_ASSISTANCE',
          name: 'Roadside Assistance / Towing',
          category: 'ADDITIONAL',
          isIncluded: true,
          notes: 'Emergency road service 24/7',
          evidence: {
            documentId: 'DOC-NV-49281',
            documentName: 'GEICO_Auto_Dec_Page_NV49281.pdf',
            pageNumber: 2,
            extractedSnippet: 'ROADSIDE ASSISTANCE: EMERGENCY ROAD SERVICE - INCLUDED',
            confidence: 0.95,
            verifiedByConsumer: false
          }
        }
      ]
    }
  },
  {
    id: 'DOC-CA-88392',
    name: 'StateFarm_Personal_Auto_Policy_CA88392.pdf',
    carrier: 'State Farm Mutual Automobile Insurance',
    jurisdiction: 'CA',
    documentType: 'DECLARATIONS_PAGE',
    fileSize: '512 KB',
    uploadDate: '2026-09-15',
    rawTextExcerpt: `POLICY NUMBER: 938-2041-A12-05A
INSURED: MARCUS STERLING, 412 OCEANSIDE BLVD, SAN DIEGO CA 92109
VEHICLE 01: 2023 HONDA CR-V EX-L VIN: 7FARW2H86PE018392
COVERAGES & LIMITS:
BODILY INJURY: $250,000 EACH PERSON / $500,000 EACH ACCIDENT
PROPERTY DAMAGE LIABILITY: $100,000 EACH ACCIDENT
COMPREHENSIVE DEDUCTIBLE: $500
COLLISION DEDUCTIBLE: $500
RENTAL EXPENSE: INCLUDED ($50/DAY)
EMERGENCY ROAD SERVICE: INCLUDED
ANNUAL PREMIUM: $3,240.00 ($270.00 / MO)`,
    policyData: {
      policyNumber: '938-2041-A12-05A',
      carrier: 'State Farm Mutual Automobile Insurance',
      jurisdiction: 'CA',
      namedInsured: 'Marcus Sterling',
      effectiveDate: '2025-10-01',
      expirationDate: '2026-10-01',
      termMonths: 12,
      annualPremium: 3240,
      monthlyPremium: 270,
      vehicles: [
        {
          vin: '7FARW2H86PE018392',
          year: 2023,
          make: 'Honda',
          model: 'CR-V',
          trim: 'EX-L',
          usage: 'COMMUTE',
          annualMileage: 10000,
          garagingZip: '92109',
          ownership: 'OWNED'
        }
      ],
      drivers: [
        {
          id: 'DRV-CA-1',
          name: 'Marcus Sterling',
          isPrimary: true,
          licenseState: 'CA',
          licenseNumberMasked: 'CA•••••4401',
          age: 42
        }
      ],
      coverages: [
        {
          id: 'COV-CA-1',
          code: 'BODILY_INJURY',
          name: 'Bodily Injury Liability',
          category: 'LIABILITY',
          perPersonLimit: 250000,
          perAccidentLimit: 500000,
          isIncluded: true
        },
        {
          id: 'COV-CA-2',
          code: 'PROPERTY_DAMAGE',
          name: 'Property Damage Liability',
          category: 'LIABILITY',
          propertyLimit: 100000,
          isIncluded: true
        },
        {
          id: 'COV-CA-3',
          code: 'COLLISION',
          name: 'Collision Coverage',
          category: 'PHYSICAL_DAMAGE',
          deductible: 500,
          isIncluded: true
        },
        {
          id: 'COV-CA-4',
          code: 'COMPREHENSIVE',
          name: 'Comprehensive Coverage',
          category: 'PHYSICAL_DAMAGE',
          deductible: 500,
          isIncluded: true
        },
        {
          id: 'COV-CA-5',
          code: 'RENTAL_REIMBURSEMENT',
          name: 'Rental Reimbursement',
          category: 'ADDITIONAL',
          isIncluded: true
        },
        {
          id: 'COV-CA-6',
          code: 'ROADSIDE_ASSISTANCE',
          name: 'Emergency Road Service',
          category: 'ADDITIONAL',
          isIncluded: true
        }
      ]
    }
  }
];

/**
 * Checks provider-entered quote data against supporting quote document
 * Returns discrepancy details if conflicting data is detected
 */
export function detectQuoteDiscrepancies(
  enteredData: {
    carrier: string;
    annualPremium: number;
    collisionDeductible?: number;
    compDeductible?: number;
    rentalIncluded: boolean;
  },
  docTextOrSimulatedData: {
    extractedCollisionDeductible?: number;
    extractedCompDeductible?: number;
    extractedAnnualPremium?: number;
    extractedRentalIncluded?: boolean;
  }
): { hasDiscrepancy: boolean; discrepancies: string[] } {
  const discrepancies: string[] = [];

  if (
    docTextOrSimulatedData.extractedCollisionDeductible !== undefined &&
    enteredData.collisionDeductible !== undefined &&
    docTextOrSimulatedData.extractedCollisionDeductible !== enteredData.collisionDeductible
  ) {
    discrepancies.push(
      `Collision Deductible Discrepancy: Provider entered $${enteredData.collisionDeductible}, but uploaded quote document states $${docTextOrSimulatedData.extractedCollisionDeductible}.`
    );
  }

  if (
    docTextOrSimulatedData.extractedCompDeductible !== undefined &&
    enteredData.compDeductible !== undefined &&
    docTextOrSimulatedData.extractedCompDeductible !== enteredData.compDeductible
  ) {
    discrepancies.push(
      `Comprehensive Deductible Discrepancy: Provider entered $${enteredData.compDeductible}, but quote document states $${docTextOrSimulatedData.extractedCompDeductible}.`
    );
  }

  if (
    docTextOrSimulatedData.extractedAnnualPremium !== undefined &&
    Math.abs(docTextOrSimulatedData.extractedAnnualPremium - enteredData.annualPremium) > 5
  ) {
    discrepancies.push(
      `Premium Discrepancy: Provider entered $${enteredData.annualPremium}/yr, but quote document states $${docTextOrSimulatedData.extractedAnnualPremium}/yr.`
    );
  }

  if (
    docTextOrSimulatedData.extractedRentalIncluded !== undefined &&
    docTextOrSimulatedData.extractedRentalIncluded !== enteredData.rentalIncluded
  ) {
    discrepancies.push(
      `Rental Coverage Discrepancy: Provider stated Rental is ${enteredData.rentalIncluded ? 'Included' : 'Excluded'}, but quote document indicates it is ${docTextOrSimulatedData.extractedRentalIncluded ? 'Included' : 'Excluded'}.`
    );
  }

  return {
    hasDiscrepancy: discrepancies.length > 0,
    discrepancies
  };
}
