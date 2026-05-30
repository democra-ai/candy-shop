/**
 * dw-json-transformer.js — a real, self-contained Cloudflare Worker module that
 * is loaded and executed *inside* the `dw-sandbox` worker by the Worker Loader
 * (Dynamic Workers) binding. It is NOT part of any host bundle at runtime; the
 * host ships this file's TEXT into `env.LOADER` and runs it as an isolated
 * child Worker with `globalOutbound: null` (no network egress — pure compute).
 *
 * Contract (the universal dw-sandbox module contract):
 *   - default export with `async fetch(request)`.
 *   - reads a JSON body (the `input` the host forwards) from the request.
 *   - returns a JSON `Response` describing the computed transform.
 *
 * Input  : { text?: string, n?: number }
 * Output : {
 *     tool: "json-transformer",
 *     received: <the parsed input>,
 *     text:  { input, upper, lower, reversed, upperReversed, length, words } | null,
 *     number:{ n, factorial, isEven, square } | null,
 *     note: <string>
 *   }
 *
 * This is the catalog twin of the bundled dw-sandbox example, hosted on Pages so
 * the deployed site can point `artifactUrl` at it and the loader fetches + runs
 * it on the fly.
 */

/** Iterative factorial as a finite Number (caps absurd n so it never overflows to Infinity). */
function factorial(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  if (n < 0) return null;
  const k = Math.min(Math.floor(n), 170); // 170! is the largest finite double
  let acc = 1;
  for (let i = 2; i <= k; i++) acc *= i;
  return acc;
}

function reverseString(s) {
  return Array.from(s).reverse().join("");
}

export default {
  async fetch(request) {
    let input = {};
    try {
      const raw = await request.text();
      if (raw && raw.trim()) input = JSON.parse(raw);
    } catch {
      // Non-JSON / empty body → treat as no input; still return a valid result.
      input = {};
    }

    const out = {
      tool: "json-transformer",
      received: input,
      text: null,
      number: null,
      note: "self-contained Worker module executed via Worker Loader (no network)",
    };

    if (typeof input.text === "string") {
      const upper = input.text.toUpperCase();
      out.text = {
        input: input.text,
        upper,
        lower: input.text.toLowerCase(),
        reversed: reverseString(input.text),
        upperReversed: reverseString(upper),
        length: Array.from(input.text).length,
        words: input.text.trim() ? input.text.trim().split(/\s+/).length : 0,
      };
    }

    if (typeof input.n === "number") {
      out.number = {
        n: input.n,
        factorial: factorial(input.n),
        isEven: Number.isInteger(input.n) ? input.n % 2 === 0 : null,
        square: input.n * input.n,
      };
    }

    if (out.text === null && out.number === null) {
      out.note =
        'no { text } or { n } supplied — pass e.g. {"text":"candy","n":5}';
    }

    return new Response(JSON.stringify(out), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
