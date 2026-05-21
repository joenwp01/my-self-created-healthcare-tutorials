import { useState } from "react";

// ─── DATA ──────────────────────────────────────────────────────────────────────
const REFERENCE_TABLE = [
  { code_system: "ICD-10", code: "E11.9", description: "Type 2 diabetes mellitus without complications" },
  { code_system: "ICD-10", code: "I10", description: "Essential (primary) hypertension" },
  { code_system: "ICD-10", code: "J06.9", description: "Acute upper respiratory infection, unspecified" },
  { code_system: "ICD-10", code: "M54.5", description: "Low back pain" },
  { code_system: "ICD-10", code: "E78.5", description: "Hyperlipidemia, unspecified" },
  { code_system: "ICD-10", code: "F41.9", description: "Anxiety disorder, unspecified" },
  { code_system: "CPT", code: "93000", description: "Electrocardiogram, routine ECG with at least 12 leads" },
  { code_system: "CPT", code: "99213", description: "Office visit, established patient, 20-29 min" },
  { code_system: "CPT", code: "99214", description: "Office visit, established patient, 30-39 min" },
  { code_system: "CPT", code: "36415", description: "Venipuncture (routine blood draw)" },
  { code_system: "CPT", code: "80053", description: "Comprehensive metabolic panel" },
  { code_system: "CPT", code: "71046", description: "Chest X-ray, 2 views" },
];

const ENCOUNTER_TABLE = [
  { encounter_id: "ENC-001", code_system: "ICD-10", code: "E11.9", description: "Type 2 diabetes mellitus without complications", status: "MATCH" },
  { encounter_id: "ENC-002", code_system: "CPT", code: "93000", description: "Chest X-ray", status: "MISMATCH" },
  { encounter_id: "ENC-003", code_system: "ICD-10", code: "I10", description: "Essential (primary) hypertension", status: "MATCH" },
  { encounter_id: "ENC-004", code_system: "ICD-10", code: "J06.9", description: "Low back pain", status: "MISMATCH" },
  { encounter_id: "ENC-005", code_system: "CPT", code: "99213", description: "Office visit, established patient, 20-29 min", status: "MATCH" },
  { encounter_id: "ENC-006", code_system: "CPT", code: "36415", description: "Comprehensive metabolic panel", status: "MISMATCH" },
  { encounter_id: "ENC-007", code_system: "ICD-10", code: "M54.5", description: "Low back pain", status: "MATCH" },
  { encounter_id: "ENC-008", code_system: "CPT", code: "80053", description: "Comprehensive metabolic panel", status: "MATCH" },
  { encounter_id: "ENC-009", code_system: "ICD-10", code: "E78.5", description: "Type 2 diabetes mellitus without complications", status: "MISMATCH" },
  { encounter_id: "ENC-010", code_system: "CPT", code: "71046", description: "Chest X-ray, 2 views", status: "MATCH" },
];

// ─── DEMO SECTION COMPONENT ────────────────────────────────────────────────────
function DemoSection() {
  const [showMismatches, setShowMismatches] = useState(false);
  const [highlightedRow, setHighlightedRow] = useState(null);

  const mismatches = ENCOUNTER_TABLE.filter(r => r.status === "MISMATCH");
  const getRefDesc = (sys, code) => {
    const ref = REFERENCE_TABLE.find(r => r.code_system === sys && r.code === code);
    return ref ? ref.description : "—";
  };

  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={styles.sectionTitle}>
        <span style={styles.badge}>DEMO</span> Walkthrough
      </h2>
      <p style={styles.body}>
        Below are two tables: the <strong>reference terminology</strong> (trusted codes) and the
        <strong> encounter staging table</strong> (data from the EHR). Some encounters have a
        description that does <em>not</em> match the reference for the given code.
        The dbt test will join these tables and surface only the mismatches.
      </p>

      {/* Reference Table */}
      <h3 style={styles.subTitle}>ref_medical_codes (reference / seed)</h3>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>code_system</th>
              <th style={styles.th}>code</th>
              <th style={styles.th}>description</th>
            </tr>
          </thead>
          <tbody>
            {REFERENCE_TABLE.map((r, i) => (
              <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                <td style={styles.td}><span style={{...styles.pill, background: r.code_system === "ICD-10" ? "#1a5276" : "#7d3c98"}}>{r.code_system}</span></td>
                <td style={{...styles.td, fontFamily: "'IBM Plex Mono', monospace"}}>{r.code}</td>
                <td style={styles.td}>{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Encounter Table */}
      <h3 style={{...styles.subTitle, marginTop: 30}}>stg_encounters (staging model)</h3>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>encounter_id</th>
              <th style={styles.th}>code_system</th>
              <th style={styles.th}>code</th>
              <th style={styles.th}>description (from EHR)</th>
              <th style={styles.th}>expected description</th>
            </tr>
          </thead>
          <tbody>
            {ENCOUNTER_TABLE.map((r, i) => {
              const isBad = r.status === "MISMATCH";
              const rowBg = highlightedRow === i
                ? "rgba(231, 76, 60, 0.15)"
                : isBad && showMismatches
                ? "rgba(231, 76, 60, 0.08)"
                : i % 2 === 0
                ? "rgba(255,255,255,0.02)"
                : "rgba(255,255,255,0.06)";
              return (
                <tr
                  key={i}
                  style={{ background: rowBg, transition: "background 0.3s" }}
                  onMouseEnter={() => setHighlightedRow(i)}
                  onMouseLeave={() => setHighlightedRow(null)}
                >
                  <td style={{...styles.td, fontFamily: "'IBM Plex Mono', monospace"}}>{r.encounter_id}</td>
                  <td style={styles.td}>
                    <span style={{...styles.pill, background: r.code_system === "ICD-10" ? "#1a5276" : "#7d3c98"}}>{r.code_system}</span>
                  </td>
                  <td style={{...styles.td, fontFamily: "'IBM Plex Mono', monospace"}}>{r.code}</td>
                  <td style={{...styles.td, color: isBad && showMismatches ? "#e74c3c" : "#c5ccd3", fontWeight: isBad && showMismatches ? 600 : 400}}>
                    {r.description}
                    {isBad && showMismatches && <span style={styles.errBadge}>✗ MISMATCH</span>}
                  </td>
                  <td style={{...styles.td, color: "#58d68d"}}>{getRefDesc(r.code_system, r.code)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button onClick={() => setShowMismatches(!showMismatches)} style={styles.runBtn}>
        {showMismatches ? "Hide Mismatches" : "▶ Run dbt test (reveal mismatches)"}
      </button>

      {showMismatches && (
        <div style={styles.resultBox}>
          <h4 style={{ margin: "0 0 8px", color: "#e74c3c" }}>dbt test returned {mismatches.length} failing row(s):</h4>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
            {mismatches.map((m, i) => (
              <li key={i} style={{ color: "#ddd" }}>
                <strong>{m.encounter_id}</strong> — code <code style={styles.code}>{m.code}</code> ({m.code_system}) has description
                "<em style={{ color: "#e74c3c" }}>{m.description}</em>" but expected
                "<em style={{ color: "#58d68d" }}>{getRefDesc(m.code_system, m.code)}</em>"
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* SQL preview */}
      <h3 style={{...styles.subTitle, marginTop: 30}}>The dbt Singular Test SQL</h3>
      <pre style={styles.codeBlock}>{`-- tests/assert_encounter_description_matches_reference.sql
--
-- This dbt test returns rows where the encounter description
-- does NOT match the reference terminology table.
-- If any rows are returned, the test FAILS.

SELECT
    e.encounter_id,
    e.code_system,
    e.code,
    e.description   AS encounter_description,
    r.description   AS expected_description
FROM {{ ref('stg_encounters') }} AS e
LEFT JOIN {{ ref('ref_medical_codes') }} AS r
    ON  e.code_system = r.code_system
    AND e.code        = r.code
WHERE
    r.description IS NULL                -- code not in reference at all
    OR e.description <> r.description    -- description mismatch`}</pre>
    </div>
  );
}

// ─── QUIZ SECTION ──────────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    id: 1,
    type: "multiple_choice",
    prompt: "In dbt, a data test passes when the query returns _____ rows.",
    choices: ["Exactly 1 row", "Zero rows", "All rows from the model", "At least 5 rows"],
    answer: 1,
    explanation: "A dbt data test passes when the SQL query returns ZERO rows. Any rows returned represent failures."
  },
  {
    id: 2,
    type: "fill_blank",
    prompt: 'Complete the FROM clause:\n\nSELECT * FROM {{ _____(\'stg_encounters\') }}',
    answer: "ref",
    explanation: "The dbt Jinja function {{ ref('model_name') }} references another model and builds the DAG dependency."
  },
  {
    id: 3,
    type: "multiple_choice",
    prompt: "Which encounter has a MISMATCH?\n\nENC-002: CPT 93000 → \"Chest X-ray\"\nENC-005: CPT 99213 → \"Office visit, established patient, 20-29 min\"",
    choices: ["ENC-005", "ENC-002", "Both", "Neither"],
    answer: 1,
    explanation: "CPT 93000 is 'Electrocardiogram, routine ECG with at least 12 leads', NOT 'Chest X-ray'. ENC-002 is the mismatch."
  },
  {
    id: 4,
    type: "fill_blank",
    prompt: "ICD-10 code E11.9 maps to: \"Type 2 diabetes mellitus without ___________\"",
    answer: "complications",
    explanation: "E11.9 is 'Type 2 diabetes mellitus without complications'—one of the most commonly billed ICD-10 codes."
  },
  {
    id: 5,
    type: "multiple_choice",
    prompt: "Where should a dbt singular test SQL file be stored?",
    choices: ["models/", "tests/", "macros/", "seeds/"],
    answer: 1,
    explanation: "Singular tests are standalone .sql files placed in the tests/ directory of your dbt project."
  },
  {
    id: 6,
    type: "fill_blank",
    prompt: "Complete the WHERE clause to catch mismatches:\n\nWHERE r.description IS NULL\n   OR e.description _____ r.description",
    answer: "<>",
    altAnswers: ["!="],
    explanation: "The <> operator (or !=) checks for inequality. We want rows where the encounter description differs from the reference."
  },
  {
    id: 7,
    type: "multiple_choice",
    prompt: "CPT code 36415 corresponds to which procedure?",
    choices: ["Comprehensive metabolic panel", "Chest X-ray, 2 views", "Venipuncture (routine blood draw)", "Electrocardiogram"],
    answer: 2,
    explanation: "CPT 36415 is for venipuncture—the routine collection of venous blood by needle, commonly in outpatient settings."
  },
  {
    id: 8,
    type: "multiple_choice",
    prompt: "In a dbt project, reference/lookup data (like our medical codes table) is best stored as a:",
    choices: ["Snapshot", "Seed (CSV file)", "Source YAML", "Macro"],
    answer: 1,
    explanation: "dbt seeds are CSV files in the seeds/ directory that get loaded into the warehouse with `dbt seed`. Perfect for small, relatively static reference data."
  },
];

function QuizSection() {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [fillAnswer, setFillAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  const q = QUESTIONS[current];
  const isCorrect = q.type === "multiple_choice"
    ? selected === q.answer
    : (() => {
        const ans = fillAnswer.trim().toLowerCase();
        if (ans === q.answer.toLowerCase()) return true;
        if (q.altAnswers) return q.altAnswers.some(a => ans === a.toLowerCase());
        return false;
      })();

  const handleSubmit = () => {
    setSubmitted(true);
    if (isCorrect) setScore(s => s + 1);
  };

  const handleNext = () => {
    if (current < QUESTIONS.length - 1) {
      setCurrent(c => c + 1);
      setSelected(null);
      setFillAnswer("");
      setSubmitted(false);
      setShowHint(false);
    } else {
      setCompleted(true);
    }
  };

  if (completed) {
    const pct = Math.round((score / QUESTIONS.length) * 100);
    return (
      <div style={styles.quizCard}>
        <h2 style={{...styles.sectionTitle, textAlign: "center"}}>Tutorial Complete!</h2>
        <div style={{ textAlign: "center", fontSize: 48, margin: "20px 0", color: pct >= 70 ? "#58d68d" : "#e74c3c" }}>
          {score} / {QUESTIONS.length}
        </div>
        <p style={{ textAlign: "center", color: "#aab2bd", fontSize: 16 }}>
          {pct >= 70 ? "Great work! You understand dbt billing audits well." : "Review the demo section and try again to strengthen your understanding."}
        </p>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={() => { setCurrent(0); setSelected(null); setFillAnswer(""); setSubmitted(false); setShowHint(false); setScore(0); setCompleted(false); }} style={styles.runBtn}>
            Restart Quiz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.quizCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ color: "#7fb3d8", fontWeight: 600, fontSize: 14, letterSpacing: 1 }}>
          QUESTION {current + 1} / {QUESTIONS.length}
        </span>
        <span style={{ color: "#aab2bd", fontSize: 13 }}>Score: {score}</span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "#2c3e50", borderRadius: 2, marginBottom: 24 }}>
        <div style={{ height: 4, background: "linear-gradient(90deg, #3498db, #1abc9c)", borderRadius: 2, width: `${((current + 1) / QUESTIONS.length) * 100}%`, transition: "width 0.5s" }} />
      </div>

      <pre style={{ whiteSpace: "pre-wrap", color: "#ecf0f1", fontSize: 15, lineHeight: 1.6, margin: "0 0 20px", fontFamily: "'IBM Plex Mono', 'Fira Code', monospace" }}>
        {q.prompt}
      </pre>

      {q.type === "multiple_choice" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {q.choices.map((c, i) => {
            let bg = "rgba(52, 73, 94, 0.5)";
            let border = "1px solid rgba(127,179,216,0.15)";
            if (submitted) {
              if (i === q.answer) { bg = "rgba(88, 214, 141, 0.15)"; border = "1px solid #58d68d"; }
              else if (i === selected && !isCorrect) { bg = "rgba(231, 76, 60, 0.15)"; border = "1px solid #e74c3c"; }
            } else if (i === selected) {
              bg = "rgba(52, 152, 219, 0.2)"; border = "1px solid #3498db";
            }
            return (
              <button
                key={i}
                onClick={() => !submitted && setSelected(i)}
                style={{ background: bg, border, borderRadius: 8, padding: "12px 16px", color: "#ecf0f1", fontSize: 14, cursor: submitted ? "default" : "pointer", textAlign: "left", transition: "all 0.2s" }}
              >
                <span style={{ fontWeight: 600, marginRight: 10, color: "#7fb3d8" }}>{String.fromCharCode(65 + i)}.</span>
                {c}
              </button>
            );
          })}
        </div>
      ) : (
        <div>
          <input
            type="text"
            value={fillAnswer}
            onChange={e => !submitted && setFillAnswer(e.target.value)}
            placeholder="Type your answer..."
            style={{ width: "100%", boxSizing: "border-box", padding: "12px 16px", background: "rgba(52,73,94,0.5)", border: submitted ? (isCorrect ? "1px solid #58d68d" : "1px solid #e74c3c") : "1px solid rgba(127,179,216,0.2)", borderRadius: 8, color: "#ecf0f1", fontSize: 15, fontFamily: "'IBM Plex Mono', monospace", outline: "none" }}
          />
          {submitted && !isCorrect && (
            <p style={{ color: "#58d68d", fontSize: 13, marginTop: 8 }}>Correct answer: <code style={styles.code}>{q.answer}</code></p>
          )}
        </div>
      )}

      {submitted && (
        <div style={{ marginTop: 16, padding: 14, background: isCorrect ? "rgba(88,214,141,0.08)" : "rgba(231,76,60,0.08)", borderRadius: 8, borderLeft: `3px solid ${isCorrect ? "#58d68d" : "#e74c3c"}` }}>
          <p style={{ margin: 0, color: isCorrect ? "#58d68d" : "#e74c3c", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
            {isCorrect ? "✓ Correct!" : "✗ Incorrect"}
          </p>
          <p style={{ margin: 0, color: "#bdc3c7", fontSize: 13, lineHeight: 1.5 }}>{q.explanation}</p>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 20, justifyContent: "space-between" }}>
        {!submitted && (
          <button onClick={() => setShowHint(!showHint)} style={{ background: "none", border: "1px solid rgba(127,179,216,0.25)", borderRadius: 6, padding: "8px 16px", color: "#7fb3d8", fontSize: 13, cursor: "pointer" }}>
            {showHint ? "Hide Hint" : "I'm Stuck – Show Hint"}
          </button>
        )}
        <div style={{ flex: 1 }} />
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={q.type === "multiple_choice" ? selected === null : fillAnswer.trim() === ""}
            style={{ ...styles.runBtn, opacity: (q.type === "multiple_choice" ? selected === null : fillAnswer.trim() === "") ? 0.4 : 1, padding: "10px 28px" }}
          >
            Submit
          </button>
        ) : (
          <button onClick={handleNext} style={{ ...styles.runBtn, padding: "10px 28px" }}>
            {current < QUESTIONS.length - 1 ? "Next →" : "Finish"}
          </button>
        )}
      </div>

      {showHint && !submitted && (
        <div style={{ marginTop: 14, padding: 12, background: "rgba(52,152,219,0.08)", borderRadius: 8, borderLeft: "3px solid #3498db" }}>
          <p style={{ margin: 0, color: "#85c1e9", fontSize: 13, lineHeight: 1.5 }}>{q.explanation}</p>
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function DbtBillingAuditTutorial() {
  const [activeTab, setActiveTab] = useState("demo");

  return (
    <div style={styles.page}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <header style={styles.header}>
        <div style={styles.logoRow}>
          <div style={styles.dbtLogo}>dbt</div>
          <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 24, fontWeight: 300 }}>×</span>
          <span style={{ color: "#ecf0f1", fontSize: 18, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Healthcare Billing Audit</span>
        </div>
        <h1 style={styles.h1}>Medical Code ↔ Description<br />Mismatch Detection</h1>
        <p style={styles.subtitle}>
          A hands-on dbt tutorial: write SQL-based data tests that catch billing mismatches between
          CPT/ICD-10 codes and their descriptions in your EHR staging tables.
        </p>
      </header>

      {/* Tabs */}
      <div style={styles.tabRow}>
        <button
          onClick={() => setActiveTab("demo")}
          style={activeTab === "demo" ? styles.tabActive : styles.tab}
        >
          📖 Demo Walkthrough
        </button>
        <button
          onClick={() => setActiveTab("quiz")}
          style={activeTab === "quiz" ? styles.tabActive : styles.tab}
        >
          ✏️ Interactive Quiz
        </button>
      </div>

      <div style={styles.content}>
        {activeTab === "demo" ? <DemoSection /> : <QuizSection />}
      </div>

      <footer style={styles.footer}>
        <p>dbt Billing Audit Tutorial — Built for Healthcare Data Engineers</p>
      </footer>
    </div>
  );
}

// ─── STYLES ────────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(170deg, #0c1929 0%, #1a2740 40%, #1c2e45 100%)",
    color: "#ecf0f1",
    fontFamily: "'DM Sans', sans-serif",
    padding: 0,
  },
  header: {
    padding: "48px 32px 36px",
    textAlign: "center",
    borderBottom: "1px solid rgba(127,179,216,0.1)",
    background: "radial-gradient(ellipse at 50% 0%, rgba(52,152,219,0.08), transparent 70%)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginBottom: 20,
  },
  dbtLogo: {
    background: "linear-gradient(135deg, #ff694a, #e6522c)",
    color: "#fff",
    fontWeight: 700,
    fontSize: 18,
    padding: "6px 16px",
    borderRadius: 8,
    fontFamily: "'IBM Plex Mono', monospace",
    letterSpacing: 1,
  },
  h1: {
    fontSize: 32,
    fontWeight: 700,
    lineHeight: 1.2,
    margin: "0 0 14px",
    background: "linear-gradient(135deg, #ecf0f1, #7fb3d8)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: {
    color: "#8899aa",
    fontSize: 15,
    maxWidth: 620,
    margin: "0 auto",
    lineHeight: 1.6,
  },
  tabRow: {
    display: "flex",
    justifyContent: "center",
    gap: 8,
    padding: "24px 16px 0",
  },
  tab: {
    background: "rgba(44, 62, 80, 0.5)",
    border: "1px solid rgba(127,179,216,0.12)",
    borderRadius: "8px 8px 0 0",
    padding: "12px 28px",
    color: "#7f8c8d",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  tabActive: {
    background: "rgba(52,152,219,0.12)",
    border: "1px solid rgba(52,152,219,0.3)",
    borderBottom: "2px solid #3498db",
    borderRadius: "8px 8px 0 0",
    padding: "12px 28px",
    color: "#ecf0f1",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  content: {
    maxWidth: 960,
    margin: "0 auto",
    padding: "32px 24px",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#ecf0f1",
    marginBottom: 12,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "#7fb3d8",
    marginBottom: 10,
    fontFamily: "'IBM Plex Mono', monospace",
  },
  badge: {
    background: "linear-gradient(135deg, #ff694a, #e6522c)",
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 4,
    marginRight: 10,
    verticalAlign: "middle",
    letterSpacing: 1,
  },
  body: {
    color: "#aab2bd",
    fontSize: 14,
    lineHeight: 1.7,
    marginBottom: 24,
  },
  tableWrap: {
    overflowX: "auto",
    borderRadius: 10,
    border: "1px solid rgba(127,179,216,0.12)",
    background: "rgba(12, 25, 41, 0.6)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    textAlign: "left",
    padding: "10px 14px",
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#7fb3d8",
    borderBottom: "1px solid rgba(127,179,216,0.15)",
    background: "rgba(44,62,80,0.4)",
  },
  td: {
    padding: "10px 14px",
    borderBottom: "1px solid rgba(127,179,216,0.06)",
    color: "#c5ccd3",
    fontSize: 13,
  },
  trEven: { background: "rgba(255,255,255,0.02)" },
  trOdd: { background: "rgba(255,255,255,0.05)" },
  pill: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    color: "#fff",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.5,
  },
  errBadge: {
    display: "inline-block",
    marginLeft: 8,
    padding: "1px 7px",
    borderRadius: 4,
    background: "rgba(231,76,60,0.2)",
    color: "#e74c3c",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  runBtn: {
    marginTop: 16,
    padding: "12px 32px",
    background: "linear-gradient(135deg, #e6522c, #ff694a)",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    transition: "transform 0.15s, box-shadow 0.15s",
    boxShadow: "0 2px 12px rgba(230,82,44,0.3)",
  },
  resultBox: {
    marginTop: 20,
    padding: 20,
    background: "rgba(231,76,60,0.06)",
    border: "1px solid rgba(231,76,60,0.2)",
    borderRadius: 10,
  },
  code: {
    fontFamily: "'IBM Plex Mono', monospace",
    background: "rgba(52,152,219,0.15)",
    padding: "2px 6px",
    borderRadius: 4,
    fontSize: 13,
    color: "#85c1e9",
  },
  codeBlock: {
    background: "rgba(12, 25, 41, 0.8)",
    border: "1px solid rgba(127,179,216,0.12)",
    borderRadius: 10,
    padding: 20,
    fontSize: 13,
    lineHeight: 1.6,
    color: "#85c1e9",
    fontFamily: "'IBM Plex Mono', monospace",
    overflowX: "auto",
    whiteSpace: "pre",
  },
  quizCard: {
    background: "rgba(44, 62, 80, 0.3)",
    border: "1px solid rgba(127,179,216,0.12)",
    borderRadius: 14,
    padding: 28,
  },
  footer: {
    textAlign: "center",
    padding: "32px 16px",
    borderTop: "1px solid rgba(127,179,216,0.08)",
    color: "#566573",
    fontSize: 12,
  },
};
