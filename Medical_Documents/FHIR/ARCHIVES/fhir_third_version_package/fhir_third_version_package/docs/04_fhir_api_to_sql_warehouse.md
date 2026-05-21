# FHIR API response into SQL warehouse row demo

## Purpose

This demo shows how already-FHIR data from a server still needs extraction, reference resolution, and warehouse modeling before analysts can use it comfortably.

## Significant steps

1. Receive FHIR API response
   - Starts with a Bundle returned from a FHIR server.

2. Extract reporting fields
   - Pulls out observation code, timestamps, value, subject reference, and encounter reference.

3. Resolve references
   - Matches FHIR references to warehouse identifiers or dimension rows.

4. Load fact table row
   - Inserts or upserts the simplified observation into a SQL target.

5. Optional mart layer
   - Builds a curated SQL view or mart for end users.

## Error branches shown

- Broken or incomplete FHIR API payload
- Missing observation value branch
- Warehouse identity lookup failure
- Warehouse write failure
- Semantic mart mismatch

## What this teaches

- FHIR JSON is often too nested for direct BI use.
- Warehouse modeling is still required after FHIR ingestion.
- Good pipelines protect both the interoperability layer and the analytics layer.
