import { encodeAbiParameters, keccak256, toHex, stringToHex } from 'viem';

export const SCHEMA_VERSION = 1;

export const AGREEMENT_SCHEMA = [
  { name: 'schemaVersion', type: 'uint8' },
  { name: 'buyer', type: 'address' },
  { name: 'freelancer', type: 'address' },
  { name: 'resolver', type: 'address' },
  { name: 'hardEnd', type: 'uint32' },
  { 
    name: 'milestones', 
    type: 'tuple[]',
    components: [
      { name: 'amount', type: 'uint256' },
      { name: 'deliveryDeadline', type: 'uint32' },
      { name: 'reviewDuration', type: 'uint32' },
      { name: 'criteriaHash', type: 'bytes32' }
    ]
  }
];

export function hashCriteria(criteriaText: string): `0x${string}` {
  // Hash the UTF-8 text representation of the acceptance criteria
  return keccak256(stringToHex(criteriaText.trim()));
}

export type AgreementTerms = {
  buyer: string;
  freelancer: string;
  resolver: string;
  hardEnd: number;
  milestones: {
    amount: bigint;
    deliveryDeadline: number;
    reviewDuration: number;
    criteriaText: string;
  }[];
};

export function generateCanonicalHash(terms: AgreementTerms): `0x${string}` {
  const processedMilestones = terms.milestones.map(m => ({
    amount: m.amount,
    deliveryDeadline: m.deliveryDeadline,
    reviewDuration: m.reviewDuration,
    criteriaHash: hashCriteria(m.criteriaText)
  }));

  const encoded = encodeAbiParameters(
    AGREEMENT_SCHEMA,
    [
      SCHEMA_VERSION,
      (terms.buyer || '0x0000000000000000000000000000000000000000') as `0x${string}`,
      (terms.freelancer || '0x0000000000000000000000000000000000000000') as `0x${string}`,
      (terms.resolver || '0x0000000000000000000000000000000000000000') as `0x${string}`,
      terms.hardEnd || 0,
      processedMilestones
    ]
  );
  
  return keccak256(encoded);
}
