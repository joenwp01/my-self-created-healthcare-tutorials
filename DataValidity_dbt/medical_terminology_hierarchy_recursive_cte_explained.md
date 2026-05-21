# Medical Terminology Hierarchy Traversal with a Recursive SQL CTE (ICD‑10 example)

## 1) Layman’s explanation (what this is doing)

Think of ICD‑10 codes like folders on a computer:

- **E11** is a *folder* named **“Type 2 diabetes mellitus”**.
- Inside that folder are more specific *sub‑folders/files* like **E11.9** (“Type 2 diabetes mellitus without complications”), **E11.65** (“…with hyperglycemia”), etc.

A **recursive CTE** (Common Table Expression) is a SQL pattern that lets you:
- **Start at a parent code** (the “folder”), and then
- **Repeatedly find children** (sub‑folders), and then their children, and so on,
until there are no more.

That’s perfect for cohort logic like:
> “Give me all diagnosis codes that are descendants of E11 (Type 2 diabetes)”.

---

## 1) Line‑by‑line explanation of your CTE (using E11)

Here is your query again:

```sql
WITH RECURSIVE icd_hierarchy AS (
    -- Anchor: start with parent code
    SELECT code, description, code AS root_code
    FROM icd10_taxonomy WHERE code = 'E11'

    UNION ALL

    -- Recursive: get children
    SELECT c.code, c.description, p.root_code
    FROM icd10_taxonomy c
    JOIN icd_hierarchy p ON c.parent_code = p.code
)
SELECT * FROM icd_hierarchy;
```

### What table structure is assumed?
This assumes a taxonomy table like:

- `icd10_taxonomy.code` (e.g., `E11`, `E11.9`, `E11.65`)
- `icd10_taxonomy.description` (human description for that code)
- `icd10_taxonomy.parent_code` (the immediate parent in the hierarchy)

Example rows (illustrative):

| code   | description                                             | parent_code |
|--------|----------------------------------------------------------|-------------|
| E11    | Type 2 diabetes mellitus                                 | NULL        |
| E11.9  | Type 2 diabetes mellitus without complications            | E11         |
| E11.65 | Type 2 diabetes mellitus with hyperglycemia               | E11         |
| E11.22 | Type 2 diabetes mellitus with diabetic chronic kidney disease | E11      |

> Note: ICD‑10‑CM is “category → more specific subcode” (often 3‑char category like E11 → subcodes like E11.9, E11.65, etc.).  
> Your table can represent this as parent/child links.

---

### `WITH RECURSIVE icd_hierarchy AS ( ... )`
- This defines a **temporary named result set** called `icd_hierarchy`.
- You can think of it as a **virtual table** you can query at the end.
- The keyword **RECURSIVE** allows the CTE to refer to itself.

---

### Anchor query (runs first, one time)
```sql
SELECT code, description, code AS root_code
FROM icd10_taxonomy WHERE code = 'E11'
```

- This selects the **starting node** of the tree: `E11`.
- It returns one row (assuming `E11` exists).
- `code AS root_code` creates a new column `root_code` and sets it to `E11`.

**What is `root_code` for?**  
It “labels” every descendant row with the original starting code (`E11`), so later you can say:  
> “These rows are all in the E11 family.”

---

### `UNION ALL`
```sql
UNION ALL
```
- Combines the anchor results with results from the recursive part.
- **ALL** means it does not try to remove duplicates (faster).
- If you have cycles or duplicate edges in your taxonomy, `UNION ALL` can repeat rows — you may need cycle guards (more on that below).

---

### Recursive query (runs repeatedly until no new rows are found)
```sql
SELECT c.code, c.description, p.root_code
FROM icd10_taxonomy c
JOIN icd_hierarchy p ON c.parent_code = p.code
```

This is the key idea:

- `icd10_taxonomy c` is aliased as **`c`** for “child”.
- `icd_hierarchy p` is aliased as **`p`** for “parent row already found in the hierarchy”.

**Aliasing (`c` and `p`) matters because:**
- You’re joining a “real” table (`icd10_taxonomy`) to the growing CTE (`icd_hierarchy`).
- If you didn’t alias, it becomes hard to read and ambiguous.
- Using `c` and `p` makes it clear which side is which:

**Join condition**
```sql
ON c.parent_code = p.code
```
Meaning:
- Find rows in `icd10_taxonomy` whose `parent_code` matches a `code` we already discovered.

So on the first recursive pass:
- `p.code = 'E11'` from the anchor
- You pull all `c.*` where `c.parent_code = 'E11'` → all direct children like `E11.9`, `E11.65`, etc.

On the next pass:
- `p.code` includes `E11.9`, `E11.65`, ...
- You pull *their* children, and so on.

**Why select `p.root_code`?**
```sql
SELECT c.code, c.description, p.root_code
```
- `p.root_code` keeps the original `E11` label on every row, even many levels down.
- Without this, you’d lose track of which tree you started from.

---

### Final select
```sql
SELECT * FROM icd_hierarchy;
```
This returns:
- `E11` itself, plus
- every descendant code reachable via repeated `parent_code` links.

---

### Practical enhancement: include depth/level (often helpful)
```sql
WITH RECURSIVE icd_hierarchy AS (
  SELECT code, description, parent_code, code AS root_code, 0 AS depth
  FROM icd10_taxonomy
  WHERE code = 'E11'

  UNION ALL

  SELECT c.code, c.description, c.parent_code, p.root_code, p.depth + 1 AS depth
  FROM icd10_taxonomy c
  JOIN icd_hierarchy p
    ON c.parent_code = p.code
)
SELECT *
FROM icd_hierarchy
ORDER BY depth, code;
```

Now you can see how far each code is from the root.

---

### Practical enhancement: prevent cycles (important in messy taxonomies)
If your data could accidentally contain loops (A → B → C → A), recursion can run forever (or until DB limits).

A common guard is keeping a “path” and refusing to revisit a code:

```sql
WITH RECURSIVE icd_hierarchy AS (
  SELECT code, description, parent_code, code AS root_code, 0 AS depth,
         CAST(code AS TEXT) AS path
  FROM icd10_taxonomy
  WHERE code = 'E11'

  UNION ALL

  SELECT c.code, c.description, c.parent_code, p.root_code, p.depth + 1,
         p.path || '>' || c.code AS path
  FROM icd10_taxonomy c
  JOIN icd_hierarchy p
    ON c.parent_code = p.code
  WHERE p.path NOT LIKE '%' || c.code || '%'
)
SELECT * FROM icd_hierarchy;
```

(Exact string functions vary a bit by database.)

---

## 2) Can recursive CTEs help validate a code’s meaning and catch miscoding?

### What recursion *can* validate (good for data quality)
A recursive CTE is great for **structural validation** against the official hierarchy you’ve loaded:

1) **“Does this code exist in the taxonomy?”**  
   If not, it’s invalid/outdated/typo.

2) **“Is this code under the correct parent category?”**  
   Example: if a record is labeled “Type 2 diabetes” but the code is in a different family (e.g., E10.* Type 1), that’s a mismatch.

3) **“Is the parent chain complete?”**  
   If a code has a `parent_code` but that parent doesn’t exist, you’ve got an orphaned node in your taxonomy.

4) **“Are there cycles?”**  
   You can detect impossible loops.

### What recursion *cannot* fully validate (needs clinical rules)
A recursive CTE does **not** prove clinical correctness like:
- The patient truly has diabetes,
- The complication is appropriate,
- The code matches labs/meds/encounter context, etc.

That’s clinical/semantic validation and usually requires:
- additional patient facts (labs, meds, problem list, note text),
- clinical logic,
- sometimes NLP.

---

### Example: “Is this diagnosis code in the E11 family?”
Say you have claims/encounter rows:

- `patient_id`
- `dx_code` (e.g., `E11.9`)
- `expected_category` (e.g., you derived or stored `E11` as “Type 2 diabetes family”)

You can use recursion to compute the **root category** for each dx_code, then compare.

#### Option A: create an ancestor mapping (closure table) in dbt, then validate
A common dbt pattern is to build a model that precomputes ancestor/descendant pairs (a “closure table”), then downstream models and tests use it.

**dbt model example (generic SQL)**
```sql
-- models/icd_ancestor_map.sql
WITH RECURSIVE walk_up AS (
  SELECT
    code        AS descendant_code,
    code        AS current_code,
    parent_code AS current_parent,
    0           AS hops
  FROM {{ ref('icd10_taxonomy') }}

  UNION ALL

  SELECT
    w.descendant_code,
    t.code        AS current_code,
    t.parent_code AS current_parent,
    w.hops + 1    AS hops
  FROM walk_up w
  JOIN {{ ref('icd10_taxonomy') }} t
    ON w.current_parent = t.code
  WHERE w.current_parent IS NOT NULL
)
SELECT
  descendant_code,
  current_code AS ancestor_code,
  hops
FROM walk_up;
```

Now you can ask:
- “Is dx_code a descendant of E11?” by checking if `ancestor_code = 'E11'`.

#### Option B: a direct cohort query (descendants of E11)
```sql
WITH RECURSIVE icd_hierarchy AS (
  SELECT code
  FROM icd10_taxonomy
  WHERE code = 'E11'
  UNION ALL
  SELECT c.code
  FROM icd10_taxonomy c
  JOIN icd_hierarchy p ON c.parent_code = p.code
)
SELECT e.*
FROM encounters e
JOIN icd_hierarchy h
  ON e.dx_code = h.code;
```

This yields all encounters with an E11 descendant dx_code.

---

## Should Great Expectations be used? (Yes—especially for operational QA)

Recursive CTEs are great inside your warehouse/lakehouse, but **GX shines for pipeline guardrails**:
- validate codes exist,
- validate codes roll up to the expected category,
- validate you aren’t producing orphaned/cyclic taxonomy,
- and fail fast with an actionable work queue.

### GX example: validate `dx_code` exists in taxonomy and is a descendant of E11

Below is a **simple Pandas + GX** pattern (conceptual; adapt to your environment):

```python
import pandas as pd
import great_expectations as gx

# Example inputs
encounters = pd.DataFrame({
    "patient_id": [1, 2, 3],
    "dx_code": ["E11.9", "E10.9", "E11.65"],  # one Type 1 example mixed in
    "expected_root": ["E11", "E11", "E11"],   # business expectation: all should be in E11 family
})

taxonomy = pd.DataFrame({
    "code": ["E11", "E11.9", "E11.65", "E10", "E10.9"],
    "parent_code": [None, "E11", "E11", None, "E10"],
    "description": [
        "Type 2 diabetes mellitus",
        "Type 2 diabetes mellitus without complications",
        "Type 2 diabetes mellitus with hyperglycemia",
        "Type 1 diabetes mellitus",
        "Type 1 diabetes mellitus without complications",
    ]
})

# Build a quick parent lookup and compute root via iterative "walk up"
parent = dict(zip(taxonomy["code"], taxonomy["parent_code"]))

def root_code(code: str) -> str | None:
    seen = set()
    cur = code
    while cur is not None and cur not in seen:
        seen.add(cur)
        nxt = parent.get(cur)
        if nxt is None:
            return cur
        cur = nxt
    return None  # None means loop or missing parent chain

encounters["derived_root"] = encounters["dx_code"].map(root_code)

# Great Expectations validation
context = gx.get_context()
df_ge = gx.from_pandas(encounters)

results = df_ge.validate(expectation_suite={
    "expectations": [
        {
            "expectation_type": "expect_column_values_to_not_be_null",
            "kwargs": {"column": "derived_root"},
        },
        {
            "expectation_type": "expect_column_pair_values_to_be_equal",
            "kwargs": {"column_A": "derived_root", "column_B": "expected_root"},
        }
    ]
})

print(results["success"])
```

**What this catches:**
- If `dx_code` doesn’t exist in the taxonomy, the `root_code()` function may return `None` or a wrong root.
- If the record expects E11 but the code rolls up to E10, the pair-equality expectation fails.

> In production you’d compute `derived_root` in SQL/dbt (faster, centralized), then GX validates the resulting columns and sends failures to your “work queue” table.

---

## Summary

- **Recursive CTEs** are ideal for navigating medical code hierarchies (descendants, ancestors, rollups).
- They’re excellent for **taxonomy/structural validation** (existence, ancestry, orphan detection, cycle detection).
- For ongoing pipeline QA and actionable failures, pair recursion/dbt with **Great Expectations** to enforce rules and produce audit-friendly validation results.

