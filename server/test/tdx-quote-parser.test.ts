// Minimal self-test for the TDX quote parser.
// Synthesizes a well-formed quote layout and asserts extraction + verdict.
import { parseTdxQuote, verifyTdxQuote } from '../lib/tdx-quote-parser.js';
import { createHash } from 'node:crypto';

function build(nonce: string, mrtd: string): Buffer {
  const buf = Buffer.alloc(48 + 584 + 4);
  // header: TEE_TYPE=0x81 at offset 4 (u32 LE)
  buf.writeUInt16LE(4, 0);              // version = 4
  buf.writeUInt32LE(0x81, 4);           // tee_type = TDX

  const bodyOff = 48;
  const mrtdOff = bodyOff + 16 + 48 + 48 + 8 + 8 + 8;
  Buffer.from(mrtd, 'hex').copy(buf, mrtdOff);

  const reportDataOff = mrtdOff + 48 * 4 + 48 * 4;
  // report_data = sha512(nonce) — 64 bytes fits exactly
  const rd = createHash('sha512').update(nonce).digest();
  rd.copy(buf, reportDataOff);

  // sig_data_len = 0 (trailing field), no signature body
  buf.writeUInt32LE(0, 48 + 584);
  return buf;
}

const NONCE = 'test-nonce-abc123';
const MRTD = 'aa'.repeat(48);
const quoteHex = build(NONCE, MRTD).toString('hex');

// Parse
const parsed = parseTdxQuote(quoteHex);
if (!parsed) throw new Error('FAIL: parse returned null');
if (parsed.teeType !== 0x81) throw new Error(`FAIL: teeType=${parsed.teeType}`);
if (parsed.mrtd !== MRTD) throw new Error(`FAIL: mrtd mismatch: ${parsed.mrtd}`);
console.log('✓ parse extracts correct fields');

// Verify with matching MRTD + nonce
const v1 = verifyTdxQuote({ quote: quoteHex, nonce: NONCE, expectedMrtd: MRTD });
if (!v1.valid) throw new Error(`FAIL: expected valid, reasons: ${v1.reasons.join('; ')}`);
console.log('✓ nonce binding + MRTD match → valid');

// Verify rejects bad MRTD
const v2 = verifyTdxQuote({ quote: quoteHex, nonce: NONCE, expectedMrtd: 'bb'.repeat(48) });
if (v2.valid) throw new Error('FAIL: expected invalid for mismatched MRTD');
if (!v2.reasons.some((r) => r.includes('MRTD mismatch'))) throw new Error('FAIL: missing MRTD mismatch reason');
console.log('✓ MRTD mismatch → rejected');

// Verify rejects wrong nonce
const v3 = verifyTdxQuote({ quote: quoteHex, nonce: 'different-nonce', expectedMrtd: MRTD });
if (v3.valid) throw new Error('FAIL: expected invalid for nonce mismatch');
if (!v3.reasons.some((r) => r.includes('report_data'))) throw new Error('FAIL: missing nonce binding reason');
console.log('✓ nonce mismatch → rejected');

// Malformed input
if (parseTdxQuote('not-hex') !== null) throw new Error('FAIL: should reject non-hex');
if (parseTdxQuote('deadbeef') !== null) throw new Error('FAIL: should reject short input');
console.log('✓ malformed input → null');

console.log('\nAll TDX parser tests passed.');
