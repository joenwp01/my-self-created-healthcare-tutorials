import { useState, useEffect, useRef, useCallback } from "react";

// ─── Seedable PRNG (xoshiro128**) ────────────────────────────────
function makeRng(seed) {
  let s = [seed ^ 0xdead, seed ^ 0xbeef, seed ^ 0xcafe, seed ^ 0xbabe];
  const rot = (x, k) => ((x << k) | (x >>> (32 - k))) >>> 0;
  return () => {
    const r = (rot((s[1] * 5) >>> 0, 7) * 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
    s[2] ^= t; s[3] = rot(s[3], 11);
    return (r >>> 0) / 4294967296;
  };
}

// ─── Data generator (mirrors tz_helpers.py) ──────────────────────
const REGIONS = {
  "US-East":    { tz: "America/New_York",    offset: -5 },
  "US-West":    { tz: "America/Los_Angeles", offset: -8 },
  "EU-London":  { tz: "Europe/London",       offset:  0 },
  "Asia-Tokyo": { tz: "Asia/Tokyo",          offset:  9 },
};
const EVENT_FLOW = ["page_view", "add_to_cart", "checkout", "purchase_confirm"];
const SOURCES   = ["web_app", "mobile_ios", "mobile_android", "api_partner"];
const REGION_KEYS = Object.keys(REGIONS);

function generateEvents(nUsers, seed, injectRate) {
  const rng = makeRng(seed);
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  const randInt = (lo, hi) => lo + Math.floor(rng() * (hi - lo));
  const base = new Date("2025-03-09T00:00:00Z").getTime();
  const rows = [];

  for (let uid = 1; uid <= nUsers; uid++) {
    const region = pick(REGION_KEYS);
    const { tz, offset } = REGIONS[region];
    const source = pick(SOURCES);
    const sessStart = base + randInt(0, 72) * 3600000 + randInt(0, 60) * 60000;
    let cum = 0;
    for (const evt of EVENT_FLOW) {
      cum += randInt(1, 45) * 60000;
      const trueUtc = new Date(sessStart + cum);
      let storedTs, storedTz;
      if (rng() < injectRate) {
        const buggy = new Date(trueUtc.getTime() + offset * 3600000);
        storedTs = buggy.toISOString().replace("T", " ").slice(0, 19);
        storedTz = null;
      } else {
        storedTs = trueUtc.toISOString().replace("T", " ").slice(0, 19);
        storedTz = "UTC";
      }
      rows.push({
        user_id: `U${String(uid).padStart(4, "0")}`,
        event_type: evt, timestamp_raw: storedTs, source_system: source,
        original_tz: storedTz, region, true_utc: trueUtc.toISOString().replace("T", " ").slice(0, 19),
      });
    }
  }
  return rows;
}

// ─── SQL template library ────────────────────────────────────────
const QUERIES = {
  "Preview Data": `SELECT user_id, event_type, timestamp_raw, original_tz, region, source_system
FROM events LIMIT 30;`,

  "Missing Timezone Rows": `SELECT COUNT(*) AS total_rows,
       SUM(CASE WHEN original_tz IS NULL THEN 1 ELSE 0 END) AS missing_tz,
       ROUND(100.0 * SUM(CASE WHEN original_tz IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_missing
FROM events;`,

  "Hourly Distribution by Region": `SELECT region,
       CAST(SUBSTR(timestamp_raw, 12, 2) AS INTEGER) AS hour_of_day,
       COUNT(*) AS event_count
FROM events
GROUP BY region, hour_of_day
ORDER BY region, hour_of_day;`,

  "Sequence Violations": `WITH ordered AS (
  SELECT user_id, event_type, timestamp_raw,
         LAG(event_type) OVER (PARTITION BY user_id ORDER BY timestamp_raw) AS prev_event,
         LAG(timestamp_raw) OVER (PARTITION BY user_id ORDER BY timestamp_raw) AS prev_ts
  FROM events
)
SELECT user_id, prev_event, event_type AS next_event,
       prev_ts, timestamp_raw,
       ROUND((JULIANDAY(timestamp_raw) - JULIANDAY(prev_ts)) * 1440, 1) AS gap_minutes
FROM ordered
WHERE (prev_event = 'checkout'          AND event_type = 'add_to_cart')
   OR (prev_event = 'purchase_confirm'  AND event_type = 'add_to_cart')
   OR (prev_event = 'purchase_confirm'  AND event_type = 'checkout')
ORDER BY user_id;`,

  "Session Duration Outliers": `WITH spans AS (
  SELECT user_id,
         MIN(timestamp_raw) AS session_start,
         MAX(timestamp_raw) AS session_end,
         ROUND((JULIANDAY(MAX(timestamp_raw)) - JULIANDAY(MIN(timestamp_raw))) * 1440, 1) AS duration_min
  FROM events
  GROUP BY user_id
)
SELECT * FROM spans
WHERE duration_min < 0 OR duration_min > 1440
ORDER BY duration_min;`,

  "Offset Detection (vs Ground Truth)": `SELECT
  ROUND(AVG(
    (JULIANDAY(timestamp_raw) - JULIANDAY(true_utc)) * 24
  ), 1) AS avg_offset_hours,
  COUNT(*) AS rows_checked
FROM events
WHERE original_tz IS NULL;`,

  "Before vs After UTC Fix": `SELECT user_id, event_type, timestamp_raw, original_tz, true_utc,
       CASE
         WHEN original_tz IS NOT NULL THEN timestamp_raw
         ELSE DATETIME(timestamp_raw,
              '-' || CAST(ROUND((JULIANDAY(timestamp_raw) - JULIANDAY(true_utc)) * 24) AS INTEGER) || ' hours')
       END AS corrected_utc
FROM events
WHERE user_id IN (SELECT DISTINCT user_id FROM events WHERE original_tz IS NULL LIMIT 3)
ORDER BY user_id, true_utc;`,

  "Custom Query": `-- Write your own SQL here.
-- Table: events
-- Columns: user_id, event_type, timestamp_raw,
--          source_system, original_tz, region, true_utc
SELECT * FROM events LIMIT 10;`,
};

// ─── Styles ──────────────────────────────────────────────────────
const FONT_MONO = "'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace";
const FONT_BODY = "'DM Sans', 'Outfit', system-ui, sans-serif";

const palette = {
  bg:        "#0c0e14",   ink:       "#e2e4ea",
  surface:   "#151820",   surfaceHi:"#1c2030",
  border:    "#262d3d",   borderHi: "#3a4460",
  accent:    "#58a6ff",   accentDim:"#264a78",
  warn:      "#f0883e",   error:    "#f85149",
  green:     "#3fb950",   purple:   "#bc8cff",
  cyan:      "#79c0ff",
};

// ─── Component ───────────────────────────────────────────────────
export default function TimezoneSyncLab() {
  const [db, setDb]               = useState(null);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [nUsers, setNUsers]       = useState(50);
  const [seed, setSeed]           = useState(42);
  const [injectRate, setInjectRate] = useState(0.30);
  const [selectedQuery, setSelectedQuery] = useState("Preview Data");
  const [sql, setSql]             = useState(QUERIES["Preview Data"]);
  const [results, setResults]     = useState(null);
  const [queryError, setQueryError] = useState(null);
  const [execMs, setExecMs]       = useState(null);
  const [rowCount, setRowCount]   = useState(0);
  const [missingTz, setMissingTz] = useState(0);
  const [dbReady, setDbReady]     = useState(false);
  const editorRef = useRef(null);

  // ── Load sql.js WASM ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cdn = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3";
        if (!window.initSqlJs) {
          await new Promise((res, rej) => {
            const s = document.createElement("script");
            s.src = `${cdn}/sql-wasm.min.js`;
            s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
          });
        }
        const SQL = await window.initSqlJs({ locateFile: f => `${cdn}/${f}` });
        if (!cancelled) { setDb(new SQL.Database()); setLoading(false); }
      } catch (e) { if (!cancelled) { setLoadError(e.message); setLoading(false); } }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Seed database when db or params change ──────────────────────
  const seedDatabase = useCallback(() => {
    if (!db) return;
    try {
      db.run("DROP TABLE IF EXISTS events;");
      db.run(`CREATE TABLE events (
        user_id       TEXT,
        event_type    TEXT,
        timestamp_raw TEXT,
        source_system TEXT,
        original_tz   TEXT,
        region        TEXT,
        true_utc      TEXT
      );`);
      const rows = generateEvents(nUsers, seed, injectRate);
      const stmt = db.prepare(
        "INSERT INTO events VALUES (?,?,?,?,?,?,?)"
      );
      for (const r of rows) {
        stmt.run([r.user_id, r.event_type, r.timestamp_raw,
                  r.source_system, r.original_tz, r.region, r.true_utc]);
      }
      stmt.free();
      setRowCount(rows.length);
      setMissingTz(rows.filter(r => r.original_tz === null).length);
      setDbReady(true);
      setResults(null);
      setQueryError(null);
    } catch (e) { setQueryError(e.message); }
  }, [db, nUsers, seed, injectRate]);

  useEffect(() => { seedDatabase(); }, [seedDatabase]);

  // ── Run query ───────────────────────────────────────────────────
  const runQuery = useCallback(() => {
    if (!db || !sql.trim()) return;
    setQueryError(null);
    const t0 = performance.now();
    try {
      const res = db.exec(sql);
      setExecMs(Math.round(performance.now() - t0));
      setResults(res.length ? res[0] : { columns: [], values: [] });
    } catch (e) { setQueryError(e.message); setResults(null); }
  }, [db, sql]);

  const handleQuerySelect = (name) => {
    setSelectedQuery(name);
    setSql(QUERIES[name]);
    setQueryError(null);
    setResults(null);
  };

  // ── Download CSV ────────────────────────────────────────────────
  const downloadCsv = () => {
    if (!results || !results.values?.length) return;
    const header = results.columns.join(",");
    const body = results.values.map(r =>
      r.map(v => v === null ? "" : `"${String(v).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `tz_query_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Export full DB as SQL ───────────────────────────────────────
  const exportSql = () => {
    if (!db) return;
    const dump = db.export();
    const blob = new Blob([dump], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `tz_sync_lab_${nUsers}u_${seed}s.sqlite`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ──────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ background: palette.bg, color: palette.ink, minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_BODY }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Loading SQLite WASM…</div>
        <div style={{ color: palette.accent, fontSize: 14 }}>Fetching sql.js from CDN</div>
      </div>
    </div>
  );

  if (loadError) return (
    <div style={{ background: palette.bg, color: palette.error, minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_BODY, padding: 32 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Failed to load SQLite</div>
        <div style={{ fontSize: 14, opacity: .8 }}>{loadError}</div>
      </div>
    </div>
  );

  const statPill = (label, value, color) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
      padding: "10px 18px", borderRadius: 10, background: palette.surfaceHi, minWidth: 90,
      border: `1px solid ${palette.border}` }}>
      <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2,
        color: palette.ink, opacity: .5, marginBottom: 4 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color, fontFamily: FONT_MONO }}>{value}</span>
    </div>
  );

  return (
    <div style={{ background: palette.bg, color: palette.ink, minHeight: "100vh",
      fontFamily: FONT_BODY, padding: 0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        textarea:focus, select:focus, input:focus { outline: 2px solid ${palette.accent}; outline-offset: -1px; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${palette.surface}; }
        ::-webkit-scrollbar-thumb { background: ${palette.borderHi}; border-radius: 3px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────── */}
      <header style={{ padding: "28px 32px 20px", borderBottom: `1px solid ${palette.border}`,
        background: `linear-gradient(180deg, ${palette.surfaceHi} 0%, ${palette.bg} 100%)` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -.5 }}>
            <span style={{ color: palette.cyan }}>⏱</span> Timezone Sync Lab
          </h1>
          <span style={{ fontSize: 12, color: palette.accent, fontFamily: FONT_MONO,
            background: palette.accentDim, padding: "3px 10px", borderRadius: 6 }}>
            SQLite · WebAssembly · In-Browser
          </span>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: palette.ink, opacity: .55, maxWidth: 700 }}>
          Generate distributed-system ecommerce events with tunable timezone bugs,
          then detect and correct them using live SQL queries — all running locally in your browser.
        </p>
      </header>

      <div style={{ display: "flex", gap: 0, minHeight: "calc(100vh - 110px)" }}>

        {/* ── Left Panel: Controls ────────────────────────────────── */}
        <aside style={{ width: 280, minWidth: 280, borderRight: `1px solid ${palette.border}`,
          padding: "20px 18px", background: palette.surface, display: "flex", flexDirection: "column", gap: 20,
          overflowY: "auto" }}>

          {/* Data Parameters */}
          <section>
            <h3 style={{ margin: "0 0 14px", fontSize: 11, textTransform: "uppercase",
              letterSpacing: 1.5, color: palette.accent, fontWeight: 700 }}>Data Parameters</h3>

            <label style={lbl}>Users: <b style={{ color: palette.cyan, fontFamily: FONT_MONO }}>{nUsers}</b></label>
            <input type="range" min={5} max={200} step={5} value={nUsers}
              onChange={e => setNUsers(+e.target.value)} style={slider} />

            <label style={lbl}>Seed: <b style={{ color: palette.cyan, fontFamily: FONT_MONO }}>{seed}</b></label>
            <input type="range" min={1} max={999} value={seed}
              onChange={e => setSeed(+e.target.value)} style={slider} />

            <label style={lbl}>Bug Inject Rate: <b style={{ color: palette.warn, fontFamily: FONT_MONO }}>
              {Math.round(injectRate * 100)}%</b></label>
            <input type="range" min={0} max={100} value={Math.round(injectRate * 100)}
              onChange={e => setInjectRate(+e.target.value / 100)} style={slider} />

            <button onClick={seedDatabase} style={{
              ...btn, background: palette.accent, color: "#000", fontWeight: 700, width: "100%", marginTop: 6,
            }}>Regenerate Data</button>
          </section>

          {/* Stats */}
          {dbReady && (
            <section style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {statPill("Rows", rowCount, palette.cyan)}
              {statPill("Missing TZ", missingTz, missingTz > 0 ? palette.warn : palette.green)}
              {statPill("Users", nUsers, palette.purple)}
            </section>
          )}

          {/* Query Templates */}
          <section>
            <h3 style={{ margin: "0 0 10px", fontSize: 11, textTransform: "uppercase",
              letterSpacing: 1.5, color: palette.accent, fontWeight: 700 }}>Query Templates</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {Object.keys(QUERIES).map(name => (
                <button key={name} onClick={() => handleQuerySelect(name)} style={{
                  ...btn, textAlign: "left", fontSize: 12, padding: "7px 10px", borderRadius: 6,
                  background: selectedQuery === name ? palette.accentDim : "transparent",
                  color: selectedQuery === name ? palette.accent : palette.ink,
                  border: `1px solid ${selectedQuery === name ? palette.accent : palette.border}`,
                  fontWeight: selectedQuery === name ? 600 : 400,
                }}>
                  {name}
                </button>
              ))}
            </div>
          </section>

          {/* Export */}
          <section style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            <button onClick={exportSql} style={{ ...btn, fontSize: 12, width: "100%",
              background: palette.surfaceHi, border: `1px solid ${palette.border}`, color: palette.ink }}>
              ↓ Export .sqlite file
            </button>
            {results?.values?.length > 0 && (
              <button onClick={downloadCsv} style={{ ...btn, fontSize: 12, width: "100%",
                background: palette.surfaceHi, border: `1px solid ${palette.border}`, color: palette.ink }}>
                ↓ Download results CSV
              </button>
            )}
          </section>
        </aside>

        {/* ── Main Panel: Editor + Results ────────────────────────── */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {/* SQL Editor */}
          <div style={{ padding: "16px 24px 12px", borderBottom: `1px solid ${palette.border}`,
            background: palette.surface }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: palette.ink }}>
                SQL Editor — <span style={{ color: palette.purple }}>{selectedQuery}</span>
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {execMs !== null && (
                  <span style={{ fontSize: 11, fontFamily: FONT_MONO, color: palette.green }}>
                    {execMs}ms
                  </span>
                )}
                <button onClick={runQuery} style={{
                  ...btn, background: palette.green, color: "#000", fontWeight: 700, padding: "7px 20px",
                }}>▶ Run</button>
              </div>
            </div>
            <textarea ref={editorRef} value={sql} onChange={e => setSql(e.target.value)}
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runQuery(); }}}
              spellCheck={false}
              style={{
                width: "100%", minHeight: 120, resize: "vertical", fontFamily: FONT_MONO, fontSize: 13,
                lineHeight: 1.6, background: palette.bg, color: palette.cyan, border: `1px solid ${palette.border}`,
                borderRadius: 8, padding: 14, tabSize: 2,
              }}
            />
            <div style={{ fontSize: 11, color: palette.ink, opacity: .35, marginTop: 4 }}>
              Ctrl+Enter to run · Table: <code style={{ color: palette.purple }}>events</code> · Columns: user_id, event_type, timestamp_raw, source_system, original_tz, region, true_utc
            </div>
          </div>

          {/* Error */}
          {queryError && (
            <div style={{ margin: "12px 24px", padding: "10px 14px", borderRadius: 8,
              background: "#2d1215", border: `1px solid ${palette.error}`, color: palette.error,
              fontSize: 13, fontFamily: FONT_MONO, animation: "fadeUp .25s ease" }}>
              {queryError}
            </div>
          )}

          {/* Results Table */}
          <div style={{ flex: 1, overflow: "auto", padding: "0 24px 24px" }}>
            {results && results.columns?.length > 0 ? (
              <div style={{ animation: "fadeUp .3s ease" }}>
                <div style={{ fontSize: 12, color: palette.ink, opacity: .45, padding: "12px 0 8px",
                  fontFamily: FONT_MONO }}>
                  {results.values.length} row{results.values.length !== 1 ? "s" : ""} returned
                </div>
                <div style={{ overflowX: "auto", borderRadius: 10,
                  border: `1px solid ${palette.border}` }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13,
                    fontFamily: FONT_MONO }}>
                    <thead>
                      <tr>
                        {results.columns.map((c, i) => (
                          <th key={i} style={{
                            padding: "10px 14px", textAlign: "left", fontWeight: 700,
                            background: palette.surfaceHi, color: palette.accent, fontSize: 11,
                            textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap",
                            borderBottom: `2px solid ${palette.accent}`,
                            position: "sticky", top: 0, zIndex: 1,
                          }}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.values.map((row, ri) => (
                        <tr key={ri} style={{
                          background: ri % 2 === 0 ? palette.surface : palette.bg,
                          transition: "background .15s",
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = palette.surfaceHi}
                          onMouseLeave={e => e.currentTarget.style.background = ri % 2 === 0 ? palette.surface : palette.bg}
                        >
                          {row.map((val, ci) => {
                            const col = results.columns[ci]?.toLowerCase() || "";
                            let cellColor = palette.ink;
                            if (val === null) cellColor = palette.borderHi;
                            else if (col.includes("violation") || col.includes("error")) cellColor = palette.error;
                            else if (col.includes("tz") || col.includes("timezone")) cellColor = palette.warn;
                            else if (col.includes("utc") || col.includes("corrected")) cellColor = palette.green;
                            else if (col.includes("user")) cellColor = palette.purple;
                            return (
                              <td key={ci} style={{
                                padding: "8px 14px", whiteSpace: "nowrap",
                                borderBottom: `1px solid ${palette.border}`,
                                color: cellColor, fontSize: 12.5,
                              }}>
                                {val === null ? <i style={{ opacity: .4 }}>NULL</i> : String(val)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              !queryError && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  height: "100%", minHeight: 200, opacity: .3 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>⏱</div>
                    <div style={{ fontSize: 14 }}>Select a query template and hit <b>Run</b></div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>or write your own SQL</div>
                  </div>
                </div>
              )
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Shared inline styles ─────────────────────────────────────────
const lbl = {
  fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center",
  marginBottom: 2, color: "#e2e4ea", opacity: .7,
};
const slider = {
  width: "100%", marginBottom: 12, accentColor: "#58a6ff", cursor: "pointer", height: 5,
};
const btn = {
  cursor: "pointer", border: "none", borderRadius: 8, padding: "8px 14px",
  fontSize: 13, fontFamily: "'DM Sans', system-ui, sans-serif", transition: "all .15s",
};
