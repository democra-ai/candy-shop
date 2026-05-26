// ============================================================
// Intel TDX Quote Parser — Structural Verification
// ============================================================
//
// Parses TDX v4 quotes (the format produced by Phala dstack / Intel DCAP).
// Extracts MRTD and REPORT_DATA for local verification:
//   - REPORT_DATA must contain sha512(nonce) → proves quote freshness
//   - MRTD must match the registered value → proves code integrity
//
// What this does NOT do (requires Intel PCCS + full DCAP chain walk):
//   - Verify the quote signature (ECDSA-P256)
//   - Walk the PCK cert chain back to Intel SGX Root CA
//   - Check TCB levels against Intel's TCB Info service
//
// For that level of assurance, either:
//   - Set TEE_VERIFIER=phala and point PHALA_ATTESTATION_VERIFY_URL at
//     Phala's proof-of-execution service (they do the PKI chain for you)
//   - Install @automata-network/dcap-qvl and plug it into `verifyQuoteSignature`
// ============================================================
//
// TDX v4 quote layout (simplified):
//   offset  size   field
//   ──────  ────   ─────
//   0       48     Header
//                    u16 version
//                    u16 att_key_type
//                    u32 tee_type         (0x00000081 for TDX)
//                    u16 reserved
//                    u16 reserved
//                    u16 qe_svn
//                    u16 pce_svn
//                    u8[16] qe_vendor_id
//                    u8[20] user_data
//   48      584    TD Report
//                    u8[16]  tee_tcb_svn
//                    u8[48]  mrseam
//                    u8[48]  mrsignerseam
//                    u8[8]   seamattributes
//                    u8[8]   td_attributes
//                    u8[8]   xfam
//                    u8[48]  mrtd               ← code measurement
//                    u8[48]  mrconfigid
//                    u8[48]  mrowner
//                    u8[48]  mrownerconfig
//                    u8[48]  rtmr0
//                    u8[48]  rtmr1
//                    u8[48]  rtmr2
//                    u8[48]  rtmr3
//                    u8[64]  reportdata         ← nonce binding
//   632     4      sig_data_len
//   636     ...    sig_data (ECDSA-256 quote + PCK cert chain)
// ============================================================

export interface ParsedTdxQuote {
  version: number;
  teeType: number;
  mrseam: string;
  mrtd: string;
  rtmr0: string;
  rtmr1: string;
  rtmr2: string;
  rtmr3: string;
  reportData: string;
  sigDataLen: number;
  sigDataHex: string;     // hex of raw sig blob — for external verifiers
}

export interface TdxQuoteVerdict {
  parsed: ParsedTdxQuote | null;
  valid: boolean;
  reasons: string[];
  checks: {
    parsed: boolean;
    teeTypeIsTdx: boolean;
    reportDataBindsNonce: boolean;
    mrtdMatches: boolean;        // always true when no expected value is provided
    signatureVerified: boolean;  // reserved; always false until full DCAP
  };
}

const TEE_TYPE_TDX = 0x00000081;
const HEADER_LEN = 48;
const BODY_LEN = 584;
const SIGLEN_FIELD = 4;
const MIN_QUOTE_LEN = HEADER_LEN + BODY_LEN + SIGLEN_FIELD;

function hex(buf: Buffer, off: number, len: number): string {
  return buf.subarray(off, off + len).toString('hex');
}

function fromHex(input: string | Buffer | Uint8Array | undefined | null): Buffer | null {
  if (input == null) return null;
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (typeof input === 'string') {
    const cleaned = input.replace(/^0x/, '').replace(/\s+/g, '');
    if (cleaned.length === 0 || cleaned.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(cleaned)) return null;
    return Buffer.from(cleaned, 'hex');
  }
  return null;
}

export function parseTdxQuote(input: string | Buffer | Uint8Array): ParsedTdxQuote | null {
  const buf = fromHex(input);
  if (!buf || buf.length < MIN_QUOTE_LEN) return null;

  const version = buf.readUInt16LE(0);
  const teeType = buf.readUInt32LE(4);

  // Body starts at HEADER_LEN
  const bodyOff = HEADER_LEN;
  const mrseam    = hex(buf, bodyOff + 16, 48);
  // skip mrsignerseam (48), seamattributes (8), td_attributes (8), xfam (8)
  const mrtdOff   = bodyOff + 16 + 48 + 48 + 8 + 8 + 8;
  const mrtd      = hex(buf, mrtdOff, 48);
  const rtmr0Off  = mrtdOff + 48 + 48 + 48 + 48;   // mrtd + mrconfigid + mrowner + mrownerconfig
  const rtmr0     = hex(buf, rtmr0Off, 48);
  const rtmr1     = hex(buf, rtmr0Off + 48, 48);
  const rtmr2     = hex(buf, rtmr0Off + 96, 48);
  const rtmr3     = hex(buf, rtmr0Off + 144, 48);
  const reportData = hex(buf, rtmr0Off + 192, 64);

  const sigLenOff = HEADER_LEN + BODY_LEN;
  const sigDataLen = buf.readUInt32LE(sigLenOff);
  const sigDataHex = sigDataLen > 0 && buf.length >= sigLenOff + SIGLEN_FIELD + sigDataLen
    ? hex(buf, sigLenOff + SIGLEN_FIELD, sigDataLen)
    : '';

  return { version, teeType, mrseam, mrtd, rtmr0, rtmr1, rtmr2, rtmr3, reportData, sigDataLen, sigDataHex };
}

// ── Verify a quote's structural claims + nonce binding ──────

import { createHash } from 'node:crypto';

export interface TdxVerifyInput {
  quote: string | Buffer | Uint8Array;   // hex or raw bytes
  nonce: string;                         // must appear in report_data (as sha512 prefix)
  expectedMrtd?: string | null;          // optional — enforced when set
}

export function verifyTdxQuote(input: TdxVerifyInput): TdxQuoteVerdict {
  const reasons: string[] = [];
  const checks = {
    parsed: false,
    teeTypeIsTdx: false,
    reportDataBindsNonce: false,
    mrtdMatches: true,
    signatureVerified: false,
  };

  const parsed = parseTdxQuote(input.quote);
  if (!parsed) {
    reasons.push('Failed to parse TDX quote (bad length or malformed hex)');
    return { parsed: null, valid: false, reasons, checks };
  }
  checks.parsed = true;

  if (parsed.teeType !== TEE_TYPE_TDX) {
    reasons.push(`Unexpected TEE type: 0x${parsed.teeType.toString(16)} (expected 0x${TEE_TYPE_TDX.toString(16)} TDX)`);
  } else {
    checks.teeTypeIsTdx = true;
  }

  // Nonce binding. dstack (Phala CVM / simulator) wraps the caller-supplied
  // report_data before embedding it into the TD report, using:
  //   REPORT_DATA = sha512("app-data:" || raw_bytes(report_data_input))
  // The template sends report_data = sha512(nonce).hex() (64 bytes), so the
  // expected REPORT_DATA in the quote is sha512("app-data:" || sha512(nonce)).
  // For non-dstack TEEs that embed report_data verbatim, we also accept a
  // direct sha512(nonce) match.
  const rawSha512 = createHash('sha512').update(input.nonce).digest();
  const dstackWrapped = createHash('sha512').update(Buffer.concat([Buffer.from('app-data:'), rawSha512])).digest('hex');
  const directHex = rawSha512.toString('hex');
  const reportDataLower = parsed.reportData.toLowerCase();
  if (reportDataLower === dstackWrapped.toLowerCase() || reportDataLower === directHex.toLowerCase()) {
    checks.reportDataBindsNonce = true;
  } else {
    reasons.push('report_data does not bind the nonce (expected sha512("app-data:" || sha512(nonce)) or sha512(nonce))');
  }

  // MRTD match
  if (input.expectedMrtd) {
    if (parsed.mrtd.toLowerCase() === input.expectedMrtd.toLowerCase()) {
      checks.mrtdMatches = true;
    } else {
      checks.mrtdMatches = false;
      reasons.push(`MRTD mismatch: expected ${input.expectedMrtd.slice(0, 16)}…, got ${parsed.mrtd.slice(0, 16)}…`);
    }
  }

  // Signature verification is a TODO (requires DCAP chain walk)
  if (parsed.sigDataLen === 0) {
    reasons.push('warning: quote has no signature data');
  } else {
    reasons.push('warning: ECDSA/PCK chain not verified locally — use TEE_VERIFIER=phala for full chain verification');
  }

  const hardFail = reasons.some((r) => !r.startsWith('warning:'));
  return {
    parsed,
    valid: !hardFail && checks.parsed && checks.teeTypeIsTdx && checks.reportDataBindsNonce && checks.mrtdMatches,
    reasons,
    checks,
  };
}
