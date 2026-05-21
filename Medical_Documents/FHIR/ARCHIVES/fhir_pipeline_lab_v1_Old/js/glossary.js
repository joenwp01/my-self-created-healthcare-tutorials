/* ============================================================
   Glossary — FHIR R4, US Core, SMART on FHIR terminology
   ============================================================ */

const GLOSSARY = [
  // ===== FHIR CORE =====
  ["FHIR", "Fast Healthcare Interoperability Resources. HL7's modern web-native interoperability standard. R4 is the current 'normative' version widely adopted in the US."],
  ["R4", "FHIR version 4.0.1, published 2019. The version underpinning US Core, USCDI, and all CMS interoperability regulations as of 2026."],
  ["Resource", "The fundamental unit of FHIR data. A self-contained entity with a type (Patient, Observation, etc.), an id, and structured elements. Addressable by URL."],
  ["Bundle", "A FHIR resource that contains a collection of other resources. Bundle types include 'searchset' (from a search), 'collection' (generic), 'transaction' (atomic multi-resource write), 'batch' (best-effort multi-resource), and 'document' (signed snapshot)."],
  ["Reference", "A FHIR element that points to another resource, either by URL ('Patient/p001') or by logical identifier. The backbone of FHIR's graph structure."],
  ["Contained resource", "A resource embedded inline within another resource, referenced using '#id' syntax. Used when the child has no independent identity and no external reference is needed."],

  // ===== US CORE =====
  ["US Core", "The HL7 Implementation Guide that defines the minimum conformance expectations for US-based FHIR exchange. Anchored to USCDI data classes. Current version is US Core 6.1.0."],
  ["USCDI", "United States Core Data for Interoperability. ONC's standardized set of data classes and elements required for nationwide exchange. US Core profiles implement USCDI in FHIR."],
  ["Profile", "A StructureDefinition that constrains a base FHIR resource with additional rules: required elements, value set bindings, slicing, extensions. US Core profiles are the US baseline."],
  ["Must-support", "A profile conformance flag indicating that an implementation MUST be able to produce and consume an element if data is present. Stronger than 'optional' but weaker than 'required'."],

  // ===== SMART / AUTHORIZATION =====
  ["SMART on FHIR", "An OAuth 2.0 profile for FHIR that defines launch contexts, scopes, and authorization flows. The standard for user- and system-authorized FHIR access."],
  ["Scope", "An OAuth token permission string. SMART scopes include 'patient/Observation.read', 'user/*.rs', 'system/Patient.read'. The syntax is resource-type + permission + (optional) context."],
  ["Backend services", "A SMART flow for server-to-server (no user) access using a signed JWT client assertion. Used for bulk data, population queries, and ingestion pipelines."],

  // ===== BULK DATA =====
  ["Bulk Data", "The FHIR Bulk Data Access IG ('Flat FHIR'). Defines $export operations that produce NDJSON files for population-level extraction. Async, polling-based."],
  ["$export", "A FHIR operation that kicks off a Bulk Data job. Returns a status polling URL; when complete, returns a manifest of NDJSON file URLs."],
  ["NDJSON", "Newline-Delimited JSON. One FHIR resource per line. The Bulk Data output format. Streamable and easy to parse line-by-line."],
  ["Group-scoped export", "A Bulk Data export restricted to a defined Group resource — typically a patient cohort. Preferred over system-wide export for scope discipline."],

  // ===== SEARCH =====
  ["_include", "A search parameter that tells the server to include referenced resources in the response Bundle. Example: search Observations _include=Observation:subject to include the Patient resources."],
  ["_revinclude", "Reverse include. Returns resources that reference the search result. Example: search Patient _revinclude=Condition:subject returns each patient's Conditions too."],
  ["Capability Statement", "A FHIR resource describing what a server supports — resource types, operations, search parameters, profiles. Discovered at /metadata. The starting point for any client."],

  // ===== TERMINOLOGY =====
  ["ValueSet", "A FHIR resource defining a set of coded values drawn from one or more CodeSystems. Profile element bindings reference ValueSets."],
  ["CodeSystem", "A FHIR resource defining a terminology's codes and meanings (e.g., LOINC, SNOMED CT, ICD-10-CM, RxNorm). Usually referenced rather than stored locally."],
  ["ConceptMap", "A FHIR resource defining mappings between concepts in different CodeSystems. The formal way to represent crosswalks like ICD-9 → ICD-10."],
  ["Binding strength", "How strictly a profile requires use of its bound ValueSet: 'required' (must use), 'extensible' (use if a code applies; otherwise local), 'preferred' (encouraged), 'example' (for illustration only)."],
  ["$validate-code", "A terminology service operation that checks whether a code is valid within a given ValueSet. Used during profile validation."],
  ["$expand", "A terminology service operation that returns all codes in a ValueSet. Used for UI pickers and for validating large ValueSets."],
  ["$translate", "A terminology service operation that uses a ConceptMap to translate a code from one system to another."],

  // ===== EXTENSIONS =====
  ["Extension", "A mechanism for adding data to a FHIR resource beyond the base specification. Identified by a URL. US Core defines standard extensions for race, ethnicity, birth sex."],
  ["Modifier extension", "An extension that changes the meaning of the element it's attached to. Consumers MUST understand a modifier extension or reject the resource. Rare and significant."],

  // ===== PROFILE VALIDATION =====
  ["FHIRPath", "The expression language FHIR uses for invariants, search parameter definitions, and extractions. A path language over the resource tree."],
  ["Invariant", "A FHIRPath expression a resource must satisfy. Profile invariants express constraints that can't be captured structurally (e.g., 'if status is final, a value must be present')."],
  ["OperationOutcome", "A FHIR resource used to return validation errors, warnings, and information. The response format for failed resource submissions."],

  // ===== TRANSACTION / BATCH =====
  ["Transaction Bundle", "A Bundle of type 'transaction' submitted atomically — all entries succeed or all fail. Supports internal references between entries via urn:uuid IDs."],
  ["Batch Bundle", "A Bundle of type 'batch' submitted as independent requests. Each entry succeeds or fails individually."],
  ["Conditional create", "A create operation with an 'If-None-Exist' header or ifNoneExist entry. The server creates only if no resource matches the condition. Used to avoid duplicates."],
  ["ifNoneExist", "The Bundle entry field that expresses a conditional create condition (e.g., 'identifier=http://hospital.example/mrn|CRH-10001')."],

  // ===== WAREHOUSE / DOWNSTREAM =====
  ["OMOP", "Observational Medical Outcomes Partnership Common Data Model. A standardized analytical warehouse schema. Often the target for FHIR-to-warehouse flattening."],
  ["Flat FHIR", "Colloquial for Bulk Data's NDJSON output. Also refers generally to the practice of flattening FHIR resources into tabular rows for analytics."],
  ["US Core warehouse", "A relational schema that stores the US Core profile elements as queryable columns. The terminal destination of the Consume journey."],

  // ===== GOVERNANCE =====
  ["42 CFR Part 2", "US federal regulation restricting the disclosure of substance use disorder (SUD) treatment records. Stricter than HIPAA; requires specific consent for each disclosure."],
  ["Safe Harbor", "HIPAA's method for de-identification that requires removal of 18 specific identifier categories. The conservative default for research data release."],
  ["Minimum necessary", "A HIPAA principle requiring that only the PHI needed for a purpose be used or disclosed. Shapes FHIR scope design and query selectivity."]
];

window.GLOSSARY = GLOSSARY;

/* ===== Glossary modal rendering ===== */
function renderGlossary() {
  const modal = document.getElementById("glossary-modal");
  const body = document.getElementById("glossary-body");
  if (!modal || !body) return;

  const sorted = [...GLOSSARY].sort((a,b) => a[0].localeCompare(b[0]));
  body.innerHTML = sorted.map(([term, def]) => `
    <dt>${term}</dt>
    <dd>${def}</dd>
  `).join("");
}

function openGlossary() {
  renderGlossary();
  document.getElementById("glossary-modal")?.classList.add("active");
}
function closeGlossary() {
  document.getElementById("glossary-modal")?.classList.remove("active");
}

window.openGlossary = openGlossary;
window.closeGlossary = closeGlossary;
