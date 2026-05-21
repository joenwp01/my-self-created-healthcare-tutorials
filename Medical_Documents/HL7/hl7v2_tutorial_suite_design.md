# HL7 v2: Message to Model — Design Document

**Suite Name:** HL7 v2: Message to Model
**Author:** Joe Williams (design) / Claude (documentation)
**Date:** April 30, 2026
**Status:** Design complete — ready for build
**Derived from:** C-CDA Pipeline Lab tutorial methodology

---

## Table of Contents

1. [Suite Overview](#suite-overview)
2. [Linking Strategy](#linking-strategy)
3. [Patient Cohort: The Riverside Cohort](#patient-cohort-the-riverside-cohort)
4. [Journey Structure](#journey-structure)
5. [Answer Position Randomization](#answer-position-randomization)
6. [Part 1 — The Interface Pipeline (13 Stations)](#part-1--the-interface-pipeline-13-stations)
7. [Part 2 — From Pipeline to Prediction (5 Stations)](#part-2--from-pipeline-to-prediction-5-stations)
8. [Cross-Tutorial Tool Integration](#cross-tutorial-tool-integration)
9. [UI/UX Enhancements Over C-CDA Lab](#uiux-enhancements-over-c-cda-lab)
10. [Technical Considerations](#technical-considerations)
11. [Design Decisions & Rationale](#design-decisions--rationale)

---

## Suite Overview

### HL7 v2: Message to Model

**Part 1 — The Interface Pipeline**
13 stations covering message processing, privacy (3 dedicated stations), and FHIR/USCDI conversion (3 dedicated stations). The output is a validated, de-identified, US Core-conformant FHIR Bundle set for the patient cohort.

**Part 2 — From Pipeline to Prediction**
5 stations covering message-stream-to-dataset reconciliation. The input is the accumulated message stream and FHIR Bundle set produced by Part 1. The output is an encounter-level analytics dataset suitable for an ED high-utilizer prediction model, plus a dataset card documenting provenance and limitations. Part 2 has Part 1 as its foundation — it continues the pipeline, not a parallel effort.

### Terminal Goal

**ED High-Utilizer Prediction Model Dataset** — predicting which patients will have 4+ ED visits in 12 months based on demographics, clinical features, utilization history, and social determinants inferred from message patterns. This goal gives backward pressure to every station in both parts: the learner understands *why* each transformation matters.

---

## Linking Strategy

The two parts share a common patient cohort, message corpus, and visual identity, but are separate HTML files. Part 2 is an extension that depends on Part 1's foundation — the link is directional, not peer-to-peer. Part 2 opens by presenting the accumulated output of Part 1's pipeline as its starting material. A learner can use Part 2 without having completed Part 1, because the input data is embedded, but the framing assumes familiarity with the concepts from Part 1.

**In-app cross-references:**

- Part 1's final station (Station 13) closing text: *"Your pipeline now produces validated, de-identified, US Core-conformant FHIR Bundles. Continue to Part 2 to transform this message stream into an analytics-ready dataset."* Includes a "Continue to Part 2: From Pipeline to Prediction →" callout.
- Part 2's opening screen: *"This tutorial begins where Part 1 ended — with a stream of processed HL7 v2 messages. Here, you'll aggregate that stream into an encounter-level dataset suitable for clinical prediction."* Includes a "← Prerequisites covered in Part 1: The Interface Pipeline" note.

No runtime data passes between them. No shared localStorage keys.

---

## Patient Cohort: The Riverside Cohort

Five patients generating realistic HL7 v2 message streams across acute care encounters. Each patient introduces specific challenges that surface at different stations.

### P001 — Sarah Chen, 72F

**Role:** Clean case / happy path validator.

Straightforward admit-stay-discharge at Riverside Medical Center. Standard LOINC labs (CBC, BMP), ICD-10-CM primary diagnosis (I50.9 Heart Failure). v2.5.1 messages throughout. Tests the happy path at every station.

**Message stream:** ADT^A01 → ORU^R01 (CBC) → ORU^R01 (BMP) → ADT^A03

### P002 — Robert Kowalski, 58M

**Role:** Legacy system / vocabulary translation stress test.

Source system sends v2.3 messages. OBX-3 uses local lab codes instead of LOINC. DG1-3 carries an ICD-9 code (428.0) that needs GEM crosswalk to ICD-10-CM (I50.9). Timestamps use non-standard precision (YYYYMMDD without time component). Does not populate PID.10 (race) or PID.22 (ethnicity).

**Message stream:** ADT^A01 → ORU^R01 (local codes) → ORU^R01 (local codes) → ADT^A03

### P003 — Maya Patel, 34F

**Role:** Privacy / 42 CFR Part 2 stress test.

Substance abuse diagnosis in DG1 (F10.20 Alcohol Use Disorder). Free-text NTE segment contains references to "alcohol counseling" and "AA meeting schedule." Has a 42 CFR Part 2 consent restriction authorizing disclosure to PCP but not to research warehouse. Tests all three privacy stations heavily.

**Message stream:** ADT^A01 → ORU^R01 (standard labs) → NTE (counseling notes) → ADT^A03

### P004 — James Morrison, 45M

**Role:** Patient matching / reconciliation / Z-segment stress test.

Near-duplicate — shares DOB and first three letters of last name with existing MPI patient ("James Morris, 45M"). Two ADT^A08 messages update his address mid-stay, creating a temporal reconciliation conflict. Source system sends ZPM segments (custom pharmacy metadata) not defined in the HL7 standard.

**Message stream:** ADT^A01 → ADT^A08 (address update #1) → ORU^R01 → ADT^A08 (address update #2) → ZPM segments → ADT^A03

### P005 — Aisha Washington, 29F

**Role:** Message ordering / encounter complexity / vital signs profiling stress test.

ED visit, high-acuity. Multiple rapid ORU messages (CBC, BMP, lactate, blood cultures) arriving out of chronological order (lab processing times vary — OBR-7 and MSH-7 diverge). Transfer from ED to ICU (ADT^A02) mid-encounter. Blood pressure reported as single composite OBX value requiring decomposition for US Core Vital Signs profile.

**Message stream:** ADT^A04 (ED registration) → ADT^A01 (admit from ED) → ORU^R01 (CBC, out of order) → ORU^R01 (BMP) → ORU^R01 (lactate) → ADT^A02 (transfer ED→ICU) → ORU^R01 (blood cultures) → ORU^R01 (vitals with composite BP) → ADT^A03

---

## Journey Structure

### J1 — Foundations

Clean, well-formed v2.5.1 messages. Standard codes. Single message type per station exercise. The learner focuses on *what* each concept means without dealing with edge cases.

**Primary exercise types:** Fill-in-blank on field addresses, multiple-choice on segment purpose, single-step transformations.

### J2 — Production Reality

Mixed-version messages (v2.3 and v2.5.1 arriving on the same interface). Local codes, missing optional fields, Z-segments, timestamp ambiguity, near-duplicate patients. The learner deals with *what goes wrong* and how to handle it.

**Additional exercise types:** Version-diff comparisons, fallback logic decisions, conflict resolution.

### J3 — Governance & Operations

Same clinical scenarios as J2, but with operational and regulatory overlay. MLLP/TLS configuration, audit trail requirements, 42 CFR Part 2 segment filtering, US Core must-support enforcement, error escalation policies. The learner reasons about *why* certain decisions are mandated.

**Additional exercise types:** Policy-application decisions, editable transformation rules, ACK error code selection.

---

## Answer Position Randomization

**Design principle (correcting a C-CDA lab flaw):** The C-CDA Pipeline Lab placed the correct answer as the first option in every exercise. This allows learners to game the exercises without engaging with the content.

**Requirement for HL7 v2 tutorials:** Correct answers will be distributed across all option positions with no predictable pattern.

- For 4-option multiple-choice: correct answer appears in each position (A/B/C/D) roughly 25% of the time across the full exercise set
- For 3-option exercises: roughly 33% per position
- For 2-option (binary decision) exercises: roughly 50/50

**Implementation:** The exercise data schema stores the correct answer by value/key rather than by array index. Options are authored in varied positions. The render engine can optionally shuffle option order at render time for per-session randomization on top of the authored variation.

**Distractor quality:** Each incorrect option must represent a specific, plausible misconception — not obviously wrong filler.

Example (Station 3 — Trigger Event Routing):

Scenario: "Patient transferred from ICU to Med/Surg"

| Position | Option | Why a learner might choose it |
|---|---|---|
| A | ADT^A03 (Discharge) | Confuses leaving ICU with discharge |
| B | ADT^A02 (Transfer) | **Correct** |
| C | ADT^A08 (Update Patient Info) | Confuses location change with demographic update |
| D | ADT^A06 (Change Outpatient to Inpatient) | Confuses transfer with status change |

---

## Part 1 — The Interface Pipeline (13 Stations)

### Station 1: Message Receipt & MLLP Framing

**Concept:** HL7 v2 messages travel over TCP using MLLP (Minimum Lower Layer Protocol). The message is wrapped in a start block (0x0B), terminated with an end block (0x1C + 0x0D). The MSH segment is always first and defines the message's metadata.

**Before panel:** Raw byte stream with hex framing characters visible.
**After panel:** Extracted message content with MSH fields labeled.

**Key fields taught:** MSH-1 (field separator), MSH-2 (encoding characters), MSH-3/4 (sending app/facility), MSH-5/6 (receiving app/facility), MSH-7 (timestamp), MSH-9 (message type and trigger event), MSH-10 (message control ID), MSH-12 (version ID).

**Interaction — Live Parser introduction:** The learner sees a raw message and clicks on fields to reveal their MSH address and meaning. This is the first exposure to the parser that persists across all subsequent stations.

**J1:** Identify MSH fields in a clean v2.5.1 ADT^A01.
**J2:** Handle a message where MSH-2 uses non-standard encoding characters (a real-world problem with some legacy systems).
**J3:** Evaluate MLLP/TLS configuration — which transport settings are required for PHI in transit?

**ACK feedback:** Station introduces the ACK concept. Correct answers generate MSA|AA|{control_id}. Errors generate MSA|AE|{control_id} with an ERR segment. This feedback pattern persists for all remaining stations.

---

### Station 2: Segment Decomposition & Field Addressing

**Concept:** HL7 v2 messages are composed of segments (PID, PV1, OBR, OBX, DG1, IN1, NK1, NTE). Each segment has numbered fields, separated by |. Fields contain components (separated by ^) and subcomponents (separated by &). The addressing notation is SEGMENT.FIELD.COMPONENT.SUBCOMPONENT (e.g., PID.5.1 = family name).

**Before panel:** Complete multi-segment message.
**After panel:** Decomposition table — segment name, field number, field name, value, data type.

**Interaction — Segment Builder:** The learner constructs a PID segment for one cohort patient by filling in field slots. The pipe-delimited output assembles in real time above the input form. Teaches addressing by production rather than just consumption.

**Key segments introduced:** PID (patient identification), PV1 (patient visit), OBR (observation request), OBX (observation result), DG1 (diagnosis), IN1 (insurance), NK1 (next of kin), NTE (notes/comments).

**Key data types introduced:** XPN (extended person name), XAD (extended address), CWE (coded with exceptions), TS (timestamp), CX (extended composite ID), XTN (telephone number).

**J1:** Parse a clean message — identify what lives at PID.5.1, PID.7, PID.8, PV1.2, OBX.5.
**J2:** Handle repeating fields (PID.3 with multiple MRNs from different assigning authorities — 12345^^^HOSP^MR~67890^^^STATE^DL). Identify which component distinguishes the assigning authority.
**J3:** Document a Z-segment's field definitions — given a ZPM segment with unknown fields, propose a field mapping table.

---

### Station 3: Message Type & Trigger Event Routing

**Concept:** MSH-9 defines the message type (ADT, ORM, ORU, etc.) and trigger event (A01, A02, A03, A04, A08, R01, O01, etc.). Each combination implies a specific message structure — which segments are required, optional, or repeating. Interface engines route messages to different destinations based on MSH-9.

**Before panel:** Multiple messages from the cohort with different MSH-9 values.
**After panel:** Routing table — message type → destination system(s).

**Interaction — Trigger Event Decision Tree:** Clinical scenario presented → learner selects the correct trigger event → correct message structure populates, showing which segments are present.

**Message types covered:** ADT^A01 (admit), ADT^A02 (transfer), ADT^A03 (discharge), ADT^A04 (register outpatient), ADT^A08 (update patient info), ORU^R01 (unsolicited lab result), ORM^O01 (order message).

**J1:** Match clinical scenarios to trigger events. Identify required segments for each.
**J2:** Handle an ADT^A01 that arrives after an ORU^R01 for the same visit (out-of-order delivery). What does the interface engine do?
**J3:** Design routing rules — given 4 destination systems (EHR, lab, billing, analytics), which message types go where? Some go to multiple destinations.

---

### Station 4: Vocabulary Translation

**Concept:** HL7 v2 messages frequently carry local codes that must be translated to standard terminologies for interoperability. OBX-3 (observation identifier) needs LOINC. DG1-3 (diagnosis code) needs ICD-10-CM. RXA-5 (administered drug) needs RxNorm or CVX.

**Before panel:** Message with local/non-standard codes highlighted.
**After panel:** Same message with standard codes inserted, showing the mapping applied.

**Interaction:** Mapping lookup exercise — learner is given a local code and a concept map table, selects the correct standard code. Connects to vocabulary patterns from the WCHA mapping tutorial but now applied to v2 field positions rather than warehouse tables.

**J1:** Direct mappings — local lab code → LOINC where a 1:1 map exists.
**J2:** Handle Robert Kowalski's ICD-9 code (428.0 → I50.9) using a GEM crosswalk. Handle an OBX-3 local code with no LOINC equivalent — what goes in OBX-3 and OBX-4?
**J3:** Define a fallback policy — when no mapping exists, do you reject the message (MSA|AR), pass through with a local code system URI, or use OBX-5 text as a safety net? Justify the decision against ONC regulatory requirements.

---

### Station 5: Validation

**Concept:** Messages must be validated for structural correctness (required segments present, field cardinality correct), data type conformance (timestamps in correct format, coded fields using valid table values), and business rules (admit date before discharge date, patient age consistent with DOB).

**Before panel:** Message with validation errors embedded.
**After panel:** Validation report — field, rule, severity (error/warning), description.

**Interaction:** The learner examines a message and identifies violations. Multiple-choice on severity classification (error vs warning), fill-in-blank on the specific field that fails validation.

**Validation categories:** Structural (missing required segment), data type (malformed timestamp), table value (PID.8 administrative sex not in Table 0001), cardinality (repeating segment where only one is allowed), cross-field (PV1-44 admit date > PV1-45 discharge date).

**J1:** Validate a clean message — confirm it passes. Then validate one with a single obvious error (missing PID).
**J2:** Validate Robert Kowalski's v2.3 message — his timestamps lack a time component. Is this an error or a warning? (Answer: depends on the receiving system's conformance profile — this is version-dependent.)
**J3:** Write a validation rule in pseudocode for a business rule: "If MSH-9 = ADT^A03, then PV1-45 (discharge date) must be populated." Determine the appropriate ACK response when this fails (AE vs AR).

---

### Station 6: Transformation & Z-Segment Handling

**Concept:** Interface engines transform messages between systems — merging segments, splitting messages, re-sequencing, reformatting fields, and handling custom Z-segments. Z-segments are locally defined extensions (Z00-ZZZ) that carry institution-specific data not covered by the standard.

**Before panel:** Message with Z-segments and transformation requirements annotated.
**After panel:** Transformed message with Z-segments handled (passed through, mapped, or stripped).

**Interaction — Z-Segment Workshop:** James Morrison's message contains ZPM segments (custom pharmacy metadata). The learner encounters an undocumented Z-segment and makes handling decisions: pass through (risk of downstream parser failure), map to standard segments (requires interpretation), strip and log (data loss), or reject message (conservative but disruptive). Each choice has a consequence shown downstream.

**J1:** Simple field-level transformation — reformat PID.7 from YYYYMMDD to YYYYMMDDHHMMSS (add midnight default). Merge two PID.3 repetitions by selecting the MRN and dropping the secondary ID.
**J2:** Handle ZPM — decide how to handle an unknown Z-segment when no documentation exists. See the downstream impact of each choice.
**J3:** Write a transformation rule for segment re-sequencing — the sending system puts DG1 before PV1, but the receiving system requires PV1 before DG1.

---

### Station 7: Patient Matching / MPI

**Concept:** When messages arrive from multiple source systems, patient identity must be resolved. The Master Patient Index (MPI) uses deterministic and probabilistic matching on PID demographics (name, DOB, SSN, MRN, address) to link, merge, or create patient records.

**Before panel:** Two messages — one from the existing MPI record, one incoming — with demographics side by side.
**After panel:** Match decision with confidence score and action (link, merge, create new, flag for manual review).

**Interaction:** James Morrison (P004) shares DOB and first three surname letters with an existing patient. The learner evaluates matching criteria, assigns weights, and makes the link/no-link decision. Teaches the difference between deterministic matching (exact MRN match = auto-link) and probabilistic matching (fuzzy name + DOB + address = confidence score).

**J1:** Deterministic match — same MRN, same facility. Auto-link.
**J2:** Probabilistic match — James Morrison vs James Morris. DOB matches. Address is close but not identical. The learner adjusts match thresholds and sees how the confidence score changes.
**J3:** Policy decision — what happens when a merge is wrong? Introduce the concept of unmerge and the ADT^A35 (merge patient) / ADT^A36 (unmerge) message pair. What audit trail is required?

---

### Station 8: PHI Field Identification & Stripping (Privacy 1/3)

**Concept:** HIPAA Safe Harbor de-identification requires removing or generalizing 18 identifier categories. In HL7 v2, PHI is distributed across multiple segment types, each requiring segment-specific de-identification logic.

**Before panel:** Complete multi-segment message with PHI fields highlighted in red.
**After panel:** De-identified message with PHI removed/generalized and a field-by-field audit log.

**Interaction:** The learner scans a message and tags fields as PHI or non-PHI. More granular than the C-CDA lab's document-level approach — the learner must know that PID.5 (name) is PHI but PID.8 (administrative sex) is not, that NK1.2 (next-of-kin name) is PHI, that IN1.16 (insured name) is PHI, that OBX-5 might be PHI depending on the observation type.

**Safe Harbor field map:**

| Identifier | Primary v2 Location(s) |
|---|---|
| Name | PID.5, NK1.2, IN1.16, GT1.3 |
| Address | PID.11, NK1.4, GT1.5 |
| Dates (except year) | PID.7, PID.29, PV1.44, PV1.45 |
| Phone/Fax | PID.13, PID.14, NK1.5, NK1.6 |
| SSN | PID.19 |
| MRN | PID.3 |
| Account number | PID.18, PV1.19 |
| Device identifiers | OBX.18 |

**J1:** Identify PHI fields in a clean PID + PV1 message. Apply date generalization (keep year, strip month/day).
**J2:** Handle the full segment spread — PID + NK1 + IN1 + GT1 + NTE. NTE contains a phone number embedded in free text ("Call patient at 206-555-0142 to schedule follow-up").
**J3:** Apply Expert Determination vs Safe Harbor — when a statistician certifies that a 3-digit ZIP is sufficient, which PID.11 components can be retained? Evaluate re-identification risk from MSH-3/MSH-4 + PV1-19 correlation.

---

### Station 9: Minimum Necessary Filtering (Privacy 2/3)

**Concept:** HIPAA's Minimum Necessary Rule requires that each recipient of PHI receive only the information needed for their purpose. In HL7 v2, this means segment-level and field-level filtering per downstream receiver — a billing system doesn't need OBX clinical results, a lab system doesn't need IN1 insurance data.

**Before panel:** Complete message with all segments.
**After panel:** Filtered message variants — one per receiver — showing which segments were retained, stripped, or redacted.

**Interaction:** The learner is given 3-4 receiver profiles (billing system, clinical data repository, lab system, research warehouse) and must define segment-level filter rules for each. A matrix-style exercise: rows are segments (PID, PV1, DG1, OBX, IN1, NK1, NTE), columns are receivers, cells are retain/strip/redact.

**This station has no C-CDA equivalent.** C-CDA documents are monolithic — you send the whole document. HL7 v2's message routing model makes Minimum Necessary an active design decision at every interface.

**J1:** Two receivers, obvious filtering — billing gets PID + PV1 + DG1 + IN1 but not OBX. Lab gets PID + OBR + OBX but not IN1 or DG1.
**J2:** A receiver needs partial PID — they need MRN (PID.3) but not name (PID.5) or SSN (PID.19). Introduce field-level filtering within a segment.
**J3:** The research warehouse wants de-identified data. This is the intersection of Station 8 (de-identification) and Station 9 (Minimum Necessary) — the learner must apply both filters in sequence and determine the correct order of operations.

---

### Station 10: Sensitive Diagnosis & Free-Text Handling (Privacy 3/3)

**Concept:** 42 CFR Part 2 restricts redisclosure of substance abuse treatment records. State laws add protections for mental health, HIV/AIDS, genetic testing, and reproductive health. In HL7 v2, sensitive diagnoses appear in DG1-3 (coded) and may also appear in NTE and OBX-5 (free text). Both must be addressed.

**Before panel:** Maya Patel's (P003) message stream with DG1 and NTE segments containing substance abuse references.
**After panel:** Filtered message with sensitive content handled — DG1 segments removed or redacted, NTE text scrubbed, OBX free-text scanned.

**Interaction — two-phase exercise:**

Phase 1 (Structured): Identify DG1 segments with ICD-10-CM codes in the F10-F19 range (substance-related disorders). Decide: strip the segment entirely, redact DG1-3 but keep the segment shell, or replace with a general code.

Phase 2 (Unstructured): Scan NTE and OBX-5 text for substance abuse references. Maya's NTE contains "Patient discussed AA meeting schedule with counselor." The learner must identify this as a 42 CFR Part 2 disclosure risk even though it contains no ICD code.

**J1:** Identify a single DG1 with a substance abuse code. Apply the strip rule.
**J2:** Handle the NTE free-text problem. Introduce the concept of NLP-based scanning (regex for keywords as a minimum, with acknowledgment that this is fragile).
**J3:** Maya Patel has a signed 42 CFR Part 2 consent form authorizing disclosure to her PCP but not to the research warehouse. Apply consent-based filtering — the same message gets different treatment depending on the receiver. Connects back to Station 9's receiver-specific filtering.

---

### Station 11: Segment-to-Resource Mapping (FHIR 1/3)

**Concept:** Converting HL7 v2 segments to FHIR resources is not a one-to-one mapping. A single PID segment contributes to Patient, and potentially RelatedPerson and Coverage. OBX maps to Observation in most contexts but can map to Condition, AllergyIntolerance, or MedicationStatement depending on OBX-3 and message context. The official HL7 v2-to-FHIR Implementation Guide governs these mappings.

**Before panel:** HL7 v2 segment(s).
**After panel:** FHIR resource JSON with field-level provenance annotations ("this value came from PID.5.1").

**Interaction:** The learner is given a segment and must select the correct target FHIR resource type, then map specific fields. Fill-in-blank connecting v2 fields to FHIR resource elements.

**Core mappings taught:**

| v2 Segment | Primary FHIR Resource | Secondary/Context-Dependent |
|---|---|---|
| PID | Patient | RelatedPerson (from NK1 cross-ref) |
| PV1 | Encounter | Location (from PV1.3) |
| OBR | DiagnosticReport | ServiceRequest |
| OBX | Observation | Condition, AllergyIntolerance (context) |
| DG1 | Condition | — |
| IN1 | Coverage | Organization (from IN1.3) |
| RXA | MedicationAdministration | Medication, Immunization |

**J1:** Map PID → Patient and OBX → Observation for a clean lab result. Straightforward field-to-element mapping.
**J2:** Handle an OBX that represents an allergy (OBX-3 = local allergy code). The learner must recognize this isn't an Observation — it's an AllergyIntolerance. Decide how to determine resource type from OBX-3 context.
**J3:** Map a complete ADT^A01 message (PID + PV1 + DG1 + IN1 + NK1) to a set of FHIR resources. Identify all the resource types produced and the references between them.

---

### Station 12: US Core Profile Conformance & Vocabulary Binding (FHIR 2/3)

**Concept:** USCDI defines required data elements for nationwide health information exchange. US Core FHIR profiles enforce these requirements — must-support elements, required terminology bindings, value set constraints. A FHIR resource can be valid against base FHIR but non-conformant against US Core.

**Before panel:** FHIR resource JSON from Station 11.
**After panel:** Validation report — US Core profile, element, conformance status, required terminology binding, actual value.

**USCDI data classes mapped to v2 sources and US Core profiles:**

| USCDI Data Class | v2 Source | US Core Profile | Required Terminology |
|---|---|---|---|
| Patient Demographics | PID | US Core Patient | Race (CDC), Ethnicity (CDC), Birth Sex (HL7) |
| Encounters | PV1 | US Core Encounter | Encounter Type (CPT/SNOMED) |
| Problems | DG1 | US Core Condition | ICD-10-CM or SNOMED CT |
| Medications | RXA/RXE | US Core MedicationRequest | RxNorm |
| Lab Results | OBX | US Core Laboratory Result | LOINC |
| Vital Signs | OBX (vital LOINC) | US Core Vital Signs | LOINC (vital signs panel) |
| Immunizations | RXA (CVX) | US Core Immunization | CVX |

**J1:** Validate a clean Patient resource against US Core. Confirm birthDate, name, gender are present.
**J2:** Handle missing must-support elements. PID.10 (race) is empty. US Core Patient requires the US Core Race Extension. Options: data absent reason extension, reject the message back to source, populate from MPI data. Evaluate tradeoffs.
**J3:** Vital Signs profiling — Aisha Washington's OBX contains a blood pressure reading. US Core Vital Signs profile requires the BP to be split into systolic and diastolic components with specific LOINC codes (8480-6, 8462-4) under a panel code (85354-9). The v2 OBX has it as a single composite value. The learner must restructure the resource to conform.

---

### Station 13: Bundle Assembly & Reference Wiring (FHIR 3/3)

**Concept:** Individual FHIR resources must be packaged into a Bundle for transmission. Each resource gets a unique fullUrl. Resources reference each other using these URLs. The Bundle type (transaction, batch, document, message) determines processing semantics. Resource ordering within a transaction Bundle matters.

**Before panel:** List of individual FHIR resources from Stations 11-12.
**After panel:** Complete FHIR transaction Bundle JSON with references wired.

**Interaction:** The learner arranges resources in correct dependency order, sets fullUrl values, and fills in reference fields. A wiring diagram shows the reference graph — Patient ← Encounter ← Condition, Patient ← Observation, Encounter ← Observation.

**Bundle concepts taught:** Bundle.type (transaction vs message), entry.request (method: POST/PUT), entry.fullUrl (urn:uuid: scheme for temporary IDs), resource ordering for referential integrity, conditional references.

**J1:** Assemble a 3-resource Bundle (Patient, Encounter, Condition) from Sarah Chen's A01. Wire Encounter.subject and Condition.subject to Patient. Set Bundle.type = transaction with POST requests.
**J2:** Handle resource identity conflicts — two messages for the same patient produce two Patient resources. Should the second be a PUT (update) or a conditional create? Introduce ifNoneExist conditional references.
**J3:** Assemble a complete Bundle for Aisha Washington's ED encounter — Patient, Encounter, multiple Observations (labs + vitals), Conditions from DG1, MedicationAdministrations. 8+ resources with a complex reference graph. Validate the Bundle structure and identify missing references.

**Cross-reference:** Station 13 closing text: *"Your pipeline now produces validated, de-identified, US Core-conformant FHIR Bundles. Continue to Part 2 to transform this message stream into an analytics-ready dataset."* Includes "Continue to Part 2: From Pipeline to Prediction →" callout.

---

## Part 2 — From Pipeline to Prediction (5 Stations)

### Design Philosophy

Part 1 processes individual messages. Part 2 steps back and looks at the *message stream* — the accumulated set of messages generated by the cohort across an entire encounter. The unit of analysis shifts from "one message" to "one patient's encounter" and eventually "the cohort." Part 2 builds directly on Part 1's foundation — every transformation, validation, and privacy decision from the interface pipeline shapes the data that enters the aggregation flow.

**Terminal goal:** An encounter-level analytics dataset suitable for an ED high-utilizer prediction model — predicting which patients will have 4+ ED visits in 12 months based on demographics, clinical features, utilization history, and social determinants inferred from message patterns.

**Cross-reference:** Opening screen displays: *"This tutorial begins where Part 1 ended — with a stream of processed HL7 v2 messages. Here, you'll aggregate that stream into an encounter-level dataset suitable for clinical prediction."*

---

### Station A1: Message Stream Assembly

**Concept:** A single patient encounter generates multiple HL7 v2 messages — ADT^A01, several ORU^R01s, possibly ADT^A02 (transfer), and ADT^A03 (discharge). These arrive independently. The first aggregation step is grouping messages into encounter-level records by matching on PV1-19 (visit number) and PID.3 (MRN).

**Before panel:** Chronological stream of all messages for the cohort (interleaved — messages from different patients mixed together as they would arrive at an interface engine).
**After panel:** Messages grouped by patient and encounter, with encounter boundaries marked.

**Interaction:** The learner defines grouping keys. Fill-in-blank: "Which field uniquely identifies a patient across messages?" (PID.3 — MRN). "Which field groups messages into the same encounter?" (PV1-19 — visit number). Decision exercise: two messages have the same MRN but different visit numbers — same encounter or different?

**Edge case:** Aisha Washington (P005) has messages arriving out of chronological order — an ORU^R01 with a lab result timestamped 14:30 arrives before an ORU^R01 timestamped 14:15 (the 14:15 lab took longer to process). The learner must recognize that MSH-7 (message timestamp) and OBR-7 (observation datetime) can differ, and that clinical ordering should use OBR-7, not MSH-7.

---

### Station A2: Temporal Reconciliation & Conflict Resolution

**Concept:** Once messages are grouped, conflicts must be resolved. ADT^A08 (update patient info) messages modify demographics mid-encounter — which version is authoritative? Lab results may be corrected (OBX with OBX-11 = "C" for corrected result replacing an earlier "P" for preliminary). The reconciliation engine must apply last-write-wins, correction semantics, or merge logic depending on the field.

**Before panel:** Two or more messages for the same patient/encounter with conflicting field values highlighted.
**After panel:** Reconciled record showing which value was retained and why.

**Interaction:** The learner is given conflict scenarios and selects the resolution strategy.

**Conflict scenarios from the cohort:**

- **James Morrison (P004):** Two ADT^A08 messages update PID.11 (address) 3 hours apart. Which address is current? (Last by MSH-7 timestamp — v2 uses snapshot semantics for demographics.)
- **Aisha Washington (P005):** OBX for WBC arrives with OBX-11 = "P" (preliminary) at 14:30, then a corrected result with OBX-11 = "C" at 16:00. The corrected value replaces the preliminary — but should the preliminary be deleted or retained with a status flag?
- **Robert Kowalski (P002):** His OBX-3 was mapped from a local code to LOINC in Station 4. A second OBX arrives with the same local code but a slightly different OBX-5 value. Is this a duplicate, an update, or a new observation? (Answer depends on OBR-7 timestamp and OBX-4 sub-ID.)

---

### Station A3: Cross-Message Feature Extraction

**Concept:** Analytic features must be extracted from the reconciled message stream and flattened into encounter-level columns. Each feature has a specific source segment and extraction rule. Some features are direct (DG1-3 → primary diagnosis code), some are computed (LOS = A03 timestamp - A01 timestamp), and some require aggregation (number of lab results = count of OBX segments with OBX-11 in (F, C)).

**Before panel:** Reconciled message stream for one patient's encounter.
**After panel:** Feature vector — one row, multiple columns, with provenance annotations showing which message/segment each value came from.

**Feature set for the ED high-utilizer model:**

| Feature | Source | Extraction Rule |
|---|---|---|
| age_at_encounter | PID.7, PV1.44 | PV1.44 year - PID.7 year |
| admin_sex | PID.8 | Direct |
| zip_3digit | PID.11.5 | First 3 characters (de-identified) |
| encounter_type | PV1.2 | Direct (E = emergency, I = inpatient, O = outpatient) |
| admit_source | PV1.14 | Direct |
| primary_dx_icd10 | DG1-3 (first DG1) | Direct |
| dx_count | DG1 segments | Count |
| los_hours | PV1.44, PV1.45 | Timestamp difference |
| lab_result_count | OBX (OBX-11 in F,C) | Count |
| wbc_first | OBX where OBX-3 = 6690-2 | First by OBR-7 |
| creatinine_first | OBX where OBX-3 = 2160-0 | First by OBR-7 |
| lactate_first | OBX where OBX-3 = 2524-7 | First by OBR-7 |
| has_substance_dx | DG1-3 in F10-F19 | Boolean (privacy-aware) |
| transfer_count | ADT^A02 messages | Count |
| arrival_hour | PV1.44 | Hour component (time-of-day feature) |
| weekend_flag | PV1.44 | Day of week in {Sat, Sun} |

**Interaction:** Fill-in-blank on extraction rules. Decision exercises on computed features — "How do you handle LOS when ADT^A03 is missing?" Multiple-choice on aggregation method — "When a patient has 3 WBC results, which one becomes wbc_first?"

---

### Station A4: Dataset Shaping & Quality Assessment

**Concept:** The extracted features must be assembled into a tabular dataset, assessed for completeness and quality, and documented. Missing values, outliers, class imbalance, and potential biases must be identified before the dataset is used for modeling.

**Before panel:** Feature vectors for all 5 cohort patients (5 rows x 17 columns).
**After panel:** Quality report — completeness percentage per column, outlier flags, distribution summaries, bias warnings.

**Interaction:** The learner examines the dataset and identifies quality issues.

**Quality issues embedded in the cohort:**

- **Robert Kowalski (P002):** creatinine_first is populated but lactate_first is NULL — his v2.3 source system doesn't send lactate. Missing data pattern correlated with source system version (systemic gap, not random missingness).
- **Maya Patel (P003):** has_substance_dx was set to NULL by the privacy pipeline (42 CFR Part 2 redaction). The feature is systematically missing for patients with substance use disorders — the very population the model should identify. This is a bias landmine.
- **Aisha Washington (P005):** los_hours = 2.3 (short ED stay) while others have 48-96+ hours (inpatient). Encounter type mixing — ED and inpatient encounters have different LOS distributions and shouldn't be modeled together without stratification.

**Decision exercise:** How do you handle has_substance_dx being redacted by privacy rules? Options (randomized position): (a) drop the feature entirely, (b) impute as FALSE (introduces label bias), (c) create a substance_dx_available missingness indicator (exposes redaction status — is that a privacy violation?), (d) exclude patients with redacted values (reduces sample, biases cohort). There is no clean answer — the exercise teaches that privacy and analytics are in genuine tension.

---

### Station A5: Dataset Card & Provenance Documentation

**Concept:** A dataset card documents the dataset's origin, composition, intended use, limitations, and ethical considerations. For a dataset derived from HL7 v2 message streams, provenance is especially important — the data passed through parsing, validation, vocabulary translation, de-identification, FHIR conversion, and aggregation. Each transformation could introduce bias or error.

**Before panel:** The completed dataset from Station A4.
**After panel:** Dataset card document — structured sections.

**Interaction:** Fill-in-blank on dataset card sections. The learner completes statements like: "This dataset was derived from _____ HL7 v2 message types" (ADT, ORU). "Substance use disorder features are systematically _____ due to _____" (missing, 42 CFR Part 2 redaction). "The dataset should NOT be used for _____ without additional _____" (individual clinical decisions, validation on a larger cohort).

**Dataset card sections:**

1. Purpose & intended use (ED high-utilizer risk stratification)
2. Source description (5-patient cohort, HL7 v2.3/v2.5.1 mixed)
3. Collection window & volume (message counts per patient)
4. Pipeline provenance (13-station transformation chain — link back to Part 1)
5. Feature definitions & derivation rules (table from Station A3)
6. Known limitations (small cohort, mixed v2 versions, systematic missingness)
7. Bias & fairness considerations (substance use redaction, source-system-dependent feature availability, demographic skew)
8. Privacy compliance (Safe Harbor applied, 42 CFR Part 2 honored, re-identification risk assessment)
9. Recommended next steps (validation cohort, feature engineering, temporal splitting)

---

---

## Cross-Tutorial Tool Integration

Both parts include lightweight recognition-level exposure to production tools from earlier tutorials in the suite (GX EHR Validation Tutorial v2 and dbt Data Modeling Tutorial). These are *recognition patterns*, not *construction exercises* — the learner sees familiar tooling applied to the HL7 v2 domain, reinforcing cross-tutorial connections without derailing the HL7 v2 focus.

**Pedagogical framing (consistent for both):** "You just did this manually. Here's the production automation equivalent."

### Great Expectations in Part 1 — Station 5 (Validation)

Station 5 already teaches validation concepts. GX adds a "how would you express this rule in a production automation framework?" capstone panel at the end of the station.

**GX expectations included (2-3 total):**

1. **Structural check:** `expect_column_values_to_not_be_null` applied to MSH-10 (message control ID). Maps to "every message must have a control ID" — already validated manually by the learner.
2. **Format check:** `expect_column_values_to_match_regex` applied to MSH-7 timestamp field, enforcing YYYYMMDDHHMMSS format. Ties back to Robert Kowalski's v2.3 timestamp problem and shows how GX catches it programmatically.
3. **Cross-field check:** `expect_column_pair_values_a_to_be_greater_than_b` comparing discharge date (PV1-45) to admit date (PV1-44). The business rule already taught in the station.

**Interaction:** A short "Production Automation" panel — not a separate exercise flow. 3-line code blocks where the learner fills in one or two blanks (the expectation name or the column parameter).

**Scope boundary:** Does NOT introduce suites, checkpoints, data contexts, or the GX configuration stack. Does NOT ask the learner to build a validation pipeline. Shows only "here's what the automated version of what you just did looks like."

**Complexity cost:** ~40-60 lines of additional station content. No new UI components.

**Regex-in-comments safety:** The `expect_column_values_to_match_regex` call includes a regex pattern that could trigger the known render bug. The GX command will be shown in a static code display panel, not in a fill-in-blank template where the renderer processes placeholder indices. Same mitigation as applied in the GX tutorial fix.

### dbt in Part 2 — Stations A3 and A4

Part 2's aggregation flow maps to dbt's layered model: raw messages → staged/grouped messages → encounter-level mart table. Two dbt touch points at the natural junctures.

**Station A3 (Cross-Message Feature Extraction) — Materialization:**

The feature extraction logic is a SQL transformation from staged messages to an encounter-level feature table — this *is* a dbt model. A short panel shows the dbt model header:

```
{{ config(materialized='table') }}

SELECT
  encounter_id,
  age_at_encounter,
  ...
FROM {{ ref('stg_hl7v2_messages') }}
```

**Fill-in-blank exercise:** "Given that this encounter dataset is rebuilt nightly from the full message stream and reconciliation reprocesses conflicts, which materialization is appropriate?" Answer: `table` (full refresh). The `{{ ref('stg_hl7v2_messages') }}` reference reinforces the dbt convention that models reference staging layers via ref() rather than hardcoded table names — a callback to the dbt tutorial.

**Station A4 (Dataset Shaping & Quality Assessment) — Schema Tests:**

The quality checks map to dbt's built-in tests. A `schema.yml` snippet shows:

1. `not_null` test on `encounter_id` and `primary_dx_icd10` — fields the learner already identified as required
2. `accepted_values` test on `encounter_type` restricting to E, I, O — known from PV1.2 semantics

**Fill-in-blank exercise:** The learner completes the test name or the accepted values list in the YAML block.

**Scope boundary:** Does NOT introduce dbt project structure, seeds, sources, ref() chains, Jinja macros, or the dbt CLI. Does NOT ask the learner to configure profiles.yml or run `dbt build`. Shows two artifacts — a model config line and a schema test block — as "here's what this looks like in production."

**Complexity cost:** ~50-70 lines across both stations. No new UI components.

### Combined impact

Total complexity cost: ~100-130 lines across both parts. Both integrations fit naturally within existing station content and UI patterns. They create satisfying recognition moments for learners who have completed the GX and dbt tutorials, and serve as accessible previews for learners who haven't.

---

## UI/UX Enhancements Over C-CDA Lab

### Live Message Parser

Persistent panel available at all stations. Learner pastes or selects a message, hovers over or clicks any field, sees address/name/data type tooltip. Built with simple JS string splitting on |, ^, &, ~. This is possible because HL7 v2's pipe-delimited format is trivially parseable in-browser — C-CDA's XML structure made an equivalent tool impractical.

### ACK Feedback System

Replaces generic correct/incorrect UI. Every exercise response generates a rendered MSA segment:
- MSA|AA|{control_id} for correct answers
- MSA|AE|{control_id} with ERR segment for recoverable errors (with hint)
- MSA|AR|{control_id} for reject-level errors (with explanation)

Teaches ACK semantics passively throughout both parts.

### Segment Builder

Interactive construction tool available at Stations 2, 6, 11, and 13. Learner fills in labeled field slots, watches pipe-delimited output assemble in real time above the input form. Teaches by production rather than just consumption.

### Version Diff Viewer

Side-by-side comparison available at Stations 2, 4, and 5. Same clinical event encoded in v2.3 and v2.5.1 with differences highlighted. Teaches version-awareness as a practical skill.

### Receiver Matrix

Grid-style interaction used in Stations 9 and 10. Rows are segments, columns are receivers. Learner toggles retain/strip/redact per cell. Unique to HL7 v2 — C-CDA's monolithic document model didn't support receiver-specific filtering.

### Message Flow Animation

Header pipeline bar rendered as a network topology rather than a linear station sequence. Messages animate between system nodes (source → interface engine → destinations). Used primarily as navigation/orientation, not as a primary exercise tool.

---

## Technical Considerations

### File Size Projections

- **Part 1 — The Interface Pipeline:** 13 stations with richer interactions (live parser, ACK feedback, segment builder, receiver matrix): ~6,000-7,000 lines
- **Part 2 — From Pipeline to Prediction:** 5 stations with dataset-oriented interactions: ~2,500-3,000 lines
- Both within single-file HTML viability

### Technology Stack

- Vanilla HTML/CSS/JavaScript, single-file architecture per tutorial
- No sql.js dependency — both parts use a JS decision-state model with embedded data objects (same approach as C-CDA lab)
- Message parsing via native string manipulation (split on |, ^, &, ~)
- No build step, no server dependency

### Shared Visual Identity

- Same three-font stack as existing tutorial suite
- Dark theme with CSS custom properties
- Consistent color palette with C-CDA lab for suite cohesion
- "Developed by: Joe Williams" credit in hero section

### Persistence

- localStorage for journey progress, decisions, and reveal counts
- Keyed by tutorial ID to avoid collision between Part 1 and Part 2
- No cross-tutorial data sharing at runtime

### Known Pitfalls

- **Regex-in-comments:** All exercise definitions will avoid patterns like \d{n} in code comments, per the established pitfall from the GX tutorial
- **Answer position:** Correct answers distributed across all positions per the randomization principle documented above
- **HL7 v2 pipe characters in HTML:** The | character needs no HTML escaping but must be handled carefully in any template literal or innerHTML context

---

## Design Decisions & Rationale

### Why two separate files instead of one?

The conceptual break between "processing individual messages" (Part 1) and "aggregating a message stream into a dataset" (Part 2) is a natural pedagogical boundary. Part 2 builds on Part 1 as its foundation, but a learner focused on interface engine skills may not need the analytics extension. A learner focused on data engineering may want to start at Part 2 with the message processing treated as a prerequisite. Separate files respect both use cases while maintaining a clear directional relationship — Part 1 feeds Part 2, not the reverse.

### Why 3 privacy stations instead of 1?

HL7 v2 has more privacy surface area than C-CDA: PHI scattered across more segment types, Minimum Necessary filtering per receiver (no C-CDA equivalent), and the dual structured/unstructured problem for sensitive diagnoses. A single station would trivialize the complexity or compress it into an unlearnable wall of content.

### Why 3 FHIR/USCDI stations instead of 1?

The v2-to-FHIR conversion involves three distinct skill sets: segment-to-resource mapping (knowing which resource type to produce), US Core conformance (knowing the additional constraints beyond base FHIR), and Bundle assembly (knowing how to wire resources together). Each is independently testable and independently valuable.

### Why ED high-utilizer as the terminal goal?

It's well-established in population health literature, features are directly derivable from ADT + ORU message streams, and it creates a natural tension with the privacy pipeline (substance use disorder is both a key predictor and a 42 CFR Part 2 protected category). That tension is pedagogically valuable.

### Why the Riverside Cohort instead of reusing the Cascade Cohort?

Clean separation between tutorials. The C-CDA lab's Cascade Cohort was designed for document-level challenges; the Riverside Cohort is designed for message-stream challenges. Different patient histories surface different learning objectives.
