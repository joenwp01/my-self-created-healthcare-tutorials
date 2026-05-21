# dbt Healthcare Tutorial v2 — Design Specification

**Project codename:** `dbt-hc-v2`
**Format:** Single-file HTML, self-contained, no build step, no server dependency
**Status:** Design locked — ready for build
**Author:** Joe Williams
**Spec version:** 1.0 (2026-05-20)

---

## 1. Purpose & Scope

A single-file, browser-runnable, healthcare-themed tutorial covering the full dbt modeling lifecycle (sources → seeds → staging → intermediate → marts → tests → macros → incremental → snapshots). It replaces and enhances `dbt_healthcare_modeling_tutorial.html`. The pedagogical model is borrowed from the HL7 v2 tutorial suite: **journey tabs** carry difficulty progression, **stations** carry topic progression, and **Before / After panels** make each transformation step concrete.

**Audience.** Self-learners with working SQL fluency who are new to dbt's abstractions. Beginner journey assumes they can write a SELECT but have not used Jinja templating or run `dbt build`. Intermediate journey assumes they have completed Beginner.

**Scope at launch.** 11 stations × 2 journeys (Beginner, Intermediate). Third journey reserved but not authored.

**Non-goals.** Cards library is intentionally omitted. Live message parser is intentionally omitted (HL7-specific; not relevant here). A "Live SQL Console" floating panel is a candidate for a future enhancement but is not in v1 scope.

---

## 2. Aesthetic Direction

Inherits the HL7 v2 palette directly. Dark theme with deep blue surfaces and a single warm gold/amber accent (`#e5a832`). Each station has its own technique color used in pipeline pills, lecture badges, and tech tags — colors chosen to be distinct yet harmonious on the dark surface. Typography pairs Crimson Pro (serif headings), DM Sans (sans body), and JetBrains Mono (code).

No purple-on-white gradients. No generic system fonts. The visual identity should be unmistakably the same family as the HL7 v2 suite — if a learner opens both apps, they should feel they are in the same teaching universe.

---

## 3. Architecture Overview

**One file, three layers.**

1. **Static layer:** HTML structure (header, journey bar, pipeline bar, main content slots, modals, floating panels) and CSS (palette tokens, layout, all component styles).
2. **Data layer:** Three JavaScript objects — `JOURNEYS`, `STATIONS`, `GLOSSARY`. All UI state derives from these.
3. **Behavior layer:** Render functions (lecture, before/after, task, ack, explanation), navigation (journey switch, station switch, next-station progression), sql.js runner, modal openers, Ask AI panel, DEMO panel, localStorage persistence.

**Journey-as-difficulty.** Switching the journey tab re-renders the current station with its `journeys.J1` or `journeys.J2` content variant. The station ID, pipeline-bar position, and DEMO content stay the same; only the lecture text, Before/After panels, and tasks differ.

**Future J3 readiness.** Every place that hardcodes `J1` or `J2` as a key is replaced by iteration over `JOURNEYS`. The journey-tab CSS reserves space for a third tab. Adding J3 in the future requires authoring content for each station under a `journeys.J3` key — no structural code changes.

---

## 4. Locked Design Tokens

All values below are final. Build copies these verbatim into `:root`.

### 4.1 Colors

```css
/* Surfaces */
--bg:#0a0f1a;
--surface:#111827;
--surface-raised:#1a2332;
--surface-inset:#070b14;
--border:#1e2d45;
--border-accent:#2d4a6e;
--border-focus:#4a90d9;

/* Text */
--text:#e2e8f0;
--text-muted:#94a3b8;
--text-dim:#475569;

/* Brand accent (gold/amber) */
--accent:#e5a832;
--accent-glow:rgba(229,168,50,.1);
--accent-dim:#b8862a;

/* Semantic */
--green:#34d399; --green-bg:rgba(52,211,153,.08);
--red:#f87171; --red-bg:rgba(248,113,113,.08);
--orange:#fb923c; --orange-bg:rgba(251,146,60,.08);
--blue:#60a5fa; --blue-bg:rgba(96,165,250,.08);
--purple:#a78bfa; --purple-bg:rgba(167,139,250,.08);
--cyan:#22d3ee; --cyan-bg:rgba(34,211,238,.08);

/* Station technique colors (used in pipeline pills, tech tags) */
--c-src:#60a5fa;       /* sources */
--c-seed:#34d399;      /* seeds */
--c-test-builtin:#fb923c; /* built-in tests */
--c-stage:#a78bfa;     /* staging */
--c-int:#22d3ee;       /* intermediate */
--c-mart:#f472b6;      /* marts */
--c-test-singular:#fbbf24; /* singular tests */
--c-test-generic:#2dd4bf; /* generic test macros */
--c-dag:#38bdf8;       /* full DAG / dbt build */
--c-incr:#c084fc;      /* incremental */
--c-snap:#e879f9;      /* snapshots */
```

### 4.2 Typography

```css
--mono:'JetBrains Mono',monospace;
--serif:'Crimson Pro',Georgia,serif;
--sans:'DM Sans',system-ui,sans-serif;
```

Google Fonts URL (single `<link>` in `<head>`):

```
https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap
```

### 4.3 Geometry

```css
--radius:8px;
--radius-lg:12px;
--max-width:1100px;
```

---

## 5. Locked Data Schema

This is the single most load-bearing section of the spec. **No station authoring may add columns or tables.** If a station needs data not represented here, the gap is logged and the schema is amended before the build proceeds.

### 5.1 Cohort design

Ten patients across two facilities (PNW-Central, PNW-East), encounters dated March 2026, deliberately seeded with the dirty data needed to make tests meaningful: null codes, mismatched descriptions, preliminary vs final coding statuses, an invalid ICD-10 code (`ZZZZZ`), a draft procedure, and patient address changes for snapshot demonstration.

### 5.2 sql.js loader

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js"></script>
```

```js
async function initDB() {
  try {
    const SQL = await initSqlJs({
      locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}`
    });
    db = new SQL.Database();
    seedDatabase();
    setDbStatus('ready');
  } catch (e) {
    setDbStatus('error');
    console.error(e);
  }
}
```

### 5.3 Full seed SQL

```sql
-- ═══════════════ RAW SOURCE TABLES ═══════════════

CREATE TABLE raw_patients (
  patient_id TEXT PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  date_of_birth TEXT,
  gender TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  updated_at TEXT
);

INSERT INTO raw_patients VALUES
('P-101','Maria','Garcia','1962-04-12','F','Seattle','WA','98101','2026-03-15T08:00:00'),
('P-102','James','Morrison','1958-11-03','M','Bellevue','WA','98004','2026-03-16T09:15:00'),
('P-103','Aisha','Washington','1997-02-14','F','Renton','WA','98055','2026-03-15T10:30:00'),
('P-104','Robert','Kowalski','1971-07-22','M','Tacoma','WA','98402','2026-03-16T11:00:00'),
('P-105','Linda','Chen','1985-09-08','F','Seattle','WA','98109','2026-03-16T13:45:00'),
('P-106','Carlos','Vasquez','1943-12-30','M','Kent','WA','98030','2026-03-17T08:30:00'),
('P-107','Priya','Patel','1990-06-17','F','Redmond','WA','98052','2026-03-17T09:00:00'),
('P-108','Thomas','Anderson','1978-03-25','M','Bothell','WA','98011','2026-03-17T14:20:00'),
('P-109','Sarah','Kim','2003-08-11','F','Seattle','WA','98115','2026-03-18T10:00:00'),
('P-110','David','Nguyen','1965-01-04','M','Federal Way','WA','98003','2026-03-18T15:30:00');

CREATE TABLE raw_encounters (
  encounter_id TEXT PRIMARY KEY,
  patient_id TEXT,
  facility_code TEXT,
  encounter_date TEXT,
  encounter_type TEXT,
  provider_id TEXT,
  updated_at TEXT
);

INSERT INTO raw_encounters VALUES
('ENC-001','P-101','PNW-CENTRAL','2026-03-15','office_visit','DR-101','2026-03-15T16:00:00'),
('ENC-002','P-102','PNW-CENTRAL','2026-03-15','office_visit','DR-102','2026-03-15T16:30:00'),
('ENC-003','P-103','PNW-CENTRAL','2026-03-15','urgent_care','DR-103','2026-03-15T18:00:00'),
('ENC-004','P-101','PNW-CENTRAL','2026-03-16','office_visit','DR-101','2026-03-16T15:00:00'),
('ENC-005','P-104','PNW-CENTRAL','2026-03-16','office_visit','DR-104','2026-03-16T16:00:00'),
('ENC-006','P-105','PNW-CENTRAL','2026-03-16','lab_only','DR-102','2026-03-16T13:00:00'),
('ENC-007','P-102','PNW-EAST','2026-03-16','office_visit','DR-201','2026-03-16T17:00:00'),
('ENC-008','P-106','PNW-CENTRAL','2026-03-17','office_visit','DR-103','2026-03-17T10:00:00'),
('ENC-009','P-103','PNW-CENTRAL','2026-03-17','follow_up','DR-101','2026-03-17T11:30:00'),
('ENC-010','P-107','PNW-CENTRAL','2026-03-17','office_visit','DR-104','2026-03-17T14:00:00'),
('ENC-011','P-108','PNW-EAST','2026-03-17','office_visit','DR-201','2026-03-17T15:00:00'),
('ENC-012','P-109','PNW-CENTRAL','2026-03-18','urgent_care','DR-103','2026-03-18T19:00:00'),
('ENC-013','P-110','PNW-CENTRAL','2026-03-18','office_visit','DR-102','2026-03-18T16:30:00');

CREATE TABLE raw_diagnoses (
  diag_id INTEGER PRIMARY KEY,
  encounter_id TEXT,
  code_system TEXT,
  code TEXT,
  description TEXT,
  coding_status TEXT,
  updated_at TEXT
);

INSERT INTO raw_diagnoses VALUES
(1,'ENC-001','ICD-10','E11.9','Type 2 diabetes mellitus without complications','final','2026-03-15T16:30:00'),
(2,'ENC-002','ICD-10','I10','Essential (primary) hypertension','final','2026-03-15T17:00:00'),
(3,'ENC-003','ICD-10',NULL,'Anxiety disorder, unspecified','final','2026-03-15T18:30:00'),
(4,'ENC-003','ICD-10','J069','Acute upper respiratory infection','final','2026-03-15T18:30:00'),
(5,'ENC-004','ICD-10','M54.5',NULL,'final','2026-03-16T15:30:00'),
(6,'ENC-005','ICD-10','E78.5','Hyperlipidemia, unspecified','preliminary','2026-03-16T16:30:00'),
(7,'ENC-006','ICD-10','F41.9','Anxiety disorder, unspecified','final','2026-03-16T13:30:00'),
(8,'ENC-007','ICD-10','E11.65','Type 2 DM with hyperglycemia','final','2026-03-16T17:30:00'),
(9,'ENC-008','ICD-10','ZZZZZ','Unknown condition','final','2026-03-17T10:30:00'),
(10,'ENC-009','ICD-10','I10','Essential (primary) hypertension','final','2026-03-17T12:00:00'),
(11,'ENC-010','ICD-10','G43.909','Migraine, unspecified','final','2026-03-17T14:30:00'),
(12,'ENC-004','ICD-10','N18.3','Chronic kidney disease, stage 3','preliminary','2026-03-16T15:45:00'),
(13,'ENC-011','ICD-10','J45.909','Unspecified asthma, uncomplicated','final','2026-03-17T15:30:00'),
(14,'ENC-012','ICD-10','S52.501A','Unspecified fracture of lower end of right radius','final','2026-03-18T19:30:00'),
(15,'ENC-013','ICD-10','I10','Essential hypertension','final','2026-03-18T17:00:00');

CREATE TABLE raw_procedures (
  proc_id INTEGER PRIMARY KEY,
  encounter_id TEXT,
  cpt_code TEXT,
  description TEXT,
  status TEXT,
  updated_at TEXT
);

INSERT INTO raw_procedures VALUES
(1,'ENC-001','99213','Office visit, est patient, level 3','completed','2026-03-15T16:30:00'),
(2,'ENC-002','99214','Office visit, est patient, level 4','completed','2026-03-15T17:00:00'),
(3,'ENC-003',NULL,'Lab draw','completed','2026-03-15T18:30:00'),
(4,'ENC-003','85260','Urinalysis with microscopy','completed','2026-03-15T18:30:00'),
(5,'ENC-005','71046','Chest x-ray, two views','completed','2026-03-16T16:30:00'),
(6,'ENC-006','80053','Comprehensive metabolic panel','completed','2026-03-16T13:30:00'),
(7,'ENC-007','99213','Office visit, est patient, level 3','completed','2026-03-16T17:30:00'),
(8,'ENC-008','36415','Venipuncture','draft','2026-03-17T10:30:00'),
(9,'ENC-009','99213','Office visit, est patient, level 3','completed','2026-03-17T12:00:00'),
(10,'ENC-010','93000','Electrocardiogram, routine ECG','completed','2026-03-17T14:30:00'),
(11,'ENC-011','94640','Pressurized inhalation treatment','completed','2026-03-17T15:30:00'),
(12,'ENC-012','73090','X-ray of forearm, two views','completed','2026-03-18T19:30:00'),
(13,'ENC-013','99214','Office visit, est patient, level 4','completed','2026-03-18T17:00:00');

CREATE TABLE raw_lab_results (
  result_id INTEGER PRIMARY KEY,
  encounter_id TEXT,
  loinc_code TEXT,
  result_value REAL,
  result_unit TEXT,
  ref_range_low REAL,
  ref_range_high REAL,
  abnormal_flag TEXT,
  result_status TEXT
);

INSERT INTO raw_lab_results VALUES
(1,'ENC-006','2345-7',187.0,'mg/dL',70,99,'H','final'),
(2,'ENC-006','2093-3',245.0,'mg/dL',0,200,'H','final'),
(3,'ENC-006','2160-0',1.1,'mg/dL',0.6,1.2,'N','final'),
(4,'ENC-003','6690-2',12.4,'10*3/uL',4.5,11.0,'H','final'),
(5,'ENC-012','2160-0',0.9,'mg/dL',0.6,1.2,'N','final');

-- ═══════════════ SEED REFERENCE TABLES ═══════════════

CREATE TABLE ref_icd10_codes (
  code_system TEXT,
  code TEXT,
  description TEXT,
  category TEXT
);

INSERT INTO ref_icd10_codes VALUES
('ICD-10','E11.9','Type 2 diabetes mellitus without complications','Endocrine'),
('ICD-10','E11.65','Type 2 diabetes mellitus with hyperglycemia','Endocrine'),
('ICD-10','I10','Essential (primary) hypertension','Circulatory'),
('ICD-10','J06.9','Acute upper respiratory infection, unspecified','Respiratory'),
('ICD-10','J45.909','Unspecified asthma, uncomplicated','Respiratory'),
('ICD-10','M54.5','Low back pain','Musculoskeletal'),
('ICD-10','E78.5','Hyperlipidemia, unspecified','Endocrine'),
('ICD-10','F41.9','Anxiety disorder, unspecified','Mental'),
('ICD-10','G43.909','Migraine, unspecified, not intractable','Neurological'),
('ICD-10','N18.3','Chronic kidney disease, stage 3 (moderate)','Genitourinary'),
('ICD-10','S52.501A','Unspecified fracture of lower end of right radius, initial encounter','Injury');

CREATE TABLE ref_cpt_codes (
  code_system TEXT,
  code TEXT,
  description TEXT,
  category TEXT
);

INSERT INTO ref_cpt_codes VALUES
('CPT','99213','Office visit, established patient, 20-29 min','E&M'),
('CPT','99214','Office visit, established patient, 30-39 min','E&M'),
('CPT','93000','Electrocardiogram, routine ECG with at least 12 leads','Diagnostic'),
('CPT','36415','Collection of venous blood by venipuncture','Lab'),
('CPT','80053','Comprehensive metabolic panel','Lab'),
('CPT','85260','Urinalysis with microscopy','Lab'),
('CPT','71046','Chest X-ray, 2 views','Imaging'),
('CPT','73090','Radiologic examination, forearm, 2 views','Imaging'),
('CPT','94640','Pressurized or nonpressurized inhalation treatment','Respiratory');

CREATE TABLE ref_facilities (
  facility_code TEXT PRIMARY KEY,
  facility_name TEXT,
  region TEXT,
  facility_type TEXT
);

INSERT INTO ref_facilities VALUES
('PNW-CENTRAL','Pacific Northwest Central Clinic','Seattle Metro','Primary Care'),
('PNW-EAST','Pacific Northwest Eastside','Eastside','Primary Care');

-- ═══════════════ SNAPSHOT HISTORY (for S11) ═══════════════

CREATE TABLE snap_patient_address (
  patient_id TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  dbt_valid_from TEXT,
  dbt_valid_to TEXT,
  dbt_is_current INTEGER
);

INSERT INTO snap_patient_address VALUES
('P-101','Tacoma','WA','98402','2024-01-01T00:00:00','2025-08-15T00:00:00',0),
('P-101','Seattle','WA','98101','2025-08-15T00:00:00',NULL,1),
('P-105','Bellevue','WA','98004','2023-06-01T00:00:00','2026-01-10T00:00:00',0),
('P-105','Seattle','WA','98109','2026-01-10T00:00:00',NULL,1),
('P-108','Bothell','WA','98011','2022-03-15T00:00:00',NULL,1);
```

### 5.4 Why these particular dirty rows exist

| Row | Dirt | Used by station(s) |
|---|---|---|
| Dx 3: NULL code | demonstrates `not_null` test | S3 |
| Dx 5: NULL description | demonstrates `not_null` on description | S3 |
| Dx 9: `ZZZZZ` invalid code | demonstrates singular test failure | S7, S9 |
| Dx 4: `J069` (no period) vs ref `J06.9` | demonstrates mismatch + GEM-style cleanup | S7 |
| Dx 6, Dx 12: `preliminary` status | filter in intermediate model | S5 |
| Proc 3: NULL CPT | demonstrates `not_null` | S3 |
| Proc 8: status `draft` | filter in intermediate model | S5 |
| Dx 15: `I10` desc differs slightly from ref | demonstrates fuzzy mismatch | S7 |
| Patient P-101, P-105 address changes | SCD Type 2 demonstration | S11 |
| All `updated_at` timestamps | incremental filter demonstration | S10 |

---

## 6. Station Map (11 stations)

| # | Station | Tech tags | Beginner (J1) focus | Intermediate (J2) focus |
|---|---|---|---|---|
| 1 | Sources & `source()` | src, mod | Read raw table directly, understand `{{ source() }}` Jinja → compiled SQL | Multi-source project, source freshness, source descriptions in `schema.yml` |
| 2 | Seeds & reference data | seed, mod | Load reference codes via `dbt seed`, query with `ref()` | Seed configuration (column types, quoting, delimiter), versioning seeds in git |
| 3 | Built-in tests | test-builtin, src | `not_null`, `unique`, `accepted_values` declared in `schema.yml` | `relationships` test, severity (warn vs error), per-column custom failure thresholds |
| 4 | Staging models | stage, mod | Column renaming/aliasing, light type casting in `stg_*.sql` | Materialization choice (view vs table), `{{ config() }}` overrides, source-level grain enforcement |
| 5 | Intermediate joins with `ref()` | int, ref, jnj | Join staged encounters + diagnoses, filter preliminary | Multi-way joins with lab results, CTE-vs-subquery readability, late-binding views |
| 6 | Aggregate marts | mart, ref | Diagnoses per patient, encounters per facility | Per-patient-per-month grain, window functions for cohort counts, mart naming conventions |
| 7 | Singular tests | test-singular, ref, sed | `tests/assert_*.sql` returning bad rows, description-mismatch detection | Multi-condition singular test, parameterized via Jinja variables in the test file |
| 8 | Generic test macros | test-generic | Convert singular test to `{% test %}` macro in `tests/generic/` | Macro with required + optional arguments, calling the generic test from `schema.yml` |
| 9 | Full DAG / `dbt build` | dag, ref, sed | Sources → staging → mart → test in one query, understand `dbt build` order | Failure propagation (warn vs error), `--select` and `--exclude` for partial builds |
| 10 | Incremental models | incr, mod | `materialized='incremental'`, `is_incremental()` macro, `updated_at` filter | Late-arriving data handling, `unique_key`, full-refresh strategy, merge vs delete+insert |
| 11 | Snapshots (SCD Type 2) | snap, ref | `dbt snapshot`, the `dbt_valid_from` / `dbt_valid_to` / `dbt_is_current` columns | Check strategy vs timestamp strategy, hard-deletes invalidation, snapshot meta columns |

Station numbering is fixed. Pipeline-bar pills are rendered in this order. Each station's `id` is its number; the `slug` is the lowercase short form (`'sources'`, `'seeds'`, ..., `'snapshots'`).

---

## 7. Data Model: JOURNEYS, STATIONS, GLOSSARY

### 7.1 `JOURNEYS` object

```js
const JOURNEYS = {
  J1: { code:'J1', label:'Beginner', shortLabel:'BEG', accentVar:'--green' },
  J2: { code:'J2', label:'Intermediate', shortLabel:'INT', accentVar:'--orange' }
  // J3 (Advanced) reserved — add when authored:
  // J3: { code:'J3', label:'Advanced', shortLabel:'ADV', accentVar:'--red' }
};
```

Render code MUST iterate `Object.keys(JOURNEYS)` rather than referencing `J1`/`J2` literals.

### 7.2 `STATIONS` array shape

```js
const STATIONS = [
  {
    id: 1,
    slug: 'sources',
    name: 'Sources & source()',
    shortName: 'Sources',
    icon: '📥',
    colorVar: '--c-src',
    techs: ['src','mod'],
    demo: {
      title: 'Worked Example — source() to Compiled SQL',
      intro: '...',
      sql: '...syntax-highlighted HTML...',
      runnableSQL: '...raw SQL for live run...',
      steps: [
        { title:'...', text:'...' },
        // 2–4 steps total
      ]
    },
    journeys: {
      J1: {
        lecture: '<h2>...</h2><div class="concept"><p>...</p></div>',
        before: { type:'sql-source'|'jinja'|'table', content: function|string },
        after:  { type:'table'|'compiled-sql', content: function|string },
        tasks: [
          {
            type: 'fill' | 'choice',
            prompt: '...',
            // for 'fill': display, blanks[], hint, explanation, expectedSQL
            // for 'choice': options[], hint, explanation
          }
        ]
      },
      J2: { /* same shape, different content */ }
    }
  },
  // ... 10 more stations
];
```

### 7.3 `GLOSSARY` object

Flat `{ term: definition }`. Sorted alphabetically at render time. See § 12 for content.

---

## 8. UI Components

### 8.1 Header & Journey Tabs

Header strip with gradient (matching HL7 v2 header: `linear-gradient(135deg,#0d1929 0%,#142038 50%,#0f1a2e 100%)`), 2px bottom border in `--accent`. Left: project title "dbt × Healthcare" in Crimson Pro 26px, gold pipe motif separator, subtitle "From Sources to Snapshots" in DM Sans 13px muted. Right: "Developed by: Joe Williams" in JetBrains Mono 11px dim.

Below header: `.journey-bar` containing one `.journey-tab` per journey in `JOURNEYS`, plus a spacer, then 📖 Glossary and ↺ Reset buttons. Active tab shows accent color, inactive shows dim. Tabs are 8px × 20px, mono font, uppercase, with a small `j-label` showing the label.

### 8.2 Station Pipeline Bar

Sticky `top:0`, full-width, horizontally scrolling, backdrop-blur(12px), 1px bottom border. Renders one `.stn-pill` per station from `STATIONS`, with an arrow separator between pills. Each pill: mono 10px, rounded 20px, 5px×12px padding, shows station number + short name, colored according to `colorVar`. States: default (dim), `.active` (accent border + glow), `.done` (green border + green ✓ prefix).

### 8.3 Lecture Panel

`.lecture` card, surface bg, `--radius-lg`, 28×32 padding. Each station's `journeys[Jx].lecture` HTML is injected. Contains `<h2>` with a `<span class="stn-badge">` showing "Station N", followed by a `.concept` block of paragraphs. Concept text uses Crimson Pro for emphasis, code styling via the locked code rule (`--mono` 12px, accent color, surface-inset background).

### 8.4 Before/After Panels

Two-column grid (`grid-template-columns:1fr 1fr`, gap 16px, stacks at <768px). Each `.ba-panel` has a header strip with mono uppercase letterspaced title — Before in orange, After in green — and a scrollable content area, max-height 360px.

**Adaptation for dbt content.** The `before` and `after` objects each carry a `type` discriminator that the renderer dispatches on:

- `type:'sql-source'` → render runnable SQL of a raw table, then auto-execute via sql.js, show result table.
- `type:'jinja'` → render dbt model file with Jinja templating, syntax-highlighted.
- `type:'compiled-sql'` → render the same content as `jinja` but with `{{ source() }}` / `{{ ref() }}` calls expanded to actual table names, plus auto-executed result table.
- `type:'table'` → render an inline reference/lookup table (used for code-system reference panels).
- `type:'html'` → render arbitrary HTML, used sparingly.

The renderer is a single switch statement; all five types share the same outer chrome.

### 8.5 Task Panel

`.task-panel` card below the BA grid. Renders the active task from `journeys[Jx].tasks[currentTaskIdx]`. Task types and their UI:

- **`fill`** — Renders prompt, optional display (with `???` placeholder), then `.fill-code` block with `<input>` blanks. On `Enter` or "Check Answer", validates each blank against `answer` + `accept[]` array. Correct blanks turn green; wrong shake red.
- **`choice`** — Renders prompt, then list of `.opt-row` rows (one per option). Click selects; "Check Answer" reveals correctness.

Each task carries `hint` (revealed on Hint button) and `explanation` (revealed after correct answer or Reveal). For multi-task stations, "Next Task" advances within the station; "Next Station →" advances to S+1.

### 8.6 Action Bar

Below task panel: left side has 📖 Glossary (duplicated for ergonomic access). Right side: 💡 Hint, 👁 Reveal, "Next Station →" (disabled until task complete or revealed).

### 8.7 Scorecard

Fixed bottom-right, small surface card with three rows: Completed (e.g., "3/11"), Hints used, Reveals used. Updates live from localStorage state.

### 8.8 DEMO Panel (30% / 60% expandable)

```html
<button class="demo-badge" onclick="openDemo(stationId)">▶ DEMO</button>

<aside class="demo-panel" id="demoPanel">
  <div class="demo-header">
    <h3 id="demoTitle"></h3>
    <button class="demo-expand" onclick="toggleDemoSize()" title="Expand">↔</button>
    <button class="demo-close" onclick="closeDemo()">×</button>
  </div>
  <div class="demo-body" id="demoBody"></div>
</aside>
```

Positioned `position:fixed; top:0; right:0; height:100vh`. Width transitions: `width:30vw` → click expand → `width:60vw` → click again → `width:30vw`. Transition: `transition: width .25s ease, transform .25s ease`. Off-screen state: `transform:translateX(100%)`. On-screen state: `transform:translateX(0)`. Internal `.demo-body` scrolls; `overflow-y:auto`.

Demo content renders the station's `demo` object: title bar, intro paragraph in `.intro-box`, syntax-highlighted SQL in `.sample-code`, step cards (each with `<h5>` + `<p>`), and a "▶ Run Sample" button that pushes `runnableSQL` through sql.js and renders results inline within the panel.

**Trigger placement:** the DEMO badge sits at the **right edge of the lecture's `<h2>` station header**, so it's always one click away regardless of which task is active. Z-index of panel: 200 (above pipeline bar but below modals).

### 8.9 Glossary Modal

Identical mechanism to HL7 v2: `.modal-overlay` covers viewport, `.modal` centers, `.modal-header` with title + ×, `.modal-body` with a `<dl>` of sorted `GLOSSARY` entries. Term styling: mono semibold accent. Definition: sans muted.

### 8.10 Ask AI Panel (Civil 3D pattern)

**Floating trigger:** right gutter, fixed-position, anchored just above vertical center (top: 45vh), 40% reduced size from a notional 100px square = roughly 60×40 pill. Icon 🤖, conn-dot indicator (green = online, red = offline) keyed off `navigator.onLine`. Below Glossary if stacked vertically.

```html
<button class="ask-ai-fab" onclick="openAiChat()" title="Ask AI Tutor">
  <span class="icon">🤖</span>
  <span class="conn-dot online" id="aiConnDot"></span>
  <span class="label">Ask AI</span>
</button>
```

**Chat modal structure:**

```html
<div class="ai-chat-overlay" id="aiChatOverlay" onclick="if(event.target===this)closeAiChat()">
  <div class="ai-chat-modal">
    <div class="ai-chat-header">
      <h3>🤖 dbt Tutor</h3>
      <div class="ai-chat-header-actions">
        <button onclick="toggleAiSettings()">⚙ Settings</button>
        <button onclick="clearAiChat()">🗑 Clear Context</button>
        <button class="ai-chat-close" onclick="closeAiChat()">×</button>
      </div>
    </div>
    <div class="ai-settings-panel" id="aiSettingsPanel" style="display:none">
      <div class="field-group">
        <label>API Endpoint URL</label>
        <input type="url" id="aiSettEndpoint" placeholder="https://api.anthropic.com/v1/messages">
        <div class="field-hint">Default: Anthropic Messages API. Change for a local proxy.</div>
      </div>
      <div class="field-group">
        <label>Model</label>
        <input type="text" id="aiSettModel" placeholder="claude-sonnet-4-20250514">
      </div>
      <div class="field-group">
        <label>API Key</label>
        <input type="password" id="aiSettKey" placeholder="sk-ant-...">
        <div class="field-hint">Stored locally in this browser's localStorage. Not needed inside Claude artifacts.</div>
      </div>
      <div class="security-note">⚠ Your API key is stored locally only. Never transmitted to any server other than the endpoint above.</div>
    </div>
    <div class="ai-context-toggle">
      <label><input type="checkbox" id="aiIncludeContext" checked>
      Include current station context in question</label>
    </div>
    <div class="ai-chat-thread" id="aiChatThread"></div>
    <div class="ai-chat-input-row">
      <textarea id="aiChatInput" rows="3" placeholder="Ask about this station..."></textarea>
      <button class="ai-send" onclick="sendAiMessage()">Send</button>
    </div>
  </div>
</div>
```

**Defaults persisted to localStorage under `dbtHc2.ai.*`:**

- `dbtHc2.ai.endpoint` (default `https://api.anthropic.com/v1/messages`)
- `dbtHc2.ai.model` (default `claude-sonnet-4-20250514`)
- `dbtHc2.ai.key` (default empty)
- `dbtHc2.ai.history` (JSON array of `{role, content}` pairs, capped at last 50 messages)
- `dbtHc2.ai.includeContext` (boolean, default `true`)

**Send-message function (skeleton):**

```js
async function sendAiMessage(){
  const ep = document.getElementById('aiSettEndpoint').value || DEFAULT_ENDPOINT;
  const model = document.getElementById('aiSettModel').value || DEFAULT_MODEL;
  const key = document.getElementById('aiSettKey').value;
  const userText = document.getElementById('aiChatInput').value.trim();
  if(!userText) return;

  const includeContext = document.getElementById('aiIncludeContext').checked;
  let promptText = userText;
  if(includeContext && currentStation){
    const ctx = stripHtml(currentStation.journeys[currentJourney].lecture);
    promptText = `Context (current station):\n${ctx}\n\nQuestion: ${userText}`;
  }

  appendAiMessage('user', userText);
  document.getElementById('aiChatInput').value = '';

  try {
    const headers = { 'Content-Type':'application/json', 'anthropic-version':'2023-06-01' };
    if(key) headers['x-api-key'] = key;
    const res = await fetch(ep, {
      method:'POST',
      headers,
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{role:'user', content: promptText}]
      })
    });
    const data = await res.json();
    const text = (data.content||[]).map(c => c.text||'').join('\n');
    appendAiMessage('assistant', text || '[empty response]');
  } catch(e){
    appendAiMessage('assistant', `[error] ${e.message}`);
  }
}
```

**Inside Claude artifacts:** the `x-api-key` header is omitted when key is empty; artifact-context auth is transparent.

---

## 9. Reference Station: S1 — Sources

### 9.1 Station metadata

```js
{
  id: 1, slug:'sources', name:'Sources & source()', shortName:'Sources', icon:'📥',
  colorVar:'--c-src', techs:['src','mod'],
  demo: { /* see § 9.4 */ },
  journeys: { J1:{...}, J2:{...} }
}
```

### 9.2 J1 (Beginner) content

**Lecture HTML:**

```html
<h2><span class="stn-badge">Station 1</span> Sources & the source() Function</h2>
<div class="concept">
<p><strong>Raw tables live outside dbt.</strong> Your warehouse already has tables loaded by Fivetran, Airbyte, or a homegrown ingestion job — <code>raw_encounters</code>, <code>raw_diagnoses</code>, and so on. dbt does not own these tables; it only reads from them. To make dbt aware of them, you declare each one as a <strong>source</strong> in a YAML file.</p>
<p><strong>The source() function turns a YAML declaration into a SQL reference.</strong> Once <code>raw_encounters</code> is declared under <code>sources.ehr_raw</code>, you write <code>{{ source('ehr_raw', 'encounters') }}</code> in any model. At compile time, dbt expands this to the fully-qualified table name (<code>ehr_raw.raw_encounters</code> or whatever the schema is configured to). Two things happen simultaneously: the SQL is resolved, and a lineage edge is recorded so the dbt DAG knows this model depends on that source.</p>
<p><strong>Why bother?</strong> Three reasons. First, the YAML declaration is a single source of truth — change the schema name in one place and every model picks it up. Second, you can attach metadata: descriptions, column types, owners, freshness expectations. Third, declared sources become tested entities — you can put <code>not_null</code> on <code>encounter_id</code> in the source YAML and dbt will check it whenever you run <code>dbt test --select source:*</code>.</p>
</div>
```

**Before panel** (`type:'jinja'`):

```sql
-- models/staging/stg_encounters.sql

SELECT
    encounter_id,
    patient_id,
    facility_code,
    encounter_date,
    encounter_type
FROM {{ source('ehr_raw', 'encounters') }}
WHERE encounter_date >= '2026-03-15'
ORDER BY encounter_date, encounter_id
```

**After panel** (`type:'compiled-sql'`, auto-executed):

```sql
-- Compiled by dbt — Jinja resolved to actual schema.table
SELECT
    encounter_id,
    patient_id,
    facility_code,
    encounter_date,
    encounter_type
FROM raw_encounters
WHERE encounter_date >= '2026-03-15'
ORDER BY encounter_date, encounter_id
```

Result panel renders the 13 encounter rows from sql.js execution.

**Tasks (J1) — two tasks for this station:**

Task 1 (choice):
- Prompt: "What does `{{ source('ehr_raw', 'encounters') }}` compile to at runtime?"
- Options:
  - A: The literal string `source('ehr_raw', 'encounters')` (wrong)
  - B: The fully-qualified table name like `ehr_raw.raw_encounters` (correct)
  - C: A Python function call (wrong)
  - D: A CTE alias inside the model (wrong)
- Hint: "dbt is a SQL templating tool — Jinja calls get expanded into SQL strings before the query runs."
- Explanation: "`{{ source() }}` is a Jinja function that dbt resolves at compile time. It looks up the source declaration in `sources.yml`, finds the configured schema and table name, and substitutes the actual SQL identifier. The model file you write contains Jinja; the SQL that runs in your warehouse contains identifiers."

Task 2 (fill):
- Prompt: "Complete the staging model so it reads from the declared source. The source key is `ehr_raw` and the source name is `encounters`."
- Display:
```sql
SELECT * FROM {{ ___1___('___2___', '___3___') }}
```
- Blanks:
  - `{label:'function', answer:'source', accept:['source']}`
  - `{label:'source key', answer:'ehr_raw', accept:['ehr_raw']}`
  - `{label:'source name', answer:'encounters', accept:['encounters']}`
- Hint: "The function name matches the YAML section header — `sources:` — and is singular."
- Explanation: "`source()` takes exactly two arguments: the source key (the top-level `name:` under `sources:` in YAML) and the table name (the `name:` under `tables:`). Both are strings. Returns a SQL identifier."

### 9.3 J2 (Intermediate) content

**Lecture HTML:**

```html
<h2><span class="stn-badge">Station 1</span> Sources — Multi-Source Projects & Freshness</h2>
<div class="concept">
<p><strong>Real projects have many sources.</strong> An analytics warehouse ingests from EHR, claims, lab vendors, scheduling, billing — each is a separate source in dbt. Each gets its own block under <code>sources:</code> in YAML, with its own schema, its own freshness expectations, and its own loader metadata. Naming convention: source key matches the upstream system (<code>ehr_raw</code>, <code>claims_837</code>, <code>lab_quest</code>), table names match the physical tables (without prefix-stripping).</p>
<p><strong>Source freshness</strong> is a dbt feature that monitors when each source table was last updated. You add a <code>loaded_at_field</code> (typically an <code>updated_at</code> column) and configure <code>warn_after</code> and <code>error_after</code> thresholds. Running <code>dbt source freshness</code> queries the source, computes how long since the most recent row, and emits a warning or error if the threshold is exceeded. This catches stalled ingestion pipelines before downstream models silently serve stale data.</p>
<p><strong>Source descriptions and column docs</strong> turn the YAML into living documentation. <code>dbt docs generate</code> renders a navigable site showing every source, every column, every test, every dependent model — discoverability that scales with the team. Source declarations are the only place column-level descriptions for raw tables can live; everything downstream is derived.</p>
</div>
```

**Before panel** (`type:'jinja'`): an excerpt of the YAML source declaration with freshness config.

```yaml
# models/sources.yml
sources:
  - name: ehr_raw
    schema: ehr_raw
    description: "Epic-derived raw extracts, refreshed every 4 hours"
    tables:
      - name: encounters
        description: "One row per patient-provider interaction"
        loaded_at_field: updated_at
        freshness:
          warn_after: { count: 6, period: hour }
          error_after: { count: 12, period: hour }
        columns:
          - name: encounter_id
            description: "Primary key"
            tests: [unique, not_null]
```

**After panel** (`type:'compiled-sql'`, auto-executed):

```sql
-- Generated by `dbt source freshness` for ehr_raw.encounters
SELECT
    MAX(updated_at) AS max_loaded_at,
    CAST((julianday('now') - julianday(MAX(updated_at))) * 24 AS INTEGER) AS hours_since_load,
    CASE
        WHEN (julianday('now') - julianday(MAX(updated_at))) * 24 > 12 THEN 'ERROR'
        WHEN (julianday('now') - julianday(MAX(updated_at))) * 24 > 6 THEN 'WARN'
        ELSE 'PASS'
    END AS freshness_status
FROM raw_encounters
```

**Tasks (J2):**

Task 1 (choice):
- Prompt: "A source declaration has `warn_after: { count: 6, period: hour }` and `error_after: { count: 12, period: hour }`. The most recent `updated_at` in the source is 8 hours ago. What does `dbt source freshness` report?"
- Options:
  - A: PASS (wrong — past warn threshold)
  - B: WARN (correct — past 6 hours, not yet 12)
  - C: ERROR (wrong — not yet past 12 hours)
  - D: SKIP (wrong — freshness ran)
- Hint: "Compare 8 to each threshold. WARN fires *at or past* warn_after; ERROR fires *at or past* error_after."
- Explanation: "Freshness status is determined by the most recent row's age relative to two thresholds. 8 hours > 6 (warn) but < 12 (error), so the result is WARN. The build doesn't fail, but a notification is emitted. ERROR would fail the build if `dbt build` ran a freshness check beforehand."

Task 2 (fill):
- Prompt: "Add a freshness config to this source. Warn after 4 hours, error after 8 hours, using `updated_at` as the load timestamp."
- Display:
```yaml
- name: encounters
  ___1___: updated_at
  ___2___:
    warn_after: { count: ___3___, period: ___4___ }
    error_after: { count: ___5___, period: ___6___ }
```
- Blanks: `loaded_at_field`, `freshness`, `4`, `hour`, `8`, `hour`.

### 9.4 DEMO content (shared across J1 and J2)

```js
demo: {
  title: 'Worked Example — source() Compilation',
  intro: 'A complete walkthrough: declare a source in YAML, reference it in a model, see what dbt compiles it to, then run the compiled SQL against the warehouse.',
  sql: `<span class="cmt">-- sources.yml declares the raw table</span>
<span class="cmt">-- (not SQL — YAML, shown here for context)</span>
sources:
  - name: ehr_raw
    schema: ehr_raw
    tables:
      - name: encounters

<span class="cmt">-- models/staging/stg_encounters.sql</span>
<span class="kw">SELECT</span>
    encounter_id,
    patient_id,
    facility_code,
    encounter_date
<span class="kw">FROM</span> {{ source('ehr_raw', 'encounters') }}

<span class="cmt">-- Compiled by dbt:</span>
<span class="kw">SELECT</span>
    encounter_id,
    patient_id,
    facility_code,
    encounter_date
<span class="kw">FROM</span> raw_encounters`,
  runnableSQL: "SELECT encounter_id, patient_id, facility_code, encounter_date FROM raw_encounters",
  steps: [
    { title:'Declaration first', text:'Sources are declared in <code>sources.yml</code> before any model can reference them. The declaration is the single source of truth for the schema and table name.' },
    { title:'Jinja → SQL', text:'<code>{{ source(...) }}</code> is a Jinja function call. dbt resolves it at compile time, replacing the Jinja with the actual SQL identifier. The compiled SQL goes to the warehouse; the Jinja never does.' },
    { title:'Lineage as a side effect', text:'Every <code>source()</code> call adds an edge to the dbt DAG. Run <code>dbt docs generate</code> and you can navigate from this model back to its source declaration visually.' },
    { title:'No source(), no test', text:'Tests on source columns (declared in the same YAML) only run if the source is referenced via <code>source()</code> at least once in the project. An unreferenced source is invisible to <code>dbt test</code>.' }
  ]
}
```

---

## 10. Reference Station: S7 — Singular Tests

### 10.1 Station metadata

```js
{
  id: 7, slug:'singular-tests', name:'Singular Tests', shortName:'Singular',
  icon:'🧪', colorVar:'--c-test-singular', techs:['test-singular','ref','sed'],
  demo: { /* see § 10.4 */ },
  journeys: { J1:{...}, J2:{...} }
}
```

### 10.2 J1 (Beginner) content

**Lecture HTML:**

```html
<h2><span class="stn-badge">Station 7</span> Singular Tests — One File, One Question</h2>
<div class="concept">
<p><strong>A test passes when zero rows come back.</strong> This is the core dbt test philosophy. You write a SQL query that describes what <em>bad</em> data looks like. When the query runs and returns no rows, every row in the warehouse satisfies your invariant. When it returns rows, those are the failing rows — and the test fails.</p>
<p><strong>Singular tests are standalone files</strong> in the <code>tests/</code> directory. One file = one test = one question about the data. The file is just a SQL SELECT, no Jinja required (though Jinja is allowed — <code>{{ ref() }}</code> is common). Naming convention: <code>assert_&lt;what_must_be_true&gt;.sql</code>, for example <code>assert_diagnosis_code_matches_reference.sql</code>.</p>
<p>Riverside's EHR has <code>raw_diagnoses</code> rows where the human-typed description doesn't match the official ICD-10 reference. Some are typos, some are abbreviated, some are stale text from before a code was updated. A singular test catches these by LEFT JOINing the diagnoses against the reference seed and returning every row where the descriptions diverge.</p>
</div>
```

**Before panel** (`type:'jinja'`, the test file):

```sql
-- tests/assert_diagnosis_desc_matches_ref.sql
SELECT
    d.diag_id,
    d.code,
    d.description   AS ehr_description,
    r.description   AS expected_description
FROM {{ ref('stg_diagnoses') }} AS d
LEFT JOIN {{ ref('ref_icd10_codes') }} AS r
    ON d.code = r.code
WHERE d.code IS NOT NULL
  AND r.description IS NOT NULL
  AND d.description <> r.description
```

**After panel** (`type:'compiled-sql'`, auto-executed):

```sql
SELECT
    d.diag_id, d.code,
    d.description AS ehr_description,
    r.description AS expected_description
FROM raw_diagnoses d
LEFT JOIN ref_icd10_codes r ON d.code = r.code
WHERE d.code IS NOT NULL
  AND r.description IS NOT NULL
  AND d.description <> r.description
```

Expected output: at least one row (Dx 15: `I10`, `Essential hypertension` vs ref `Essential (primary) hypertension`).

**Tasks (J1):**

Task 1 (choice):
- Prompt: "A singular test SQL file returns 4 rows. What does dbt report when this test runs?"
- Options:
  - A: PASS (wrong)
  - B: FAIL, with 4 failing rows (correct)
  - C: WARN (wrong — singular tests have severity error by default)
  - D: SKIP (wrong)
- Hint: "Singular tests pass when zero rows come back. Any rows means the test found violations."
- Explanation: "Singular tests fail by default when ≥1 row is returned. The 4 returned rows are the failure evidence — dbt records them in the run results and (depending on `--store-failures` config) optionally persists them to a table for inspection. Test severity can be changed to `warn` in the test file with a config block at the top."

Task 2 (fill):
- Prompt: "Complete the singular test to find diagnoses whose code does not exist in the reference seed."
- Display:
```sql
SELECT d.diag_id, d.code
FROM {{ ___1___('stg_diagnoses') }} d
___2___ JOIN {{ ref('___3___') }} r
    ON d.code = r.code
WHERE d.code IS NOT NULL
  AND r.code IS ___4___
```
- Blanks: `ref`, `LEFT`, `ref_icd10_codes`, `NULL`.
- Hint: "The pattern is: keep all rows from the left side, fail to match on the right, and filter for the unmatched ones."
- Explanation: "`LEFT JOIN` keeps all `stg_diagnoses` rows. When the join finds no match, `r.code` is NULL. Filtering `WHERE r.code IS NULL AND d.code IS NOT NULL` returns diagnoses whose code wasn't in the reference. In our seed, `Dx 9 = 'ZZZZZ'` would fail this test."

### 10.3 J2 (Intermediate) content

**Lecture HTML:**

```html
<h2><span class="stn-badge">Station 7</span> Singular Tests — Multi-Condition & Parameterized</h2>
<div class="concept">
<p><strong>Most real singular tests check several invariants at once</strong> — not "is the code valid" but "is the code valid AND the description sane AND the timestamp not in the future AND the status one of the allowed values." Each invariant is a clause in the WHERE; the test fails if any row violates any of them.</p>
<p><strong>Severity and threshold configs</strong> let a singular test tolerate small amounts of dirt. A config block at the top of the test file — <code>{{ config(severity='warn', warn_if='>10', error_if='>100') }}</code> — turns a binary pass/fail into a graduated threshold: 0–10 violations = pass, 11–100 = warn, 101+ = error.</p>
<p><strong>Jinja variables make tests parameterized.</strong> Instead of hardcoding <code>'preliminary'</code> as the disallowed status, the test reads <code>{{ var('forbidden_status', 'preliminary') }}</code>. Now the test is reusable: any project that sets <code>vars: forbidden_status: 'draft'</code> in <code>dbt_project.yml</code> gets the same test logic with its own forbidden value.</p>
</div>
```

**Before panel** (`type:'jinja'`):

```sql
-- tests/assert_diagnosis_quality.sql
{{ config(severity='warn', warn_if='>0', error_if='>5') }}

SELECT
    d.diag_id,
    d.code,
    d.description,
    d.coding_status,
    'invalid_code'      AS violation_type
FROM {{ ref('stg_diagnoses') }} d
LEFT JOIN {{ ref('ref_icd10_codes') }} r ON d.code = r.code
WHERE d.code IS NOT NULL AND r.code IS NULL

UNION ALL

SELECT
    d.diag_id, d.code, d.description, d.coding_status,
    'mismatched_description' AS violation_type
FROM {{ ref('stg_diagnoses') }} d
JOIN {{ ref('ref_icd10_codes') }} r ON d.code = r.code
WHERE d.description <> r.description

UNION ALL

SELECT
    d.diag_id, d.code, d.description, d.coding_status,
    'still_preliminary' AS violation_type
FROM {{ ref('stg_diagnoses') }} d
WHERE d.coding_status = '{{ var("forbidden_status", "preliminary") }}'
```

**After panel** (`type:'compiled-sql'`):

```sql
SELECT d.diag_id, d.code, d.description, d.coding_status,
    'invalid_code' AS violation_type
FROM raw_diagnoses d
LEFT JOIN ref_icd10_codes r ON d.code = r.code
WHERE d.code IS NOT NULL AND r.code IS NULL
UNION ALL
SELECT d.diag_id, d.code, d.description, d.coding_status,
    'mismatched_description' AS violation_type
FROM raw_diagnoses d
JOIN ref_icd10_codes r ON d.code = r.code
WHERE d.description <> r.description
UNION ALL
SELECT d.diag_id, d.code, d.description, d.coding_status,
    'still_preliminary' AS violation_type
FROM raw_diagnoses d
WHERE d.coding_status = 'preliminary'
```

**Tasks (J2):**

Task 1 (choice):
- Prompt: "A multi-condition singular test has `{{ config(severity='warn', warn_if='>0', error_if='>5') }}`. It returns 3 rows. What is the outcome?"
- Options:
  - A: PASS (wrong)
  - B: WARN (correct — past 0, not past 5)
  - C: ERROR (wrong — would need >5 rows)
  - D: ERROR with auto-rollback (wrong)
- Hint: "The thresholds work like freshness in Station 1: 0 is the warn line, 5 is the error line. Three rows lands between them."
- Explanation: "Severity thresholds let a test be permissive about small amounts of dirt while blocking the pipeline when dirt accumulates. 3 violations crosses warn but not error — the run continues, but the warning shows up in `dbt build` output and any CI dashboard."

Task 2 (fill):
- Prompt: "Parameterize this test so the forbidden coding status defaults to `preliminary` but can be overridden via project vars."
- Display:
```sql
SELECT diag_id, coding_status
FROM {{ ref('stg_diagnoses') }}
WHERE coding_status = '{{ ___1___('___2___', '___3___') }}'
```
- Blanks: `var`, `forbidden_status`, `preliminary`.
- Hint: "Jinja's `var()` takes a variable name and a default — same shape as `source()`."
- Explanation: "`{{ var('forbidden_status', 'preliminary') }}` reads from `dbt_project.yml` → `vars: forbidden_status: ...`. If the var is not set, the default `'preliminary'` is used. This makes the test portable across projects with different conventions."

### 10.4 DEMO content (shared)

```js
demo: {
  title: 'Worked Example — Singular Test Against Reference',
  intro: 'A complete singular test that finds diagnosis codes whose EHR-typed descriptions disagree with the ICD-10 reference. The test passes when zero rows return; rows mean dirt.',
  sql: `<span class="cmt">-- tests/assert_diagnosis_desc_matches_ref.sql</span>

<span class="kw">SELECT</span>
    d.diag_id,
    d.code,
    d.description   <span class="kw">AS</span> ehr_description,
    r.description   <span class="kw">AS</span> expected_description
<span class="kw">FROM</span> raw_diagnoses d
<span class="kw">LEFT JOIN</span> ref_icd10_codes r <span class="kw">ON</span> d.code = r.code
<span class="kw">WHERE</span> d.code <span class="kw">IS NOT NULL</span>
  <span class="kw">AND</span> r.description <span class="kw">IS NOT NULL</span>
  <span class="kw">AND</span> d.description <> r.description`,
  runnableSQL: "SELECT d.diag_id, d.code, d.description AS ehr_description, r.description AS expected_description FROM raw_diagnoses d LEFT JOIN ref_icd10_codes r ON d.code = r.code WHERE d.code IS NOT NULL AND r.description IS NOT NULL AND d.description <> r.description",
  steps: [
    { title:'Zero rows = pass', text:'This is dbt\'s test contract. The query describes failures; absence of failures is success. Inverted from most testing frameworks.' },
    { title:'LEFT JOIN to find missing matches', text:'<code>LEFT JOIN</code> keeps every diagnosis. The <code>r.description IS NOT NULL</code> filter excludes codes that aren\'t in the reference at all (those are a separate test). The <code>&lt;&gt;</code> catches the actual mismatches.' },
    { title:'Riverside-specific finding', text:'In our seeded data, Dx 15 has <code>I10</code> with the description <em>"Essential hypertension"</em>, but the reference says <em>"Essential (primary) hypertension"</em>. Close, but not equal. The test surfaces it.' },
    { title:'From singular to generic', text:'When you want to run this same logic across multiple tables (different code systems, different reference seeds), convert it to a generic test macro — covered in Station 8.' }
  ]
}
```

---

## 11. Remaining Stations: Outlines

Each outline is a paragraph or two. The build phase authors full content following the S1/S7 pattern.

**S2 — Seeds & reference data.** Seeds are CSV files in `data/` (or `seeds/`) that `dbt seed` loads into the warehouse as tables. Referenced via `{{ ref('ref_icd10_codes') }}` just like models. J1 focuses on loading and querying a seed (basic SELECT against `ref_icd10_codes`, perhaps a simple JOIN with raw_diagnoses to enrich code descriptions). J2 covers seed configuration: `seeds.+column_types`, `quote_columns`, `delimiter`, and the choice between checking seeds into git versus dynamic loading. Demo: a code-enrichment join.

**S3 — Built-in tests.** dbt's four built-in tests: `not_null`, `unique`, `accepted_values`, `relationships`, declared inline in `schema.yml`. J1 walks through declaring `not_null` on `encounter_id`, `unique` on the same, `accepted_values` on `coding_status` (`['preliminary','final','amended']`). J2 covers `relationships` (referential integrity between encounters and patients), severity overrides (`severity: warn`), and `where` clauses to scope tests to subsets. Demo: a `schema.yml` snippet plus the SQL dbt generates for each test (each is a singular-test-shaped query).

**S4 — Staging models.** The `stg_` prefix convention. Thin SELECT layer that renames columns to project conventions (`facility_code` → `facility_id`), casts types (`encounter_date::date`), and lightly cleans (TRIM, NULLIF). No business logic, no joins beyond what's needed for normalization. J1: write a staging model for encounters with column aliasing. J2: `{{ config(materialized='view') }}` vs `table`, why staging is almost always `view`, and the `int_` prefix as the place business logic begins. Demo: a full `stg_encounters.sql` with side-by-side raw and staged output.

**S5 — Intermediate joins with `ref()`.** The `int_` prefix. Joins staged models to produce reshape-ready data. J1: join `stg_encounters` + `stg_diagnoses`, filter `coding_status = 'final'`. J2: three-way join with lab results, use CTEs for readability, distinguish `ref()` (model-to-model) from `source()` (raw-to-model). Demo: encounter + final diagnoses + procedures joined into one wide row per encounter.

**S6 — Aggregate marts.** The `fct_` / `dim_` / `agg_` prefixes. Marts are the consumer-facing layer. J1: per-patient diagnosis counts, per-facility encounter counts. J2: per-patient-per-month grain using window functions, naming conventions, the principle that one mart serves one business question. Demo: a fact table of encounters with attached dimension columns.

**S8 — Generic test macros.** The `{% test test_name(model, column) %}` macro definition. J1: convert S7's singular test into a generic `assert_matches_reference` test that takes a `model` and a `column` plus a `reference_model` and `reference_column` argument; call it from `schema.yml`. J2: optional macro arguments with defaults, calling the same macro with different parameter sets across multiple models, the macro-namespace import (`{{ project_name.macro_name(...) }}`). Demo: macro definition file + schema.yml invocation + the SQL dbt generates from the call.

**S9 — Full DAG / `dbt build`.** The integrated lifecycle: `dbt seed` → `dbt run` → `dbt test`, orchestrated by `dbt build`. J1: a single complete pipeline — source through staging through intermediate through mart, plus one test — represented as a CTE chain in a single runnable SQL. J2: failure propagation (a failing test halts downstream models), `--select` and `--exclude` for partial builds (`dbt build --select +int_encounter_diagnoses+`), the `state:modified` and `result:error` selectors. Demo: a multi-step CTE simulation of `dbt build` with a FAIL outcome row at the end.

**S10 — Incremental models.** `{{ config(materialized='incremental', unique_key='encounter_id') }}` plus the `{% if is_incremental() %}` block. J1: the basic incremental pattern — filter `WHERE updated_at > (SELECT MAX(updated_at) FROM {{ this }})` on subsequent runs, full-scan on first run. J2: late-arriving data, `unique_key` for upserts, `merge` vs `delete+insert` strategies, `full-refresh` and when to use it. Demo: simulate two runs — a first full load, then an incremental run with two new rows — and show the merge result.

**S11 — Snapshots (SCD Type 2).** `dbt snapshot` captures slowly-changing dimension history. J1: configure a snapshot on `patient_address` using `strategy='timestamp'` and `updated_at` column; see how `dbt_valid_from` / `dbt_valid_to` / `dbt_is_current` columns are populated. J2: `strategy='check'` for tables without reliable timestamps, hard-deletes invalidation (`invalidate_hard_deletes=true`), querying point-in-time (`WHERE dbt_valid_from <= '2025-09-01' AND (dbt_valid_to > '2025-09-01' OR dbt_valid_to IS NULL)`). Demo: query against `snap_patient_address` showing P-101's address history with valid_from / valid_to / is_current columns.

---

## 12. Glossary Content

```js
const GLOSSARY = {
  'accepted_values': 'Built-in dbt test that asserts a column contains only values from a specified list.',
  'CDC': 'Change Data Capture — pattern for incrementally pulling only the rows that changed since the last load.',
  'CPT': 'Current Procedural Terminology — AMA-maintained code set for medical procedures.',
  'compile': 'dbt step that converts Jinja-templated SQL into pure SQL ready to run in the warehouse.',
  'CTE': 'Common Table Expression — a named subquery introduced with WITH, often used for readability inside dbt models.',
  'DAG': 'Directed Acyclic Graph — the dependency graph dbt builds from ref() and source() calls.',
  'dbt': 'Data Build Tool — open-source framework for transforming data in the warehouse using SQL + Jinja.',
  'dbt build': 'Orchestration command that runs seeds, models, snapshots, and tests in dependency order.',
  'dbt run': 'Command that compiles and executes models (but not tests or snapshots).',
  'dbt seed': 'Command that loads CSV files from the seeds directory into the warehouse as tables.',
  'dbt test': 'Command that runs all configured tests (built-in and singular) and reports pass/fail.',
  'dbt_valid_from': 'Snapshot column recording when a row version became active.',
  'dbt_valid_to': 'Snapshot column recording when a row version was superseded; NULL for current rows.',
  'dbt_is_current': 'Snapshot column flagging the active row version (1) vs historical (0).',
  'EHR': 'Electronic Health Record — clinical system of record (Epic, Cerner, Athena, etc.).',
  'fact table': 'A mart-layer table grain-keyed to a business event (encounter, claim, lab result).',
  'fct_ prefix': 'Convention for fact tables in the marts layer.',
  'freshness': 'dbt feature that monitors when each source table was last updated and warns/errors on staleness.',
  'generic test': 'A reusable test defined as a Jinja macro in tests/generic/, callable from schema.yml.',
  'GEM': 'General Equivalence Mappings — CMS-maintained crosswalk between ICD-9 and ICD-10.',
  'grain': 'The level of detail in a table — one row per what? (patient, patient-month, encounter, etc.)',
  'ICD-10': 'International Classification of Diseases, 10th revision — code set for diagnoses.',
  'incremental': 'A dbt materialization that processes only new or changed rows on subsequent runs.',
  'int_ prefix': 'Convention for intermediate models that join and reshape staged data.',
  'is_incremental()': 'Jinja macro that returns true after the first run, enabling conditional filtering for incremental loads.',
  'Jinja': 'Templating language Python-based, used by dbt to inject SQL with variables, functions, and control flow.',
  'late-binding view': 'A view that does not lock its source table schema at creation; useful when sources may change.',
  'LOINC': 'Logical Observation Identifiers Names and Codes — code set for lab and clinical observations.',
  'macro': 'A reusable Jinja function defined in macros/, callable from any model or test.',
  'manifest.json': 'dbt-generated artifact describing every node in the project (models, tests, sources, exposures).',
  'mart': 'The consumer-facing layer of dbt — fact and dimension tables that BI tools query.',
  'materialization': 'How dbt persists a model: view, table, incremental, ephemeral, or snapshot.',
  'merge strategy': 'Incremental strategy that issues a MERGE statement to upsert new rows by unique_key.',
  'model': 'A SQL SELECT statement saved as a .sql file under models/, materialized by dbt run.',
  'not_null': 'Built-in test that asserts a column has no NULL values.',
  'preliminary': 'Coding status indicating a diagnosis has been entered but not yet finalized by a coder.',
  'ref()': 'Jinja function that references another dbt model, resolving to its compiled table name and adding a DAG edge.',
  'relationships test': 'Built-in test that asserts every value in column A exists in column B of another model.',
  'SCD Type 2': 'Slowly Changing Dimension pattern that keeps a history of value changes via valid_from/valid_to rows.',
  'schema.yml': 'YAML file that declares column descriptions, tests, and metadata for models and sources.',
  'seed': 'A CSV file under seeds/ that dbt loads into the warehouse as a table via dbt seed.',
  'severity': 'Test config that determines whether a failure produces a warning or an error.',
  'singular test': 'A standalone .sql file in tests/ that fails when it returns any rows.',
  'snapshot': 'dbt feature for capturing slowly-changing dimension history via dbt snapshot.',
  'source()': 'Jinja function that references a declared raw table, resolving to its schema.table identifier and adding a DAG edge.',
  'sources.yml': 'YAML file that declares external raw tables for dbt to reference and test.',
  'stg_ prefix': 'Convention for staging models that lightly clean and rename raw source columns.',
  'unique test': 'Built-in test that asserts a column has no duplicate values.',
  'unique_key': 'Incremental model config specifying the column(s) that uniquely identify a row for upserts.',
  'updated_at': 'Convention for the timestamp column that records when a source row was last modified; used by incremental and freshness.',
  'USCDI': 'United States Core Data for Interoperability — ONC-defined minimum data set for health IT.',
  'var()': 'Jinja function that reads a project variable from dbt_project.yml, with an optional default.'
};
```

50 entries. Sorted alphabetically by the modal renderer.

---

## 13. localStorage Schema

All keys namespaced under `dbtHc2.*`.

| Key | Type | Purpose |
|---|---|---|
| `dbtHc2.progress.completedStations` | JSON array of `{journey:'J1', stationId:1}` | Pipeline-pill done state |
| `dbtHc2.progress.hintsUsed` | integer | Scorecard counter |
| `dbtHc2.progress.revealsUsed` | integer | Scorecard counter |
| `dbtHc2.nav.currentJourney` | string (`J1`/`J2`) | Active journey on load |
| `dbtHc2.nav.currentStationId` | integer | Active station on load |
| `dbtHc2.ai.endpoint` | string URL | Ask AI endpoint setting |
| `dbtHc2.ai.model` | string | Ask AI model name |
| `dbtHc2.ai.key` | string | Ask AI API key (local only) |
| `dbtHc2.ai.includeContext` | boolean string | Include station context toggle |
| `dbtHc2.ai.history` | JSON array `[{role, content}]` | Chat thread, capped at 50 messages |

Reset button (in journey bar) clears all `dbtHc2.progress.*` and `dbtHc2.nav.*` keys; leaves `dbtHc2.ai.*` intact.

---

## 14. Build Cadence Checklist

Six-turn budget after this spec turn:

**Turn 1 — Scaffold + S1/S2.** HTML skeleton, full CSS (palette + layout), seed schema, JOURNEYS / STATIONS / GLOSSARY object framework, journey switcher, pipeline-bar renderer, lecture renderer, BA renderer (all five types), task renderer (fill + choice), action bar, scorecard, localStorage persistence, Glossary modal, Ask AI floating button + modal + send function, DEMO panel mechanism. Station 1 (Sources) fully authored for J1+J2. Station 2 (Seeds) fully authored for J1+J2. Smoke-test the journey switch, station nav, fill input validation, DEMO open/expand/close, Ask AI modal open.

**Turn 2 — S3, S4, S5.** Three stations × 2 journeys = 6 content variants + 3 demos. Smoke-test the runnableSQL on every demo and every after-panel. Confirm Before/After type dispatch works for `jinja`, `compiled-sql`, and `table`.

**Turn 3 — S6, S7, S8.** Three more stations. S7 already specified in § 10. S8 macro stations introduce the `{% test %}` syntax — make sure the syntax highlighter handles `{% ... %}` blocks correctly.

**Turn 4 — S9, S10, S11.** Final three stations. S10 (incremental) and S11 (snapshots) are the trickiest — they require simulating multi-run behavior in a single sql.js query, typically via UNION ALL chains or `WITH ... AS` chains that explicitly enumerate the state at each point in time.

**Turn 5 — Polish + smoke testing.** Visual regression check (does every station render without layout breaks?), Ask AI live test, Glossary completeness, scorecard accuracy, localStorage reset cleanliness, pipeline-bar overflow on narrow viewports, DEMO panel keyboard accessibility (Esc to close).

**Turn 6 — Final corrections + present_files.** Address any issues from Turn 5 review. Final file in `/mnt/user-data/outputs/dbt_hc_v2.html`. Call `present_files`.

If a turn runs short, the next station group rolls forward. If a turn runs long, work pauses cleanly at a station boundary — never mid-station.

---

## 15. Future J3 (Advanced) Readiness

When J3 is added later, the only required changes are:

1. Add `J3: { code:'J3', label:'Advanced', shortLabel:'ADV', accentVar:'--red' }` to `JOURNEYS`.
2. For each station in `STATIONS`, add a `journeys.J3: { lecture, before, after, tasks }` block.
3. Optionally add J3-specific glossary entries (`exposures`, `dbt_project.yml`, `manifest.json`, `Python models`, `Materialized views`, etc.).

No structural code changes. No CSS changes (J3 tab already has reserved space). No localStorage migration. The renderer's `Object.keys(JOURNEYS).forEach(...)` loops pick it up automatically.

Topic candidates for J3 (deferred, not part of this spec):
- Sources: source freshness alerting integration (Slack, PagerDuty)
- Seeds: large-seed strategies and the `dbt seed` vs `dbt run` trade-off
- Tests: Great Expectations integration, `dbt-expectations` package
- Staging: dbt-utils macros (`generate_surrogate_key`, `deduplicate`)
- Intermediate: dimensional modeling patterns (Kimball)
- Marts: semantic layer (`metrics` / MetricFlow)
- Singular tests: `--store-failures` and the audit table workflow
- Generic tests: dbt-expectations and dbt-utils generic test libraries
- DAG: `dbt-cloud` orchestration, CI/CD with GitHub Actions
- Incremental: microbatch incremental strategy (dbt 1.9+)
- Snapshots: meta-snapshotting and the `snapshots:` config block

---

## Appendix A: Civil 3D Ask AI Reference Pattern

Inherited verbatim from the Civil 3D exam prep build (chat history, May 2026). Key CSS classes to mirror: `.ask-ai-fab`, `.conn-dot.online`, `.conn-dot.offline`, `.ai-chat-overlay`, `.ai-chat-modal`, `.ai-chat-header`, `.ai-settings-panel`, `.field-group`, `.security-note`, `.ai-chat-thread`, `.ai-chat-input-row`, `.ai-send`. Function names to mirror: `openAiChat`, `closeAiChat`, `toggleAiSettings`, `clearAiChat`, `sendAiMessage`, `appendAiMessage`. localStorage keys namespaced as `dbtHc2.ai.*` (Civil 3D used `civ3d.ai.*`).

The "Include station context" toggle is the one Civil 3D feature that earns its keep most reliably — when enabled, the current station's lecture text is prepended to the user's prompt, so questions like "explain this differently" actually have something to ground against.

---

## Appendix B: Smoke-Test Checklist (per turn)

- [ ] All journey tabs render and switching changes content
- [ ] All station pills render and clicking navigates
- [ ] Active station pill matches `currentStationId`
- [ ] Done pills show ✓ after task completion
- [ ] Pipeline bar scrolls horizontally on narrow viewport
- [ ] Lecture HTML renders without escaping issues
- [ ] BA panels render for all five `type` values
- [ ] `compiled-sql` BA panels execute successfully against sql.js
- [ ] Fill-input validation: correct → green, wrong → red+shake
- [ ] Choice tasks: select + check works, explanation appears after correct
- [ ] Hint button reveals hint text without revealing answer
- [ ] Reveal button populates all blanks correctly
- [ ] DEMO badge opens panel at 30vw
- [ ] DEMO expand button toggles to 60vw and back
- [ ] DEMO panel close button (and Esc) closes panel
- [ ] DEMO Run Sample executes runnableSQL and renders results
- [ ] Glossary modal opens, sorts alphabetically, closes on overlay click or ×
- [ ] Ask AI fab opens modal
- [ ] Ask AI settings panel toggles open/closed
- [ ] Ask AI conn-dot reflects `navigator.onLine`
- [ ] Ask AI sends a test message and renders response
- [ ] Ask AI history persists across page reload
- [ ] Scorecard updates live as stations complete
- [ ] Reset button clears progress + nav, leaves AI settings intact
- [ ] localStorage restoration: reload page, find self on last-active station

---

**End of specification.** Build proceeds in Turn 1 (next).
