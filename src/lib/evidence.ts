export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_TYPES = [
  'application/pdf',
  'application/zip',
  'image/jpeg',
  'image/png',
  'text/plain'
];

export async function computeEvidenceHash(file: File): Promise<`0x${string}`> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File exceeds max size of 10MB`);
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`File type ${file.type} not allowed`);
  }

  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `0x${hex}`;
}

export async function mockUploadToStorage(file: File, hash: string): Promise<string> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Simulate IPFS CID generation deterministically based on hash
  const mockCid = 'Qm' + Buffer.from(hash.slice(2)).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 44);
  return `ipfs://${mockCid}`;
}
