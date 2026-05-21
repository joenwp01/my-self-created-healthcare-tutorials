# Recursive CTEs in Healthcare Data Pipelines

**Topic:** Recursive Common Table Expressions for Medical Records and Dataset Cleansing

**Context:** A recursive CTE is a query that keeps referring back to its own result in a loop repeatedly until it returns an empty result. This self-referencing mechanism allows it to repeatedly process and expand its results until a stopping condition is met.

---

## Key Use Cases in Healthcare

### 1. Medical Terminology Hierarchy Traversal

ICD-10, SNOMED CT, CPT, and RxNorm all have parent-child taxonomic structures. Recursive CTEs let you roll up or drill down through these trees.

**Use case:** Find all specific diagnosis codes that fall under a general category (e.g., all descendants of "E11" for Type 2 Diabetes) for cohort identification or quality measure denominators.

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

---

### 2. Transitive Closure for Patient Deduplication

Master Patient Index (MPI) matching often yields pairwise links (A↔B, B↔C). You need transitive closure to cluster all records belonging to the same person into a single group.

**Use case:** During EHR migration or multi-system consolidation, group all probabilistically matched records into canonical patient clusters.

```sql
WITH RECURSIVE patient_clusters AS (
    SELECT patient_id, patient_id AS cluster_root
    FROM match_pairs
    
    UNION
    
    SELECT mp.patient_id_b, pc.cluster_root
    FROM match_pairs mp
    JOIN patient_clusters pc ON mp.patient_id_a = pc.patient_id
)
SELECT patient_id, MIN(cluster_root) AS canonical_id
FROM patient_clusters GROUP BY patient_id;
```

---

### 3. Episode-of-Care Chaining

Linking encounters that form a clinical episode (initial visit → procedure → follow-ups → readmission within 30 days) where each encounter's discharge connects to the next admission window.

**Use case:** CMS readmission penalty analysis, bundled payment episode construction, or continuity-of-care reporting.

---

### 4. Organizational Hierarchy Rollups

Health systems have nested structures: System → Region → Facility → Department → Unit → Care Team. Recursive CTEs enable cost allocation, access control propagation, and aggregated reporting at any level.

**Use case:** Aggregate quality metrics from unit level up to system level, or cascade security permissions downward.

---

### 5. Date/Time Spine Generation for Gap Detection

Generate a continuous sequence of dates or time intervals to LEFT JOIN against sparse patient records, revealing missing observations.

**Use case:** Identify patients with gaps in chronic disease monitoring (e.g., no HbA1c in 6+ months) or missing vitals in longitudinal datasets.

```sql
WITH RECURSIVE date_spine AS (
    SELECT DATE '2023-01-01' AS obs_date
    UNION ALL
    SELECT obs_date + INTERVAL '1 day'
    FROM date_spine WHERE obs_date < DATE '2024-01-01'
)
SELECT ds.obs_date, p.patient_id, v.value
FROM date_spine ds
CROSS JOIN patients p
LEFT JOIN vitals v ON v.patient_id = p.patient_id 
    AND v.recorded_date = ds.obs_date;
```

---

### 6. Referral and Care Coordination Chains

Track the full referral path: PCP → Cardiologist → Electrophysiologist → back to PCP, including loop detection for referral pattern analysis.

**Use case:** Network leakage analysis, care coordination quality metrics, or identifying referral bottlenecks.

---

### 7. Medication Regimen Component Explosion

Combination therapies or protocol-based regimens have nested structures (regimen → drug combinations → individual ingredients). Useful for drug interaction checking or formulary compliance.

---

### 8. Data Lineage in Pipeline Auditing

When transformations reference prior transformation outputs, recursive CTEs can trace a data element back through all upstream processing steps—critical for HIPAA audit trails and debugging data quality issues.

---

## Pipeline Integration Note

In Spark, you'd typically implement these patterns using GraphX or iterative DataFrame operations since Spark SQL doesn't natively support recursive CTEs. However, for preprocessing in Snowflake, BigQuery, or PostgreSQL staging layers before Spark ingestion, recursive CTEs are extremely efficient for these hierarchical cleansing operations.

---

*Generated from Claude conversation*
