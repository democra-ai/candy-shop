/**
 * dw-csv-aggregator.js — a real, self-contained Cloudflare Worker module loaded
 * and executed *inside* the `dw-sandbox` worker by the Worker Loader (Dynamic
 * Workers) binding. Shipped as TEXT into `env.LOADER` and run as an isolated
 * child Worker with `globalOutbound: null` (no network egress — pure compute).
 *
 * Contract (the universal dw-sandbox module contract):
 *   - default export with `async fetch(request)`.
 *   - reads a JSON body (the `input` the host forwards) from the request.
 *   - returns a JSON `Response`.
 *
 * It parses CSV text into rows, then computes summary statistics (count, sum,
 * mean, min, max) for every numeric column — a practical "aggregate a CSV"
 * data tool that runs entirely on the fly, no dependencies, no network.
 *
 * Input  : { csv?: string, delimiter?: string }
 *   csv       a CSV string whose first line is the header row.
 *   delimiter column delimiter (default ",").
 * Output : {
 *     tool: "csv-aggregator",
 *     columns: string[],
 *     rowCount: number,
 *     numericStats: { [col]: { count, sum, mean, min, max } },
 *     sample: object[],     // first up-to-3 parsed rows
 *     note: string
 *   }
 */

/** Minimal RFC-4180-ish CSV line splitter that respects double-quoted fields. */
function splitCsvLine(line, delim) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const DEFAULT_CSV =
  "name,score,age\nAda,95,36\nAlan,88,41\nGrace,99,52\nKatherine,91,40";

export default {
  async fetch(request) {
    let input = {};
    try {
      const raw = await request.text();
      if (raw && raw.trim()) input = JSON.parse(raw);
    } catch {
      input = {};
    }

    const delim =
      typeof input.delimiter === "string" && input.delimiter.length
        ? input.delimiter
        : ",";
    const csv =
      typeof input.csv === "string" && input.csv.trim()
        ? input.csv
        : DEFAULT_CSV;

    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const out = {
      tool: "csv-aggregator",
      columns: [],
      rowCount: 0,
      numericStats: {},
      sample: [],
      note:
        input.csv === undefined
          ? 'no { csv } supplied — aggregated a built-in sample dataset; pass {"csv":"a,b\\n1,2"} to use your own'
          : "self-contained Worker module executed via Worker Loader (no network)",
    };

    if (lines.length === 0) return json(out);

    const columns = splitCsvLine(lines[0], delim);
    out.columns = columns;

    const rows = lines.slice(1).map((line) => {
      const cells = splitCsvLine(line, delim);
      const obj = {};
      columns.forEach((c, i) => {
        obj[c] = cells[i] ?? "";
      });
      return obj;
    });
    out.rowCount = rows.length;
    out.sample = rows.slice(0, 3);

    // Compute stats for every column that is fully numeric across all rows.
    for (const col of columns) {
      const nums = [];
      let allNumeric = rows.length > 0;
      for (const r of rows) {
        const v = r[col];
        const n = Number(v);
        if (v === "" || Number.isNaN(n)) {
          allNumeric = false;
          break;
        }
        nums.push(n);
      }
      if (allNumeric && nums.length) {
        const sum = nums.reduce((a, b) => a + b, 0);
        out.numericStats[col] = {
          count: nums.length,
          sum,
          mean: sum / nums.length,
          min: Math.min(...nums),
          max: Math.max(...nums),
        };
      }
    }

    return json(out);
  },
};

function json(obj) {
  return new Response(JSON.stringify(obj), {
    headers: { "Content-Type": "application/json" },
  });
}
