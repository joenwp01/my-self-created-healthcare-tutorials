# dbt Healthcare Billing Audit Tutorial

## Medical Code ↔ Description Mismatch Detection

A hands-on tutorial demonstrating how to use **dbt data tests** to audit that medical descriptions match their CPT or ICD-10 codes in EHR staging tables. This tutorial is provided as both a **React (.jsx)** and **standalone HTML** application.

---

## Table of Contents

1. [Overview](#overview)
2. [Why dbt for This Scenario](#why-dbt-for-this-scenario)
3. [Medical Codes Used](#medical-codes-used)
4. [Architecture & Data Model](#architecture--data-model)
5. [The dbt Test Explained](#the-dbt-test-explained)
6. [Mock Data Details](#mock-data-details)
7. [Application Structure](#application-structure)
8. [Running the Applications](#running-the-applications)
9. [Quiz Questions & Answer Key](#quiz-questions--answer-key)
10. [Extending This in a Real dbt Project](#extending-this-in-a-real-dbt-project)

---

## Overview

After EHR encounter data lands in a staging or mart table in your data warehouse, you need to verify that each row's `code_system`, `code`, and free-text `description` align with a trusted internal reference table of allowed codes and descriptions.

**Example failures this test catches:**

- A row contains CPT `93000` but the stored description says "Chest X-ray" (should be "Electrocardiogram, routine ECG with at least 12 leads")
- ICD-10 `E78.5` with description "Type 2 diabetes mellitus without complications" (should be "Hyperlipidemia, unspecified")
- ICD-10 `J06.9` with description "Low back pain" (should be "Acute upper respiratory infection, unspecified")

This is a **set-based relational audit** — the natural domain of SQL and dbt.

---

## Why dbt for This Scenario

dbt data tests are SQL queries that return failing rows. A test **passes** when the query returns **zero rows**, and **fails** when any rows are returned. This maps perfectly to a join-based mismatch check:

1. You already have both the **encounter table** and the **reference terminology table** in SQL.
2. The test is a simple `LEFT JOIN` + `WHERE` clause returning only bad records.
3. dbt supports both **singular tests** (standalone `.sql` files in `tests/`) and **generic tests** (reusable YAML-configured tests).
4. dbt builds a DAG (Directed Acyclic Graph) that ensures the test runs after the models it depends on.

This pattern — "for rows in this model, show me the bad records that disprove the assertion" — is exactly how dbt data tests are defined in the official docs.

---

## Medical Codes Used

### ICD-10-CM Codes

| Code   | Description                                      |
|--------|--------------------------------------------------|
| E11.9  | Type 2 diabetes mellitus without complications   |
| I10    | Essential (primary) hypertension                 |
| J06.9  | Acute upper respiratory infection, unspecified    |
| M54.5  | Low back pain                                    |
| E78.5  | Hyperlipidemia, unspecified                      |
| F41.9  | Anxiety disorder, unspecified                    |

### CPT Codes

| Code   | Description                                          |
|--------|------------------------------------------------------|
| 93000  | Electrocardiogram, routine ECG with at least 12 leads |
| 99213  | Office visit, established patient, 20-29 min         |
| 99214  | Office visit, established patient, 30-39 min         |
| 36415  | Venipuncture (routine blood draw)                    |
| 80053  | Comprehensive metabolic panel                        |
| 71046  | Chest X-ray, 2 views                                |

All codes are real, commonly billed medical codes sourced from CMS and AMA references.

---

## Architecture & Data Model

```
dbt Project Structure:
├── seeds/
│   └── ref_medical_codes.csv         ← Reference terminology (ICD-10 + CPT)
├── models/
│   └── staging/
│       └── stg_encounters.sql        ← Staging model from raw EHR data
├── tests/
│   └── assert_encounter_description_matches_reference.sql  ← Singular test
└── dbt_project.yml
```

### ref_medical_codes (seed / reference table)

A dbt **seed** — a CSV file in `seeds/` that gets loaded into the warehouse with `dbt seed`. Contains the trusted mapping of `code_system`, `code`, and `description`.

### stg_encounters (staging model)

A dbt **model** that stages raw EHR encounter data. Each row has:
- `encounter_id` — unique identifier
- `code_system` — either `ICD-10` or `CPT`
- `code` — the medical code
- `description` — the free-text description from the EHR

---

## The dbt Test Explained

```sql
-- tests/assert_encounter_description_matches_reference.sql

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
    OR e.description <> r.description    -- description mismatch
```

**How it works:**

1. `LEFT JOIN` the encounters to the reference table on `code_system` + `code`.
2. `WHERE` clause filters to rows where either:
   - The code doesn't exist in the reference (`r.description IS NULL`)
   - The descriptions don't match (`e.description <> r.description`)
3. If zero rows are returned → **test passes** (all codes and descriptions are valid).
4. If any rows are returned → **test fails** (those are the mismatches to investigate).

**Running the test:**

```bash
dbt test --select assert_encounter_description_matches_reference
```

---

## Mock Data Details

The tutorial includes 10 encounter rows, with 4 intentional mismatches:

| Encounter  | Code System | Code   | Given Description                   | Expected Description                          | Status    |
|------------|-------------|--------|-------------------------------------|-----------------------------------------------|-----------|
| ENC-001    | ICD-10      | E11.9  | Type 2 diabetes mellitus without... | Type 2 diabetes mellitus without complications | ✓ Match   |
| ENC-002    | CPT         | 93000  | **Chest X-ray**                     | Electrocardiogram, routine ECG...             | ✗ Mismatch|
| ENC-003    | ICD-10      | I10    | Essential (primary) hypertension    | Essential (primary) hypertension              | ✓ Match   |
| ENC-004    | ICD-10      | J06.9  | **Low back pain**                   | Acute upper respiratory infection...          | ✗ Mismatch|
| ENC-005    | CPT         | 99213  | Office visit, established patient   | Office visit, established patient, 20-29 min  | ✓ Match   |
| ENC-006    | CPT         | 36415  | **Comprehensive metabolic panel**   | Venipuncture (routine blood draw)             | ✗ Mismatch|
| ENC-007    | ICD-10      | M54.5  | Low back pain                       | Low back pain                                 | ✓ Match   |
| ENC-008    | CPT         | 80053  | Comprehensive metabolic panel       | Comprehensive metabolic panel                 | ✓ Match   |
| ENC-009    | ICD-10      | E78.5  | **Type 2 diabetes mellitus...**     | Hyperlipidemia, unspecified                   | ✗ Mismatch|
| ENC-010    | CPT         | 71046  | Chest X-ray, 2 views               | Chest X-ray, 2 views                         | ✓ Match   |

---

## Application Structure

### React Version (`dbt_billing_audit_tutorial.jsx`)

A single-file React component using hooks (`useState`). Contains:

- **DemoSection** — interactive walkthrough with reference table, encounter table, and a "Run dbt test" button that highlights mismatches.
- **QuizSection** — 8 questions with multiple-choice and fill-in-the-blank, scoring, hints, and explanations.
- **Inline styles** — no external CSS dependency beyond Google Fonts.

Dependencies: React 18+ (designed for Claude.ai artifact rendering or any React host).

### HTML Version (`dbt_billing_audit_tutorial.html`)

A zero-dependency standalone HTML file with embedded CSS and vanilla JavaScript. Identical functionality to the React version. Open directly in any modern browser.

---

## Running the Applications

### React Version

If using in Claude.ai, the `.jsx` file renders directly as an artifact. For standalone use:

```bash
# In a React project with Vite or Create React App:
# 1. Copy the .jsx file into your src/ directory
# 2. Import and render the default export
import DbtBillingAuditTutorial from './dbt_billing_audit_tutorial';
```

### HTML Version

```bash
# Simply open in a browser:
open dbt_billing_audit_tutorial.html

# Or serve locally:
python3 -m http.server 8000
# Then visit http://localhost:8000/dbt_billing_audit_tutorial.html
```

---

## Quiz Questions & Answer Key

| #  | Type       | Question Summary                                      | Answer            |
|----|------------|-------------------------------------------------------|-------------------|
| 1  | MC         | dbt test passes when query returns ___ rows           | B. Zero rows      |
| 2  | Fill       | `{{ ___('stg_encounters') }}`                         | `ref`             |
| 3  | MC         | Which encounter has a mismatch?                       | B. ENC-002        |
| 4  | Fill       | E11.9 = "Type 2 diabetes mellitus without ___"        | `complications`   |
| 5  | MC         | Where should a singular test be stored?               | B. tests/         |
| 6  | Fill       | WHERE clause operator for inequality                  | `<>`              |
| 7  | MC         | CPT 36415 corresponds to?                             | C. Venipuncture   |
| 8  | MC         | Reference data in dbt is best stored as?              | B. Seed (CSV)     |

---

## Extending This in a Real dbt Project

### 1. Convert to a Generic Test

Create a reusable generic test macro in `macros/`:

```sql
-- macros/test_description_matches_reference.sql
{% test description_matches_reference(model, code_column, desc_column, ref_model) %}
SELECT *
FROM {{ model }} AS src
LEFT JOIN {{ ref(ref_model) }} AS ref
    ON src.code_system = ref.code_system
    AND src.{{ code_column }} = ref.code
WHERE ref.description IS NULL
   OR src.{{ desc_column }} <> ref.description
{% endtest %}
```

Then apply in your YAML:

```yaml
# models/staging/schema.yml
models:
  - name: stg_encounters
    columns:
      - name: code
        tests:
          - description_matches_reference:
              code_column: code
              desc_column: description
              ref_model: ref_medical_codes
```

### 2. Add Severity Levels

```yaml
tests:
  - description_matches_reference:
      severity: warn  # warn instead of fail for soft enforcement
```

### 3. Add to CI/CD

Run billing audit tests on every PR:

```bash
dbt test --select tag:billing_audit
```

### 4. Store Results with dbt Artifacts

Use `dbt test --store-failures` to persist failing rows to a schema for downstream investigation and reporting.

---

## License & Attribution

Tutorial created for healthcare data engineering education. Medical codes sourced from CMS ICD-10-CM and AMA CPT public references. Mock data is synthetic and does not contain any real patient information.
