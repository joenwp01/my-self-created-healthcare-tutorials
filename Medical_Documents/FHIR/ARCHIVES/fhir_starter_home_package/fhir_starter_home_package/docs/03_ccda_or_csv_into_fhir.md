# C-CDA or CSV into FHIR demo

## Purpose

This demo shows how non-FHIR source content, whether document-based or tabular, is extracted and turned into standard FHIR resources.

## Significant steps

1. Receive source content
   - Accepts either a C-CDA fragment or a CSV-like extract.

2. Extract structured facts
   - Pulls out diagnosis, onset date, patient key, and related coding.

3. Reconcile codes
   - Preserves or maps multiple coding systems, for example ICD-10-CM plus SNOMED CT.
   - Resolves whether the codings agree semantically.

4. Build the FHIR resource
   - Creates a `Condition` resource from the extracted and normalized fact.

5. Export or warehouse load
   - Sends the Condition onward in FHIR form or flattens it for analytics.

## Error branches shown

- Malformed source payload
- Partial extraction only
- Coding conflict between source narrative and code
- FHIR profile validation failure
- Warehouse type mismatch

## What this teaches

- Much of the real work happens before FHIR resource creation.
- FHIR often sits in the middle of a broader pipeline rather than at the very beginning.
- One source fact may carry multiple coding systems that need deliberate handling.
