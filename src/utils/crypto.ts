export async function sha256Hex(input: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Deterministic fallback if SubtleCrypto is unavailable
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return (part1 + part2).repeat(4).slice(0, 64);
}

export async function generateSignatureHash(params: {
  signerName: string;
  signerPosition: string;
  documentRef: string;
  signedAt: string;
  signaturePreview: string;
}): Promise<string> {
  const payload = [
    'RUAMKUSON-SAMUTPRAKAN-EOFFICE',
    params.signerName,
    params.signerPosition,
    params.documentRef,
    params.signedAt,
    params.signaturePreview.slice(0, 128),
  ].join('|');
  return sha256Hex(payload);
}

// Precomputed synchronous hash helper for default PIN '123456' seeding
export const DEFAULT_PIN_SEED_HASH = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92';
