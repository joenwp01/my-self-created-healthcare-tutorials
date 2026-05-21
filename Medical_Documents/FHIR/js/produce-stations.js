/* ============================================================
   Produce Journey — Station Definitions
   Station 1: Source Data Intake         [FULLY AUTHORED]
   Station 2: Profile Selection          [FULLY AUTHORED]
   Stations 3–11: Scaffolded for Phase 2
   ============================================================ */

const PRODUCE_STATIONS = [
  /* ============================================================
     STATION 1 — Source Data Intake
     ============================================================ */
  {
    number: 1,
    title: "Source Data Intake",
    lecture: () => `
      <p>Station 1 is <strong>Source Data Intake</strong>. The Produce journey starts where real FHIR production always starts: with operational data that doesn't look anything like FHIR yet. Usually that's a relational database, a claims feed, an HL7 v2 message stream, or a flat file drop from a partner system.</p>

      <p>For the Cascade Cohort, we're taking the post-discharge summary data from our hospital's EHR operational tables and preparing to submit it to each patient's primary care physician via FHIR. The EHR exposes tables, not resources — the shape is wrong, the vocabulary is wrong, and the identity model is wrong. Every Produce station fixes one of these mismatches.</p>

      ${UI.collapsible("What intake produces", `
      <ul>
        <li><strong>Typed records</strong> — the flat rows get parsed into structured objects with typed fields (dates as dates, not strings; codes with their systems, not bare values)</li>
        <li><strong>Provenance</strong> — each record carries its source system, source record id, and extract timestamp. This becomes <code>meta.source</code> on the eventual FHIR resource.</li>
        <li><strong>Quality flags</strong> — missing required fields, invalid enumerations, parse failures. These are handled before FHIR construction, not during.</li>
      </ul>
      `)}
      ${UI.collapsible("The operational truth: source data is messy", `
      <p>The hospital EHR's <code>patient_registration</code> table stores birth date as a VARCHAR with values like <code>"04/12/1963"</code>, <code>"1963-04-12"</code>, and occasionally <code>"UNK"</code>. The <code>encounter</code> table has rows with <code>discharge_datetime = NULL</code> for in-progress admissions. The medication table has free-text strings alongside coded entries.</p>

      <p>Produce pipelines that try to skip intake and build FHIR directly from source rows fail in two predictable ways: (1) they produce invalid FHIR that fails server-side validation, and (2) when they do produce valid FHIR, semantic errors (a wrong date format parsed as the wrong date) surface downstream, often as clinical safety issues.</p>
      `)}
      ${UI.xref("produce", "consume", 6, "When you were consuming, the Consume journey's profile validation station showed what happens when a sender skipped this intake discipline — incoming resources with ISO-string dates that had been local-string dates upstream, silently mangled.")}
    `,
    beforeAfter: {
      before: () => `<pre class="code-block"><span class="pc-comment"># Raw EHR operational row for P001 (Maria Gonzalez)</span>
SELECT * FROM patient_registration WHERE mrn = 'CRH-10001';

mrn       | last_name | first_name | dob         | sex | race_code
----------+-----------+------------+-------------+-----+----------
CRH-10001 | Gonzalez  | Maria      | 04/12/1963  | F   | 2106-3
</pre>`,
      after: () => {
        const cleaned = State.getDecision("produce", 1, "intake_ok");
        if (!cleaned) return `<div class="empty-state">Run intake on the cohort to see parsed output.</div>`;
        return `<pre class="code-block">${UI.highlightJson(`{
  "sourceSystem": "cascade_hospital_ehr_v4",
  "sourceRecordId": "patient_registration:CRH-10001",
  "extractedAt": "2026-04-14T09:15:00Z",
  "parsed": {
    "mrn": "CRH-10001",
    "familyName": "Gonzalez",
    "givenName": ["Maria"],
    "birthDate": "1963-04-12",
    "sex": "female",
    "raceOmbCode": "2106-3"
  },
  "qualityFlags": []
}`)}</pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — Intake policy for date parsing</h3>
        <div class="task-prompt">
          The <code>dob</code> column stores dates as VARCHARs in multiple formats. Five patients parse cleanly; a sixth patient (not in the Cascade Cohort) has <code>dob = "UNK"</code>. What does intake do with that sixth row?
        </div>
        <div class="choice-list" id="sp1-choices">
          ${[
            { v: "skip", t: "Drop the row and log. The downstream pipeline is for known-DOB patients only." },
            { v: "passthrough", t: "Pass through <code>birthDate = null</code> and let downstream decide." },
            { v: "fallback", t: "Use a sentinel date like <code>1900-01-01</code> so FHIR construction has something valid." },
            { v: "flag-and-route", t: "Parse to null, tag a quality flag <code>missing_required:birthDate</code>, route to a review queue. Don't produce FHIR until resolved." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleSP1Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="sp1-feedback"></div>
        <div id="hint-area"></div>
        <div style="margin-top: 14px;">
          <button class="btn journey-primary" onclick="runSP1Intake()">
            ${State.getDecision("produce",1,"intake_ok") ? "✓ Intake complete" : "▶ Run intake on cohort"}
          </button>
        </div>
      `,
      hint: "US Core Patient has <code>birthDate</code> as must-support. What does must-support mean about a Patient resource submitted without one? Also think about who sees the output: silently dropping rows makes the output look complete when it isn't; sentinel dates make downstream analytics wrong in ways nobody notices until someone computes an age distribution.",
      reveal: () => {
        State.setDecision("produce", 1, "sp1_choice", "flag-and-route");
        State.setDecision("produce", 1, "intake_ok", true);
        document.getElementById("sp1-feedback").innerHTML = UI.renderReveal(
          "The right answer is <strong>flag-and-route</strong>. Parse what you can, flag what you can't, and route ambiguity to human review. Don't produce FHIR from data you know is incomplete."
        ) + UI.renderExplanation(
          "Silently dropping rows hides real data gaps from operators. Sentinel dates (<code>1900-01-01</code>) pass schema checks but poison downstream analytics. Passing null through works for elements FHIR marks optional, but US Core Patient's <code>birthDate</code> is must-support — meaning the receiver expects it when the data exists. Tagging a quality flag and routing to review is the only option that treats unknown-at-source as a first-class state rather than masking it."
        );
      },
      validate: () => {
        if (!State.getDecision("produce", 1, "intake_ok")) return { ok: false, message: "Run intake before advancing." };
        return { ok: true };
      }
    },
    postRender: () => {
      const prior = State.getDecision("produce", 1, "sp1_choice");
      if (prior) {
        const el = document.querySelector(`#sp1-choices [data-v="${prior}"]`);
        if (el) el.classList.add(prior === "flag-and-route" ? "correct" : "incorrect");
      }
    }
  },

  /* ============================================================
     STATION 2 — Profile Selection
     ============================================================ */
  {
    number: 2,
    title: "Profile Selection",
    lecture: () => `
      <p>Station 2 is <strong>Profile Selection</strong>. Before we construct a FHIR resource, we decide <em>which</em> profile it's going to claim conformance to. Profile selection is upstream of construction because the profile determines which elements are required, which bindings apply, and which extensions we need to populate.</p>

      ${UI.collapsible("What a profile does, concretely", `
      <ul>
        <li><strong>Constrains cardinality</strong> — makes optional elements required (or forbidden)</li>
        <li><strong>Binds terminology</strong> — requires specific ValueSets for coded elements</li>
        <li><strong>Defines must-support</strong> — which elements the producer must be able to populate when data exists</li>
        <li><strong>Adds extensions</strong> — US Core Patient requires the race, ethnicity, and birth sex extensions</li>
        <li><strong>Sets invariants</strong> — FHIRPath expressions the resource must satisfy</li>
      </ul>
      `)}
      ${UI.collapsible("For the Cascade post-discharge summary, we need", `
      <ul>
        <li><code>us-core-patient</code> — demographics</li>
        <li><code>us-core-condition-problems-health-concerns</code> — discharge diagnoses</li>
        <li><code>us-core-medicationrequest</code> — discharge medications</li>
        <li><code>us-core-encounter</code> — the inpatient admission itself</li>
        <li><code>us-core-practitioner</code> — the discharging physician</li>
      </ul>
      `)}
      ${UI.collapsible("Why \"just use base FHIR\" is a trap", `
      <p>Base FHIR resources are maximally permissive — almost every element is optional and bindings are 'example' strength. A receiver expecting US Core will validate against the US Core profile, not base FHIR. If the producer submits base-FHIR-conformant resources that happen to lack US Core's required extensions, the submission fails validation at the receiver. The producer's job is to claim conformance to the profile the receiver is checking against.</p>
      `)}
      ${UI.collapsible("Version pinning matters", `
      <p>Claiming <code>us-core-patient</code> without a version is ambiguous. Claiming <code>http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient|6.1.0</code> is precise. The receiver validates against a specific version; producers should assert the version they're conformant to.</p>
      `)}`,
    beforeAfter: {
      before: () => `<pre class="code-block"><span class="pc-comment"># Patient P001 — parsed intake record (from Station 1)</span>
{
  "mrn": "CRH-10001",
  "familyName": "Gonzalez",
  "givenName": ["Maria"],
  "birthDate": "1963-04-12",
  "sex": "female",
  "raceOmbCode": "2106-3"
}

<span class="pc-comment"># No profile asserted yet. Which profile will we target?</span></pre>`,
      after: () => {
        const profile = State.getDecision("produce", 2, "profile_chosen");
        if (!profile) return `<div class="empty-state">Pick a profile claim strategy below.</div>`;
        const profileUrl = profile === "us-core-versioned"
          ? "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient|6.1.0"
          : (profile === "us-core-unversioned"
              ? "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"
              : "(none — base FHIR Patient)");
        return `<pre class="code-block">${UI.highlightJson(`{
  "resourceType": "Patient",
  "meta": {
    "profile": ${profile === "base-fhir" ? "[]" : `["${profileUrl}"]`}
  },
  "identifier": [{"system": "http://hospital.cascade.example/mrn", "value": "CRH-10001"}],
  "name": [{"family": "Gonzalez", "given": ["Maria"]}],
  "gender": "female",
  "birthDate": "1963-04-12"
  // Race extension and other US Core required elements will be added in Station 3
}`)}</pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — Profile claim strategy</h3>
        <div class="task-prompt">
          The primary-care receivers expect US Core 6.1.0 conformance. How does the Patient resource assert its profile claim?
        </div>
        <div class="choice-list" id="sp2-choices">
          ${[
            { v: "base-fhir", t: "Don't declare a profile. Submit base FHIR Patient — the receiver will validate what it wants." },
            { v: "us-core-unversioned", t: "Declare <code>http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient</code> — no version pin." },
            { v: "us-core-versioned", t: "Declare <code>http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient|6.1.0</code> — explicit version pin matching the receiver's expectation." },
            { v: "multi-claim", t: "Declare both base FHIR Patient AND US Core Patient — maximum compatibility." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleSP2Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="sp2-feedback"></div>
        <div id="hint-area"></div>
      `,
      hint: "Think about what happens in 2027 when US Core 7.0.0 is released and the receiver upgrades. Which of these claims would silently start producing validation failures, and which would surface a clear 'version mismatch' error that operators can actually act on?",
      reveal: () => {
        State.setDecision("produce", 2, "sp2_choice", "us-core-versioned");
        State.setDecision("produce", 2, "profile_chosen", "us-core-versioned");
        document.getElementById("sp2-feedback").innerHTML = UI.renderReveal(
          "The right answer is <strong>us-core-versioned</strong>. Pinning to a specific version makes version mismatches loud and obvious, and matches what the receiver is validating against."
        ) + UI.renderExplanation(
          "Not declaring a profile leaves validation semantics ambiguous — the receiver may reject the resource for missing US Core required extensions with an unhelpful error. Unversioned claims work today but drift silently: when the receiver upgrades to US Core 7.0.0, an unversioned claim is interpreted against the new version, and resources that were valid under 6.1.0 may start failing without the producer knowing why. Multi-claim ('base + US Core') creates impossible validation semantics — a resource either <em>is</em> a US Core Patient or it isn't; claiming both does not make validation more permissive, it just confuses receivers."
        );
      },
      validate: () => {
        if (!State.getDecision("produce", 2, "profile_chosen")) return { ok: false, message: "Pick a profile strategy first." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "produce", stationNum: 2, decisionKey: "sp2_choice",
        choicesRootId: "sp2-choices", feedbackId: "sp2-feedback",
        correctValue: "us-core-versioned",
        correctHtml: "Correct. Version-pinned profile claims make version drift loud and actionable. When the receiver upgrades to a newer US Core version, a version-pinned producer gets a clear mismatch error rather than silently producing resources that validate against the new version's rules.",
        incorrectHtml: "Consider what happens when the receiver upgrades US Core versions. Which claim strategy surfaces that change as a clear error, and which lets it drift silently? Try again or reveal."
      });
    }
  },

  /* ============================================================
     STATIONS 3–11 — Scaffolded for Phase 2
     ============================================================ */
  /* ============================================================
     STATION 3 — Resource Construction
     ============================================================ */
  {
    number: 3,
    title: "Resource Construction",
    lecture: () => `
      <p>Station 3 is <strong>Resource Construction</strong>. With intake records cleaned (Station 1) and profile claims decided (Station 2), we build the actual FHIR resources. For the Cascade post-discharge summary, that means a US Core Patient first — the anchor that every other resource in the Bundle will reference.</p>

      ${UI.collapsible("US Core Patient required elements (6.1.0)", `
      <ul>
        <li><code>identifier</code> — at least one business identifier (MRN, SSN, driver's license). Must include <code>system</code>.</li>
        <li><code>name</code> — at least one. <code>family</code> and <code>given</code> are must-support.</li>
        <li><code>gender</code> — administrative gender from <code>AdministrativeGender</code> ValueSet.</li>
        <li><code>birthDate</code> — must-support, but see the Station 1 decision about unknown DOB.</li>
        <li><strong>Required extensions:</strong> <code>us-core-race</code>, <code>us-core-ethnicity</code>, <code>us-core-birthsex</code>.</li>
      </ul>
      `)}
      ${UI.collapsible("The race extension is more structured than it looks", `
      <p>US Core race is not a single coded value. It's an extension with sub-extensions: one or more <code>ombCategory</code> entries (from the OMB 1997 racial categories ValueSet — White, Black or African American, American Indian or Alaska Native, Asian, Native Hawaiian or Other Pacific Islander), optional <code>detailed</code> entries for finer-grained codes, and a required <code>text</code> sub-extension with a human-readable description. A producer that serializes race as a single bare code will fail US Core validation.</p>
      `)}
      ${UI.collapsible("The \"declined to report\" case", `
      <p>Not every patient discloses race or ethnicity. US Core accommodates this: instead of omitting the extension (which fails must-support), the extension is populated with the special null-flavor code <code>ASKU</code> (Asked but Unknown) or <code>UNK</code> (Unknown), drawn from the <code>NullFlavor</code> CodeSystem. The <code>text</code> sub-extension carries the corresponding human-readable phrase. This pattern — "present with a null-flavor value" — appears throughout US Core anywhere a required element may be genuinely unknown.</p>
      `)}
      ${UI.collapsible("Narrative summary matters more than producers realize", `
      <p>FHIR resources carry a <code>text.div</code> narrative: an XHTML summary that a human can read without a FHIR parser. For US Core, the narrative is not optional — it's the fallback when a receiver's software doesn't understand a particular extension or coded value. Producers that skip narrative generation produce resources that render as blank in human-readable viewers.</p>
      `)}
      ${UI.xref("produce", "consume", 8, "When you were consuming, the Extension Handling station showed the receiving side of this decision: what does a consumer do when it sees an unknown extension? What does it do when it sees a declined-to-report null flavor it doesn't recognize? The two sides have to agree on the null-flavor vocabulary, which is why US Core pins it to <code>NullFlavor</code> explicitly.")}
    `,
    beforeAfter: {
      before: () => `<pre class="code-block"><span class="pc-comment"># Parsed intake record (from Stations 1 + 2 decisions)</span>
{
  "mrn": "CRH-10001",
  "familyName": "Gonzalez",
  "givenName": ["Maria"],
  "birthDate": "1963-04-12",
  "sex": "female",
  "raceOmbCode": "<span class="pc-keyword">{RACE_CODE}</span>",
  "ethnicityOmbCode": "<span class="pc-keyword">{ETHNICITY_CODE}</span>",
  "birthSex": "F"
}

<span class="pc-comment"># For P003 (Jamal Washington): raceOmbCode = ASKU — patient declined to report.</span></pre>`,
      after: () => {
        const built = State.getDecision("produce", 3, "resource_built");
        if (!built) return `<div class="empty-state">Make a decision on the declined-race case, then build the resource.</div>`;
        const strategy = State.getDecision("produce", 3, "sp3_choice");
        let raceBlock;
        if (strategy === "null-flavor") {
          raceBlock = `{
      "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
      "extension": [
        {
          "url": "ombCategory",
          "valueCoding": {
            "system": "http://terminology.hl7.org/CodeSystem/v3-NullFlavor",
            "code": "ASKU",
            "display": "asked but unknown"
          }
        },
        {"url": "text", "valueString": "Asked but unknown"}
      ]
    }`;
        } else if (strategy === "omit") {
          raceBlock = `// race extension OMITTED — will fail US Core validation`;
        } else {
          raceBlock = `{
      "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
      "extension": [
        {"url": "ombCategory", "valueCoding": {"code": "2106-3", "display": "White"}},
        {"url": "text", "valueString": "White"}
      ]  // ← MADE UP; patient declined. This is fabrication.
    }`;
        }
        return `<pre class="code-block">${UI.highlightJson(`{
  "resourceType": "Patient",
  "id": "tmp-p003",
  "meta": {
    "profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient|6.1.0"]
  },
  "extension": [
    ${raceBlock}
  ],
  "identifier": [{"system": "http://hospital.cascade.example/mrn", "value": "CRH-10003"}],
  "name": [{"family": "Washington", "given": ["Jamal"]}],
  "gender": "male",
  "birthDate": "1980-11-15"
}`)}</pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — Declined-to-report race</h3>
        <div class="task-prompt">
          Patient P003 (Jamal Washington) declined to report race. The intake record shows <code>raceOmbCode = "ASKU"</code>. US Core Patient requires the <code>us-core-race</code> extension. How does construction handle this?
        </div>
        <div class="choice-list" id="sp3-choices">
          ${[
            { v: "omit",         t: "Omit the race extension entirely since we have no real value. The receiver will see it's missing and understand." },
            { v: "null-flavor",  t: "Populate the extension with <code>ombCategory</code> valueCoding from the <code>NullFlavor</code> CodeSystem, code <code>ASKU</code>, plus a <code>text</code> sub-extension reading 'Asked but unknown'." },
            { v: "best-guess",   t: "Default to the most common race in our patient population so the extension has a valid OMB code. Document the fallback policy." },
            { v: "empty-extension", t: "Include the extension but leave all sub-extensions empty. Schema-valid, semantically empty." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleSP3Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="sp3-feedback"></div>
        <div id="hint-area"></div>
        <div style="margin-top: 14px;">
          <button class="btn journey-primary"
                  ${State.getDecision("produce", 3, "sp3_choice") ? "" : "disabled"}
                  onclick="runSP3Build()">
            ${State.getDecision("produce", 3, "resource_built") ? "✓ Patient resource built" : "▶ Build Patient resource"}
          </button>
        </div>
      `,
      hint: "The US Core spec anticipates declined-to-report. Check what null-flavor codes look like — they're real codes from a real CodeSystem (v3 NullFlavor), not the absence of data. Also consider the ethics: fabricating demographic data, even 'sensibly defaulted', is a serious research-integrity violation and would get a producer blacklisted by a serious HIE.",
      reveal: () => {
        State.setDecision("produce", 3, "sp3_choice", "null-flavor");
        State.setDecision("produce", 3, "resource_built", true);
        document.getElementById("sp3-feedback").innerHTML = UI.renderReveal(
          "The right answer is <strong>null-flavor</strong>. Populate <code>ombCategory</code> with a <code>NullFlavor</code> code (<code>ASKU</code>), and carry the human-readable phrase in <code>text</code>."
        ) + UI.renderExplanation(
          "Omitting the extension fails US Core's must-support requirement — receivers can't distinguish 'producer doesn't populate race' from 'patient declined.' Empty sub-extensions are schema-valid but semantically useless; validators may accept them but downstream analytics will mishandle them. Fabricating a 'best-guess' value is a research-integrity failure — it injects synthetic demographics into clinical datasets, violates patient autonomy, and exposes the producer to significant legal and reputational risk. The null-flavor pattern is purpose-built for this case: the extension is present (satisfying must-support), the value is explicit (ASKU), the narrative is human-readable, and the receiver knows exactly what happened."
        );
      },
      validate: () => {
        if (!State.getDecision("produce", 3, "sp3_choice")) return { ok: false, message: "Pick a declined-race strategy first." };
        if (!State.getDecision("produce", 3, "resource_built")) return { ok: false, message: "Build the Patient resource before advancing." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "produce", stationNum: 3, decisionKey: "sp3_choice",
        choicesRootId: "sp3-choices", feedbackId: "sp3-feedback",
        correctValue: "null-flavor",
        correctHtml: "Correct. Populate the extension with a <code>NullFlavor</code> code (<code>ASKU</code>), with narrative in <code>text</code>. The extension is present (must-support satisfied), the value is explicit, and the receiver knows exactly what happened.",
        incorrectHtml: "US Core anticipates declined-to-report. The answer involves a CodeSystem called <code>v3-NullFlavor</code>. Fabricating demographic data is a research-integrity failure. Try again or reveal."
      });
    }
  },

  /* ============================================================
     STATION 4 — Reference Integrity
     ============================================================ */
  {
    number: 4,
    title: "Reference Integrity",
    lecture: () => `
      <p>Station 4 is <strong>Reference Integrity</strong>. A Bundle with Patient, Condition, MedicationRequest, Encounter, and Practitioner resources has references threaded through it — every Condition has a <code>subject</code> pointing to a Patient, every MedicationRequest has a <code>subject</code> plus a <code>requester</code>, every Encounter has a <code>participant</code>. How those references are expressed determines whether the Bundle loads atomically on the server.</p>

      ${UI.collapsible("Three ways to express a FHIR reference", `
      <ul>
        <li><strong>Literal reference to an existing resource</strong> — <code>Reference.reference = "Patient/p001"</code>. Works when the Patient is already on the server with that ID. Won't work for resources being created right now.</li>
        <li><strong>Logical reference by identifier</strong> — <code>Reference.identifier = {system: "...", value: "CRH-10001"}</code> with no literal. Tells the server "find the resource matching this identifier." Works independent of whether the resource exists yet. Especially useful for Practitioner lookups where we know the NPI but not the server's internal ID.</li>
        <li><strong><code>urn:uuid</code> reference within a transaction</strong> — <code>Reference.reference = "urn:uuid:a1b2c3..."</code> matching a <code>Bundle.entry.fullUrl</code> in the same transaction. The server resolves it to the server-assigned ID after creation. This is the mechanism that lets a single transaction Bundle create interdependent resources atomically.</li>
      </ul>
      `)}
      ${UI.collapsible("Contained vs. referenced — the older, still-useful mechanism", `
      <p>A <code>contained</code> resource is embedded inline using <code>#localId</code> references. Used when the embedded resource has no independent identity — for example, a one-off <code>Practitioner</code> that represents "the prescribing clinician" but isn't tracked as a full Practitioner in any directory. Contained resources are invisible outside their parent; they can't be searched or referenced externally.</p>

      <p>US Core generally prefers referenced over contained. The rule of thumb: if the resource makes sense on its own and anyone will want to search for it, reference it. If it only exists as context for the parent, contain it.</p>
      `)}
      ${UI.collapsible("The Practitioner decision for the Cascade post-discharge summary", `
      <p>Dr. Rachel Adler is the discharging physician. Her NPI is 1234567890. The receiver (primary care EHR) may or may not already have a Practitioner resource for her. The Bundle needs to reference her as the <code>requester</code> on each discharge MedicationRequest. How should that reference be expressed?</p>
      `)}
      ${UI.collapsible("Why this matters for the transaction POST", `
      <p>If the reference is a literal pointing to a resource that doesn't exist on the receiver, the transaction fails with a <code>404</code> buried in an <code>OperationOutcome</code>. If the reference uses <code>urn:uuid</code> but the Practitioner isn't included in the transaction, same failure. The reference integrity decisions made here determine whether the Bundle submitted in Station 11 succeeds or fails.</p>
      `)}`,
    beforeAfter: {
      before: () => `<pre class="code-block"><span class="pc-comment"># Context: transaction Bundle being assembled</span>
<span class="pc-comment"># - Patient (tmp-p001) created as entry[0]</span>
<span class="pc-comment"># - Practitioner (Dr. Adler, NPI 1234567890) — strategy <span class="pc-keyword">TBD</span></span>
<span class="pc-comment"># - MedicationRequest needs Reference for requester → Practitioner</span>

MedicationRequest {
  "status": "active",
  "intent": "order",
  "subject":   { "reference": "urn:uuid:patient-p001-uuid" },
  "requester": <span class="pc-keyword">{ ??? }</span>
}</pre>`,
      after: () => {
        const chosen = State.getDecision("produce", 4, "sp4_choice");
        if (!chosen) return `<div class="empty-state">Pick a reference strategy for the Practitioner.</div>`;
        let reqBlock;
        if (chosen === "contained") {
          reqBlock = `{ "reference": "#prac-adler" }  // contained in this MedicationRequest only`;
        } else if (chosen === "literal-direct") {
          reqBlock = `{ "reference": "Practitioner/adler" }  // assumes receiver already has this ID`;
        } else if (chosen === "urn-uuid") {
          reqBlock = `{ "reference": "urn:uuid:prac-adler-uuid" }  // resolved inside the transaction Bundle`;
        } else {
          reqBlock = `{
    "type": "Practitioner",
    "identifier": {
      "system": "http://hl7.org/fhir/sid/us-npi",
      "value": "1234567890"
    }
  }  // logical reference — receiver resolves by NPI`;
        }
        return `<pre class="code-block">${UI.highlightJson(`MedicationRequest {
  "status": "active",
  "intent": "order",
  "subject":   { "reference": "urn:uuid:patient-p001-uuid" },
  "requester": ${reqBlock}
}`)}</pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — How to reference Dr. Adler</h3>
        <div class="task-prompt">
          The receiving primary-care EHR may or may not already have a Practitioner resource for Dr. Adler. The Bundle is a transaction. Dr. Adler has NPI 1234567890. Which reference strategy is most robust?
        </div>
        <div class="choice-list" id="sp4-choices">
          ${[
            { v: "contained",      t: "<strong>Contained</strong> — embed a minimal Practitioner inline in each MedicationRequest using <code>#prac-adler</code>." },
            { v: "literal-direct", t: "<strong>Literal direct</strong> — <code>{reference: 'Practitioner/adler'}</code> — assume the receiver already has a Practitioner with ID <code>adler</code>." },
            { v: "urn-uuid",       t: "<strong>urn:uuid in transaction</strong> — include a Practitioner entry in the Bundle with <code>fullUrl: 'urn:uuid:prac-adler-uuid'</code>, reference it by that UUID from each MedicationRequest. Use <code>ifNoneExist</code> to avoid duplicating." },
            { v: "logical-npi",    t: "<strong>Logical reference by NPI</strong> — <code>{type: 'Practitioner', identifier: {system: 'http://hl7.org/fhir/sid/us-npi', value: '1234567890'}}</code> — let the receiver resolve." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleSP4Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="sp4-feedback"></div>
        <div id="hint-area"></div>
      `,
      hint: "Two questions determine this: (1) does the receiver already have Dr. Adler as a resource? (2) do we want the Practitioner to be searchable and linkable after the transaction completes, or is she ephemeral context? If the answer to (2) is 'searchable,' contained is wrong. If we can't assume the receiver knows her internal ID, literal-direct is wrong. That leaves two choices — consider which is more self-contained.",
      reveal: () => {
        State.setDecision("produce", 4, "sp4_choice", "urn-uuid");
        document.getElementById("sp4-feedback").innerHTML = UI.renderReveal(
          "The right answer is <strong>urn:uuid in transaction</strong>. Include a Practitioner entry in the Bundle with <code>fullUrl: urn:uuid:...</code>, add <code>ifNoneExist</code> on the entry so the receiver skips creation if a matching NPI already exists, and reference it from every MedicationRequest using the same UUID."
        ) + UI.renderExplanation(
          "<strong>Contained</strong> makes Dr. Adler invisible outside each MedicationRequest — if three prescriptions name her, she becomes three copies with no cross-link, defeating the point of having a Practitioner directory. <strong>Literal direct</strong> assumes knowledge of the receiver's internal ID space, which we don't have and shouldn't guess. <strong>Logical reference by NPI</strong> is correct syntactically and valid FHIR, but pushes resolution responsibility entirely onto the receiver — if their Practitioner directory doesn't have that NPI, the reference dangles, and nothing in the Bundle creates Dr. Adler. The <strong>urn:uuid + ifNoneExist</strong> pattern is self-contained: the Bundle carries the Practitioner data, the receiver creates her only if she doesn't already exist, and the references inside the Bundle resolve atomically. This is the standard FHIR transaction idiom for 'reference a resource that may or may not exist yet.'"
        );
      },
      validate: () => {
        if (!State.getDecision("produce", 4, "sp4_choice")) return { ok: false, message: "Pick a reference strategy first." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "produce", stationNum: 4, decisionKey: "sp4_choice",
        choicesRootId: "sp4-choices", feedbackId: "sp4-feedback",
        correctValue: "urn-uuid",
        correctHtml: "Correct. <code>urn:uuid</code> within a transaction Bundle, combined with <code>ifNoneExist</code> on the Practitioner entry, is the standard FHIR idiom for 'reference a resource that may or may not exist yet on the receiver.' The Bundle is self-contained and the transaction resolves atomically.",
        incorrectHtml: "Two filters: (1) we don't know the receiver's internal IDs, so literal-direct is out; (2) we want Dr. Adler searchable after the transaction, so contained is out. Between the remaining two, which is self-contained? Try again or reveal."
      });
    }
  },
  /* ============================================================
     STATION 5 — Terminology Binding
     ============================================================ */
  {
    number: 5,
    title: "Terminology Binding",
    lecture: () => `
      <p>Station 5 is <strong>Terminology Binding</strong>. With resources constructed (S3) and references threaded (S4), every coded element now has to actually use the right CodeSystem with the right code. US Core profiles bind specific elements to specific ValueSets — and binding strength determines what happens when source data doesn't fit cleanly.</p>

      ${UI.collapsible("The four binding strengths", `
      <ul>
        <li><strong>required</strong> — the value MUST be from the bound ValueSet. Anything else fails validation. Used for elements where shared semantics are non-negotiable (e.g., Patient <code>gender</code> bound to <code>AdministrativeGender</code>).</li>
        <li><strong>extensible</strong> — the value SHOULD be from the bound ValueSet if a code in it applies. If no code applies, the producer MAY use a code from another system. Used for clinical terminologies that can't enumerate every possible concept (e.g., Condition <code>code</code> bound to a US Core problem ValueSet).</li>
        <li><strong>preferred</strong> — encouraged but not required. Producers who use other codes shouldn't be flagged.</li>
        <li><strong>example</strong> — purely illustrative. The ValueSet is shown as one possible vocabulary; producers can use anything.</li>
      </ul>
      `)}
      ${UI.collapsible("The Cascade Cohort's terminology challenges", `
      <p>For the post-discharge summary, several elements need binding decisions:</p>
      <ul>
        <li><strong>Condition.code</strong> — extensible binding to US Core's problem ValueSet (SNOMED CT primarily, ICD-10-CM permitted). Maria's "Type 2 diabetes mellitus" maps cleanly to SNOMED <code>44054006</code> AND ICD-10-CM <code>E11.9</code>.</li>
        <li><strong>MedicationRequest.medicationCodeableConcept</strong> — extensible to RxNorm. "Metformin 500 MG Oral Tablet" is RxNorm <code>860975</code>. Source EHR stored it as a local formulary code — needs translation.</li>
        <li><strong>Patient.gender</strong> — required binding. Source has "F"; we must emit "female".</li>
        <li><strong>Encounter.class</strong> — required binding to <code>v3-ActEncounterCode</code>. Source says "INPATIENT"; we must emit <code>IMP</code>.</li>
      </ul>
      `)}
      ${UI.collapsible("The hard case: Robert Kowalski's legacy ICD-9 code", `
      <p>P002's discharge diagnoses include "Atrial fibrillation" but the source EHR — which migrated from a legacy system in 2014 — stored it as ICD-9 code <code>427.31</code>. US Core's Condition ValueSet doesn't include ICD-9. We need to decide: translate to ICD-10-CM <code>I48.91</code> in the producer? Emit ICD-9 anyway and let the receiver handle it? Emit both?</p>
      `)}
      ${UI.collapsible("Translation options", `
      <ul>
        <li><strong>Static crosswalk</strong> — maintain a local <code>ConceptMap</code> and look up translations at producer-time. Fast, deterministic, but stale crosswalks rot quietly.</li>
        <li><strong>Terminology service <code>$translate</code></strong> — call a hosted terminology service (e.g., NLM's, or a commercial one) at producer-time. Always current, but adds external dependency to the producer.</li>
        <li><strong>Dual-coding</strong> — emit <code>Condition.code.coding</code> with both ICD-9 and ICD-10-CM entries. Receiver picks. Spec-compliant — FHIR explicitly allows multiple codings — but pushes interpretation downstream.</li>
        <li><strong>Skip translation, emit raw</strong> — leave it as ICD-9 and let validation fail at the receiver. Always wrong.</li>
      </ul>
      `)}
      ${UI.xref("produce", "consume", 7, "On the consuming side, Terminology Binding Checks runs <code>$validate-code</code> against incoming resources to catch exactly the problem this station prevents — codes that don't match the bound ValueSet. The decisions on this station determine whether your output sails through that check or gets quarantined.")}
    `,
    beforeAfter: {
      before: () => `<pre class="code-block"><span class="pc-comment"># P002 (Robert Kowalski) discharge diagnosis — source EHR row</span>
{
  "diagnosis_text": "Atrial fibrillation",
  "diagnosis_code_system": "ICD-9-CM",
  "diagnosis_code": "427.31",
  "diagnosis_date": "2026-04-02"
}

<span class="pc-comment"># Target: US Core Condition resource
# Profile: us-core-condition-problems-health-concerns
# Binding strength on Condition.code: extensible (SNOMED preferred, ICD-10-CM permitted)
# ICD-9 is NOT in the bound ValueSet.</span></pre>`,
      after: () => {
        const strategy = State.getDecision("produce", 5, "sp5_choice");
        if (!strategy) return `<div class="empty-state">Pick a translation strategy.</div>`;
        let codingBlock;
        if (strategy === "static-crosswalk" || strategy === "service-translate") {
          codingBlock = `[
        {
          "system": "http://hl7.org/fhir/sid/icd-10-cm",
          "code": "I48.91",
          "display": "Unspecified atrial fibrillation"
        }${strategy === "service-translate" ? `,
        {
          "extension": [{
            "url": "http://hl7.org/fhir/StructureDefinition/originalText",
            "valueString": "Translated from ICD-9-CM 427.31 via $translate at 2026-04-14T09:30:00Z"
          }]
        }` : ""}
      ]`;
        } else if (strategy === "dual-code") {
          codingBlock = `[
        {
          "system": "http://hl7.org/fhir/sid/icd-9-cm",
          "code": "427.31",
          "display": "Atrial fibrillation"
        },
        {
          "system": "http://hl7.org/fhir/sid/icd-10-cm",
          "code": "I48.91",
          "display": "Unspecified atrial fibrillation"
        }
      ]`;
        } else {
          codingBlock = `[
        {
          "system": "http://hl7.org/fhir/sid/icd-9-cm",
          "code": "427.31",
          "display": "Atrial fibrillation"
        }
      ]  // WILL FAIL US Core extensible binding`;
        }
        return `<pre class="code-block">${UI.highlightJson(`{
  "resourceType": "Condition",
  "meta": {"profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns|6.1.0"]},
  "subject": {"reference": "urn:uuid:patient-p002-uuid"},
  "code": {
    "coding": ${codingBlock},
    "text": "Atrial fibrillation"
  },
  "onsetDateTime": "2026-04-02"
}`)}</pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — How to handle the legacy ICD-9 code</h3>
        <div class="task-prompt">
          P002's diagnosis is stored as ICD-9 in the source EHR. The receiver expects US Core conformance, which requires extensible binding to a SNOMED/ICD-10-CM ValueSet. ICD-9 is not in that ValueSet. Which approach is best for production?
        </div>
        <div class="choice-list" id="sp5-choices">
          ${[
            { v: "static-crosswalk",  t: "<strong>Static crosswalk</strong> — maintain a local ICD-9 → ICD-10-CM <code>ConceptMap</code>. Translate at producer-time. Fast, deterministic." },
            { v: "service-translate", t: "<strong>Service <code>$translate</code></strong> — call a hosted terminology service at producer-time. Always current but adds an external dependency." },
            { v: "dual-code",         t: "<strong>Dual-coding</strong> — emit both ICD-9 and ICD-10-CM in <code>Condition.code.coding</code>. Receiver picks. Spec-allowed." },
            { v: "emit-raw",          t: "<strong>Emit raw</strong> — leave it as ICD-9. Receiver will validate and reject if it can't handle." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleSP5Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="sp5-feedback"></div>
        <div id="hint-area"></div>
      `,
      hint: "Three filters: (1) does it satisfy US Core's extensible binding? (2) does it preserve the original code for audit/reversibility? (3) does it work without an external service every batch run? One option fails (1). One adds operational risk (external dependency for a routine producer). One satisfies all three.",
      reveal: () => {
        State.setDecision("produce", 5, "sp5_choice", "dual-code");
      },
      validate: () => {
        if (!State.getDecision("produce", 5, "sp5_choice")) return { ok: false, message: "Pick a translation strategy first." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "produce", stationNum: 5, decisionKey: "sp5_choice",
        choicesRootId: "sp5-choices", feedbackId: "sp5-feedback",
        correctValue: "dual-code",
        correctHtml: "Correct. Dual-coding satisfies US Core's extensible binding (the ICD-10-CM coding is from the bound ValueSet), preserves the original ICD-9 for audit and reversibility, and requires no external service. FHIR's <code>Condition.code.coding</code> is explicitly an array for exactly this case.",
        incorrectHtml: "Three filters to pass: (1) satisfy US Core's extensible binding, (2) preserve the original code for audit, (3) avoid runtime external-service dependency. One option does all three. Try again or reveal."
      });
    }
  },
  /* ============================================================
     STATION 6 — Extension Design
     ============================================================ */
  {
    number: 6,
    title: "Extension Design",
    lecture: () => `
      <p>Station 6 is <strong>Extension Design</strong>. With terminology bound (S5), we now confront the elements that don't have native FHIR fields — patient preferences, organizational metadata, jurisdiction-specific flags. FHIR's answer is the extension mechanism: a structured way to add data without forking the spec.</p>

      ${UI.collapsible("The hierarchy of extension choices", `
      <p>Before designing a custom extension, walk this ladder in order — most projects can stop at step 1 or 2:</p>
      <ol>
        <li><strong>Use a base FHIR field</strong> you may have overlooked. <code>Patient.communication</code> for languages, <code>Patient.contact</code> for emergency contacts, <code>Patient.maritalStatus</code> — these exist and are widely supported.</li>
        <li><strong>Use a US Core extension</strong>. The standard extensions cover race, ethnicity, birth sex, sex (parameter for clinical use vs. administrative), genderIdentity, tribal affiliation, and several others.</li>
        <li><strong>Use an HL7-published extension</strong>. <code>http://hl7.org/fhir/StructureDefinition/...</code> includes patient-religion, patient-importance, patient-disability, and many more.</li>
        <li><strong>Use an Implementation Guide-defined extension</strong>. Da Vinci, CARIN, IHE — if your domain has an IG, check there.</li>
        <li><strong>Define a custom extension</strong>. Last resort. Costs you interoperability — nobody will know what your URL means.</li>
      </ol>
      `)}
      ${UI.collapsible("The Cascade Cohort's extension needs", `
      <p>For the post-discharge summary, we need to convey three things beyond what US Core's required fields cover:</p>
      <ul>
        <li><strong>Preferred language</strong> for clinician-patient communication. P001 (Maria Gonzalez) prefers Spanish.</li>
        <li><strong>Religion</strong>. P002 (Robert Kowalski) is recorded as Catholic — relevant for end-of-life care planning he discussed during admission.</li>
        <li><strong>"Discharge follow-up urgency"</strong> — a Cascade-internal flag indicating "primary care must contact within 7 days" vs. "routine 30-day follow-up." This is the hospital's internal triage rubric, not a standard concept.</li>
      </ul>
      `)}
      ${UI.collapsible("Walking the ladder for each", `
      <ul>
        <li><strong>Preferred language</strong> → step 1. <code>Patient.communication</code> with <code>preferred = true</code>. No extension needed.</li>
        <li><strong>Religion</strong> → step 3. <code>http://hl7.org/fhir/StructureDefinition/patient-religion</code> with a code from <code>v3-ReligiousAffiliation</code>. Standard extension, widely understood.</li>
        <li><strong>Discharge follow-up urgency</strong> → ?? This is the decision point. There's no standard concept that means exactly "Cascade's 7-day-vs-30-day triage." Walk the ladder and pick the right floor to stop on.</li>
      </ul>
      `)}
      ${UI.collapsible("Modifier extensions — the dangerous kind", `
      <p>Standard extensions are <em>additive</em>: a receiver that doesn't recognize them can ignore them safely. Modifier extensions <em>change the meaning</em> of the element they're attached to. A receiver that doesn't recognize a modifier extension MUST reject the resource. Use <code>modifierExtension</code> only when ignoring it would change clinical interpretation — almost never the right call for organizational metadata.</p>
      `)}
      ${UI.collapsible("What \"cost of a custom extension\" actually means", `
      <p>Custom extensions break in three predictable ways: receivers ignore them silently (defeating their purpose), receivers misinterpret them (worse), or downstream tooling (validators, mappers) doesn't know how to handle them and either errors or skips them. Each consumer who wants to use the data has to be told what the extension means, in human-readable docs, separately from the FHIR spec.</p>
      `)}`,
    beforeAfter: {
      before: () => `<pre class="code-block"><span class="pc-comment"># Source EHR record for P001 (Maria Gonzalez):</span>
{
  "mrn": "CRH-10001",
  "preferred_language": "es-US",
  "religion_code": null,
  "discharge_followup_urgency": "7-day"   <span class="pc-comment">// Cascade-internal flag</span>
}

<span class="pc-comment"># Three extension decisions — language and religion are easy.
# discharge_followup_urgency is the hard one.</span></pre>`,
      after: () => {
        const choice = State.getDecision("produce", 6, "sp6_choice");
        if (!choice) return `<div class="empty-state">Pick where to stop on the extension ladder.</div>`;
        let urgencyBlock;
        if (choice === "us-core-shoehorn") {
          urgencyBlock = `// Attempting to use Patient.contact for follow-up urgency...
  // ...this is structurally wrong; Patient.contact is for emergency contacts, not triage flags.
  // SEMANTIC MISMATCH — receivers will misinterpret.`;
        } else if (choice === "hl7-published") {
          urgencyBlock = `// Searched HL7-published extensions: none match "discharge follow-up urgency"
  // (patient-importance is closest but means something different — patient VIP status)
  // No clean fit at this floor — must descend further or invent.`;
        } else if (choice === "custom-extension") {
          urgencyBlock = `{
    "url": "http://cascadehealth.example/fhir/StructureDefinition/discharge-followup-urgency",
    "valueCode": "7-day"
  }
  // Custom extension. Cascade publishes a StructureDefinition + human-readable docs.
  // Scope: Cascade-internal exchange. Receivers outside Cascade will not understand.`;
        } else {
          urgencyBlock = `// Decided NOT to convey discharge_followup_urgency in FHIR.
  // Routed through a separate operational channel (case-management workflow).
  // Patient resource stays clean and standard.`;
        }
        return `<pre class="code-block">${UI.highlightJson(`{
  "resourceType": "Patient",
  "id": "tmp-p001",
  "meta": {"profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient|6.1.0"]},
  "extension": [
    {
      "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
      "extension": [/* race ombCategory + text — from Station 3 */]
    }
    // Step 1: language → Patient.communication (no extension needed)
    // Step 3: religion → standard HL7 extension (patient-religion)
    ${urgencyBlock}
  ],
  "communication": [
    {"language": {"coding": [{"system": "urn:ietf:bcp:47", "code": "es-US"}]}, "preferred": true}
  ]
}`)}</pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — How to convey "discharge follow-up urgency"</h3>
        <div class="task-prompt">
          The Cascade-internal urgency flag has no clean match in US Core, base FHIR, or published HL7 extensions. Where on the extension ladder should the producer stop?
        </div>
        <div class="choice-list" id="sp6-choices">
          ${[
            { v: "us-core-shoehorn",    t: "<strong>Shoehorn into a US Core field</strong> — repurpose <code>Patient.contact</code> with a custom relationship code to carry the urgency flag." },
            { v: "hl7-published",       t: "<strong>Use the closest HL7-published extension</strong> — <code>patient-importance</code> is the closest semantic match and is widely understood." },
            { v: "custom-extension",    t: "<strong>Define a custom extension</strong> — publish <code>http://cascadehealth.example/fhir/StructureDefinition/discharge-followup-urgency</code> with a StructureDefinition and human-readable docs. Scoped to Cascade-internal exchange." },
            { v: "out-of-band",         t: "<strong>Route out-of-band</strong> — don't put urgency in FHIR at all. Use the existing case-management workflow channel. Keep the FHIR resource clean and standard." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleSP6Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="sp6-feedback"></div>
        <div id="hint-area"></div>
      `,
      hint: "Two of these options are wrong because they break semantics — shoehorning misuses an existing field; <code>patient-importance</code> means VIP status, not triage urgency. That leaves two plausible options. The decision between them turns on: is the receiver going to act on this data inside their FHIR consumer, or do they have a separate workflow that already handles case-management triage? If the latter, FHIR isn't the right channel for this concept at all.",
      reveal: () => {
        State.setDecision("produce", 6, "sp6_choice", "out-of-band");
      },
      validate: () => {
        if (!State.getDecision("produce", 6, "sp6_choice")) return { ok: false, message: "Pick an extension strategy first." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "produce", stationNum: 6, decisionKey: "sp6_choice",
        choicesRootId: "sp6-choices", feedbackId: "sp6-feedback",
        correctValue: "out-of-band",
        correctHtml: "Correct. Discharge follow-up urgency is operational triage data, not clinical fact. The receivers (primary care offices) already have case-management workflows for this. Putting it in FHIR creates a custom extension that nobody outside Cascade will understand, with no offsetting benefit. Sometimes the right answer is 'this concept doesn't belong in FHIR.'",
        incorrectHtml: "Two of these break semantics outright (shoehorning, <code>patient-importance</code>). Between custom-extension and out-of-band, ask: does the receiver consume this through their FHIR pipeline, or through a separate workflow that already exists? Try again or reveal."
      });
    }
  },
  /* ============================================================
     STATION 7 — FHIRPath Invariant Checks
     ============================================================ */
  {
    number: 7,
    title: "FHIRPath Invariant Checks",
    lecture: () => `
      <p>Station 7 is <strong>FHIRPath Invariant Checks</strong>. With terminology bound (S5) and extensions decided (S6), each resource is structurally complete. But profiles also carry <em>invariants</em> — FHIRPath expressions that must evaluate to true for the resource to be considered valid. Cardinality and type rules can't express things like "if status is final, a value must be present" or "name must have given OR family." Invariants do.</p>

      ${UI.collapsible("What FHIRPath looks like in practice", `
      <p>FHIRPath is a path language over the resource tree. Examples from US Core invariants:</p>
      <ul>
        <li><code>name.exists() and name.all(family.exists() or given.exists())</code> — every name entry must have either family or given (not both required, but at least one).</li>
        <li><code>status='entered-in-error' or value.exists() or dataAbsentReason.exists()</code> — an Observation must either have a value, or explain why it doesn't, or be flagged as a data-entry error.</li>
        <li><code>identifier.where(system='http://hospital.example/mrn').exists()</code> — a Cascade-internal invariant requiring an MRN identifier specifically.</li>
      </ul>
      `)}
      ${UI.collapsible("Where invariants come from", `
      <p>Three sources, in order of broadness:</p>
      <ol>
        <li><strong>Base FHIR invariants</strong> — built into resource definitions. <code>Patient.name</code> for example carries an invariant requiring family or given.</li>
        <li><strong>Profile invariants</strong> — added by US Core, IPA, Da Vinci, etc. <code>us-core-patient</code> adds <code>us-core-1</code>: <code>name.given.exists() or name.family.exists()</code> (which mirrors the base rule but with profile-level enforcement).</li>
        <li><strong>Site-local invariants</strong> — Cascade may layer additional FHIRPath rules in a derived profile (e.g., requiring that an MRN identifier system match Cascade's specific URL).</li>
      </ol>
      `)}
      ${UI.collapsible("Local validation vs. server-side validation", `
      <p>The <strong>$validate</strong> operation on the receiving server runs all invariants and returns OperationOutcome on failures. We could just submit the Bundle and let the server tell us what's wrong. Two reasons not to:</p>
      <ul>
        <li><strong>Bandwidth and audit</strong> — a 200-resource Bundle that fails on resource #4 still travels the wire fully and gets logged at the receiver. A local check stops the failure inside our perimeter.</li>
        <li><strong>Diagnostic richness</strong> — the receiver returns <em>that</em> something failed. Local validation can attribute the failure to a specific source row in our intake records, with line number and column. That's a better debugging trail.</li>
      </ul>
      `)}
      ${UI.collapsible("The Cascade Cohort's invariant trouble spots", `
      <p>Across the constructed resources for the post-discharge submission:</p>
      <ul>
        <li><strong>P004's Encounter</strong> — discharge time is <em>before</em> admission time. Source data error. Invariant <code>Encounter.period.end &gt;= Encounter.period.start</code> fails.</li>
        <li><strong>P003's MedicationRequest for buprenorphine</strong> — has <code>status = "active"</code> and <code>doNotPerform = true</code>. Contradictory. Invariant <code>not(status='active' and doNotPerform=true)</code> fails.</li>
        <li><strong>P002's discharge Observation</strong> — has <code>status = "final"</code> but no <code>value</code> and no <code>dataAbsentReason</code>. Invariant <code>status='entered-in-error' or value.exists() or dataAbsentReason.exists()</code> fails.</li>
      </ul>
      `)}
      ${UI.collapsible("What does the producer do with invariant failures?", `
      <p>Unlike terminology mismatches (which sometimes have legitimate workarounds), invariant failures are almost always source-data problems that need fixing at the source. The decision is whether to fix them in the producer (silent repair), surface them for review (loud), or refuse to construct the offending resource at all.</p>
      `)}`,
    beforeAfter: {
      before: () => `<pre class="code-block"><span class="pc-comment"># P004 Encounter — discharge time before admission time</span>
{
  "resourceType": "Encounter",
  "id": "tmp-enc-p004",
  "status": "finished",
  "class": {"system": "...v3-ActCode", "code": "AMB", "display": "ambulatory"},
  "subject": {"reference": "urn:uuid:patient-p004-uuid"},
  "period": {
    "start": "2026-04-10T14:00:00Z",   <span class="pc-comment">// admission</span>
    "end":   "2026-04-10T13:30:00Z"    <span class="pc-comment">// discharge — BEFORE admission</span>
  }
}

<span class="pc-comment"># Invariant: Encounter.period.end &gt;= Encounter.period.start
# Source data error in the EHR's encounter table.</span></pre>`,
      after: () => {
        const policy = State.getDecision("produce", 7, "sp7_choice");
        if (!policy) return `<div class="empty-state">Pick an invariant-failure policy.</div>`;
        let outcome;
        if (policy === "silent-repair") {
          outcome = `{
  "policy": "silent-repair",
  "P004 Encounter": {
    "action": "Swapped period.start and period.end",
    "result": "VALID",
    "warning": "WAREHOUSE-BOUND DATA NO LONGER MATCHES SOURCE — silently corrected without source-system fix"
  }
}`;
        } else if (policy === "review-queue") {
          outcome = `{
  "policy": "review-queue",
  "P004 Encounter": {
    "action": "Routed to data-quality review queue with intake_record_id and invariant trace",
    "result": "NOT SUBMITTED",
    "next": "Data steward investigates source EHR row, corrects upstream, pipeline retries"
  },
  "P003 MedicationRequest": { "result": "NOT SUBMITTED", "next": "review-queue" },
  "P002 Observation":       { "result": "NOT SUBMITTED", "next": "review-queue" }
}`;
        } else if (policy === "skip-resource") {
          outcome = `{
  "policy": "skip-resource",
  "result": "Bundle submitted without P004 Encounter, P003 MedicationRequest, P002 Observation",
  "issue": "RECEIVER GETS INCOMPLETE PICTURE OF PATIENT — silent data loss"
}`;
        } else {
          outcome = `{
  "policy": "submit-anyway",
  "result": "Receiver $validate returns OperationOutcome with 3 ERROR-severity invariant failures",
  "outcome": "Transaction Bundle REJECTED in entirety; nothing accepted",
  "wasted": "All 30 valid resources also bounced because the transaction is atomic"
}`;
        }
        return `<pre class="code-block">${UI.highlightJson(outcome)}</pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — Handling 3 invariant failures pre-submit</h3>
        <div class="task-prompt">
          P004's Encounter, P003's MedicationRequest, and P002's Observation each fail at least one profile invariant. The Bundle is being prepared as a transaction (atomic). What should the producer do?
        </div>
        <div class="choice-list" id="sp7-choices">
          ${[
            { v: "silent-repair",  t: "<strong>Silent repair</strong> — fix what's automatically fixable (swap reversed dates, infer missing values), submit. Warehouse stays current with corrected data." },
            { v: "review-queue",   t: "<strong>Review queue</strong> — route failing resources to a data-quality review queue with full diagnostic trace. Don't submit until source data is fixed and pipeline retries." },
            { v: "skip-resource",  t: "<strong>Skip resource</strong> — drop the failing resources from the Bundle, submit the rest. Receiver gets a partial submission." },
            { v: "submit-anyway",  t: "<strong>Submit anyway</strong> — let the receiver's <code>$validate</code> catch them. The Bundle will fail atomically; we'll see the OperationOutcome." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleSP7Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="sp7-feedback"></div>
        <div id="hint-area"></div>
      `,
      hint: "Three filters: (1) does the warehouse end up matching reality (the source system's actual data)? (2) does the receiver see what we have, accurately? (3) does the source-system error get fixed at the source, where it actually came from? Silent-repair fails (1) and (3). Skip-resource fails (2). Submit-anyway fails everything because the transaction bounces atomically. One option puts the right pressure on the right place.",
      reveal: () => {
        State.setDecision("produce", 7, "sp7_choice", "review-queue");
      },
      validate: () => {
        if (!State.getDecision("produce", 7, "sp7_choice")) return { ok: false, message: "Pick an invariant-failure policy first." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "produce", stationNum: 7, decisionKey: "sp7_choice",
        choicesRootId: "sp7-choices", feedbackId: "sp7-feedback",
        correctValue: "review-queue",
        correctHtml: "Correct. Routing to a review queue puts the right pressure in the right place — the source EHR's data steward gets a ticket with the bad row, fixes it upstream, and the pipeline retries. The warehouse stays accurate. The receiver eventually gets correct data. The source system gets actually-fixed instead of having errors silently routed around forever.",
        incorrectHtml: "Three filters: warehouse accuracy, receiver completeness, source-system correction. Silent-repair fails warehouse accuracy and bypasses the source fix. Skip-resource leaves the receiver with a partial picture. Submit-anyway bounces the whole atomic transaction. One option satisfies all three. Try again or reveal."
      });
    }
  },
  /* ============================================================
     STATION 8 — Profile Validation (Pre-Submit)
     ============================================================ */
  {
    number: 8,
    title: "Profile Validation (Pre-Submit)",
    lecture: () => `
      <p>Station 8 is <strong>Profile Validation (Pre-Submit)</strong>. This is the final gate inside the producer's perimeter before the Bundle leaves for the receiver. Stations 5–7 caught terminology, extension, and invariant problems individually. This station runs the full US Core profile validator against every constructed resource as a unified check.</p>

      ${UI.collapsible("Why a separate validation pass at the end", `
      <p>The earlier stations were targeted: each one verified one dimension. This station catches the failures that emerge from interactions between dimensions — a resource where every individual element is fine but the assembled whole still violates a profile constraint. Common examples:</p>
      <ul>
        <li>A required slice that wasn't populated (e.g., US Core Patient requires an identifier slice with <code>system = "http://hl7.org/fhir/sid/us-ssn"</code> OR <code>system = "http://hospital.example/mrn"</code> — a producer who emitted only a driver's-license identifier passes individual element checks but fails the slice).</li>
        <li>A profile invariant that depends on multiple fields evaluating together.</li>
        <li>A reference target that resolves but doesn't conform to its own expected profile.</li>
      </ul>
      `)}
      ${UI.collapsible("The validator we run", `
      <p>For US Core conformance, the canonical option is the <strong>HL7 FHIR Validator</strong> (the Java jar referenced by every IG, also exposed via <code>$validate</code> on most servers). Many production pipelines run the validator locally rather than via a server call, because:</p>
      <ul>
        <li>Local validation has no network dependency for routine batch runs</li>
        <li>The validator can be pinned to an exact version, matching the receiver's expected version</li>
        <li>Local logs attribute failures to specific source rows, not anonymized resource IDs</li>
      </ul>
      `)}
      ${UI.collapsible("What \"must-support\" actually means at this stage", `
      <p>Must-support is the most-misunderstood concept in US Core. It does NOT mean "required" — a resource missing a must-support element can still be valid. What must-support means is: <em>if you have data for this element in your records, you must populate it</em>. The producer is asserting "we are capable of populating this; the absence here means we don't have it," not "this is optional and we just chose not to bother."</p>

      <p>For the Cascade post-discharge submission, must-support gaps are flagged but don't block. The validator emits them as <code>WARNING</code> severity. The pipeline tracks a must-support coverage rate per resource type and per producer batch — falling coverage signals upstream data-quality drift.</p>
      `)}
      ${UI.collapsible("Where things actually break at this gate", `
      <p>Across the constructed resources (post terminology + extension + invariant fixes):</p>
      <ul>
        <li>P003's MedicationRequest profile claim is <code>us-core-medicationrequest|6.1.0</code>, but the producer code path that built it referenced a different profile's slicing definition. <strong>Slicing mismatch — fails validation.</strong></li>
        <li>P002's Observation references an Encounter (<code>encounter</code> field) that resolves to a resource not claiming <code>us-core-encounter</code> profile. <strong>Reference target profile mismatch — fails validation.</strong></li>
        <li>P004's Condition is missing a <code>verificationStatus</code> element that's must-support. <strong>Warning, not error</strong> — but flagged in the must-support coverage report.</li>
      </ul>
      `)}
      ${UI.collapsible("Action on each finding", `
      <p>Errors block submission. Warnings inform reporting. The decision is whether to <em>route</em> errors through the same review queue as Station 7's invariant failures, or treat them differently — they're a different kind of failure (composition-level rather than per-resource).</p>
      `)}`,
    beforeAfter: {
      before: () => `<pre class="code-block"><span class="pc-comment"># Final pre-submit validation report (HL7 FHIR Validator output)</span>
{
  "summary": {"validated": 30, "errors": 2, "warnings": 1, "must_support_coverage": "94.2%"},
  "errors": [
    {
      "resource": "MedicationRequest/tmp-medreq-p003-bup",
      "severity": "ERROR",
      "code": "Slicing constraint failed",
      "diagnostics": "Profile us-core-medicationrequest requires at least one identifier slice matching system pattern; found none."
    },
    {
      "resource": "Observation/tmp-obs-p002-bp",
      "severity": "ERROR",
      "code": "Reference target profile mismatch",
      "diagnostics": "Observation.encounter resolves to Encounter/tmp-enc-p002-2026-04 which does not claim us-core-encounter conformance."
    }
  ],
  "warnings": [
    {
      "resource": "Condition/tmp-cond-p004-htn",
      "severity": "WARNING",
      "code": "must-support element absent",
      "diagnostics": "verificationStatus is must-support but absent; if your records contain this data, please populate."
    }
  ]
}</pre>`,
      after: () => {
        const policy = State.getDecision("produce", 8, "sp8_choice");
        if (!policy) return `<div class="empty-state">Pick an error-handling policy.</div>`;
        let outcome;
        if (policy === "block-and-route") {
          outcome = `{
  "policy": "block-and-route",
  "submitted": 28,
  "blocked": 2,
  "routedTo": "review_queue",
  "details": "MedicationRequest/tmp-medreq-p003-bup → review queue (slicing failure: producer's identifier-emission code path needs fix)",
  "details_2": "Observation/tmp-obs-p002-bp → review queue (Encounter not claiming us-core-encounter — fix Encounter construction in S3)",
  "warnings_logged": 1,
  "must_support_report": "94.2% coverage; trending stable (last batch: 94.0%)"
}`;
        } else if (policy === "auto-fix-attempt") {
          outcome = `{
  "policy": "auto-fix-attempt",
  "result": "Pipeline rewrote MedicationRequest identifier and re-pointed Observation.encounter target",
  "submitted": 30,
  "danger": "PRODUCER OUTPUT NO LONGER MATCHES PRODUCER CODE PATH — silent rewrites mask upstream bugs"
}`;
        } else if (policy === "downgrade-and-submit") {
          outcome = `{
  "policy": "downgrade-and-submit",
  "result": "Removed us-core profile claims from failing resources; submitted as base FHIR",
  "submitted": 30,
  "issue": "Receiver expecting US Core conformance gets base FHIR resources; validation will fail at receiver instead"
}`;
        } else {
          outcome = `{
  "policy": "submit-and-let-receiver-handle",
  "result": "Bundle submitted with known errors",
  "outcome": "Receiver returns OperationOutcome with 2 ERROR-severity findings; transaction REJECTED atomically",
  "wasted": "All 28 valid resources also bounced; receiver bandwidth and audit log polluted"
}`;
        }
        return `<pre class="code-block">${UI.highlightJson(outcome)}</pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — Final pre-submit validation policy</h3>
        <div class="task-prompt">
          The HL7 FHIR Validator returned 2 errors and 1 warning across 30 constructed resources. The transaction Bundle is atomic — any error blocks the whole submission at the receiver. What does the producer do?
        </div>
        <div class="choice-list" id="sp8-choices">
          ${[
            { v: "block-and-route",                t: "<strong>Block and route</strong> — hold the failing resources in a review queue with full validator output; submit a 28-resource Bundle (or hold the entire batch if cohort-atomicity matters); log the warning for must-support coverage tracking." },
            { v: "auto-fix-attempt",               t: "<strong>Auto-fix attempt</strong> — pipeline silently rewrites failing resources to make them pass (synthesize identifiers, repoint references), submits all 30." },
            { v: "downgrade-and-submit",           t: "<strong>Downgrade and submit</strong> — strip the us-core profile claim from failing resources, submit as base FHIR. Receiver may not validate against the same profile." },
            { v: "submit-and-let-receiver-handle", t: "<strong>Submit and let receiver handle</strong> — send the Bundle with known errors. Let the receiver's <code>$validate</code> reject and we'll handle the OperationOutcome on bounce." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleSP8Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="sp8-feedback"></div>
        <div id="hint-area"></div>
      `,
      hint: "Same filters as Station 7's invariant decision. Auto-fix masks producer-code bugs (you'll never know your construction code is wrong). Downgrade ships invalid claims (you said US Core, you're sending non-US-Core). Submit-anyway wastes a round trip and pollutes the receiver's logs. The right answer puts the failing resources in human view and gets the rest of the data flowing.",
      reveal: () => {
        State.setDecision("produce", 8, "sp8_choice", "block-and-route");
      },
      validate: () => {
        if (!State.getDecision("produce", 8, "sp8_choice")) return { ok: false, message: "Pick an error-handling policy first." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "produce", stationNum: 8, decisionKey: "sp8_choice",
        choicesRootId: "sp8-choices", feedbackId: "sp8-feedback",
        correctValue: "block-and-route",
        correctHtml: "Correct. Block-and-route surfaces validator errors to the team that can fix them (the producer-code maintainers and source-system owners), routes the failing resources without losing them, and lets the rest of the batch reach the receiver. Must-support warnings get tracked separately so coverage drift becomes visible. This is the same pattern as Station 7's invariant decision, applied at a different gate — and that consistency is itself the point.",
        incorrectHtml: "Auto-fix masks producer bugs. Downgrade ships invalid profile claims. Submit-anyway wastes a round trip on an atomic transaction. The pattern from Station 7 (review-queue) applies here too. Try again or reveal."
      });
    }
  },
  /* ============================================================
     STATION 9 — Bundle Assembly
     ============================================================ */
  {
    number: 9,
    title: "Bundle Assembly",
    lecture: () => `
      <p>Station 9 is <strong>Bundle Assembly</strong>. Every resource has been constructed, validated, and queued. Now we assemble them into a Bundle that the receiver can accept as a single submission. The choice of Bundle type and entry shape determines whether the submission is atomic, what happens on partial failures, and how interdependent resources resolve their references.</p>

      ${UI.collapsible("Bundle types — and why most producers should use only two", `
      <ul>
        <li><strong>transaction</strong> — atomic. All entries succeed or all fail. References inside the Bundle (using <code>urn:uuid:</code>) resolve atomically to server-assigned IDs. The right choice when the entries are interdependent — like a Patient + their new Conditions + their new MedicationRequests, where partial success would leave orphaned clinical resources pointing at no patient.</li>
        <li><strong>batch</strong> — non-atomic. Each entry is processed independently; some succeed, some fail. The right choice when entries are unrelated and partial success is meaningful — like submitting 100 unrelated Patient updates where 99 succeeding and 1 failing is a useful outcome.</li>
        <li><strong>collection / document / message / history / searchset</strong> — special-purpose, rarely the right choice for routine producer submissions. <code>document</code> in particular is for signed, frozen clinical documents and is a different workflow entirely.</li>
      </ul>
      `)}
      ${UI.collapsible("Entry shape — the parts that matter", `
      <ul>
        <li><strong>fullUrl</strong> — uses <code>urn:uuid:&lt;new-uuid&gt;</code> for resources being created in this Bundle. References inside the Bundle target this URL. The server replaces it with the real server-assigned URL after creation.</li>
        <li><strong>resource</strong> — the resource itself.</li>
        <li><strong>request.method</strong> — POST (create), PUT (update by ID), PATCH (partial update), DELETE.</li>
        <li><strong>request.url</strong> — the target URL relative to the FHIR base. <code>Patient</code> for create; <code>Patient/p001</code> for update by ID; <code>Patient?identifier=...</code> for conditional create/update.</li>
        <li><strong>request.ifNoneExist</strong> — for conditional create. Tells the server "create only if no resource matches this query." Used to avoid duplicates.</li>
      </ul>
      `)}
      ${UI.collapsible("The Cascade post-discharge submission", `
      <p>For each of the 5 patients, we're submitting:</p>
      <ul>
        <li>1 Patient (conditional create — don't duplicate if the receiver already has them by MRN)</li>
        <li>1 Practitioner (Dr. Adler — conditional create on NPI)</li>
        <li>1 Encounter (the inpatient admission)</li>
        <li>3-5 Conditions (discharge diagnoses)</li>
        <li>2-4 MedicationRequests (discharge medications)</li>
      </ul>
      <p>Roughly 30 resources total. Heavy interdependence — Conditions point at Patient and Encounter, MedicationRequests point at Patient and Practitioner. Partial success would be a mess.</p>
      `)}
      ${UI.collapsible("The atomicity decision in detail", `
      <p>Should this be one transaction Bundle (all 30 atomic) or one transaction per patient (5 Bundles, 6 resources each)? Or 5 batches?</p>
      <ul>
        <li><strong>Single transaction (30 entries)</strong> — atomic across the cohort. If any of 30 entries fails at the receiver, all 30 bounce. Recovery requires re-submitting everything.</li>
        <li><strong>Per-patient transactions (5 × ~6 entries)</strong> — atomic per patient. If P003's submission fails, P001/P002/P004/P005 still go through. Each patient is internally consistent or not at all.</li>
        <li><strong>Per-patient batches</strong> — non-atomic. Each resource within a patient succeeds or fails individually. P003's Patient might succeed while P003's Conditions fail, leaving partial state.</li>
        <li><strong>Single batch (30 entries)</strong> — fully non-atomic. Worst of both worlds for interdependent data.</li>
      </ul>
      `)}`,
    beforeAfter: {
      before: () => `<pre class="code-block"><span class="pc-comment"># 30 resources ready for submission. 5 patients, ~6 resources each.</span>
{
  "resources_per_patient": {
    "P001": ["Patient", "Practitioner", "Encounter", "Condition×2", "MedicationRequest×2"],
    "P002": ["Patient", "Practitioner", "Encounter", "Condition×2", "MedicationRequest×3"],
    "P003": ["Patient", "Practitioner", "Encounter", "Condition×2", "MedicationRequest×2"],
    "P004": ["Patient", "Practitioner", "Encounter", "Condition×1", "MedicationRequest×0"],
    "P005": ["Patient", "Practitioner", "Encounter", "Condition×1", "MedicationRequest×1"]
  },
  "interdependencies": "Conditions reference Patient and Encounter; MedicationRequests reference Patient and Practitioner",
  "decision": "How to assemble?"
}</pre>`,
      after: () => {
        const choice = State.getDecision("produce", 9, "sp9_choice");
        if (!choice) return `<div class="empty-state">Pick a Bundle assembly strategy.</div>`;
        let outcome;
        if (choice === "single-transaction") {
          outcome = `{
  "strategy": "single-transaction",
  "submissions": 1,
  "Bundle": {
    "resourceType": "Bundle",
    "type": "transaction",
    "entry": "[ 30 entries; urn:uuid: refs throughout ]"
  },
  "atomicity": "All-or-nothing across the entire cohort",
  "risk": "Any single resource failing rejects all 30. P003's MedicationRequest issue blocks P001's clean data."
}`;
        } else if (choice === "per-patient-transactions") {
          outcome = `{
  "strategy": "per-patient-transactions",
  "submissions": 5,
  "Bundles": [
    {"type": "transaction", "patient": "P001", "entries": 6, "atomicity": "P001 internally atomic"},
    {"type": "transaction", "patient": "P002", "entries": 7},
    {"type": "transaction", "patient": "P003", "entries": 6},
    {"type": "transaction", "patient": "P004", "entries": 4},
    {"type": "transaction", "patient": "P005", "entries": 4}
  ],
  "outcome": "P003's submission may fail; P001/P002/P004/P005 still succeed. Each patient is internally consistent.",
  "tradeoff": "5 round-trips instead of 1, but vastly better failure isolation."
}`;
        } else if (choice === "per-patient-batches") {
          outcome = `{
  "strategy": "per-patient-batches",
  "submissions": 5,
  "issue": "Within each patient, resources can succeed/fail individually",
  "danger": "P003's Patient creates successfully but P003's Conditions fail → orphaned references in receiver's data",
  "outcome": "Partial-state on per-patient basis; receiver has inconsistent data per patient"
}`;
        } else {
          outcome = `{
  "strategy": "single-batch",
  "submissions": 1,
  "Bundle": {"type": "batch", "entries": 30},
  "outcome": "30 independent operations. Patient may create but its Conditions may fail to create. Reference resolution within batch is NOT supported by spec.",
  "result": "Likely partial-state chaos at the receiver."
}`;
        }
        return `<pre class="code-block">${UI.highlightJson(outcome)}</pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — Bundle assembly strategy</h3>
        <div class="task-prompt">
          30 interdependent resources across 5 patients. Each patient's resources reference each other. Assemble as what?
        </div>
        <div class="choice-list" id="sp9-choices">
          ${[
            { v: "single-transaction",       t: "<strong>Single transaction Bundle (30 entries)</strong> — fully atomic across the entire cohort. One round-trip. Any single failure rejects all." },
            { v: "per-patient-transactions", t: "<strong>5 transaction Bundles, one per patient (~6 entries each)</strong> — atomic per patient. 5 round-trips. Failures isolated to one patient." },
            { v: "per-patient-batches",      t: "<strong>5 batch Bundles, one per patient</strong> — non-atomic within patient. 5 round-trips. Per-resource success/failure means orphaned references possible." },
            { v: "single-batch",             t: "<strong>Single batch Bundle (30 entries)</strong> — non-atomic across cohort. Reference resolution within batch not supported. Maximum partial-state risk." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleSP9Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="sp9-feedback"></div>
        <div id="hint-area"></div>
      `,
      hint: "Two filters: (1) atomicity needs to match interdependence — if Conditions need Patient, partial success is bad; (2) failure-blast-radius — should one bad resource block the entire cohort? Single-transaction maximizes atomicity but maximizes blast radius. Single-batch minimizes both. The middle paths balance them. Of those, one preserves intra-patient atomicity (the natural unit of clinical interdependence) while limiting blast radius to one patient.",
      reveal: () => {
        State.setDecision("produce", 9, "sp9_choice", "per-patient-transactions");
      },
      validate: () => {
        if (!State.getDecision("produce", 9, "sp9_choice")) return { ok: false, message: "Pick a Bundle assembly strategy first." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "produce", stationNum: 9, decisionKey: "sp9_choice",
        choicesRootId: "sp9-choices", feedbackId: "sp9-feedback",
        correctValue: "per-patient-transactions",
        correctHtml: "Correct. Per-patient transactions match the natural unit of clinical interdependence (a patient's discharge data is internally coherent or not at all) while limiting blast radius (one bad patient doesn't block four good ones). The 5 round-trips are a small price for the failure isolation.",
        incorrectHtml: "Two filters: atomicity matching interdependence; failure blast-radius. Single-anything is wrong on at least one filter. The right answer matches transaction boundaries to the unit of interdependence. Try again or reveal."
      });
    }
  },
  /* ============================================================
     STATION 10 — Conditional Create/Update
     ============================================================ */
  {
    number: 10,
    title: "Conditional Create/Update",
    lecture: () => `
      <p>Station 10 is <strong>Conditional Create/Update</strong>. The Bundle is assembled (S9). Each entry has a <code>request.method</code> and <code>request.url</code>. But for resources where the receiver may already have a record (most notably Patients and Practitioners), naive POST creates duplicates. Conditional create and conditional update are the FHIR mechanisms to prevent that.</p>

      ${UI.collapsible("The four operations and what they do", `
      <ul>
        <li><strong>POST [type]</strong> — unconditional create. Server assigns a new ID. Always creates a new resource. Use only when you're certain the receiver doesn't already have it.</li>
        <li><strong>POST [type] with <code>ifNoneExist</code></strong> — conditional create. Search by the given criteria; if zero matches, create; if one match, do nothing (return the existing); if multiple matches, fail with 412 Precondition Failed.</li>
        <li><strong>PUT [type]/[id]</strong> — update by ID. Requires you to know the receiver's ID, which a producer usually doesn't.</li>
        <li><strong>PUT [type]?[criteria]</strong> — conditional update. Search by criteria; if zero matches, create; if one match, update; if multiple matches, fail. Combines create-or-update semantics on a search query.</li>
      </ul>
      `)}
      ${UI.collapsible("What \"matches\" actually means — the criteria string", `
      <p>The criteria are a FHIR search query. For Patients, the standard idiom is <code>identifier=&lt;system&gt;|&lt;value&gt;</code> — match by external business identifier (MRN, NPI, SSN). The receiver runs the search against its own data and decides whether the resource already exists.</p>

      <p>Two things make this tricky:</p>
      <ol>
        <li><strong>The criteria's narrowness is your responsibility.</strong> Searching by <code>name=Maria</code> will match many patients. The right criteria are usually unique-by-design: an MRN, an NPI, an SSN. Anything else risks false positives (multiple matches → 412 fail) or false negatives (zero matches → unintended duplicate creation).</li>
        <li><strong>You're sharing identity vocabulary with the receiver.</strong> If your MRN system URL is <code>http://hospital.cascade.example/mrn</code> and the receiver stores those same MRNs under <code>http://cascade.org/mrn</code>, the conditional create won't find a match even though the receiver has the patient. This is one of the most common causes of duplicate creation in cross-organization FHIR exchange.</li>
      </ol>
      `)}
      ${UI.collapsible("The Cascade Cohort's conditional cases", `
      <ul>
        <li><strong>5 Patients</strong> — the receivers (primary care offices) usually already know these patients (referrals from Cascade Hospital). Conditional create on MRN: if PCP already has them, no-op; if not, create.</li>
        <li><strong>Dr. Adler</strong> — the receivers might have her, might not. Conditional create on NPI.</li>
        <li><strong>Encounters, Conditions, MedicationRequests</strong> — the receivers definitely don't have these (they're new clinical events from the recent admission). Unconditional POST with <code>urn:uuid</code> for in-bundle reference resolution.</li>
      </ul>
      `)}
      ${UI.collapsible("The near-duplicate case (P001/P005) returns", `
      <p>From the consumer side (Station 9), P001 and P005 looked like a possible duplicate. From the producer side, we have to decide what to do at submission time.</p>
      <ul>
        <li>If we treat them as definitely-distinct and submit both with conditional creates on their separate MRNs, the receiver gets two patients. That's correct if they're actually distinct; wrong if they're the same person.</li>
        <li>If we hold P005 pending review (mirroring the consumer-side review queue), the submission only contains P001. Cleaner but loses P005's discharge data on this batch.</li>
        <li>If we mark P005's Patient entry with <code>ifNoneExist=identifier=...|CRH-10001,...|CRH-10005</code> (multi-value), the search returns the existing P001 if she's already on the receiver — and the receiver's Patient is reused for P005's clinical resources. This is a creative use of conditional create, and it's wrong if they're actually distinct.</li>
      </ul>
      `)}
      ${UI.collapsible("The non-creative answer is the right one", `
      <p>The producer should not try to fix the consumer-side duplicate problem. Submit each as a distinct conditional-create on its own MRN. Let the receiver's data steward (or the consumer-side reconciliation queue) handle ambiguity. Trying to be clever at submission time pushes a guess into permanent receiver state.</p>
      `)}
      ${UI.xref("produce", "consume", 9, "On the consumer side, Resource Reconciliation handled the same P001/P005 ambiguity from the receiving end. The producer-side decision here (submit each distinctly, let stewardship sort it out) and the consumer-side decision there (load distinct, flag for review) are the same answer to the same problem from opposite sides.")}
    `,
    beforeAfter: {
      before: () => `<pre class="code-block"><span class="pc-comment"># Bundle entry shapes — choosing request method and conditional criteria</span>
{
  "Patient": "POST or conditional-create on MRN?",
  "Practitioner": "POST or conditional-create on NPI?",
  "Encounter / Condition / MedicationRequest": "POST (definitely new clinical events)"
}

<span class="pc-comment"># P001 and P005 — same producer batch, score 0.86 possible-duplicate</span>
P001 entry → Patient with identifier system="...mrn", value="CRH-10001"
P005 entry → Patient with identifier system="...mrn", value="CRH-10005"</pre>`,
      after: () => {
        const choice = State.getDecision("produce", 10, "sp10_choice");
        if (!choice) return `<div class="empty-state">Pick a conditional-create strategy.</div>`;
        let outcome;
        if (choice === "distinct-conditional-create") {
          outcome = `{
  "strategy": "distinct-conditional-create",
  "Patient_P001_entry": {
    "request": {
      "method": "POST",
      "url": "Patient",
      "ifNoneExist": "identifier=http://hospital.cascade.example/mrn|CRH-10001"
    }
  },
  "Patient_P005_entry": {
    "request": {
      "method": "POST",
      "url": "Patient",
      "ifNoneExist": "identifier=http://hospital.cascade.example/mrn|CRH-10005"
    }
  },
  "outcome": "Each Patient submitted distinctly. If receiver already has either MRN, the conditional skips creation. Stewardship handles ambiguity downstream."
}`;
        } else if (choice === "hold-p005-for-review") {
          outcome = `{
  "strategy": "hold-p005-for-review",
  "submitted": "P001 + 6 related resources",
  "held": "P005's Patient + Encounter + Condition + MedicationRequest (4 resources) — review_queue",
  "issue": "P005's discharge data does not reach the receiver this batch. If P001 and P005 are actually distinct people, P005's care continuity is broken."
}`;
        } else if (choice === "multi-value-ifNoneExist") {
          outcome = `{
  "strategy": "multi-value-ifNoneExist",
  "Patient_P005_entry": {
    "request": {
      "ifNoneExist": "identifier=http://hospital.cascade.example/mrn|CRH-10001,http://hospital.cascade.example/mrn|CRH-10005"
    }
  },
  "DANGER": "If P001 already exists on receiver, P005's Patient entry resolves to the existing P001. P005's clinical resources get attached to P001's chart.",
  "irreversibility": "If P001 and P005 are actually distinct people, this misroutes P005's care. Hard to detect, hard to unwind."
}`;
        } else {
          outcome = `{
  "strategy": "unconditional-post-everything",
  "result": "All 5 Patients POSTed unconditionally. Receiver creates 5 new Patient records.",
  "issue": "If receiver already had any of these patients (likely — they're PCP referrals), receiver now has duplicates. Future queries return multiple Patients per real person."
}`;
        }
        return `<pre class="code-block">${UI.highlightJson(outcome)}</pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — Conditional create strategy for P001/P005</h3>
        <div class="task-prompt">
          The producer-side data shows P001 and P005 as separate patients in the source EHR. The submission is going to PCP receivers. How does the producer handle the conditional create for these two specifically?
        </div>
        <div class="choice-list" id="sp10-choices">
          ${[
            { v: "distinct-conditional-create", t: "<strong>Submit each distinctly with its own MRN-scoped <code>ifNoneExist</code></strong>. Receiver gets two Patient entries; if either MRN already exists at the receiver, conditional skips creation. Stewardship handles ambiguity downstream." },
            { v: "hold-p005-for-review",        t: "<strong>Hold P005 pending producer-side review</strong>. Submit P001 + her resources only. P005's data stays in the producer's queue until review confirms she's distinct from P001." },
            { v: "multi-value-ifNoneExist",     t: "<strong>Multi-value <code>ifNoneExist</code></strong> — P005's entry uses <code>ifNoneExist=identifier=...|CRH-10001,...|CRH-10005</code> so if P001 already exists at receiver, P005's entry resolves to her." },
            { v: "unconditional-post-everything", t: "<strong>Unconditional POST</strong> on all Patients. Receiver creates new records for all 5. Don't worry about duplicates." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleSP10Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="sp10-feedback"></div>
        <div id="hint-area"></div>
      `,
      hint: "Two of these are obviously bad: unconditional-POST creates duplicates at receivers who already have the patients; multi-value-ifNoneExist could silently misroute P005's clinical data to P001's chart. Hold-p005 sounds safe but breaks P005's care continuity if she's a distinct real person. The remaining option submits both distinctly and lets the stewardship process (consumer-side reconciliation) handle ambiguity — which is exactly what that process exists for.",
      reveal: () => {
        State.setDecision("produce", 10, "sp10_choice", "distinct-conditional-create");
      },
      validate: () => {
        if (!State.getDecision("produce", 10, "sp10_choice")) return { ok: false, message: "Pick a conditional-create strategy first." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "produce", stationNum: 10, decisionKey: "sp10_choice",
        choicesRootId: "sp10-choices", feedbackId: "sp10-feedback",
        correctValue: "distinct-conditional-create",
        correctHtml: "Correct. The producer's job is to submit what the source data says. Resolving identity ambiguity is stewardship work — and the consumer-side reconciliation process from Station 9 (queue-with-distinct-load) is precisely the mechanism designed to handle it. Producer-side cleverness (multi-value <code>ifNoneExist</code>, holding records, unconditional POST) creates worse problems than it solves.",
        incorrectHtml: "Three options have specific failure modes: unconditional-POST creates receiver-side duplicates; multi-value-ifNoneExist can misroute clinical data; hold-p005 breaks care continuity. The right answer trusts the stewardship process to handle ambiguity downstream. Try again or reveal."
      });
    }
  },
  /* ============================================================
     STATION 11 — POST & OperationOutcome (Terminal)
     ============================================================ */
  {
    number: 11,
    title: "POST & OperationOutcome",
    lecture: () => `
      <p>Station 11 is the Produce <strong>terminal</strong>. The 5 per-patient transaction Bundles from Station 9 (with conditional creates from Station 10) are queued. We POST them to the receivers and interpret the responses.</p>

      ${UI.collapsible("What the POST returns on success", `
      <p>For each transaction Bundle, the receiver returns a Bundle of type <code>transaction-response</code>. Each <code>entry</code> in the response corresponds to an entry in the request, in order, with:</p>
      <ul>
        <li><strong>response.status</strong> — HTTP status of that entry (<code>"201 Created"</code>, <code>"200 OK"</code> for updates, <code>"412 Precondition Failed"</code>, etc.)</li>
        <li><strong>response.location</strong> — the new server-assigned URL, e.g. <code>"Patient/abc123def/_history/1"</code></li>
        <li><strong>response.etag</strong> — version reference for future updates</li>
        <li><strong>response.lastModified</strong> — when the receiver wrote the resource</li>
        <li><strong>resource</strong> (sometimes) — the fully-resolved resource as the receiver stored it</li>
      </ul>
      `)}
      ${UI.collapsible("What the POST returns on failure", `
      <p>An <code>OperationOutcome</code> resource. This is FHIR's structured error format. Each <code>issue</code> entry has:</p>
      <ul>
        <li><strong>severity</strong> — fatal / error / warning / information</li>
        <li><strong>code</strong> — a coded reason (<code>invalid</code>, <code>structure</code>, <code>required</code>, <code>value</code>, <code>conflict</code>, <code>processing</code>, etc.)</li>
        <li><strong>diagnostics</strong> — human-readable description</li>
        <li><strong>location</strong> / <strong>expression</strong> — FHIRPath pointer to the offending element</li>
      </ul>
      `)}
      ${UI.collapsible("Atomic transaction failure mode", `
      <p>Per FHIR spec, a transaction Bundle is all-or-nothing. If <em>any</em> entry fails, the receiver returns an OperationOutcome (often with multiple <code>issue</code> entries describing each failure) and <em>nothing</em> is created. The producer's job is to read the OperationOutcome, attribute the issues back to specific Bundle entries, and decide what to do.</p>
      `)}
      ${UI.collapsible("The Cascade post-discharge submission outcome", `
      <p>Five transaction Bundles, sent to four different PCP receivers (P001 and P003 share a PCP). Three outcomes:</p>
      <ul>
        <li><strong>4 Bundles succeed cleanly</strong> — server-assigned IDs returned; warehouse-bound provenance updated</li>
        <li><strong>P002's Bundle fails</strong> — receiver returns an OperationOutcome with one <code>error</code>-severity issue: the receiver's policy requires Practitioner resources to carry a state-medical-license identifier in addition to NPI, and Dr. Adler's resource lacks one</li>
      </ul>
      `)}
      ${UI.collapsible("Decision: what to do about P002's failure", `
      <p>The producer didn't know about the receiver's site-local Practitioner policy. The OperationOutcome tells us what's missing. Options to consider:</p>
      <ul>
        <li><strong>Patch and resubmit</strong> — add the missing license identifier (we have it in our HR records) and resubmit P002's Bundle</li>
        <li><strong>Skip Practitioner, resubmit</strong> — drop the Practitioner from the Bundle (use a logical reference by NPI instead), let the receiver resolve from their own directory</li>
        <li><strong>Surface to operator</strong> — quarantine P002's Bundle, alert that this receiver has a policy we didn't anticipate, get human guidance before retrying</li>
        <li><strong>Retry as-is</strong> — assume it was a transient failure</li>
      </ul>
      `)}
      ${UI.xref("produce", "consume", 6, "On the consuming side, Profile Validation handled missing-extension failures with the same per-resource-quarantine pattern this terminal station uses for receiver-side rejections. The shape is identical: route the failure where humans can act on it; don't auto-fix unilaterally; don't retry without diagnosis.")}

      ${UI.xref("produce", "consume", 11, "On the consuming side, the warehouse terminal's continuous-trend monitoring is the producing side's mirror — over time, what fraction of submissions succeed first-try? Which receivers reject most often? Which OperationOutcome codes recur? The producer's operational health is also a longitudinal signal.")}
    `,
    beforeAfter: {
      before: () => `<pre class="code-block"><span class="pc-comment"># 5 transaction Bundles queued for POST</span>
P001 → PCP "PineCrest Family Medicine"   → Bundle (6 entries, conditional create on Patient + Practitioner)
P002 → PCP "Lakeside Internal Medicine"  → Bundle (7 entries)
P003 → PCP "PineCrest Family Medicine"   → Bundle (6 entries)
P004 → PCP "Sunrise Pediatrics"          → Bundle (4 entries)
P005 → PCP "Bay Family Health"           → Bundle (4 entries)

POST https://&lt;receiver-fhir-base&gt;/
Content-Type: application/fhir+json
Authorization: Bearer &lt;token&gt;</pre>`,
      after: () => {
        const submitted = State.getDecision("produce", 11, "submitted");
        if (!submitted) return `<div class="empty-state">Click "Submit transaction Bundles" to POST and see the responses.</div>`;
        const showFailure = State.getDecision("produce", 11, "show_failure_path");
        if (!showFailure) {
          // Success path — 4 successful response Bundles
          return `<pre class="code-block">${UI.highlightJson(`{
  "P001 (PineCrest)":   { "status": "200 OK", "type": "transaction-response", "entries": 6, "all_201_created": true },
  "P002 (Lakeside)":    { "status": "412 Precondition Failed", "type": "OperationOutcome", "see_below": "Click 'Show OperationOutcome' to inspect" },
  "P003 (PineCrest)":   { "status": "200 OK", "type": "transaction-response", "entries": 6, "all_201_created": true },
  "P004 (Sunrise)":     { "status": "200 OK", "type": "transaction-response", "entries": 4, "all_201_created": true },
  "P005 (Bay Family)":  { "status": "200 OK", "type": "transaction-response", "entries": 4, "all_201_created": true }
}`)}
<div style="margin-top: 12px;">
  <button class="btn ghost" onclick="showS11Failure()">▶ Show P002's OperationOutcome</button>
</div>`;
        }
        // Failure path detail
        const decision = State.getDecision("produce", 11, "sp11_choice");
        let outcomeBlock = "";
        if (decision) {
          if (decision === "patch-resubmit") {
            outcomeBlock = `,
  "actionTaken": {
    "policy": "patch-resubmit",
    "added": "Practitioner.identifier with system='http://hl7.org/fhir/sid/us-ml' value='WA-MD-12345'",
    "result": "Resubmitted; received 200 OK; all 7 entries created"
  }`;
          } else if (decision === "skip-practitioner") {
            outcomeBlock = `,
  "actionTaken": {
    "policy": "skip-practitioner",
    "modified": "Replaced contained Practitioner with logical reference by NPI",
    "result": "Resubmitted; receiver could not resolve NPI in their directory; FAILED again"
  }`;
          } else if (decision === "surface-to-operator") {
            outcomeBlock = `,
  "actionTaken": {
    "policy": "surface-to-operator",
    "result": "P002 Bundle held in submission_review_queue with full OperationOutcome attached",
    "next": "Operator confirms whether the missing license identifier is available in HR records; updates Practitioner construction code path; retries on next batch"
  }`;
          } else {
            outcomeBlock = `,
  "actionTaken": {
    "policy": "retry-as-is",
    "result": "Same OperationOutcome returned. No progress. Retry loop ineffective."
  }`;
          }
        }
        return `<pre class="code-block">${UI.highlightJson(`{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "error",
    "code": "required",
    "diagnostics": "Practitioner resource is missing required identifier (system='http://hl7.org/fhir/sid/us-ml'). Lakeside Internal Medicine policy requires state medical license identifier on all Practitioner submissions in addition to NPI.",
    "expression": ["Bundle.entry[1].resource.identifier"],
    "details": {
      "coding": [{
        "system": "http://terminology.hl7.org/CodeSystem/operation-outcome",
        "code": "MSG_RESOURCE_REQUIRED",
        "display": "Required resource identifier missing"
      }]
    }
  }]
}${outcomeBlock}`)}`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — How to handle P002's OperationOutcome</h3>
        <div class="task-prompt">
          Lakeside Internal Medicine rejected P002's Bundle because Dr. Adler's Practitioner is missing a state medical license identifier they require. Other 4 PCPs accepted their submissions cleanly. What does the producer do?
        </div>
        <div class="choice-list" id="sp11-choices">
          ${[
            { v: "patch-resubmit",      t: "<strong>Patch and resubmit</strong> — add the missing license identifier from HR records and immediately resubmit P002's Bundle." },
            { v: "skip-practitioner",   t: "<strong>Skip the Practitioner entry, resubmit</strong> — replace the contained Practitioner with a logical reference by NPI; let Lakeside resolve from their own directory." },
            { v: "surface-to-operator", t: "<strong>Surface to operator</strong> — hold P002's Bundle in a submission-review queue with full OperationOutcome attached; alert that Lakeside has a site-local Practitioner policy we didn't anticipate; get human guidance and update the producer's Practitioner construction." },
            { v: "retry-as-is",         t: "<strong>Retry as-is</strong> — assume transient failure; resubmit unchanged." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleSP11Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="sp11-feedback"></div>
        <div id="hint-area"></div>
        <div style="margin-top: 14px;">
          <button class="btn journey-primary" onclick="runSP11Submit()">
            ${State.getDecision("produce", 11, "submitted") ? "✓ Bundles submitted" : "▶ Submit transaction Bundles"}
          </button>
        </div>
      `,
      hint: "Retry-as-is is obviously wrong (same input, same output). Patch-resubmit assumes we have the data and have safely concluded that adding it is correct — both untested assumptions. Skip-practitioner assumes Lakeside can resolve by NPI from their own directory — also untested. Only one option treats the underlying issue as 'we don't know enough to make this call' and routes appropriately. The same pattern as Stations 7 and 8 on the producer side, applied at the receiver-rejection gate.",
      reveal: () => {
        State.setDecision("produce", 11, "sp11_choice", "surface-to-operator");
      },
      validate: () => {
        if (!State.getDecision("produce", 11, "sp11_choice")) return { ok: false, message: "Pick a response policy first." };
        if (!State.getDecision("produce", 11, "submitted")) return { ok: false, message: "Submit the Bundles before completing the journey." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "produce", stationNum: 11, decisionKey: "sp11_choice",
        choicesRootId: "sp11-choices", feedbackId: "sp11-feedback",
        correctValue: "surface-to-operator",
        correctHtml: "Correct. The OperationOutcome tells us what's wrong, not what's right. Patching assumes we have data we may not, in a shape that may not satisfy the receiver. Skipping assumes the receiver can resolve by NPI alone. The right move is to route the failure to operators who can verify, update producer construction code, and prevent the same failure on the next batch. The pattern is consistent with Stations 7 and 8: don't auto-fix unilaterally; surface what's actionable.",
        incorrectHtml: "Same pattern as the prior validation gates. Auto-fixing on a guess is a recipe for compounding problems. Surface, don't speculate. Try again or reveal."
      });
    }
  }
];

function scaffoldProduceStation(number, title, overview) {
  return {
    number,
    title,
    lecture: () => `
      <p><strong>Station ${number} — ${title}.</strong></p>
      <p>${overview}</p>
      <div class="hint-box small">
        <strong>Phase 1 scaffold.</strong> Full lecture, before/after payloads, and decision task reserved for Phase 2 authoring. Framework wiring is in place — Phase 2 fills the <code>lecture()</code>, <code>beforeAfter</code>, and <code>task</code> fields in <code>js/produce-stations.js</code>.
      </div>
    `,
    task: {
      render: () => `
        <h3>Station ${number} placeholder task</h3>
        <div class="task-prompt">
          Authoring in progress. Click "Complete station" to advance through the journey skeleton.
        </div>
      `,
      validate: () => ({ ok: true })
    }
  };
}

/* ===== Station handlers ===== */
window.handleSP1Choice = function(v) {
  State.setDecision("produce", 1, "sp1_choice", v);
  const cards = document.querySelectorAll("#sp1-choices .choice-card");
  cards.forEach(c => c.classList.remove("selected","correct","incorrect"));
  const el = document.querySelector(`#sp1-choices [data-v="${v}"]`);
  const correct = v === "flag-and-route";
  el.classList.add(correct ? "correct" : "incorrect");
  const fb = document.getElementById("sp1-feedback");
  if (correct) {
    fb.innerHTML = UI.renderExplanation(
      "Correct. Unknown-at-source is a first-class state, not an error to mask. Parse what you can, flag what you can't, route ambiguity to a review queue. The review step is cheap; producing bad FHIR is expensive to unwind."
    );
  } else {
    fb.innerHTML = `<div class="hint-box">Think about what US Core's must-support means for elements where source data is genuinely unknown. Try again or reveal.</div>`;
  }
};

window.runSP1Intake = function() {
  State.setDecision("produce", 1, "intake_ok", true);
  Runtime.renderAll({ preserveScroll: true });
};

window.handleSP2Choice = function(v) {
  State.setDecision("produce", 2, "sp2_choice", v);
  State.setDecision("produce", 2, "profile_chosen", v);
  Runtime.renderAll({ preserveScroll: true });
};

/* ===== Station 3 (Produce) handlers ===== */
window.handleSP3Choice = function(v) {
  State.setDecision("produce", 3, "sp3_choice", v);
  Runtime.renderAll({ preserveScroll: true });
};

window.runSP3Build = function() {
  if (!State.getDecision("produce", 3, "sp3_choice")) {
    alert("Pick a declined-race strategy first.");
    return;
  }
  State.setDecision("produce", 3, "resource_built", true);
  Runtime.renderAll({ preserveScroll: true });
};

/* ===== Station 4 (Produce) handlers ===== */
window.handleSP4Choice = function(v) {
  State.setDecision("produce", 4, "sp4_choice", v);
  Runtime.renderAll({ preserveScroll: true });
};

/* ===== Station 5 (Produce) handlers ===== */
window.handleSP5Choice = function(v) {
  State.setDecision("produce", 5, "sp5_choice", v);
  Runtime.renderAll({ preserveScroll: true });
};

/* ===== Station 6 (Produce) handlers ===== */
window.handleSP6Choice = function(v) {
  State.setDecision("produce", 6, "sp6_choice", v);
  Runtime.renderAll({ preserveScroll: true });
};

/* ===== Station 7 (Produce) handlers ===== */
window.handleSP7Choice = function(v) {
  State.setDecision("produce", 7, "sp7_choice", v);
  Runtime.renderAll({ preserveScroll: true });
};

/* ===== Station 8 (Produce) handlers ===== */
window.handleSP8Choice = function(v) {
  State.setDecision("produce", 8, "sp8_choice", v);
  Runtime.renderAll({ preserveScroll: true });
};

/* ===== Station 9 (Produce) handlers ===== */
window.handleSP9Choice = function(v) {
  State.setDecision("produce", 9, "sp9_choice", v);
  Runtime.renderAll({ preserveScroll: true });
};

/* ===== Station 10 (Produce) handlers ===== */
window.handleSP10Choice = function(v) {
  State.setDecision("produce", 10, "sp10_choice", v);
  Runtime.renderAll({ preserveScroll: true });
};

/* ===== Station 11 (Produce) handlers ===== */
window.handleSP11Choice = function(v) {
  State.setDecision("produce", 11, "sp11_choice", v);
  Runtime.renderAll({ preserveScroll: true });
};

window.runSP11Submit = function() {
  if (!State.getDecision("produce", 11, "sp11_choice")) {
    alert("Pick a response policy first.");
    return;
  }
  State.setDecision("produce", 11, "submitted", true);
  Runtime.renderAll({ preserveScroll: true });
};

window.showS11Failure = function() {
  State.setDecision("produce", 11, "show_failure_path", true);
  Runtime.renderAll({ preserveScroll: true });
};

window.PRODUCE_STATIONS = PRODUCE_STATIONS;
