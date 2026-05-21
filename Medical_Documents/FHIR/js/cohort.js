/* ============================================================
   Cascade Cohort — 5 patients, FHIR R4, US Core aligned
   Shared across Consume and Produce journeys with different framings:
     - Consume: "data we are receiving from a regional HIE"
     - Produce: "data we need to submit to external systems"
   ============================================================ */

const COHORT = [
  {
    id: "P001",
    name: "Maria Gonzalez",
    age: 62,
    sex: "female",
    role: "Type 2 diabetic, index admission — primary readmission risk case",
    consumeRole: "Incoming from Cascade Regional HIE; clean US Core conformance",
    produceRole: "Submitting post-discharge summary to primary care",
    conditions: ["Type 2 diabetes mellitus", "Essential hypertension"],
    medications: ["Metformin 500 MG", "Lisinopril 10 MG"],
    // Minimal FHIR R4 Bundle — expanded in station payloads
    fhir: {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: "p001",
            meta: { profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"] },
            identifier: [{
              system: "http://hospital.cascade.example/mrn",
              value: "CRH-10001"
            }],
            name: [{ family: "Gonzalez", given: ["Maria"] }],
            gender: "female",
            birthDate: "1963-04-12",
            extension: [{
              url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
              extension: [
                { url: "ombCategory", valueCoding: { system: "urn:oid:2.16.840.1.113883.6.238", code: "2106-3", display: "White" }},
                { url: "text", valueString: "White" }
              ]
            }]
          }
        }
      ]
    }
  },
  {
    id: "P002",
    name: "Robert Kowalski",
    age: 71,
    sex: "male",
    role: "CHF, recent inpatient admission — positive readmission label",
    consumeRole: "Incoming with an ICD-9 legacy code that needs crosswalk",
    produceRole: "Submitting medication reconciliation to community pharmacy",
    conditions: ["Congestive heart failure", "Atrial fibrillation"],
    medications: ["Furosemide 40 MG", "Warfarin 5 MG", "Metoprolol 50 MG"],
    fhir: {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: "p002",
            meta: { profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"] },
            identifier: [{
              system: "http://hospital.cascade.example/mrn",
              value: "CRH-10002"
            }],
            name: [{ family: "Kowalski", given: ["Robert"] }],
            gender: "male",
            birthDate: "1954-08-30"
          }
        }
      ]
    }
  },
  {
    id: "P003",
    name: "Jamal Washington",
    age: 45,
    sex: "male",
    role: "Behavioral health — 42 CFR Part 2 candidate",
    consumeRole: "Incoming with narrative PHI that needs NLP de-id",
    produceRole: "Submitting outpatient note — Part 2 redaction required",
    conditions: ["Major depressive disorder, recurrent", "Opioid use disorder, in remission"],
    medications: ["Sertraline 100 MG", "Buprenorphine/naloxone 8-2 MG"],
    fhir: {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: "p003",
            meta: { profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"] },
            identifier: [{
              system: "http://hospital.cascade.example/mrn",
              value: "CRH-10003"
            }],
            name: [{ family: "Washington", given: ["Jamal"] }],
            gender: "male",
            birthDate: "1980-11-15"
          }
        }
      ]
    }
  },
  {
    id: "P004",
    name: "Emily Chen",
    age: 34,
    sex: "female",
    role: "Healthy control — low readmission risk",
    consumeRole: "Incoming with minimal clinical data; extension-free",
    produceRole: "Submitting wellness visit summary",
    conditions: [],
    medications: [],
    fhir: {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: "p004",
            meta: { profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"] },
            identifier: [{
              system: "http://hospital.cascade.example/mrn",
              value: "CRH-10004"
            }],
            name: [{ family: "Chen", given: ["Emily"] }],
            gender: "female",
            birthDate: "1991-06-22"
          }
        }
      ]
    }
  },
  {
    id: "P005",
    name: "Maria Gonzales",
    age: 60,
    sex: "female",
    role: "Near-duplicate of P001 — record linkage challenge",
    consumeRole: "Incoming with possible duplicate of P001 (spelling variant)",
    produceRole: "Submitting with conditional create to avoid duplicate",
    conditions: ["Type 2 diabetes mellitus"],
    medications: ["Metformin 1000 MG"],
    fhir: {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: "p005",
            meta: { profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"] },
            identifier: [{
              system: "http://hospital.cascade.example/mrn",
              value: "CRH-10005"
            }],
            name: [{ family: "Gonzales", given: ["Maria"] }],
            gender: "female",
            birthDate: "1965-04-12"
          }
        }
      ]
    }
  }
];

window.COHORT = COHORT;
