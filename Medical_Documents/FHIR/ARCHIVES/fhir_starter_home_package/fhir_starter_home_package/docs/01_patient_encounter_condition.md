# Patient + Encounter + Condition demo

## Purpose

This demo shows how a basic registration and diagnosis input becomes connected FHIR resources and then an analytics-ready SQL row.

## Significant steps

1. Intake raw source row
   - Receives the operational row unchanged.
   - Preserves the original payload for lineage and traceability.

2. Parse the source
   - Separates patient details, encounter details, and diagnosis details.
   - Converts a flat row into logical entities.

3. Normalize and validate
   - Standardizes identifiers, dates, and gender values.
   - Attaches the diagnosis to a standard coding system such as ICD-10-CM.
   - Checks for missing or invalid source values.

4. Build FHIR resources
   - Creates a `Patient`
   - Creates an `Encounter`
   - Creates a `Condition`
   - Connects them using references

5. Flatten for SQL
   - Joins the FHIR graph back into a single warehouse-style row.

## Error branches shown

- Missing MRN at intake
- Encounter date parse failure
- Diagnosis code validation failure
- Profile validation failure during Condition creation
- Warehouse dimension lookup miss

## What this teaches

- FHIR is not one big row; it is a graph of related resources.
- Identity and code quality matter before resource construction.
- A correct FHIR resource still may require a second transformation into SQL-friendly form.
