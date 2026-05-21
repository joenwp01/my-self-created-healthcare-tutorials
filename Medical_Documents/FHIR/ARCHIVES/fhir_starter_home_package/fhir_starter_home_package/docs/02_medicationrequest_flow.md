# MedicationRequest flow demo

## Purpose

This demo shows how a source prescribing record becomes a standard FHIR medication order and then a flat medication reporting row.

## Significant steps

1. Intake medication order
   - Receives the prescribing row from the source system.

2. Parse fields
   - Separates patient identifier, local medication text, SIG, dates, and prescriber details.

3. Normalize and code medication
   - Converts source order status into FHIR-style status.
   - Maps local medication text to a standard concept such as RxNorm.

4. Build FHIR resources
   - Creates or references the patient
   - Creates a practitioner representation
   - Creates a `MedicationRequest`

5. Flatten for reporting
   - Produces one row for medication analytics, dashboards, or warehouse storage.

## Error branches shown

- Missing medication name at intake
- Prescriber identity ambiguity
- RxNorm mapping failure
- Profile validation failure on MedicationRequest
- Warehouse upsert conflict

## What this teaches

- Medication meaning depends heavily on terminology normalization.
- Free-text SIG and local medication strings often require cleanup or review.
- A medication order can succeed as FHIR but still fail later during analytics load or reconciliation.
