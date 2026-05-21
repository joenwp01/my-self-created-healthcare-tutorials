import React, { useMemo, useState } from "react";

const flows = [
  {
    id: "pec",
    label: "Patient + Encounter + Condition",
    description:
      "Shows how registration and diagnosis data are cleaned, linked, and shaped into connected FHIR resources.",
    steps: [
      {
        title: "Inbound source row",
        subtitle: "Registration plus diagnosis arrives from a source system",
        need: "The source is operational data, not yet interoperable or analytics-ready.",
        before: `patient_mrn,last_name,first_name,dob,sex,visit_id,visit_date,department,diag_code,diag_text\n445566,DOE,JANE,1980-04-12,F,V1001,2026-04-13,Cardiology,I10,Hypertension`,
        after: `patient_mrn,last_name,first_name,dob,sex,visit_id,visit_date,department,diag_code,diag_text\n445566,DOE,JANE,1980-04-12,F,V1001,2026-04-13,Cardiology,I10,Hypertension`,
        changes: [
          "The pipeline first receives and stores the raw row unchanged.",
          "Nothing has been validated or standardized yet.",
        ],
      },
      {
        title: "Parse and identify core entities",
        subtitle: "Split the source into patient, encounter, and diagnosis parts",
        need: "We must separate person data, visit context, and condition facts.",
        before: `patient_mrn,last_name,first_name,dob,sex,visit_id,visit_date,department,diag_code,diag_text\n445566,DOE,JANE,1980-04-12,F,V1001,2026-04-13,Cardiology,I10,Hypertension`,
        after: `{
  "patient": {
    "mrn": "445566",
    "name": { "family": "DOE", "given": "JANE" },
    "dob": "1980-04-12",
    "sex": "F"
  },
  "encounter": {
    "visitId": "V1001",
    "visitDate": "2026-04-13",
    "department": "Cardiology"
  },
  "condition": {
    "code": "I10",
    "text": "Hypertension"
  }
}`,
        changes: [
          "The flat row is split into logical entities.",
          "This makes it easier to validate each piece separately.",
          "The diagnosis is still only a source fact, not yet a FHIR Condition resource.",
        ],
      },
      {
        title: "Normalize and validate",
        subtitle: "Clean identifiers and standardize values",
        need: "FHIR expects consistent identifiers and constrained values.",
        before: `{
  "mrn": "445566",
  "dob": "1980-04-12",
  "sex": "F",
  "visitDate": "2026-04-13",
  "department": "Cardiology",
  "code": "I10"
}`,
        after: `{
  "patientId": "urn:mrn:HOSP:445566",
  "birthDate": "1980-04-12",
  "gender": "female",
  "encounterId": "enc-V1001",
  "encounterClass": "AMB",
  "serviceTypeText": "Cardiology",
  "conditionCoding": {
    "system": "http://hl7.org/fhir/sid/icd-10-cm",
    "code": "I10",
    "display": "Essential (primary) hypertension"
  }
}`,
        changes: [
          "The MRN becomes a stable identifier.",
          "Sex is normalized to FHIR gender values.",
          "The visit is recognized as an ambulatory encounter.",
          "The diagnosis code is tied to a standard code system.",
        ],
      },
      {
        title: "Build linked FHIR resources",
        subtitle: "Create Patient, Encounter, and Condition",
        need: "FHIR represents these as separate resources connected by references.",
        before: `patient + encounter + diagnosis facts`,
        after: `{
  "resourceType": "Bundle",
  "type": "collection",
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "patient-445566",
        "identifier": [{ "system": "urn:mrn:HOSP", "value": "445566" }],
        "name": [{ "family": "Doe", "given": ["Jane"] }],
        "gender": "female",
        "birthDate": "1980-04-12"
      }
    },
    {
      "resource": {
        "resourceType": "Encounter",
        "id": "enc-V1001",
        "status": "finished",
        "class": { "code": "AMB" },
        "subject": { "reference": "Patient/patient-445566" },
        "period": { "start": "2026-04-13" },
        "serviceType": { "text": "Cardiology" }
      }
    },
    {
      "resource": {
        "resourceType": "Condition",
        "id": "cond-V1001-I10",
        "clinicalStatus": { "text": "active" },
        "code": {
          "coding": [{
            "system": "http://hl7.org/fhir/sid/icd-10-cm",
            "code": "I10",
            "display": "Essential (primary) hypertension"
          }]
        },
        "subject": { "reference": "Patient/patient-445566" },
        "encounter": { "reference": "Encounter/enc-V1001" }
      }
    }
  ]
}`,
        changes: [
          "One source row becomes three connected FHIR resources.",
          "Condition points to both Patient and Encounter.",
          "This shape is useful for apps and exchange between systems.",
        ],
      },
      {
        title: "Flatten for SQL analytics",
        subtitle: "Prepare a warehouse-friendly row",
        need: "Analysts usually prefer one row with joined context.",
        before: `Patient -> Encounter -> Condition`,
        after: `patient_id | encounter_id | condition_code | condition_display                  | visit_date  | service_type | gender | birth_date\n445566     | enc-V1001    | I10            | Essential (primary) hypertension | 2026-04-13 | Cardiology   | female | 1980-04-12`,
        changes: [
          "FHIR references are joined into one reporting row.",
          "This is easier for dashboards and cohort logic.",
        ],
      },
    ],
  },
  {
    id: "med",
    label: "MedicationRequest flow",
    description:
      "Shows how a medication order is normalized, coded, and shaped into MedicationRequest plus supporting resources.",
    steps: [
      {
        title: "Inbound medication order",
        subtitle: "A prescribing event arrives from the source system",
        need: "The source order must be separated from normalized medication concepts.",
        before: `order_id,patient_mrn,drug_name_local,sig,start_date,status,provider\nRX9001,445566,Lisinopril 10 MG Tab,1 tablet by mouth daily,2026-04-13,A,Dr Smith`,
        after: `order_id,patient_mrn,drug_name_local,sig,start_date,status,provider\nRX9001,445566,Lisinopril 10 MG Tab,1 tablet by mouth daily,2026-04-13,A,Dr Smith`,
        changes: [
          "The raw prescribing row is received as-is.",
          "The order status and medication name are still local source values.",
        ],
      },
      {
        title: "Parse medication fields",
        subtitle: "Break the order into medication, dose instruction, and author context",
        need: "We need structured values before building MedicationRequest.",
        before: `RX9001,445566,Lisinopril 10 MG Tab,1 tablet by mouth daily,2026-04-13,A,Dr Smith`,
        after: `{
  "orderId": "RX9001",
  "patientMrn": "445566",
  "medicationLocalText": "Lisinopril 10 MG Tab",
  "sig": "1 tablet by mouth daily",
  "startDate": "2026-04-13",
  "status": "A",
  "prescriber": "Dr Smith"
}`,
        changes: [
          "The prescribing row is split into medication and instruction elements.",
          "The free-text SIG is kept but becomes easier to interpret downstream.",
        ],
      },
      {
        title: "Normalize status and code the drug",
        subtitle: "Map local medication text to a standard terminology concept",
        need: "Cross-system medication exchange is hard without standard coding.",
        before: `{
  "medicationLocalText": "Lisinopril 10 MG Tab",
  "status": "A"
}`,
        after: `{
  "patientId": "urn:mrn:HOSP:445566",
  "medicationCode": {
    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
    "code": "316151",
    "display": "lisinopril 10 MG Oral Tablet"
  },
  "requestStatus": "active",
  "intent": "order",
  "dosageInstruction": {
    "text": "1 tablet by mouth daily"
  },
  "authoredOn": "2026-04-13"
}`,
        changes: [
          "Local drug text is mapped to a standard RxNorm concept.",
          "Source status A becomes FHIR status active.",
          "The order intent is recognized as order.",
        ],
      },
      {
        title: "Build MedicationRequest bundle",
        subtitle: "Create Patient, Practitioner, and MedicationRequest",
        need: "FHIR represents prescribing as a request resource connected to the patient and prescriber.",
        before: `normalized medication order facts`,
        after: `{
  "resourceType": "Bundle",
  "type": "collection",
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "patient-445566",
        "identifier": [{ "system": "urn:mrn:HOSP", "value": "445566" }]
      }
    },
    {
      "resource": {
        "resourceType": "Practitioner",
        "id": "prac-smith",
        "name": [{ "text": "Dr Smith" }]
      }
    },
    {
      "resource": {
        "resourceType": "MedicationRequest",
        "id": "medrx-RX9001",
        "status": "active",
        "intent": "order",
        "medicationCodeableConcept": {
          "coding": [{
            "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
            "code": "316151",
            "display": "lisinopril 10 MG Oral Tablet"
          }]
        },
        "subject": { "reference": "Patient/patient-445566" },
        "requester": { "reference": "Practitioner/prac-smith" },
        "authoredOn": "2026-04-13",
        "dosageInstruction": [{ "text": "1 tablet by mouth daily" }]
      }
    }
  ]
}`,
        changes: [
          "MedicationRequest is the central prescribing resource.",
          "The patient and prescriber are linked by references.",
          "Coding makes the medication comparable across systems.",
        ],
      },
      {
        title: "Flatten for medication analytics",
        subtitle: "Create a row for medication reporting",
        need: "Population medication queries usually use flat reporting tables.",
        before: `MedicationRequest -> Patient -> Practitioner`,
        after: `patient_id | med_request_id | rxnorm_code | medication_display                 | status | authored_on | prescriber | sig\n445566     | medrx-RX9001 | 316151      | lisinopril 10 MG Oral Tablet      | active | 2026-04-13  | Dr Smith   | 1 tablet by mouth daily`,
        changes: [
          "FHIR graph data is turned into an analytics-friendly medication row.",
          "This is often what downstream SQL and pharmacy reporting consume.",
        ],
      },
    ],
  },
  {
    id: "ccda-csv",
    label: "C-CDA or CSV into FHIR",
    description:
      "Shows how semi-structured or tabular source content becomes validated FHIR resources through mapping and cleanup.",
    steps: [
      {
        title: "Source document or extract arrives",
        subtitle: "The pipeline receives either a C-CDA snippet or a CSV extract",
        need: "The source is not yet in native FHIR resource form.",
        before: `C-CDA Problem Entry\n<observation classCode=\"OBS\">\n  <code code=\"44054006\" displayName=\"Diabetes mellitus type 2\"/>\n</observation>\n\nCSV Example\npatient_mrn,problem_code,problem_text,onset_date\n445566,E11.9,Type 2 diabetes mellitus without complications,2025-01-02`,
        after: `C-CDA Problem Entry\n<observation classCode=\"OBS\">\n  <code code=\"44054006\" displayName=\"Diabetes mellitus type 2\"/>\n</observation>\n\nCSV Example\npatient_mrn,problem_code,problem_text,onset_date\n445566,E11.9,Type 2 diabetes mellitus without complications,2025-01-02`,
        changes: [
          "The source can be XML-like C-CDA or simple tabular CSV.",
          "Neither source is directly ready for FHIR exchange until mapped.",
        ],
      },
      {
        title: "Extract structured fields",
        subtitle: "Pull the relevant problem facts out of the source",
        need: "We must isolate the clinical fact, patient key, and onset date.",
        before: `document text or CSV row`,
        after: `{
  "patientMrn": "445566",
  "problemCodeSource": "E11.9",
  "problemText": "Type 2 diabetes mellitus without complications",
  "onsetDate": "2025-01-02",
  "altClinicalConcept": {
    "system": "http://snomed.info/sct",
    "code": "44054006",
    "display": "Diabetes mellitus type 2"
  }
}`,
        changes: [
          "The important fields are pulled out of the XML or CSV.",
          "Multiple source coding systems may appear at the same time.",
        ],
      },
      {
        title: "Map and reconcile coding",
        subtitle: "Prepare the fact for a FHIR Condition resource",
        need: "The pipeline decides which coding to preserve and how to represent the diagnosis cleanly.",
        before: `{
  "problemCodeSource": "E11.9",
  "problemText": "Type 2 diabetes mellitus without complications",
  "altClinicalConcept": "44054006"
}`,
        after: `{
  "patientId": "urn:mrn:HOSP:445566",
  "conditionCode": {
    "coding": [
      {
        "system": "http://hl7.org/fhir/sid/icd-10-cm",
        "code": "E11.9",
        "display": "Type 2 diabetes mellitus without complications"
      },
      {
        "system": "http://snomed.info/sct",
        "code": "44054006",
        "display": "Diabetes mellitus type 2"
      }
    ],
    "text": "Type 2 diabetes mellitus without complications"
  },
  "onsetDate": "2025-01-02"
}`,
        changes: [
          "The diagnosis is represented using one or more standard codings.",
          "The pipeline decides how to keep source detail without losing interoperability.",
        ],
      },
      {
        title: "Build FHIR resource",
        subtitle: "Create a Condition resource from the normalized fact",
        need: "This is the point where the source becomes native FHIR.",
        before: `normalized problem fact`,
        after: `{
  "resourceType": "Condition",
  "id": "cond-445566-e119",
  "clinicalStatus": { "text": "active" },
  "code": {
    "coding": [
      {
        "system": "http://hl7.org/fhir/sid/icd-10-cm",
        "code": "E11.9",
        "display": "Type 2 diabetes mellitus without complications"
      },
      {
        "system": "http://snomed.info/sct",
        "code": "44054006",
        "display": "Diabetes mellitus type 2"
      }
    ],
    "text": "Type 2 diabetes mellitus without complications"
  },
  "subject": { "reference": "Patient/patient-445566" },
  "onsetDateTime": "2025-01-02"
}`,
        changes: [
          "The original C-CDA or CSV fact is now a standard FHIR Condition resource.",
          "This is where validation against a profile would often happen.",
        ],
      },
      {
        title: "Export or warehouse load",
        subtitle: "Push the new FHIR resource onward to another system or reporting table",
        need: "After mapping to FHIR, the data can either stay in FHIR form or be flattened again for analytics.",
        before: `Condition resource`,
        after: `patient_id | condition_code | condition_text                                | onset_date\n445566     | E11.9          | Type 2 diabetes mellitus without complications | 2025-01-02`,
        changes: [
          "This row is ready for SQL reporting or warehouse storage.",
          "The same mapped fact can still be preserved as native FHIR for interoperability.",
        ],
      },
    ],
  },
  {
    id: "api-sql",
    label: "FHIR API response into SQL warehouse row",
    description:
      "Shows how an API-delivered FHIR resource graph is extracted, joined, and loaded into warehouse tables.",
    steps: [
      {
        title: "FHIR API response arrives",
        subtitle: "A search or read returns Bundle JSON from a FHIR server",
        need: "The response is already FHIR, but still too nested for most analytics queries.",
        before: `{
  "resourceType": "Bundle",
  "entry": [
    {
      "resource": {
        "resourceType": "Observation",
        "id": "obs-1",
        "status": "final",
        "code": { "coding": [{ "system": "http://loinc.org", "code": "4548-4", "display": "Hemoglobin A1c/Hemoglobin.total in Blood" }] },
        "subject": { "reference": "Patient/patient-445566" },
        "encounter": { "reference": "Encounter/enc-1001" },
        "effectiveDateTime": "2026-04-13T12:00:00Z",
        "valueQuantity": { "value": 7.2, "unit": "%" }
      }
    }
  ]
}`,
        after: `{
  "resourceType": "Bundle",
  "entry": [
    {
      "resource": {
        "resourceType": "Observation",
        "id": "obs-1",
        "status": "final",
        "code": { "coding": [{ "system": "http://loinc.org", "code": "4548-4", "display": "Hemoglobin A1c/Hemoglobin.total in Blood" }] },
        "subject": { "reference": "Patient/patient-445566" },
        "encounter": { "reference": "Encounter/enc-1001" },
        "effectiveDateTime": "2026-04-13T12:00:00Z",
        "valueQuantity": { "value": 7.2, "unit": "%" }
      }
    }
  ]
}`,
        changes: [
          "The payload is standards-based but nested.",
          "References point outward to related resources that may require follow-up fetches or prior joins.",
        ],
      },
      {
        title: "Extract relevant fields",
        subtitle: "Pull out the pieces needed for reporting",
        need: "Warehouses need explicit columns, not nested JSON branches.",
        before: `Bundle JSON`,
        after: `{
  "observationId": "obs-1",
  "status": "final",
  "loincCode": "4548-4",
  "display": "Hemoglobin A1c/Hemoglobin.total in Blood",
  "patientRef": "Patient/patient-445566",
  "encounterRef": "Encounter/enc-1001",
  "observedAt": "2026-04-13T12:00:00Z",
  "resultValue": 7.2,
  "unit": "%"
}`,
        changes: [
          "Nested JSON branches become a simpler intermediate structure.",
          "Patient and encounter are still references, not resolved warehouse keys yet.",
        ],
      },
      {
        title: "Resolve references and dimensions",
        subtitle: "Map FHIR references to warehouse entities",
        need: "Most warehouses use conformed dimensions or surrogate keys.",
        before: `{
  "patientRef": "Patient/patient-445566",
  "encounterRef": "Encounter/enc-1001"
}`,
        after: `{
  "patientKey": 81234,
  "encounterKey": 55091,
  "observationCode": "4548-4",
  "observationDisplay": "Hemoglobin A1c/Hemoglobin.total in Blood",
  "valueNumeric": 7.2,
  "unit": "%",
  "observedAt": "2026-04-13T12:00:00Z"
}`,
        changes: [
          "FHIR references are mapped to warehouse keys or trusted business identifiers.",
          "This is where dimension lookups and identity matching often happen.",
        ],
      },
      {
        title: "Load warehouse row",
        subtitle: "Insert into the target fact table",
        need: "This is the final analytics-ready representation.",
        before: `resolved observation fact`,
        after: `fact_lab_result\npatient_key | encounter_key | loinc_code | result_name                                 | result_value | unit | observed_at\n81234       | 55091         | 4548-4     | Hemoglobin A1c/Hemoglobin.total in Blood    | 7.2          | %    | 2026-04-13T12:00:00Z`,
        changes: [
          "The FHIR resource graph is now a fact table row.",
          "This is what downstream BI and SQL usually consume directly.",
        ],
      },
      {
        title: "Optional SQL transform view",
        subtitle: "Create a curated mart or view for end users",
        need: "Analysts often want a simpler semantic layer on top of raw fact tables.",
        before: `fact_lab_result table`,
        after: `SELECT patient_key, loinc_code, result_name, result_value, observed_at\nFROM fact_lab_result\nWHERE loinc_code = '4548-4';`,
        changes: [
          "The warehouse can expose patient, quality, or cohort marts after load.",
          "FHIR data is often only the ingestion shape, not the final analytics shape.",
        ],
      },
    ],
  },
];

function CodePane({ title, content }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-slate-700">{title}</div>
      <pre className="overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100 shadow-inner">
        <code>{content}</code>
      </pre>
    </div>
  );
}

function Pill({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
    >
      {children}
    </button>
  );
}

export default function FhirMultiFlowStationDemo() {
  const [flowId, setFlowId] = useState(flows[0].id);
  const [stepIndex, setStepIndex] = useState(0);
  const [showAfter, setShowAfter] = useState(false);

  const flow = useMemo(() => flows.find((f) => f.id === flowId) || flows[0], [flowId]);
  const step = flow.steps[stepIndex];
  const progress = ((stepIndex + 1) / flow.steps.length) * 100;

  const switchFlow = (id) => {
    setFlowId(id);
    setStepIndex(0);
    setShowAfter(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">FHIR station demo package</div>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">Multi-flow transformation viewer</h1>
              <p className="mt-2 max-w-3xl text-slate-600">
                Pick a flow, inspect the state before and after each station, then apply the change and continue.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              Flow step {stepIndex + 1} of {flow.steps.length}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {flows.map((f) => (
              <Pill key={f.id} active={f.id === flowId} onClick={() => switchFlow(f.id)}>
                {f.label}
              </Pill>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-3xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-500">Current flow</div>
                <h2 className="text-2xl font-bold text-slate-900">{flow.label}</h2>
                <p className="mt-1 text-slate-600">{flow.description}</p>
              </div>
            </div>

            <div className="mb-5 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${progress}%` }} />
            </div>

            <div className="rounded-2xl bg-amber-50 p-4 text-sm text-slate-700">
              <span className="font-semibold">Why this station matters: </span>
              {step.need}
            </div>

            <div className="mt-5">
              <div className="text-sm font-semibold text-slate-500">Station</div>
              <h3 className="text-xl font-bold text-slate-900">{step.title}</h3>
              <p className="text-slate-600">{step.subtitle}</p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Pill active={!showAfter} onClick={() => setShowAfter(false)}>Show before change</Pill>
              <Pill active={showAfter} onClick={() => setShowAfter(true)}>Show after change</Pill>
            </div>

            <div className="mt-5">
              {!showAfter ? (
                <CodePane title="State before modification" content={step.before} />
              ) : (
                <CodePane title="State after modification" content={step.after} />
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setStepIndex((s) => Math.max(0, s - 1));
                  setShowAfter(false);
                }}
                disabled={stepIndex === 0}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous station
              </button>
              <button
                onClick={() => {
                  setShowAfter(true);
                  setTimeout(() => {
                    setStepIndex((s) => Math.min(flow.steps.length - 1, s + 1));
                  }, 150);
                }}
                disabled={stepIndex === flow.steps.length - 1}
                className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply change and continue
              </button>
              <button
                onClick={() => {
                  setStepIndex(0);
                  setShowAfter(false);
                }}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700"
              >
                Restart flow
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
              <div className="text-lg font-bold text-slate-900">Flow map</div>
              <div className="mt-4 space-y-3">
                {flow.steps.map((s, idx) => {
                  const active = idx === stepIndex;
                  const done = idx < stepIndex;
                  return (
                    <div
                      key={`${flow.id}-${idx}`}
                      className={`rounded-2xl border p-4 transition ${active ? "border-slate-900 bg-slate-900 text-white" : done ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50"}`}
                    >
                      <div className="text-sm font-semibold">{idx + 1}. {s.title}</div>
                      <div className={`mt-1 text-sm ${active ? "text-slate-200" : "text-slate-600"}`}>{s.subtitle}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
              <div className="text-lg font-bold text-slate-900">What changed here</div>
              <div className="mt-4 grid gap-3">
                {step.changes.map((change, idx) => (
                  <div key={idx} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200">
                    {change}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
