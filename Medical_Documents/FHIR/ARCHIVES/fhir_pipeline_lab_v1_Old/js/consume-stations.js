/* ============================================================
   Consume Journey — Station Definitions
   Station 1: Capability Statement Discovery    [FULLY AUTHORED]
   Station 2: SMART on FHIR Authorization       [FULLY AUTHORED]
   Stations 3–11: Scaffolded with lecture stubs for Phase 2
   ============================================================ */

const CONSUME_STATIONS = [
  /* ============================================================
     STATION 1 — Capability Statement Discovery
     ============================================================ */
  {
    number: 1,
    title: "Capability Statement Discovery",
    lecture: () => `
      <p>Station 1 is <strong>Capability Statement Discovery</strong>. Before a FHIR client can do anything useful with a server, it needs to know what the server supports — which resource types, which search parameters, which operations, which profiles. FHIR formalizes this as the <code>CapabilityStatement</code> resource, exposed at the well-known endpoint <code>/metadata</code>.</p>

      <h4>What you're looking for</h4>
      <ul>
        <li><strong>FHIR version</strong> — confirm R4 (we'll reject anything else for this pipeline)</li>
        <li><strong>Security schemes</strong> — SMART on FHIR? OAuth? Basic auth? We need to know before Station 2</li>
        <li><strong>Supported resources and interactions</strong> — read, search, create, update, vread, history</li>
        <li><strong>Search parameters</strong> — especially chained, <code>_include</code>, and <code>_revinclude</code> support</li>
        <li><strong>Supported profiles</strong> — does the server declare US Core conformance?</li>
        <li><strong>Operations</strong> — <code>$export</code> for Bulk Data, <code>$validate</code> for validation, <code>$everything</code> for patient bundles</li>
      </ul>

      <h4>The Cascade Regional HIE's Capability Statement</h4>
      <p>Cascade Regional HIE exposes a SMART-on-FHIR-secured R4 endpoint at <code>https://fhir.cascade-hie.example/R4/metadata</code>. In Journey 1, we fetch and inspect it.</p>

      <h4>Why this matters more than it looks</h4>
      <p>A surprising number of production pipelines skip capability discovery and hard-code assumptions. They work until the upstream server adds a new version, drops support for an operation, or changes its security model. A pipeline that re-reads the CapabilityStatement periodically and compares it against a pinned expected baseline catches these changes before they break a batch load at 2am.</p>

      ${UI.xref("consume", "produce", 11, "When you were producing, the Produce journey's terminal station had you read the receiver's CapabilityStatement before submitting — for the same reason in reverse.")}
    `,
    beforeAfter: {
      before: () => `<pre class="code-block">GET https://fhir.cascade-hie.example/R4/metadata
Accept: application/fhir+json

<span class="pc-comment"># Response pending — click Run Station below</span></pre>`,
      after: () => {
        const ran = State.getDecision("consume", 1, "metadata_fetched");
        if (!ran) return `<div class="empty-state">Run the metadata fetch to see the response.</div>`;
        return `<pre class="code-block">${UI.highlightJson(`{
  "resourceType": "CapabilityStatement",
  "status": "active",
  "fhirVersion": "4.0.1",
  "format": ["application/fhir+json", "application/fhir+xml"],
  "rest": [{
    "mode": "server",
    "security": {
      "service": [{
        "coding": [{
          "system": "http://hl7.org/fhir/restful-security-service",
          "code": "SMART-on-FHIR"
        }]
      }],
      "extension": [{
        "url": "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris",
        "extension": [
          {"url": "authorize", "valueUri": "https://auth.cascade-hie.example/authorize"},
          {"url": "token", "valueUri": "https://auth.cascade-hie.example/token"}
        ]
      }]
    },
    "resource": [
      {"type": "Patient", "interaction": [{"code":"read"},{"code":"search-type"}],
       "supportedProfile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"]},
      {"type": "Condition", "interaction": [{"code":"search-type"}],
       "supportedProfile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns"]},
      {"type": "MedicationRequest", "interaction": [{"code":"search-type"}]},
      {"type": "Observation", "interaction": [{"code":"search-type"}]}
    ],
    "operation": [
      {"name": "export", "definition": "http://hl7.org/fhir/uv/bulkdata/OperationDefinition/group-export"}
    ]
  }]
}`)}</pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — Server capability check</h3>
        <div class="task-prompt">
          You've fetched the Cascade HIE's CapabilityStatement. Before proceeding to authorization, you need to confirm the server meets this pipeline's minimum requirements. Which of the following is the most important check to perform <em>programmatically</em> before every batch run?
        </div>
        <div class="choice-list" id="s1-choices">
          ${[
            { v: "fhir-version", t: "Verify <code>fhirVersion</code> is exactly <code>4.0.1</code> — the pipeline's code paths assume R4 semantics." },
            { v: "uptime", t: "Check the server's uptime statistics in a status page." },
            { v: "us-core-listed", t: "Confirm <code>supportedProfile</code> lists the US Core profiles we consume." },
            { v: "both-critical", t: "Both the FHIR version AND the declared US Core profile support — fail the run if either is missing." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleS1Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="s1-feedback"></div>
        <div id="hint-area"></div>
        <div style="margin-top: 14px;">
          <button class="btn journey-primary" onclick="runS1Fetch()">
            ${State.getDecision("consume",1,"metadata_fetched") ? "✓ Metadata fetched" : "▶ Run Station — fetch /metadata"}
          </button>
        </div>
      `,
      hint: "A server's version and its profile support can both change silently between releases. A pipeline that validates only one will eventually get surprised. Think about what changed between FHIR R4 (2019) and R4B (2022) in resources like <code>Evidence</code> — version-only checks caught that. Think about what happens when US Core 6.1 adds a new must-support element — profile-only checks caught that. Neither alone is enough.",
      reveal: () => {
        State.setDecision("consume", 1, "s1_choice", "both-critical");
        State.setDecision("consume", 1, "metadata_fetched", true);
        document.getElementById("s1-feedback").innerHTML = UI.renderReveal(
          "The right answer is <strong>both-critical</strong>. FHIR version and US Core profile support are orthogonal failure modes: version drift breaks code assumptions; profile drift breaks data assumptions. A robust pipeline pins both in its expected baseline and fails fast when either diverges."
        ) + UI.renderExplanation(
          "In production, this check is typically a startup gate: the pipeline fetches <code>/metadata</code>, compares <code>fhirVersion</code> and the set of declared <code>supportedProfile</code> URLs against a config file, and refuses to run if either has shifted. The failure message should name <em>what</em> changed, not just that something changed — operators need to decide whether to pin to the old state or update the expected baseline."
        );
      },
      validate: () => {
        const fetched = State.getDecision("consume", 1, "metadata_fetched");
        if (!fetched) return { ok: false, message: "Run the /metadata fetch first (button under the decision)." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "consume", stationNum: 1, decisionKey: "s1_choice",
        choicesRootId: "s1-choices", feedbackId: "s1-feedback",
        correctValue: "both-critical",
        correctHtml: "Correct. FHIR version and US Core profile support are orthogonal failure modes. Robust pipelines pin both and fail fast when either diverges. The failure message should name <em>what</em> changed — operators need enough detail to decide whether to pin to the old baseline or update to the new one.",
        incorrectHtml: "Not quite — think about what happens when the upstream changes in a way only one of your checks catches. Try again or reveal the answer."
      });
    }
  },

  /* ============================================================
     STATION 2 — SMART on FHIR Authorization
     ============================================================ */
  {
    number: 2,
    title: "SMART on FHIR Authorization",
    lecture: () => `
      <p>Station 2 is <strong>Authorization</strong>. The CapabilityStatement from Station 1 told us the Cascade HIE uses SMART on FHIR. Since we're a server-to-server pipeline (no interactive user), we use the <strong>Backend Services</strong> flow — a signed JWT client assertion exchanged for an access token.</p>

      <h4>What distinguishes Backend Services from user-facing SMART flows</h4>
      <ul>
        <li><strong>No browser redirect.</strong> There's no <code>authorize</code> endpoint hop — we go straight to <code>token</code>.</li>
        <li><strong>Pre-registered public key.</strong> We register our JWKS URL (or a public key) with the HIE ahead of time. They use it to verify our JWT.</li>
        <li><strong>System scopes.</strong> We request <code>system/*.rs</code> (read + search) rather than <code>patient/*</code> or <code>user/*</code>.</li>
        <li><strong>Short-lived tokens.</strong> 5–15 minutes typical. The pipeline refreshes before each batch or on 401.</li>
      </ul>

      <h4>Scope syntax</h4>
      <p>SMART v2 scopes have the form <code>context/ResourceType.(c|r|u|d|s)</code> where the letters are create/read/update/delete/search. Wildcards are allowed on both axes.</p>
      <ul>
        <li><code>system/Patient.rs</code> — read and search Patient resources (system-wide)</li>
        <li><code>system/Observation.rs</code> — read and search Observation resources</li>
        <li><code>system/*.rs</code> — read and search everything the server exposes (broad)</li>
      </ul>
      <p>For a US Core warehouse load, the conservative scope list enumerates the USCDI-aligned resources rather than using <code>*</code>. This narrower scope is easier to justify in a security review and easier to spot-check during incident response.</p>

      <h4>What a real production pipeline does</h4>
      <p>Stores the client private key in a secrets vault (never in code). Refreshes tokens ahead of expiry (not on 401 — that wastes a request). Logs scope grants for audit. On a scope denial, fails the run and alerts — scope drift means either the HIE changed its policy or a key rotated.</p>
    `,
    beforeAfter: {
      before: () => `<pre class="code-block">POST https://auth.cascade-hie.example/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&amp;scope=<span class="pc-keyword">{SCOPE_TO_REQUEST}</span>
&amp;client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
&amp;client_assertion=<span class="pc-string">&lt;signed_JWT&gt;</span></pre>`,
      after: () => {
        const scope = State.getDecision("consume", 2, "scope_chosen");
        if (!scope) return `<div class="empty-state">Choose a scope strategy below, then run the token request.</div>`;
        const granted = State.getDecision("consume", 2, "token_granted");
        if (!granted) return `<pre class="code-block"><span class="pc-keyword">Requesting token with scope:</span>
<span class="pc-string">${scope}</span>

<span class="pc-comment"># Click "Request token" to execute</span></pre>`;
        return `<pre class="code-block">${UI.highlightJson(`{
  "access_token": "eyJhbGciOiJSUzI1NiIs...[truncated]...",
  "token_type": "bearer",
  "expires_in": 900,
  "scope": "${scope}"
}`)}
<span style="color:#6aaed6;">// Token valid for 15 minutes. Next refresh at T-2min.</span></pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — Scope strategy</h3>
        <div class="task-prompt">
          The Cascade warehouse load needs access to US Core data classes: Patient, Condition, MedicationRequest, Observation, Immunization, AllergyIntolerance, Procedure, and Encounter. Which scope strategy should the pipeline request?
        </div>
        <div class="choice-list" id="s2-choices">
          ${[
            { v: "wildcard", t: "<code>system/*.rs</code> — simplest; request everything and let the warehouse load filter." },
            { v: "enumerated", t: "Enumerate: <code>system/Patient.rs system/Condition.rs system/MedicationRequest.rs system/Observation.rs system/Immunization.rs system/AllergyIntolerance.rs system/Procedure.rs system/Encounter.rs</code>" },
            { v: "read-only-single", t: "<code>system/*.r</code> — read-only wildcard, no search." },
            { v: "patient-scoped", t: "<code>patient/*.rs</code> — scope to a single patient per token request." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleS2Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="s2-feedback"></div>
        <div id="hint-area"></div>
        <div style="margin-top: 14px;">
          <button class="btn journey-primary"
                  ${State.getDecision("consume",2,"scope_chosen") ? "" : "disabled"}
                  onclick="runS2Token()">
            ${State.getDecision("consume",2,"token_granted") ? "✓ Token received" : "▶ Request token"}
          </button>
        </div>
      `,
      hint: "Think about what happens during a security review six months from now. Someone will ask: 'Why does this pipeline have access to X?' The scope grant in the audit log is the answer. Broad answers feel fine in the moment; narrow answers hold up under scrutiny. Also — <code>patient/*</code> scopes bind to a single patient per token, which is wrong for a population load.",
      reveal: () => {
        State.setDecision("consume", 2, "scope_chosen", "system/Patient.rs system/Condition.rs system/MedicationRequest.rs system/Observation.rs system/Immunization.rs system/AllergyIntolerance.rs system/Procedure.rs system/Encounter.rs");
        document.getElementById("s2-feedback").innerHTML = UI.renderReveal(
          "The right answer is <strong>enumerated</strong>. Narrow scopes are easier to justify, easier to spot-check, and fail more safely when the HIE adds new resource types you didn't know about."
        ) + UI.renderExplanation(
          "<code>system/*.rs</code> is tempting because it 'just works,' but it fails two tests: (1) security reviews ask 'why?' and 'everything' is a bad answer; (2) when the HIE adds a new resource type (say, <code>Coverage</code>), a wildcard scope silently grants access, while an enumerated scope forces the pipeline team to make a conscious decision. <code>patient/*.rs</code> is the wrong shape — those scopes bind to a single patient context, not a population. <code>system/*.r</code> (no search) would leave the pipeline unable to query, since search is how we discover resources without knowing their IDs upfront."
        );
      },
      validate: () => {
        if (!State.getDecision("consume", 2, "scope_chosen")) return { ok: false, message: "Pick a scope strategy first." };
        if (!State.getDecision("consume", 2, "token_granted")) return { ok: false, message: "Request the token before advancing." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "consume", stationNum: 2, decisionKey: "s2_choice",
        choicesRootId: "s2-choices", feedbackId: "s2-feedback",
        correctValue: "enumerated",
        correctHtml: "Correct. Narrow scopes are easier to justify in security reviews and fail more safely when the upstream adds new resource types. The narrower scope is also easier to spot-check during incident response — a reviewer can read the scope list and immediately understand what the pipeline can and can't access.",
        incorrectHtml: "Consider: a security reviewer six months from now will ask 'why does this pipeline have access to X?' Some of these choices have better answers than others. Try again or reveal the answer."
      });
    }
  },

  /* ============================================================
     STATIONS 3–11 — Scaffolded for Phase 2 authoring
     Each station definition preserves the full structure so Phase 2
     can fill lectures, before/after, and tasks without reshaping.
     ============================================================ */
  /* ============================================================
     STATION 3 — Search & Bundle Retrieval
     ============================================================ */
  {
    number: 3,
    title: "Search & Bundle Retrieval",
    lecture: () => `
      <p>Station 3 is <strong>Search &amp; Bundle Retrieval</strong>. Now that we have a token (Station 2) and know the server's capabilities (Station 1), we ask the Cascade HIE for the cohort. FHIR search returns a <code>Bundle</code> of type <code>searchset</code> — the entries are the matching resources, plus metadata about how many matched total and how to page through them.</p>

      <h4>FHIR search in one paragraph</h4>
      <p>Search is a GET on the resource type URL with query parameters: <code>GET [base]/Patient?identifier=http://hospital.cascade.example/mrn|CRH-10001</code>. Parameters are type-specific (the Patient resource exposes <code>identifier</code>, <code>name</code>, <code>birthdate</code>, etc.; Condition exposes <code>subject</code>, <code>clinical-status</code>, <code>onset-date</code>). The CapabilityStatement from Station 1 told us which search parameters this server supports.</p>

      <h4>Three ways to pull a 5-patient cohort</h4>
      <ul>
        <li><strong>Five separate searches</strong> — one per MRN. Works, but chatty: 5 HTTP requests, 5 round trips, 5 server-side query plans. Scales badly to 500 or 5,000 patients.</li>
        <li><strong>One search with <code>identifier</code> repeated</strong> — <code>GET Patient?identifier=...|CRH-10001,...|CRH-10002,...</code> (comma-separated OR). Collapses to one request. Most servers support this per FHIR spec.</li>
        <li><strong>Group-based fetch</strong> — if the Cascade HIE publishes a <code>Group</code> resource for the cohort, we can <code>GET Group/&lt;id&gt;/$everything</code> or use Bulk Data's <code>$export</code> on that Group (covered in Station 4).</li>
      </ul>

      <h4>Pagination — the part that trips up new pipelines</h4>
      <p>Search responses are paged. The Bundle carries a <code>link</code> array with relations <code>self</code>, <code>next</code>, <code>previous</code>, <code>first</code>. A pipeline that reads the first page and stops has a silent bug: it processes 20 of 500 matching resources and nobody notices until a clinical analyst questions the numbers. <strong>Always follow <code>next</code> until it's absent.</strong></p>

      <h4>What comes back</h4>
      <p>A <code>searchset</code> Bundle is not the same shape as a <code>collection</code> or <code>transaction</code> Bundle. Its <code>entry[].search.mode</code> tells you whether each entry is a <code>match</code> (hit) or an <code>include</code> (pulled in by <code>_include</code>). A pipeline that treats every entry as a match will conflate patients with their included practitioners, organizations, and locations.</p>

      ${UI.xref("consume", "produce", 9, "On the producing side, Bundle Assembly is the mirror image: you're choosing between transaction and batch Bundle types, populating <code>entry[].fullUrl</code> with <code>urn:uuid:</code> identifiers, and deciding what the receiver's search will find. Notice how <code>searchset</code> (what we receive here) and <code>transaction</code> (what we submit there) look structurally similar but carry opposite semantics.")}
    `,
    beforeAfter: {
      before: () => `<pre class="code-block">GET https://fhir.cascade-hie.example/R4/Patient?identifier=http://hospital.cascade.example/mrn|CRH-10001,http://hospital.cascade.example/mrn|CRH-10002,http://hospital.cascade.example/mrn|CRH-10003,http://hospital.cascade.example/mrn|CRH-10004,http://hospital.cascade.example/mrn|CRH-10005
Authorization: Bearer eyJhbGci...
Accept: application/fhir+json</pre>`,
      after: () => {
        const fetched = State.getDecision("consume", 3, "search_done");
        if (!fetched) return `<div class="empty-state">Execute the search to see the returned Bundle.</div>`;
        return `<pre class="code-block">${UI.highlightJson(`{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 5,
  "link": [
    {"relation": "self", "url": "https://fhir.cascade-hie.example/R4/Patient?..."}
  ],
  "entry": [
    {
      "fullUrl": "https://fhir.cascade-hie.example/R4/Patient/p001",
      "search": {"mode": "match"},
      "resource": {"resourceType": "Patient", "id": "p001", "identifier": [{"value": "CRH-10001"}], "name": [{"family": "Gonzalez"}], "...": "..."}
    },
    {"fullUrl": "...Patient/p002", "search": {"mode": "match"}, "resource": {"...": "Robert Kowalski"}},
    {"fullUrl": "...Patient/p003", "search": {"mode": "match"}, "resource": {"...": "Jamal Washington"}},
    {"fullUrl": "...Patient/p004", "search": {"mode": "match"}, "resource": {"...": "Emily Chen"}},
    {"fullUrl": "...Patient/p005", "search": {"mode": "match"}, "resource": {"...": "Maria Gonzales"}}
  ]
}`)}</pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — Cohort retrieval strategy</h3>
        <div class="task-prompt">
          You have the 5 Cascade MRNs and need to pull each patient's Patient, Conditions, Medications, and Observations. Which approach should the pipeline use?
        </div>
        <div class="choice-list" id="s3-choices">
          ${[
            { v: "per-patient-serial",  t: "Five <code>Patient/id</code> reads, then for each patient five searches (Condition, MedicationRequest, Observation, Immunization, AllergyIntolerance). Simple, predictable." },
            { v: "identifier-or",       t: "One search per resource type using <code>identifier=...|CRH-10001,...|CRH-10002,...</code>. Five round trips total instead of thirty. Follow <code>next</code> links on each." },
            { v: "include-chain",       t: "One <code>Patient?identifier=...</code> search with <code>_revinclude=Condition:subject&amp;_revinclude=MedicationRequest:subject&amp;_revinclude=Observation:subject</code>. One request returns everything." },
            { v: "ignore-pagination",   t: "Use <code>identifier</code> multi-value search, take the first page of each response, skip pagination — 5 patients is small enough not to matter." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleS3Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="s3-feedback"></div>
        <div id="hint-area"></div>
        <div style="margin-top: 14px;">
          <button class="btn journey-primary"
                  ${State.getDecision("consume", 3, "s3_choice") ? "" : "disabled"}
                  onclick="runS3Search()">
            ${State.getDecision("consume", 3, "search_done") ? "✓ Search executed" : "▶ Execute search"}
          </button>
        </div>
      `,
      hint: "Think about three dimensions: network round-trips, server query cost, and what happens when the cohort grows from 5 to 5,000. Also think about <code>search.mode</code> on the returned entries — a response with <code>_revinclude</code> mixes <code>match</code> and <code>include</code> entries, which the pipeline has to separate. The 'simplest' answer isn't always the fewest requests.",
      reveal: () => {
        State.setDecision("consume", 3, "s3_choice", "identifier-or");
        State.setDecision("consume", 3, "search_done", true);
        document.getElementById("s3-feedback").innerHTML = UI.renderReveal(
          "The right answer is <strong>identifier-or</strong>. One search per resource type with multi-value <code>identifier</code> — five round trips total, pagination followed, each response cleanly scoped to one resource type."
        ) + UI.renderExplanation(
          "<strong>per-patient-serial</strong> is correct but wasteful — 30 requests for 5 patients becomes 30,000 for 5,000, and most servers rate-limit long before that. <strong>include-chain</strong> with <code>_revinclude</code> looks elegant but has real problems: responses mix <code>match</code> and <code>include</code> entries that your code has to demux, most servers cap <code>_revinclude</code> expansion at a few hundred rows per page (silently truncating for a large cohort), and pagination of a mixed Bundle is ambiguous in edge cases. <strong>ignore-pagination</strong> is the trap that catches new pipelines — default page size varies by server (often 10, sometimes 50), and a cohort of '5 patients' might have hundreds of Observations spread across pages. The <code>identifier-or</code> approach is the boring, correct answer: one search per resource type, follow <code>next</code> until absent, assemble into a working collection in memory."
        );
      },
      validate: () => {
        if (!State.getDecision("consume", 3, "s3_choice")) return { ok: false, message: "Pick a retrieval strategy first." };
        if (!State.getDecision("consume", 3, "search_done")) return { ok: false, message: "Execute the search before advancing." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "consume", stationNum: 3, decisionKey: "s3_choice",
        choicesRootId: "s3-choices", feedbackId: "s3-feedback",
        correctValue: "identifier-or",
        correctHtml: "Correct. One search per resource type with multi-value <code>identifier</code>, pagination followed, clean <code>match</code>-only entries. Scales linearly with cohort size and keeps each response shape predictable.",
        incorrectHtml: "Not quite — consider how each approach scales from 5 patients to 5,000, and what happens to pagination and <code>search.mode</code> demuxing on the returned Bundle. Try again or reveal."
      });
    }
  },

  /* ============================================================
     STATION 4 — Bulk Data Export ($export)
     ============================================================ */
  {
    number: 4,
    title: "Bulk Data Export ($export)",
    lecture: () => `
      <p>Station 4 is <strong>Bulk Data Export</strong>. Search works well for small, targeted pulls. For population-scale extraction — nightly warehouse loads, quality measure cohorts, research extracts — the FHIR Bulk Data Access IG defines an async operation called <code>$export</code> that returns NDJSON files instead of inline Bundles.</p>

      <h4>The kickoff / poll / download dance</h4>
      <ol>
        <li><strong>Kickoff</strong> — <code>GET [base]/Group/&lt;cohort-id&gt;/$export</code> with header <code>Prefer: respond-async</code>. The server returns <code>202 Accepted</code> and a <code>Content-Location</code> header pointing to a status URL.</li>
        <li><strong>Poll</strong> — the client GETs the status URL at intervals. Response is <code>202</code> while the export is running (often with <code>X-Progress</code> and <code>Retry-After</code> headers hinting at timing), then <code>200</code> with a manifest JSON when complete.</li>
        <li><strong>Download</strong> — the manifest lists NDJSON file URLs, one per resource type. The client fetches each file, streaming line-by-line.</li>
      </ol>

      <h4>Group-scoped vs. system-wide</h4>
      <p>The three <code>$export</code> variants are <code>[base]/$export</code> (everything — almost always too broad), <code>[base]/Patient/$export</code> (all patients the caller can see), and <code>[base]/Group/&lt;id&gt;/$export</code> (a pre-defined cohort Group). Group-scoped is the minimum-necessary option: the Cascade HIE publishes a Group resource for our known cohort, and we export against that ID. This creates an audit trail anchored to an identifiable cohort definition.</p>

      <h4>Why not just use search everywhere?</h4>
      <p>Search is synchronous and paged — each request holds a server connection open until it returns. For 50,000 patients, that's tens of thousands of requests with latency adding up. <code>$export</code> is a single async job that the server can execute in the background, optimize with its own batch query plans, and deliver as streamable files. The pipeline reads one NDJSON line at a time and never holds more than one resource in memory.</p>

      <h4>Polling discipline</h4>
      <p>Clients that poll too aggressively get rate-limited; clients that poll too slowly burn wall-clock time. The server sends <code>Retry-After</code> (in seconds) — honor it. If absent, a reasonable default is exponential backoff starting at 30s and capping at 5 minutes. For overnight jobs, coarser intervals are fine.</p>

      <h4>The Cascade cohort on $export</h4>
      <p>For 5 patients, <code>$export</code> is overkill — search is faster and simpler. We walk through it here because the decision of <em>when</em> to reach for <code>$export</code> is itself the lesson. Production pipelines typically use search for delta loads (new/changed in the last hour) and <code>$export</code> for full refreshes.</p>
    `,
    beforeAfter: {
      before: () => `<pre class="code-block"><span class="pc-comment"># Step 1 — kickoff</span>
GET https://fhir.cascade-hie.example/R4/Group/cascade-cohort-2026/$export?_type=Patient,Condition,MedicationRequest,Observation,Immunization
Authorization: Bearer eyJhbGci...
Prefer: respond-async
Accept: application/fhir+json

<span class="pc-comment"># Expected: 202 Accepted, Content-Location: https://fhir.cascade-hie.example/status/abc-123</span></pre>`,
      after: () => {
        const stage = State.getDecision("consume", 4, "export_stage") || "idle";
        if (stage === "idle") return `<div class="empty-state">Click "Kickoff export" to start the async job.</div>`;
        if (stage === "polling") return `<pre class="code-block"><span class="pc-comment"># Polling status URL...</span>
GET https://fhir.cascade-hie.example/status/abc-123

HTTP/1.1 202 Accepted
X-Progress: "building Patient file (3/5 resource types complete)"
Retry-After: 30

<span class="pc-comment"># Polling again in 30s...</span></pre>`;
        // complete
        return `<pre class="code-block">${UI.highlightJson(`{
  "transactionTime": "2026-04-14T09:22:17Z",
  "request": "https://fhir.cascade-hie.example/R4/Group/cascade-cohort-2026/$export",
  "requiresAccessToken": true,
  "output": [
    {"type": "Patient",           "url": "https://bulk.cascade-hie.example/out/Patient-abc123.ndjson",           "count": 5},
    {"type": "Condition",         "url": "https://bulk.cascade-hie.example/out/Condition-abc123.ndjson",         "count": 11},
    {"type": "MedicationRequest", "url": "https://bulk.cascade-hie.example/out/MedicationRequest-abc123.ndjson", "count": 7},
    {"type": "Observation",       "url": "https://bulk.cascade-hie.example/out/Observation-abc123.ndjson",       "count": 142},
    {"type": "Immunization",      "url": "https://bulk.cascade-hie.example/out/Immunization-abc123.ndjson",      "count": 18}
  ],
  "error": []
}`)}</pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — Polling strategy</h3>
        <div class="task-prompt">
          The pipeline kicked off an <code>$export</code> and got back a status URL. The server's first poll response returned <code>202 Accepted</code> with <code>Retry-After: 30</code>. What polling behavior should the client use?
        </div>
        <div class="choice-list" id="s4-choices">
          ${[
            { v: "tight-loop",   t: "Poll every 1 second. Fastest completion detection." },
            { v: "respect-retry", t: "Poll after the <code>Retry-After</code> value (30s). If no <code>Retry-After</code> on subsequent polls, use exponential backoff starting at 30s and capping at 5 minutes." },
            { v: "fixed-5min",   t: "Poll every 5 minutes regardless of <code>Retry-After</code>. Conservative, avoids rate limits." },
            { v: "no-poll-wait", t: "Don't poll — just wait a fixed 30 minutes and then check once." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleS4Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="s4-feedback"></div>
        <div id="hint-area"></div>
        <div style="margin-top: 14px;">
          <button class="btn journey-primary"
                  ${State.getDecision("consume", 4, "s4_choice") ? "" : "disabled"}
                  onclick="runS4Export()">
            ${
              State.getDecision("consume", 4, "export_stage") === "complete"
                ? "✓ Export complete — manifest received"
                : (State.getDecision("consume", 4, "export_stage") === "polling"
                    ? "⏳ Continue polling..."
                    : "▶ Kickoff export")
            }
          </button>
        </div>
      `,
      hint: "<code>Retry-After</code> exists because the server knows something you don't — its current load, the size of the job, and its own rate limits. Clients that ignore it either get throttled (too fast) or waste wall-clock time (too slow). Exponential backoff is the right default for missing headers, because job completion time is unpredictable.",
      reveal: () => {
        State.setDecision("consume", 4, "s4_choice", "respect-retry");
        // Advance through all stages for the reveal path
        State.setDecision("consume", 4, "export_stage", "complete");
        document.getElementById("s4-feedback").innerHTML = UI.renderReveal(
          "The right answer is <strong>respect-retry</strong>. Honor the server's <code>Retry-After</code>; use exponential backoff (30s base, 5m cap) when the header isn't present."
        ) + UI.renderExplanation(
          "Tight-loop polling gets you rate-limited and may make the export take longer (servers deprioritize chatty clients). Fixed 5-minute polling wastes wall-clock time on fast jobs — a 90-second export doesn't need 5 minutes of waiting. No-poll waits are fragile: if the export takes longer than the fixed window, you get <code>202</code> again and have to implement polling anyway; if shorter, you waste time. The <code>Retry-After</code> header is the server telling you exactly how often it wants to be polled — the only right move is to use it."
        );
      },
      validate: () => {
        if (!State.getDecision("consume", 4, "s4_choice")) return { ok: false, message: "Pick a polling strategy first." };
        if (State.getDecision("consume", 4, "export_stage") !== "complete") return { ok: false, message: "Advance the export to completion before moving on." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "consume", stationNum: 4, decisionKey: "s4_choice",
        choicesRootId: "s4-choices", feedbackId: "s4-feedback",
        correctValue: "respect-retry",
        correctHtml: "Correct. <code>Retry-After</code> is the server telling you how often it wants to be polled. Honor it; back off exponentially when it's absent.",
        incorrectHtml: "The server sent <code>Retry-After</code> for a reason. What does ignoring it cost in each direction (too fast, too slow)? Try again or reveal."
      });
    }
  },
  /* ============================================================
     STATION 5 — Reference Resolution
     ============================================================ */
  {
    number: 5,
    title: "Reference Resolution",
    lecture: () => `
      <p>Station 5 is <strong>Reference Resolution</strong>. The Bundles we received from Station 3 (search) and Station 4 (Bulk Data) are graphs, not flat tables. A Condition has a <code>subject</code> reference pointing to a Patient. A MedicationRequest has a <code>requester</code> pointing to a Practitioner. An Observation has both <code>subject</code> and <code>encounter</code>. Before we can flatten these for warehouse load, every reference needs to point at something we have in hand.</p>

      <h4>What "resolving" actually means</h4>
      <p>Resolving a reference means: given <code>Reference.reference = "Patient/p001"</code>, find the actual Patient resource and stitch them together. Three things can happen:</p>
      <ul>
        <li><strong>Hit (in-bundle)</strong> — the referenced Patient is already in our working collection from a prior search. Resolve in-memory.</li>
        <li><strong>Hit (server fetch)</strong> — the Patient isn't in our collection but exists on the server. Fetch it.</li>
        <li><strong>Dangling</strong> — the reference is to a resource that doesn't exist on the server, or is a logical reference (<code>identifier</code>-only) we can't resolve. Quarantine and surface.</li>
      </ul>

      <h4>Two ways to avoid dangling references at the source</h4>
      <p><strong><code>_include</code></strong> — when searching for Conditions, ask the server to include the referenced Patient resources in the same Bundle. <code>GET Condition?subject=Patient/p001&amp;_include=Condition:subject</code> returns Conditions <em>and</em> the Patient, in one response. Entries are tagged <code>search.mode: "match"</code> for the Conditions and <code>search.mode: "include"</code> for the Patient.</p>

      <p><strong><code>_revinclude</code></strong> — the reverse. When searching for Patients, ask the server to also return the resources that reference those patients. <code>GET Patient?identifier=...&amp;_revinclude=Condition:subject&amp;_revinclude=MedicationRequest:subject</code> returns the Patients plus all their Conditions and MedicationRequests.</p>

      <h4>The tradeoff between <code>_include</code> and follow-up fetches</h4>
      <p>Including resources in the original search keeps round-trips down but bloats the response and forces the consumer to demux <code>match</code> vs. <code>include</code> entries. Follow-up fetches keep responses clean but multiply network traffic — a search returning 1,000 Conditions means up to 1,000 follow-up Patient fetches if naively implemented.</p>

      <p>The middle path most production pipelines use: <strong>collect the unique referenced IDs first, then batch-fetch.</strong> 1,000 Conditions referencing 200 unique Patients becomes one search for those 200 Patients (using <code>_id=p001,p002,...</code>), not 1,000 individual reads.</p>

      <h4>Logical references — the trickier case</h4>
      <p>Some references don't have <code>reference</code> at all — they have <code>identifier</code>. <code>{"requester": {"identifier": {"system": "http://hl7.org/fhir/sid/us-npi", "value": "1234567890"}}}</code> says "the requester is the Practitioner with this NPI" but doesn't give us a server URL. To resolve, we search: <code>GET Practitioner?identifier=http://hl7.org/fhir/sid/us-npi|1234567890</code>. If it returns one match, resolved. If zero, dangling. If more than one (rare but possible — multiple servers hosting overlapping Practitioner directories), it's an integrity error worth surfacing.</p>

      ${UI.xref("consume", "produce", 4, "On the producing side, Reference Integrity faced the mirror problem: deciding how to express a reference so the receiver could resolve it. The <code>urn:uuid</code> + <code>ifNoneExist</code> pattern from that station is what producers use specifically to avoid leaving dangling references for consumers like us.")}
    `,
    beforeAfter: {
      before: () => `<pre class="code-block"><span class="pc-comment"># Working collection after Stations 3-4: 5 Patients + 11 Conditions + 7 MedicationRequests + 142 Observations + 18 Immunizations</span>
<span class="pc-comment"># Sample Condition resource:</span>
{
  "resourceType": "Condition",
  "id": "cond-p001-dm",
  "subject":   { "reference": "Patient/p001" },          <span class="pc-comment">// hit in-bundle</span>
  "encounter": { "reference": "Encounter/enc-p001-2026-03" }, <span class="pc-comment">// not in our collection</span>
  "asserter":  { "identifier": { "system": "http://hl7.org/fhir/sid/us-npi", "value": "1234567890" }} <span class="pc-comment">// logical</span>
}

<span class="pc-comment"># Total references to resolve:
#   - Patient: 167 references → 5 unique IDs (all in-bundle)
#   - Encounter: 47 references → 12 unique IDs (NONE in bundle)
#   - Practitioner: 23 references → 4 unique NPIs (logical)</span></pre>`,
      after: () => {
        const strategy = State.getDecision("consume", 5, "s5_choice");
        const resolved = State.getDecision("consume", 5, "resolution_done");
        if (!strategy) return `<div class="empty-state">Pick a resolution strategy below.</div>`;
        if (!resolved) return `<pre class="code-block"><span class="pc-comment"># Strategy chosen: ${strategy}
# Click "Run resolution" to execute</span></pre>`;
        return `<pre class="code-block">${UI.highlightJson(`{
  "resolutionReport": {
    "patientReferences":      { "total": 167, "resolved": 167, "dangling": 0 },
    "encounterReferences":    { "total": 47,  "resolved": 47,  "dangling": 0,
                                "method": "batched _id search (1 round-trip for 12 unique IDs)" },
    "practitionerReferences": { "total": 23,  "resolved": 22,  "dangling": 1,
                                "danglingDetails": [
                                  {"npi": "9999999999", "reason": "no Practitioner found with this identifier"}
                                ]},
    "totalRoundTrips": 2,
    "quarantined":   [ "MedicationRequest/medreq-p005-12 (asserter NPI 9999999999 unresolvable)" ]
  }
}`)}</pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — Resolution strategy for 47 unique Encounter references</h3>
        <div class="task-prompt">
          The cohort's Conditions and Observations reference 47 Encounter resources, but only 12 unique Encounter IDs (multiple resources share the same Encounter). None of those Encounters were returned by our prior searches. How should the pipeline resolve them?
        </div>
        <div class="choice-list" id="s5-choices">
          ${[
            { v: "individual-reads", t: "Issue 47 individual <code>Encounter/&lt;id&gt;</code> reads, one per reference. Simple and obvious." },
            { v: "batch-by-id",      t: "Deduplicate to 12 unique IDs, issue one <code>Encounter?_id=enc1,enc2,...,enc12</code> search. Single round-trip." },
            { v: "rerun-revinclude", t: "Re-run the original Patient search with <code>_revinclude=Encounter:subject</code> added. Pulls everything fresh." },
            { v: "skip-encounters",  t: "Skip Encounter resolution — just keep the reference strings and let the warehouse load handle dangling refs as null." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleS5Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="s5-feedback"></div>
        <div id="hint-area"></div>
        <div style="margin-top: 14px;">
          <button class="btn journey-primary"
                  ${State.getDecision("consume", 5, "s5_choice") ? "" : "disabled"}
                  onclick="runS5Resolve()">
            ${State.getDecision("consume", 5, "resolution_done") ? "✓ References resolved" : "▶ Run resolution"}
          </button>
        </div>
      `,
      hint: "Two dimensions: (1) round-trip cost — 47 reads vs. 12 reads vs. 1 read; (2) what 'resolved' even means in your warehouse downstream — Encounter dimension rows need actual resource data, not reference strings. Strategy 4 sounds like a shortcut but creates a different problem: a fact table with 47 NULL encounter_id values. Strategy 3 is overkill if you've already paginated your way through the original search.",
      reveal: () => {
        State.setDecision("consume", 5, "s5_choice", "batch-by-id");
        State.setDecision("consume", 5, "resolution_done", true);
      },
      validate: () => {
        if (!State.getDecision("consume", 5, "s5_choice")) return { ok: false, message: "Pick a resolution strategy first." };
        if (!State.getDecision("consume", 5, "resolution_done")) return { ok: false, message: "Run reference resolution before advancing." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "consume", stationNum: 5, decisionKey: "s5_choice",
        choicesRootId: "s5-choices", feedbackId: "s5-feedback",
        correctValue: "batch-by-id",
        correctHtml: "Correct. Deduplicate to unique IDs, batch-fetch with <code>_id=...</code>. One round-trip for 12 IDs instead of 47 individual reads. Standard FHIR batch-fetch pattern.",
        incorrectHtml: "Think about round-trip cost AND what the warehouse needs downstream. Individual reads are wasteful; <code>_revinclude</code> re-pulls everything you already have; skipping leaves nulls. There's a middle option that batches on unique IDs. Try again or reveal."
      });
    }
  },
  /* ============================================================
     STATION 6 — Profile Validation
     ============================================================ */
  {
    number: 6,
    title: "Profile Validation",
    lecture: () => `
      <p>Station 6 is <strong>Profile Validation</strong>. We have a graph of resolved resources (S5). Before we let any of it touch our warehouse, we validate each resource against the US Core profile it claims conformance to. This catches malformed data at the boundary, where we can quarantine and respond, rather than at warehouse load time, where errors become operational fires.</p>

      <h4>What a profile validator actually checks</h4>
      <ul>
        <li><strong>Cardinality</strong> — required elements are present, forbidden elements are absent, repeating elements stay within min/max bounds.</li>
        <li><strong>Type conformance</strong> — <code>birthDate</code> is a date, not a string; <code>identifier.system</code> is a URI, not arbitrary text.</li>
        <li><strong>Terminology bindings</strong> — coded values come from the bound ValueSet at the strength specified.</li>
        <li><strong>Profile invariants</strong> — FHIRPath expressions the resource must satisfy (e.g., <code>us-core-patient</code>'s invariant that requires <code>name.given OR name.family</code>).</li>
        <li><strong>Slicing constraints</strong> — when a profile slices a list (e.g., requiring at least one identifier with <code>system = "http://hospital.example/mrn"</code>), the validator confirms slices match.</li>
        <li><strong>Must-support</strong> — interpreted strictly here means: <em>if</em> data is present in our records, the producer was supposed to populate this element. A consumer can flag missing must-support but typically doesn't reject on it alone.</li>
      </ul>

      <h4>The real failure modes — by frequency</h4>
      <p>Across production FHIR ingestion pipelines, validation failures cluster heavily into a few categories:</p>
      <ol>
        <li><strong>Missing required extensions</strong> (most common) — the producer omitted <code>us-core-race</code> or <code>us-core-ethnicity</code>. Often because the producer was conformant to a base FHIR Patient and never updated to US Core.</li>
        <li><strong>Required-binding violations</strong> — gender as "M" instead of "male"; encounter class as "INPATIENT" instead of <code>IMP</code>.</li>
        <li><strong>Identifier system missing</strong> — bare values without <code>system</code>, which makes them ambiguous (whose MRN is <code>10001</code>?).</li>
        <li><strong>Reference dangling</strong> (caught here if S5 missed it) — points at a resource that doesn't exist.</li>
        <li><strong>Invariant failures</strong> — usually downstream of one of the above.</li>
      </ol>

      <h4>The Cascade Cohort's incoming validation report</h4>
      <p>Of 183 resources in our working collection: 178 pass cleanly. 4 have warnings (must-support gaps but valid). 1 fails — <strong>P005's Patient resource</strong> is missing the <code>us-core-race</code> extension entirely. The producer was claiming US Core 6.1.0 conformance but didn't emit the extension.</p>

      <h4>Quarantine vs. best-effort — the policy decision</h4>
      <p>What does the pipeline do with that one failure?</p>
      <ul>
        <li><strong>Strict quarantine</strong> — fail the entire batch. Loud, blocks downstream until resolved. Never silently corrupts the warehouse, but creates operational pressure to resolve quickly.</li>
        <li><strong>Per-resource quarantine</strong> — load the 182 valid resources into the warehouse, route the 1 failing resource to a quarantine table for review. The warehouse gains data steadily; failures get human attention without blocking the rest.</li>
        <li><strong>Best-effort coercion</strong> — synthesize the missing extension with a null-flavor value and load. Warehouse stays full but now contains synthetic data that didn't come from the source.</li>
        <li><strong>Log and continue</strong> — write a warning, load anyway. Warehouse contains an invalid resource that now passes downstream because nothing checks again.</li>
      </ul>

      ${UI.xref("consume", "produce", 8, "On the producing side, Profile Validation Pre-Submit runs the same checks before transmission so the producer never sends invalid resources in the first place. The Cascade producer that emitted P005's broken Patient evidently skipped that station — which is exactly the upstream gap your quarantine policy here exists to catch.")}
    `,
    beforeAfter: {
      before: () => `<pre class="code-block"><span class="pc-comment"># Resources entering validation: 183
# Profile claims:
#   - us-core-patient                          → 5 resources
#   - us-core-condition-problems-health-concerns → 11 resources
#   - us-core-medicationrequest                → 7 resources
#   - us-core-encounter                        → 12 resources
#   - us-core-observation-lab + vital-signs    → 142 resources
#   - us-core-immunization                     → 6 resources</span>

POST $validate?profile=http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient|6.1.0
{
  "resourceType": "Patient",
  "id": "p005",
  "meta": { "profile": ["...us-core-patient|6.1.0"] },
  "identifier": [{"system": "...mrn", "value": "CRH-10005"}],
  "name": [{"family": "Gonzales", "given": ["Maria"]}],
  "gender": "female",
  "birthDate": "1965-04-12"
  <span class="pc-comment">// NO extension array at all</span>
}</pre>`,
      after: () => {
        const policy = State.getDecision("consume", 6, "s6_choice");
        const ran = State.getDecision("consume", 6, "validation_ran");
        if (!policy) return `<div class="empty-state">Pick a quarantine policy.</div>`;
        if (!ran) return `<pre class="code-block"><span class="pc-comment"># Policy chosen: ${policy}
# Click "Run validation" to execute against the 183 resources</span></pre>`;
        let outcome;
        if (policy === "strict-quarantine") {
          outcome = `{
  "batchStatus": "FAILED",
  "loaded": 0,
  "quarantined": 183,
  "reason": "1 resource failed validation; strict policy fails entire batch"
}`;
        } else if (policy === "per-resource-quarantine") {
          outcome = `{
  "batchStatus": "PARTIAL_SUCCESS",
  "loaded": 182,
  "quarantined": 1,
  "quarantineQueue": [
    {"id": "p005", "profile": "us-core-patient|6.1.0",
     "issue": "ERROR: us-core-race extension missing (required)",
     "action": "routed to quarantine_review_queue with batch_id; alerted data-quality channel"}
  ]
}`;
        } else if (policy === "best-effort-coercion") {
          outcome = `{
  "batchStatus": "SUCCESS_WITH_SYNTHESIS",
  "loaded": 183,
  "synthesized": 1,
  "synthesisLog": [
    {"id": "p005", "synthesized": "us-core-race extension with NullFlavor:UNK",
     "warning": "WAREHOUSE NOW CONTAINS SYNTHETIC DEMOGRAPHIC DATA — provenance flag set"}
  ]
}`;
        } else {
          outcome = `{
  "batchStatus": "SUCCESS",
  "loaded": 183,
  "warnings": 1,
  "note": "p005 loaded with invalid profile claim; downstream consumers will not re-validate"
}`;
        }
        return `<pre class="code-block">${UI.highlightJson(outcome)}</pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — Quarantine policy for the failing P005 Patient</h3>
        <div class="task-prompt">
          Of 183 incoming resources, P005's Patient fails US Core validation (missing required <code>us-core-race</code> extension). What should the pipeline do?
        </div>
        <div class="choice-list" id="s6-choices">
          ${[
            { v: "strict-quarantine",         t: "<strong>Strict quarantine</strong> — fail the entire batch. Nothing loads until P005 is fixed upstream." },
            { v: "per-resource-quarantine",   t: "<strong>Per-resource quarantine</strong> — load the 182 valid resources, route P005 to a review queue, alert the data-quality channel." },
            { v: "best-effort-coercion",      t: "<strong>Best-effort coercion</strong> — synthesize a <code>us-core-race</code> with NullFlavor:UNK and load all 183. Warehouse stays full." },
            { v: "log-and-continue",          t: "<strong>Log and continue</strong> — record a warning and load all 183 unchanged. Move on." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleS6Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="s6-feedback"></div>
        <div id="hint-area"></div>
        <div style="margin-top: 14px;">
          <button class="btn journey-primary"
                  ${State.getDecision("consume", 6, "s6_choice") ? "" : "disabled"}
                  onclick="runS6Validate()">
            ${State.getDecision("consume", 6, "validation_ran") ? "✓ Validation executed" : "▶ Run validation"}
          </button>
        </div>
      `,
      hint: "Three filters: (1) does it block legitimate data (the 182 good resources) from reaching the warehouse? (2) does it silently corrupt the warehouse (synthesize, or load invalid)? (3) does it create human visibility into the failure? Two options fail the third filter; one fails the first; one fails the second. One option satisfies all three.",
      reveal: () => {
        State.setDecision("consume", 6, "s6_choice", "per-resource-quarantine");
        State.setDecision("consume", 6, "validation_ran", true);
      },
      validate: () => {
        if (!State.getDecision("consume", 6, "s6_choice")) return { ok: false, message: "Pick a quarantine policy first." };
        if (!State.getDecision("consume", 6, "validation_ran")) return { ok: false, message: "Run validation before advancing." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "consume", stationNum: 6, decisionKey: "s6_choice",
        choicesRootId: "s6-choices", feedbackId: "s6-feedback",
        correctValue: "per-resource-quarantine",
        correctHtml: "Correct. Per-resource quarantine loads the 182 valid resources, routes the 1 failing resource to a review queue, and alerts the data-quality channel. The warehouse stays current with everything that passed; the failure gets visible human attention; nothing is silently corrupted or synthesized.",
        incorrectHtml: "Three filters: don't block good data, don't corrupt the warehouse silently, do create human visibility. Strict quarantine fails the first; coercion and log-and-continue fail the second. One option passes all three. Try again or reveal."
      });
    }
  },
  /* ============================================================
     STATION 7 — Terminology Binding Checks
     ============================================================ */
  {
    number: 7,
    title: "Terminology Binding Checks",
    lecture: () => `
      <p>Station 7 is <strong>Terminology Binding Checks</strong>. Profile validation (S6) caught structural failures. This station catches semantic ones — codes that pass structural type-checks but don't actually come from the ValueSet the profile binds. A <code>"gender": "M"</code> value is a valid string, but if the profile binds gender to <code>AdministrativeGender</code> (which expects <code>"male"</code>), the value is wrong.</p>

      <h4>What <code>$validate-code</code> does</h4>
      <p>The terminology service operation <code>$validate-code</code> takes a coded value and a ValueSet URL, and answers: "is this code in this ValueSet?" Plus context — display text matching, version handling, hierarchical inclusion. The Cascade pipeline calls <code>$validate-code</code> against an authoritative terminology server (NLM's, or a commercial like Ontoserver) for each coded element on every incoming resource.</p>

      <h4>Required vs. extensible — what failure means</h4>
      <ul>
        <li><strong>Required binding fails</strong> → resource is invalid. No ambiguity. Quarantine.</li>
        <li><strong>Extensible binding fails</strong> → the producer used a code from outside the bound ValueSet. This is <em>permitted</em> if no code in the ValueSet semantically applies. The check becomes "is there a code in the ValueSet that would have applied?" — if yes, the producer made a poor choice; if no, the producer was justified.</li>
        <li><strong>Preferred fails</strong> → noted for data-quality reporting; doesn't block load.</li>
        <li><strong>Example fails</strong> → ignored entirely.</li>
      </ul>

      <h4>The Cascade Cohort's incoming binding issues</h4>
      <p>Across the 182 resources that survived S6, the validator finds:</p>
      <ul>
        <li>P002's atrial fibrillation Condition has <code>coding[0]</code> = ICD-9 <code>427.31</code> — outside the extensible US Core ValueSet. But also <code>coding[1]</code> = ICD-10-CM <code>I48.91</code>, which IS in the ValueSet. <strong>Result: passes.</strong> (The cross-reference: this is exactly the producer's dual-code decision from the producer-side Station 5 paying off.)</li>
        <li>P003's MedicationRequest for buprenorphine/naloxone has medication code <code>1250000</code> — claimed as RxNorm but no such RxNorm code exists. <strong>Result: fails extensible binding.</strong> Likely a typo at the source.</li>
        <li>3 Observations have <code>code</code> values from a local lab system, not LOINC. The bound ValueSet is extensible. <code>$translate</code> finds LOINC equivalents for all 3. <strong>Result: passes after translation, with a quality flag noting the original local code.</strong></li>
      </ul>

      <h4>Translate-then-check, or check-then-translate?</h4>
      <p>Two orderings, two failure modes. <strong>Check-then-translate</strong>: validate the incoming code, fail if not in ValueSet, then translate failures via <code>$translate</code> as a recovery step. Clean separation, but generates a lot of "soft failures" that the recovery step then resolves — noisy logs. <strong>Translate-then-check</strong>: pre-translate any code from a known-mapped CodeSystem to the bound CodeSystem, then validate. Quieter, but masks producers who are emitting non-canonical codes (you'd never know unless you log the translations separately).</p>

      <p>Production pipelines usually do check-then-translate, because the data-quality signal of "producer X consistently emits non-canonical codes" is worth the noise. It's information about your upstream that translate-then-check throws away.</p>

      ${UI.xref("consume", "produce", 5, "On the producing side, Terminology Binding decided how to handle the same atrial fibrillation case from the source end. The dual-coding decision (emit both ICD-9 and ICD-10-CM) is what lets the consumer-side check here pass. This is the cross-journey loop: producer decisions propagate forward into consumer outcomes.")}
    `,
    beforeAfter: {
      before: () => `<pre class="code-block"><span class="pc-comment"># Sample: P003 MedicationRequest with bad RxNorm code</span>
{
  "resourceType": "MedicationRequest",
  "id": "medreq-p003-bup",
  "medicationCodeableConcept": {
    "coding": [{
      "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
      "code": "1250000",     <span class="pc-comment">// claimed as RxNorm — does not exist</span>
      "display": "buprenorphine/naloxone 8-2 MG sublingual tablet"
    }]
  },
  "subject": {"reference": "Patient/p003"},
  "status": "active",
  "intent": "order"
}

POST $validate-code
parameters:
  url:    http://hl7.org/fhir/us/core/ValueSet/us-core-medication-codes
  system: http://www.nlm.nih.gov/research/umls/rxnorm
  code:   1250000</pre>`,
      after: () => {
        const ordering = State.getDecision("consume", 7, "s7_choice");
        const ran = State.getDecision("consume", 7, "checks_ran");
        if (!ordering) return `<div class="empty-state">Pick a check ordering strategy.</div>`;
        if (!ran) return `<pre class="code-block"><span class="pc-comment"># Strategy chosen: ${ordering}
# Click "Run binding checks" to execute</span></pre>`;
        let outcome;
        if (ordering === "check-then-translate") {
          outcome = `{
  "checkOrdering": "check-then-translate",
  "summary": {"checked": 182, "passed": 178, "failed": 4, "recovered": 3, "quarantined": 1},
  "qualityReport": {
    "producerCodeQuality": {
      "Cascade Regional HIE": "0.984 pass rate (3 non-canonical lab codes from local system)",
      "alert": "investigate why local lab codes appear in US Core feed"
    },
    "byCase": [
      {"id": "cond-p002-afib",     "result": "PASS (dual-coded)"},
      {"id": "obs-p001-glucose-1", "result": "RECOVERED (local→LOINC via $translate)"},
      {"id": "obs-p001-glucose-2", "result": "RECOVERED (local→LOINC via $translate)"},
      {"id": "obs-p004-bmi",       "result": "RECOVERED (local→LOINC via $translate)"},
      {"id": "medreq-p003-bup",    "result": "QUARANTINED (RxNorm 1250000 does not exist; no translation possible)"}
    ]
  }
}`;
        } else {
          outcome = `{
  "checkOrdering": "translate-then-check",
  "summary": {"checked": 182, "passed": 181, "failed": 1, "quarantined": 1},
  "qualityReport": {
    "producerCodeQuality": "(no signal — translations applied silently before check)",
    "warning": "producer is emitting non-canonical lab codes; this strategy obscures it",
    "byCase": [
      {"id": "cond-p002-afib",     "result": "PASS"},
      {"id": "obs-p001-glucose-1", "result": "PASS (auto-translated, original code lost in main log)"},
      {"id": "obs-p001-glucose-2", "result": "PASS (auto-translated, original code lost in main log)"},
      {"id": "obs-p004-bmi",       "result": "PASS (auto-translated, original code lost in main log)"},
      {"id": "medreq-p003-bup",    "result": "QUARANTINED (no source CodeSystem to translate from; binding fails)"}
    ]
  }
}`;
        }
        return `<pre class="code-block">${UI.highlightJson(outcome)}</pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — Order of binding checks vs. translation</h3>
        <div class="task-prompt">
          The pipeline can either validate codes first and use <code>$translate</code> as recovery, or translate first and then validate. Both produce the same warehouse content for valid cases. They differ in what they tell you about your upstream producers. Which ordering is preferable for production?
        </div>
        <div class="choice-list" id="s7-choices">
          ${[
            { v: "check-then-translate", t: "<strong>Check-then-translate</strong> — validate against the bound ValueSet first; on failure, attempt <code>$translate</code> from a known source CodeSystem; quarantine if translation also fails. Logs producer code-quality signal." },
            { v: "translate-then-check", t: "<strong>Translate-then-check</strong> — pre-translate any code from a known source CodeSystem to the bound CodeSystem before validating. Cleaner logs; producer code-quality issues become invisible." },
            { v: "check-only-no-translate", t: "<strong>Check only, never translate</strong> — fail any code outside the bound ValueSet. Force producers to emit canonical codes upstream." },
            { v: "translate-only-skip-check", t: "<strong>Translate everything, skip check</strong> — assume <code>$translate</code> is authoritative; trust its output without re-validating." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleS7Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="s7-feedback"></div>
        <div id="hint-area"></div>
        <div style="margin-top: 14px;">
          <button class="btn journey-primary"
                  ${State.getDecision("consume", 7, "s7_choice") ? "" : "disabled"}
                  onclick="runS7Checks()">
            ${State.getDecision("consume", 7, "checks_ran") ? "✓ Binding checks executed" : "▶ Run binding checks"}
          </button>
        </div>
      `,
      hint: "Two of these are obviously bad — refusing to translate at all blocks legitimate data; trusting <code>$translate</code> blindly trusts an external service for primary validation. The decision is between the two ordering options, and the question is: do you want to keep <em>information</em> about producers who are emitting non-canonical codes, even though it's noisy? In a multi-source pipeline (Cascade is one of many feeds), that signal often pays for itself within months by surfacing upstream issues.",
      reveal: () => {
        State.setDecision("consume", 7, "s7_choice", "check-then-translate");
        State.setDecision("consume", 7, "checks_ran", true);
      },
      validate: () => {
        if (!State.getDecision("consume", 7, "s7_choice")) return { ok: false, message: "Pick a check ordering first." };
        if (!State.getDecision("consume", 7, "checks_ran")) return { ok: false, message: "Run binding checks before advancing." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "consume", stationNum: 7, decisionKey: "s7_choice",
        choicesRootId: "s7-choices", feedbackId: "s7-feedback",
        correctValue: "check-then-translate",
        correctHtml: "Correct. Check-then-translate gives you both the operational outcome (recovered codes load successfully) and the data-quality signal (which producers are emitting non-canonical codes). The signal is what tells you to push back on producer X next quarter to fix their feed at the source. Translate-then-check loses that signal silently.",
        incorrectHtml: "Two options are clearly wrong (no translation; blind trust in translate). The remaining decision is about whether to preserve producer code-quality signal. In a multi-feed pipeline, that signal is worth the noise. Try again or reveal."
      });
    }
  },
  /* ============================================================
     STATION 8 — Extension Handling
     ============================================================ */
  {
    number: 8,
    title: "Extension Handling",
    lecture: () => `
      <p>Station 8 is <strong>Extension Handling</strong>. The structural and semantic checks (S6, S7) caught what they could against US Core profiles. But many incoming resources carry extensions — some standard, some site-local, some homegrown by the producer. Each one is a small interpretation problem.</p>

      <h4>The three classes of extension</h4>
      <ul>
        <li><strong>Recognized standard extensions</strong> — US Core's race/ethnicity/birth-sex, HL7's patient-religion, etc. We know what they mean and how to map them into our warehouse.</li>
        <li><strong>Recognized site-local extensions</strong> — the Cascade producer's <code>discharge-followup-urgency</code> (which we know about because we have a partner agreement with Cascade documenting it).</li>
        <li><strong>Unrecognized extensions</strong> — the most interesting class. A URL we've never seen. It might be from another site's IG, a typo, an experimental extension, or something the producer added without telling anyone.</li>
      </ul>

      <h4>The modifier extension exception</h4>
      <p>Standard (non-modifier) extensions can always be safely ignored. <code>modifierExtension</code> entries change the meaning of the element they're attached to — a receiver that doesn't recognize a modifier extension MUST reject the resource per the FHIR spec. This is a hard rule, not a policy choice. A pipeline that silently ignores unknown modifier extensions has a clinical safety bug.</p>

      <h4>The Cascade Cohort's extension landscape</h4>
      <p>Across the 178 incoming resources that survived prior validation gates:</p>
      <ul>
        <li>All 5 Patients carry US Core race, ethnicity, birth-sex extensions — <strong>recognized standard, mapped to warehouse columns</strong>.</li>
        <li>P002's Patient carries <code>http://hl7.org/fhir/StructureDefinition/patient-religion</code> with a Catholic ReligiousAffiliation code — <strong>recognized standard, mapped to a warehouse column</strong>.</li>
        <li>P001's Patient carries <code>http://cascadehealth.example/fhir/StructureDefinition/preferred-pharmacy</code> — a Cascade-specific extension we have docs for. <strong>Recognized site-local, mapped to a known warehouse column.</strong></li>
        <li>P003's Encounter carries <code>http://anotherhealth.example/fhir/StructureDefinition/triage-acuity-modified</code> — never seen before. Looks site-local from another HIE that maybe shares data with Cascade. <strong>Unrecognized.</strong></li>
        <li>P002's MedicationRequest carries a <code>modifierExtension</code> with URL <code>http://oldsystem.example/fhir/StructureDefinition/conditional-on-lab-result</code> — never seen before. <strong>Unrecognized modifier extension.</strong></li>
      </ul>

      <h4>Policy decisions, in order of safety</h4>
      <p>The non-modifier unrecognized extension on P003's Encounter is a low-stakes decision. The unrecognized modifier extension on P002's MedicationRequest is a high-stakes decision with a clear right answer dictated by the spec.</p>

      <h4>What a working pipeline does with unrecognized non-modifier extensions</h4>
      <ul>
        <li><strong>Pass-through to a JSON column</strong> — store the extension verbatim in a <code>raw_extensions</code> column on the warehouse fact table. Doesn't lose data, doesn't pretend to understand it. Analysts can query it later if it turns out to matter.</li>
        <li><strong>Drop with audit log</strong> — discard the extension, write a log entry ("unrecognized extension URL X seen on resource Y"). The audit log accumulates; if the same URL keeps appearing, that's a signal to investigate.</li>
        <li><strong>Add to schema and ignore until reviewed</strong> — build a registry of seen-but-unhandled extensions. New URLs go on the queue for human review.</li>
      </ul>

      ${UI.xref("consume", "produce", 3, "On the producing side, Resource Construction faced this from the other end — the null-flavor decision for declined-to-report race used the <code>v3-NullFlavor</code> CodeSystem inside an extension. The receiver-side handling we're doing here is what makes that producer-side discipline pay off: standard codes get standard interpretations.")}

      ${UI.xref("consume", "produce", 6, "Producer-side Extension Design walked the ladder of where to put novel concepts. The producer that wrote the <code>discharge-followup-urgency</code> extension chose to publish a custom extension; the producer who wrote <code>triage-acuity-modified</code> apparently chose the same. Both create exactly this consumer-side problem — and the consumer's answer to that problem is what determines whether the producer's choice was worth it.")}
    `,
    beforeAfter: {
      before: () => `<pre class="code-block"><span class="pc-comment"># P002 MedicationRequest — modifier extension, unrecognized URL</span>
{
  "resourceType": "MedicationRequest",
  "id": "medreq-p002-warfarin",
  "status": "active",
  "intent": "order",
  "modifierExtension": [{
    "url": "http://oldsystem.example/fhir/StructureDefinition/conditional-on-lab-result",
    "valueReference": {"reference": "Observation/inr-target-2-3"}
  }],
  "medicationCodeableConcept": {"coding": [{"system": "...rxnorm", "code": "855332", "display": "Warfarin Sodium 5 MG Oral Tablet"}]},
  "subject": {"reference": "Patient/p002"}
}

<span class="pc-comment"># Per FHIR spec: a receiver that doesn't recognize a modifierExtension MUST NOT process the resource.
# This is not a policy choice — it's a clinical safety requirement.</span></pre>`,
      after: () => {
        const policy = State.getDecision("consume", 8, "s8_choice");
        const ran = State.getDecision("consume", 8, "extensions_processed");
        if (!policy) return `<div class="empty-state">Pick an unrecognized-extension policy.</div>`;
        if (!ran) return `<pre class="code-block"><span class="pc-comment"># Policy chosen: ${policy}
# Click "Process extensions" to execute</span></pre>`;
        let outcome;
        if (policy === "passthrough-with-modifier-quarantine") {
          outcome = `{
  "policy": "passthrough-with-modifier-quarantine",
  "summary": {"recognized": 23, "unrecognized_nonmodifier": 1, "unrecognized_modifier": 1},
  "actions": {
    "P003 Encounter (unknown non-modifier ext)": "Stored in raw_extensions JSON column; quality flag set",
    "P002 MedicationRequest (unknown MODIFIER ext)": "QUARANTINED — receiver must not process per FHIR spec",
    "Audit log": "URL http://anotherhealth.example/.../triage-acuity-modified seen 1 time; investigate if recurrent"
  }
}`;
        } else if (policy === "ignore-unknown-all") {
          outcome = `{
  "policy": "ignore-unknown-all",
  "summary": {"recognized": 23, "ignored": 2},
  "warning": "MODIFIER EXTENSION SILENTLY IGNORED on P002 MedicationRequest",
  "spec_violation": "FHIR R4 §2.4.1: receivers MUST NOT process resources with unknown modifierExtensions",
  "clinical_risk": "Warfarin order's 'conditional-on-lab-result' constraint dropped — could result in dosing without checking INR"
}`;
        } else if (policy === "quarantine-everything-unknown") {
          outcome = `{
  "policy": "quarantine-everything-unknown",
  "summary": {"recognized": 23, "quarantined": 2},
  "issue": "P003 Encounter quarantined for a benign non-modifier extension — overcautious",
  "result": "Warehouse missing the entire P003 encounter row because of one unrecognized field"
}`;
        } else {
          outcome = `{
  "policy": "best-effort-coerce",
  "result": "Inferred meaning of unknown extensions from URL text and produced warehouse mappings",
  "danger": "ATTRIBUTING SEMANTICS WE DO NOT KNOW — false interpretations now in clinical warehouse",
  "P002 MedicationRequest": "Coerced 'conditional-on-lab-result' to 'conditional' boolean column — dropped the actual lab reference"
}`;
        }
        return `<pre class="code-block">${UI.highlightJson(outcome)}</pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — Unrecognized extension policy</h3>
        <div class="task-prompt">
          One unrecognized non-modifier extension (P003 Encounter, low-stakes), one unrecognized modifier extension (P002 MedicationRequest, FHIR-spec-mandated rejection). Which policy does the pipeline implement?
        </div>
        <div class="choice-list" id="s8-choices">
          ${[
            { v: "passthrough-with-modifier-quarantine", t: "<strong>Pass through non-modifier extensions to a raw_extensions JSON column with audit logging; quarantine any resource carrying an unrecognized modifier extension</strong> per FHIR spec." },
            { v: "ignore-unknown-all",                   t: "<strong>Ignore all unknown extensions</strong> — modifier or not. Warehouse stays clean; the unknowns are 'just metadata.'" },
            { v: "quarantine-everything-unknown",        t: "<strong>Quarantine any resource with any unknown extension</strong> — modifier or not. Maximum caution." },
            { v: "best-effort-coerce",                   t: "<strong>Best-effort coerce</strong> — inspect the extension URL text, infer likely meaning, and produce a warehouse mapping." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleS8Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="s8-feedback"></div>
        <div id="hint-area"></div>
        <div style="margin-top: 14px;">
          <button class="btn journey-primary"
                  ${State.getDecision("consume", 8, "s8_choice") ? "" : "disabled"}
                  onclick="runS8Process()">
            ${State.getDecision("consume", 8, "extensions_processed") ? "✓ Extensions processed" : "▶ Process extensions"}
          </button>
        </div>
      `,
      hint: "The modifier-extension rule is non-negotiable — FHIR R4 §2.4.1 says receivers MUST NOT process resources with unknown modifier extensions. So ignore-everything fails immediately on clinical safety grounds. Best-effort coercion attributes meaning we don't have, which is worse than dropping the data. Quarantine-everything is overcautious for benign non-modifier extensions. The right answer differentiates between modifier and non-modifier and treats each appropriately.",
      reveal: () => {
        State.setDecision("consume", 8, "s8_choice", "passthrough-with-modifier-quarantine");
        State.setDecision("consume", 8, "extensions_processed", true);
      },
      validate: () => {
        if (!State.getDecision("consume", 8, "s8_choice")) return { ok: false, message: "Pick an unrecognized-extension policy first." };
        if (!State.getDecision("consume", 8, "extensions_processed")) return { ok: false, message: "Process extensions before advancing." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "consume", stationNum: 8, decisionKey: "s8_choice",
        choicesRootId: "s8-choices", feedbackId: "s8-feedback",
        correctValue: "passthrough-with-modifier-quarantine",
        correctHtml: "Correct. Modifier vs. non-modifier extensions are categorically different problems and need different handling. Non-modifier unknowns get raw-passed-through with audit logging (no data lost, no semantics fabricated). Modifier unknowns trigger resource quarantine because that's what the FHIR spec mandates for clinical safety reasons. The distinction matters: a warfarin order with a 'conditional-on-lab-result' modifier extension that we don't process is a real patient safety hazard.",
        incorrectHtml: "The modifier-extension rule is a FHIR spec MUST. The right answer treats modifier and non-modifier extensions differently — one with caution, the other with controlled passthrough. Try again or reveal."
      });
    }
  },
  /* ============================================================
     STATION 9 — Resource Reconciliation
     ============================================================ */
  {
    number: 9,
    title: "Resource Reconciliation",
    lecture: () => `
      <p>Station 9 is <strong>Resource Reconciliation</strong>. Validation gates have done their job. Every resource that's still in the pipeline is structurally and semantically valid. But "valid" doesn't mean "non-overlapping." Some incoming resources describe the same patient or the same encounter as resources we already have — either from a prior batch, from another producer feed, or from elsewhere in this batch. Reconciliation is the decision about what to do with overlap.</p>

      <h4>Three reconciliation cases, in increasing difficulty</h4>
      <ol>
        <li><strong>Same resource, newer version</strong> — same identifier, same source system, but one resource has a later <code>meta.lastUpdated</code>. Trivial: keep the newer; discard the older. Or both, with version history.</li>
        <li><strong>Different resources, same clinical fact</strong> — two MedicationRequests for warfarin from two different prescribers on the same patient, same dose, same date. Are these the same order? Probably yes — but who's authoritative?</li>
        <li><strong>Possible duplicate patients</strong> — the hardest case. Two Patient resources, similar demographics, different MRNs. Are they the same person?</li>
      </ol>

      <h4>The Cascade Cohort's near-duplicate: P001 vs. P005</h4>
      <p>Maria <strong>Gonzalez</strong> (P001, MRN CRH-10001, DOB 1963-04-12) and Maria <strong>Gonzales</strong> (P005, MRN CRH-10005, DOB 1965-04-12). One letter different in the surname. Two-year DOB difference. Both have Type 2 diabetes mellitus. Both are female. Both list Cascade Hospital as their care site.</p>

      <p>Are they the same person, where one record is wrong about the DOB? Or two distinct patients who happen to have similar names (statistically not improbable in a community of any size)? The pipeline cannot answer this question alone. What it can do is decide how to <em>handle</em> the ambiguity.</p>

      <h4>Match score thresholds — a typical setup</h4>
      <p>A patient-matching algorithm scores candidate pairs. A typical scoring setup:</p>
      <ul>
        <li><strong>Score ≥ 0.95 (definite match)</strong> — auto-merge into a single warehouse patient row, link MRNs as alternate identifiers.</li>
        <li><strong>Score 0.80–0.94 (possible match)</strong> — surface to a steward review queue. <em>Do not</em> auto-merge. Both records load as distinct in the warehouse with a "potential duplicate" flag until reviewed.</li>
        <li><strong>Score &lt; 0.80 (no match)</strong> — treat as distinct. No flag.</li>
      </ul>

      <p>P001/P005 score around 0.86 on most reasonable patient-matching algorithms — name similarity high, gender match, condition overlap, but DOB and MRN differ. Solidly in the "possible" band.</p>

      <h4>Why not auto-merge "possibles"</h4>
      <p>Auto-merging two distinct real patients is irreversible data corruption. If P001 and P005 are actually different people and the warehouse merges them, the merged patient now has the union of both clinical histories. A clinician viewing that record sees one person who has twice as many encounters, contradictory medication histories, and possibly conflicting allergies. Untangling a wrong merge after downstream systems have ingested it is enormously expensive — and may not be possible at all if records have been edited post-merge.</p>

      <p>Conversely, leaving two records that are actually the same person as distinct is a fixable error: a reviewer can merge them later. The asymmetry is the whole reason for the steward queue.</p>

      <h4>Same-batch dose conflict — a different reconciliation case</h4>
      <p>P002 (Robert Kowalski) has two MedicationRequests for Lisinopril in this batch — one from his cardiologist for 10 MG, one from his PCP for 20 MG. Same drug, same patient, different doses, both <code>status = "active"</code>. The producer didn't reconcile this; the consumer has to.</p>

      <p>Auto-resolving this is dangerous (which dose is current?). Surfacing it to a clinical reviewer (not a data steward — this needs a clinician) is the only safe path. The pipeline routes it to a medication-reconciliation worklist with full provenance.</p>

      ${UI.xref("consume", "produce", 10, "On the producing side, Conditional Create/Update is the producer's defense against creating exactly the duplicate situation we're handling here. The producer's <code>ifNoneExist</code> patterns try to prevent the consumer from ever needing this station — and when those patterns are well-designed, the consumer's reconciliation queue stays short.")}
    `,
    beforeAfter: {
      before: () => `<pre class="code-block"><span class="pc-comment"># Two patients, possibly the same person</span>
{
  "P001": {
    "name": "Maria Gonzalez",   "mrn": "CRH-10001",
    "dob":  "1963-04-12",       "sex": "female",
    "conditions": ["Type 2 diabetes mellitus", "Essential hypertension"]
  },
  "P005": {
    "name": "Maria Gonzales",   "mrn": "CRH-10005",
    "dob":  "1965-04-12",       "sex": "female",
    "conditions": ["Type 2 diabetes mellitus"]
  }
}

<span class="pc-comment"># Patient-match score: 0.86 (possible match — within 0.80–0.94 band)
# P002 (Robert Kowalski) has dose conflict on Lisinopril (10 MG vs 20 MG, both active)</span></pre>`,
      after: () => {
        const policy = State.getDecision("consume", 9, "s9_choice");
        const ran = State.getDecision("consume", 9, "reconciliation_done");
        if (!policy) return `<div class="empty-state">Pick a reconciliation policy.</div>`;
        if (!ran) return `<pre class="code-block"><span class="pc-comment"># Policy chosen: ${policy}
# Click "Run reconciliation" to execute</span></pre>`;
        let outcome;
        if (policy === "auto-merge-all-possibles") {
          outcome = `{
  "policy": "auto-merge-all-possibles",
  "result": "P001 and P005 merged into single warehouse row",
  "merged_record": {
    "mrn_primary": "CRH-10001", "mrn_alt": "CRH-10005",
    "name": "Maria Gonzalez (alt: Gonzales)",
    "dob": "1963-04-12",  // P001's DOB chosen; P005's DOB lost
    "conditions": ["Type 2 diabetes mellitus" (deduplicated), "Essential hypertension"]
  },
  "DANGER": "If P001 and P005 are actually different people, this merge is irreversible data corruption.",
  "P002_lisinopril": "Both doses kept; latest timestamp wins (no clinical review)"
}`;
        } else if (policy === "queue-with-distinct-load") {
          outcome = `{
  "policy": "queue-with-distinct-load",
  "result": "P001 and P005 loaded as DISTINCT patients with potential_duplicate_flag=true",
  "review_queue": [
    {"type": "patient_match_review", "score": 0.86, "candidates": ["P001", "P005"], "for": "data_steward"},
    {"type": "medication_reconciliation", "patient": "P002", "drug": "Lisinopril", "candidates": ["10MG order from cardiologist", "20MG order from PCP"], "for": "clinical_reviewer"}
  ],
  "warehouse_state": "Both Marias load as separate patients; flagged. Both Lisinopril orders load with status='reconciliation-pending'. No silent decisions."
}`;
        } else if (policy === "drop-lower-confidence") {
          outcome = `{
  "policy": "drop-lower-confidence",
  "result": "P005 dropped (assumed to be erroneous duplicate of P001)",
  "issue": "If P005 is a real distinct patient, the warehouse now has zero record of her. Silent data loss with no audit trail of why."
}`;
        } else {
          outcome = `{
  "policy": "load-everything-no-flag",
  "result": "Both patients loaded; no duplicate flag; no medication review",
  "downstream_consequence": "Population-health analyst counts diabetic patients: P001 and P005 both counted as separate cases. Cohort statistics mildly wrong. Maria's care team (whichever one she actually is) sees two charts and doesn't know which is current."
}`;
        }
        return `<pre class="code-block">${UI.highlightJson(outcome)}</pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — Reconciliation policy for P001/P005 + P002 dose conflict</h3>
        <div class="task-prompt">
          P001/P005 score 0.86 on patient matching (possible duplicate). P002 has two active Lisinopril orders at different doses. Which policy?
        </div>
        <div class="choice-list" id="s9-choices">
          ${[
            { v: "auto-merge-all-possibles",   t: "<strong>Auto-merge all possibles</strong> — merge P001 and P005 into one record; pick a winning DOB; resolve P002's dose conflict by latest-timestamp wins. Warehouse stays clean." },
            { v: "queue-with-distinct-load",   t: "<strong>Queue with distinct load</strong> — load P001 and P005 as separate patients flagged as potential duplicates; load both Lisinopril orders flagged as reconciliation-pending; route both to appropriate reviewers (data steward for patients, clinician for medications)." },
            { v: "drop-lower-confidence",      t: "<strong>Drop lower-confidence record</strong> — assume P005 is erroneous and discard it; assume newer Lisinopril order is current and discard the older." },
            { v: "load-everything-no-flag",    t: "<strong>Load everything, no flags</strong> — let downstream consumers (analysts, clinicians) figure it out. Pipeline doesn't make decisions about overlap." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleS9Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="s9-feedback"></div>
        <div id="hint-area"></div>
        <div style="margin-top: 14px;">
          <button class="btn journey-primary"
                  ${State.getDecision("consume", 9, "s9_choice") ? "" : "disabled"}
                  onclick="runS9Reconcile()">
            ${State.getDecision("consume", 9, "reconciliation_done") ? "✓ Reconciliation complete" : "▶ Run reconciliation"}
          </button>
        </div>
      `,
      hint: "Asymmetry of error costs: wrongly merging two real patients is irreversible data corruption that can affect clinical decisions. Wrongly leaving two records as distinct is a fixable nuisance. Auto-resolving a dose conflict on an active medication is a clinical safety decision the pipeline shouldn't make. Dropping records causes silent data loss. Loading everything unflagged passes the problem downstream where it's harder to handle. One option treats the asymmetry correctly.",
      reveal: () => {
        State.setDecision("consume", 9, "s9_choice", "queue-with-distinct-load");
        State.setDecision("consume", 9, "reconciliation_done", true);
      },
      validate: () => {
        if (!State.getDecision("consume", 9, "s9_choice")) return { ok: false, message: "Pick a reconciliation policy first." };
        if (!State.getDecision("consume", 9, "reconciliation_done")) return { ok: false, message: "Run reconciliation before advancing." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "consume", stationNum: 9, decisionKey: "s9_choice",
        choicesRootId: "s9-choices", feedbackId: "s9-feedback",
        correctValue: "queue-with-distinct-load",
        correctHtml: "Correct. Load both as distinct (cheap to reverse later), flag the duplicate possibility (so it gets human review), route the medication conflict to a clinical reviewer (because dose decisions aren't pipeline decisions). The warehouse stays usable, no data is lost, no irreversible silent merges happen, and reviewers see the failure modes that need their attention.",
        incorrectHtml: "Auto-merge can corrupt irreversibly. Drop loses data silently. Load-everything-unflagged passes the problem downstream where it's worse. The right answer respects the asymmetry between reversible and irreversible errors. Try again or reveal."
      });
    }
  },
  /* ============================================================
     STATION 10 — Flattening for Warehouse
     ============================================================ */
  {
    number: 10,
    title: "Flattening for Warehouse",
    lecture: () => `
      <p>Station 10 is <strong>Flattening for Warehouse</strong>. The reconciled FHIR resource graph (S9) is a forest of nested objects with references threaded throughout. The warehouse is a relational schema. This station is the impedance-match between them.</p>

      <h4>Why FHIR doesn't load directly into a warehouse</h4>
      <p>Three structural mismatches:</p>
      <ul>
        <li><strong>Nesting</strong> — a Patient has a list of names, each with a list of given names. SQL has tables and rows, not nested arrays. Flattening either picks the "primary" entries (name with <code>use="official"</code>; given[0]) or explodes into child tables.</li>
        <li><strong>Polymorphic types</strong> — <code>Observation.value[x]</code> can be Quantity, CodeableConcept, string, boolean, integer, Range, Ratio, etc. SQL columns are typed. The warehouse needs either a value-per-type column set (<code>value_quantity</code>, <code>value_code</code>, <code>value_string</code>...) with most NULL on any given row, or a value-as-JSON column with downstream type-aware queries.</li>
        <li><strong>References</strong> — <code>Condition.subject = "Patient/p001"</code> is a string. The warehouse wants a <code>patient_key</code> integer foreign key into the Patient dimension. Reference resolution (S5) gave us the resource; flattening converts the reference to a key.</li>
      </ul>

      <h4>The US Core warehouse target schema</h4>
      <p>Cascade's warehouse follows a star-schema-ish layout aligned to USCDI data classes:</p>
      <ul>
        <li><strong><code>dim_patient</code></strong> — one row per patient, columns for the must-support US Core Patient elements (mrn, family_name, given_names, birth_date, gender, race_omb, race_text, ethnicity_omb, birth_sex, etc.). One-to-many overflow (extra names, telecoms) goes to child tables (<code>patient_name_xref</code>, <code>patient_telecom</code>) keyed back to <code>patient_key</code>.</li>
        <li><strong><code>fact_condition</code></strong> — one row per Condition. Columns for code (icd10 + snomed), onset, recorded date, clinical status, verification status. Subject and encounter become FK references.</li>
        <li><strong><code>fact_medication_request</code></strong> — one row per MedicationRequest. Medication code (rxnorm), status, dose info flattened to the most-common shape (dose_quantity, dose_unit, frequency).</li>
        <li><strong><code>fact_observation</code></strong> — one row per Observation. Value-per-type column set (<code>value_quantity</code>, <code>value_code</code>, <code>value_string</code>) plus units, range, interpretation.</li>
        <li><strong><code>raw_extensions</code></strong> — JSON column on each fact table for the unrecognized-extension passthrough from S8.</li>
      </ul>

      <h4>The decision: how to handle one-to-many fields</h4>
      <p>Patients can have multiple names (legal name, maiden name, nickname). Conditions can have multiple coded values (the dual-coded ICD-10 + ICD-9 from Station 7). MedicationRequests can have multiple dosage instructions. The warehouse can handle this in different ways.</p>

      <h4>The Cascade Cohort's flattening challenges</h4>
      <ul>
        <li>P003 has 3 names recorded in his Patient resource: legal name "Jamal Washington", a previous legal name "Jamal Smith" (from before a name change), and a nickname "JW" (used in clinical notes).</li>
        <li>P002's atrial fibrillation Condition has the dual coding from Station 7 (ICD-10-CM + ICD-9-CM). The warehouse fact_condition has columns for icd10 and snomed but not icd9.</li>
        <li>P001's MedicationRequest for Metformin has a single dosage instruction. P002's MedicationRequest for Warfarin has two dosage instructions (5 MG Mon/Wed/Fri, 7.5 MG Tue/Thu/Sat/Sun) for INR-target dose adjustment.</li>
      </ul>

      <h4>Three approaches to the one-to-many problem</h4>
      <ul>
        <li><strong>First-wins flattening</strong> — pick name[0], coding[0], dosageInstruction[0] for the main fact row. Lose the rest. Fast queries, lossy data.</li>
        <li><strong>Primary-on-fact-table + child-table-for-overflow</strong> — pick the "primary" (name with use=official, coding from the bound CodeSystem, first dosage instruction) for the fact row, and load all entries (including primary) into a child table for full fidelity. Most queries hit the fact table; analyses needing full history join the child.</li>
        <li><strong>JSON column for everything multi-valued</strong> — fact table carries a JSON column with the full list. Queries are slower (JSON path expressions instead of SQL), but no data loss.</li>
      </ul>

      ${UI.xref("consume", "produce", 5, "On the producing side, Terminology Binding's dual-coding decision (emit both ICD-9 and ICD-10-CM) is what gives us the fidelity we're now flattening here. The producer chose to preserve the source code; the consumer-side decision is whether the warehouse preserves it too.")}

      ${UI.xref("consume", "produce", 9, "Producer-side Bundle Assembly chose per-patient transactions to limit failure blast radius. That choice means the warehouse here loads on a per-patient basis — 4 patients can land cleanly even if 1 patient's data is in the review queue from Station 9.")}
    `,
    beforeAfter: {
      before: () => `<pre class="code-block"><span class="pc-comment"># P003 Patient resource (validated, reconciled)</span>
{
  "resourceType": "Patient",
  "id": "p003",
  "name": [
    {"use": "official", "family": "Washington", "given": ["Jamal"]},
    {"use": "old",      "family": "Smith",      "given": ["Jamal"]},
    {"use": "nickname", "given": ["JW"]}
  ],
  "extension": [
    {"url": ".../us-core-race",      "extension": [...]},
    {"url": ".../us-core-ethnicity", "extension": [...]},
    {"url": ".../us-core-birthsex",  "valueCode": "M"},
    {"url": "http://anotherhealth.example/.../triage-acuity-modified", "valueCode": "moderate"}
  ],
  ...
}

<span class="pc-comment"># P002 Condition (atrial fibrillation, dual-coded)</span>
{
  "resourceType": "Condition",
  "code": {
    "coding": [
      {"system": "http://hl7.org/fhir/sid/icd-10-cm", "code": "I48.91"},
      {"system": "http://hl7.org/fhir/sid/icd-9-cm",  "code": "427.31"}
    ]
  }
}</pre>`,
      after: () => {
        const strategy = State.getDecision("consume", 10, "s10_choice");
        const ran = State.getDecision("consume", 10, "flattening_done");
        if (!strategy) return `<div class="empty-state">Pick a flattening strategy.</div>`;
        if (!ran) return `<pre class="code-block"><span class="pc-comment"># Strategy chosen: ${strategy}
# Click "Run flattening" to execute</span></pre>`;
        let outcome;
        if (strategy === "first-wins") {
          outcome = `{
  "strategy": "first-wins",
  "dim_patient_p003": {
    "mrn": "CRH-10003", "family_name": "Washington", "given_names": "Jamal",
    "former_names_lost": ["Smith family", "JW nickname"],
    "raw_extensions": "(no — unrecognized extension dropped at flatten time)"
  },
  "fact_condition_p002_afib": {
    "icd10_code": "I48.91", "icd10_display": "Unspecified atrial fibrillation",
    "icd9_code_lost": "427.31"
  },
  "data_loss_summary": "Lost 2 historical names, 1 unrecognized extension, 1 ICD-9 code, 1 dosage instruction (P002 warfarin)"
}`;
        } else if (strategy === "primary-plus-child") {
          outcome = `{
  "strategy": "primary-plus-child",
  "dim_patient_p003": {
    "mrn": "CRH-10003", "family_name": "Washington", "given_names": "Jamal",
    "primary_name_use": "official"
  },
  "patient_name_xref_p003": [
    {"name_use": "official", "family": "Washington", "given": "Jamal"},
    {"name_use": "old",      "family": "Smith",      "given": "Jamal"},
    {"name_use": "nickname", "family": null,         "given": "JW"}
  ],
  "fact_condition_p002_afib": {
    "icd10_code": "I48.91", "icd10_display": "Unspecified atrial fibrillation"
  },
  "condition_coding_xref_p002_afib": [
    {"code_system": "icd-10-cm", "code": "I48.91"},
    {"code_system": "icd-9-cm",  "code": "427.31"}
  ],
  "raw_extensions_p003": "[{url: 'triage-acuity-modified', value: 'moderate'}]",
  "data_loss_summary": "Zero — all entries preserved across primary + child tables"
}`;
        } else {
          outcome = `{
  "strategy": "json-everywhere",
  "dim_patient_p003": {
    "mrn": "CRH-10003",
    "names_json": "[{...}, {...}, {...}]",
    "extensions_json": "[{...}, {...}, {...}, {...}]"
  },
  "queries": "Reading 'family name' requires JSON path: names_json::jsonb #>> '{0,family}'",
  "performance": "Acceptable for ad-hoc analytics; poor for high-volume joins; downstream BI tools may not handle JSON natively"
}`;
        }
        return `<pre class="code-block">${UI.highlightJson(outcome)}</pre>`;
      }
    },
    task: {
      render: () => `
        <h3>Decision — One-to-many flattening strategy</h3>
        <div class="task-prompt">
          P003 has 3 names; P002's atrial fibrillation has dual-coding; P002's warfarin has 2 dosage instructions. The warehouse needs to support both routine BI queries (fast joins on the main fact tables) and detailed clinical analyses (full fidelity to source). Which flattening strategy?
        </div>
        <div class="choice-list" id="s10-choices">
          ${[
            { v: "first-wins",          t: "<strong>First-wins flattening</strong> — primary entries on fact tables, drop everything else. Fast queries, lossy. JW's old name and the ICD-9 code are gone." },
            { v: "primary-plus-child",  t: "<strong>Primary on fact + child table for overflow</strong> — put primary entries on fact tables for routine queries; load full entries into child tables for fidelity. Two query paths." },
            { v: "json-everywhere",     t: "<strong>JSON columns for everything multi-valued</strong> — store full lists as JSON on the fact tables. Single-table queries but no SQL-native access to nested data." },
            { v: "explode-rows",        t: "<strong>Explode multi-valued fields into multiple fact rows</strong> — P003 generates 3 dim_patient rows (one per name); P002's warfarin generates 2 fact_medication_request rows (one per dosage). Queries always need DISTINCT." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleS10Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="s10-feedback"></div>
        <div id="hint-area"></div>
        <div style="margin-top: 14px;">
          <button class="btn journey-primary"
                  ${State.getDecision("consume", 10, "s10_choice") ? "" : "disabled"}
                  onclick="runS10Flatten()">
            ${State.getDecision("consume", 10, "flattening_done") ? "✓ Flattening complete" : "▶ Run flattening"}
          </button>
        </div>
      `,
      hint: "Two requirements pulling in opposite directions: BI queries want a clean star schema (fast joins, no JSON parsing); clinical analyses want full source fidelity (no data loss). First-wins fails fidelity; JSON-everywhere fails BI; explode-rows breaks the basic 'one row per patient' contract that downstream tools assume. The remaining option splits the difference — the cost is two query paths to know about, but each is well-suited to its purpose.",
      reveal: () => {
        State.setDecision("consume", 10, "s10_choice", "primary-plus-child");
        State.setDecision("consume", 10, "flattening_done", true);
      },
      validate: () => {
        if (!State.getDecision("consume", 10, "s10_choice")) return { ok: false, message: "Pick a flattening strategy first." };
        if (!State.getDecision("consume", 10, "flattening_done")) return { ok: false, message: "Run flattening before advancing." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "consume", stationNum: 10, decisionKey: "s10_choice",
        choicesRootId: "s10-choices", feedbackId: "s10-feedback",
        correctValue: "primary-plus-child",
        correctHtml: "Correct. Primary-plus-child is the standard star-schema approach for FHIR-to-warehouse flattening. Fact tables stay clean and fast for the 95% of queries that just want the primary value. Child tables preserve full fidelity for the 5% of analyses that need it. Both query patterns are well-supported by SQL and downstream BI tools.",
        incorrectHtml: "First-wins loses data; JSON-everywhere kills BI performance and tool compatibility; explode-rows breaks per-patient row uniqueness. The right answer separates the two query paths cleanly. Try again or reveal."
      });
    }
  },
  /* ============================================================
     STATION 11 — SQL Load (sql.js Terminal)
     ============================================================ */
  {
    number: 11,
    title: "SQL Load — sql.js Terminal",
    lecture: () => `
      <p>Station 11 is the <strong>terminal</strong>. Everything we've done — discovery, authorization, retrieval, resolution, validation, terminology checks, extension handling, reconciliation, flattening — funnels into this last step: the rows actually land in a US Core-conformant warehouse, and analysts can query them.</p>

      <h4>The warehouse schema</h4>
      <p>This station instantiates a real SQLite database in your browser using sql.js (a WebAssembly compile of SQLite). The schema is the one we've been building toward:</p>
      <ul>
        <li><code>dim_patient</code> — one row per patient, US Core demographic columns</li>
        <li><code>patient_name_xref</code> — overflow names from Station 10's primary-plus-child decision</li>
        <li><code>fact_condition</code> — one row per diagnosis</li>
        <li><code>condition_coding_xref</code> — multi-coding overflow (e.g., the dual ICD-10/ICD-9 from P002)</li>
        <li><code>fact_medication_request</code> — one row per discharge medication</li>
        <li><code>quarantine_log</code> — the resources that didn't make it (P003 buprenorphine RxNorm failure from S7, etc.)</li>
      </ul>

      <h4>What happens when you click "Initialize warehouse"</h4>
      <ol>
        <li>sql.js loads from CDN (~1 MB; one-time per page session)</li>
        <li>An in-memory SQLite database is created</li>
        <li>DDL runs to create the 6 tables</li>
        <li>INSERT statements load rows synthesized from the cohort + the decisions you made on prior stations</li>
        <li>A query box appears — you can run any SQL against the warehouse</li>
      </ol>

      <h4>Try the suggested queries</h4>
      <p>Three suggested queries demonstrate what a US Core warehouse is for:</p>
      <ul>
        <li><strong>Patient roster</strong> — confirms all 5 are loaded (or 4, if your S6 quarantine policy held one back)</li>
        <li><strong>Diabetic patients with most-recent diagnosis date</strong> — the kind of cohort query a population-health analyst writes daily</li>
        <li><strong>P002's dual-coded atrial fibrillation</strong> — joins fact_condition to condition_coding_xref to show the fidelity Station 10 preserved</li>
      </ul>

      <h4>What this station is NOT</h4>
      <p>This isn't a production warehouse. It's an in-browser SQLite, ephemeral per session, with synthetic data shaped to demonstrate the schema. A real US Core warehouse would be Snowflake, Databricks, BigQuery, or Postgres; would partition fact tables by time; would carry millions of rows; would feed downstream marts via dbt models. The shape is the lesson — the technology is just the demo.</p>

      <h4>The terminal decision</h4>
      <p>At a real terminal, the question isn't "did the load succeed" (the validator gates already handled that). The question is "now that data is loaded, what's the operational signal we surface to the team that runs this pipeline?" Three options exist; one is the right ongoing-operations posture.</p>
    `,
    beforeAfter: {
      before: () => `<pre class="code-block"><span class="pc-comment"># Flattened rows ready for INSERT (from Station 10's primary-plus-child output)</span>
dim_patient:                5 rows
patient_name_xref:          7 rows  (P003 has 3, others have 1 each)
fact_condition:            10 rows  (1 quarantined per S6 policy)
condition_coding_xref:     11 rows  (P002 afib has 2 codes)
fact_medication_request:    7 rows
quarantine_log:             3 rows  (S6 P005 race ext, S7 P003 RxNorm, S9 P002 dose conflict)</pre>`,
      after: () => {
        const initialized = State.getDecision("consume", 11, "warehouse_initialized");
        if (!initialized) {
          return `<div class="empty-state">Click "Initialize warehouse" below to load sql.js, create the schema, and INSERT the rows.</div>`;
        }
        return `
          <div id="sqljs-status" style="margin-bottom: 12px; font-size: 12px; color: #1e6670;">
            <strong>✓ Warehouse ready</strong> — SQLite running in-browser via sql.js (WebAssembly).
            <span id="sqljs-row-counts"></span>
          </div>
          <div style="margin-bottom: 12px;">
            <h4 style="font-size: 12px; margin-bottom: 6px;">Suggested queries — click to run</h4>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <button class="btn ghost" style="text-align: left; font-family: monospace; font-size: 11px;"
                      onclick="runS11SuggestedQuery('roster')">
                SELECT mrn, family_name, given_names, birth_date, gender FROM dim_patient ORDER BY mrn;
              </button>
              <button class="btn ghost" style="text-align: left; font-family: monospace; font-size: 11px;"
                      onclick="runS11SuggestedQuery('diabetic')">
                Diabetic patients (joins fact_condition to dim_patient)
              </button>
              <button class="btn ghost" style="text-align: left; font-family: monospace; font-size: 11px;"
                      onclick="runS11SuggestedQuery('dual_coded')">
                P002's atrial fibrillation showing both ICD-10 and ICD-9 codings
              </button>
              <button class="btn ghost" style="text-align: left; font-family: monospace; font-size: 11px;"
                      onclick="runS11SuggestedQuery('quarantine')">
                Quarantine log — what didn't make it through
              </button>
            </div>
          </div>
          <div>
            <h4 style="font-size: 12px; margin-bottom: 6px;">Or write your own SQL</h4>
            <textarea id="s11-sql-input" class="answer-input" rows="3"
                      style="font-family: monospace; font-size: 12px;"
                      placeholder="SELECT * FROM dim_patient WHERE gender = 'female';"></textarea>
            <div style="margin-top: 8px;">
              <button class="btn journey-primary" onclick="runS11CustomQuery()">▶ Run query</button>
            </div>
          </div>
          <div id="s11-query-output" style="margin-top: 14px;"></div>
        `;
      }
    },
    task: {
      render: () => `
        <h3>Decision — Operational signal posture for the live warehouse</h3>
        <div class="task-prompt">
          The warehouse is loaded and queryable. Going forward, what operational posture does the pipeline team take regarding ongoing data quality?
        </div>
        <div class="choice-list" id="s11-choices">
          ${[
            { v: "no-monitoring",        t: "<strong>No monitoring</strong> — the validator gates caught what they could; trust the warehouse contents and react to user-reported issues." },
            { v: "run-once-dashboard",   t: "<strong>Run-once dashboard</strong> — generate a one-time data-quality report at the end of each batch (counts, must-support coverage, quarantine sizes); email it to the team." },
            { v: "continuous-with-trends", t: "<strong>Continuous monitoring with trend detection</strong> — track the same data-quality metrics per batch over time, alert on drift (must-support coverage falling, quarantine sizes growing, new unrecognized extension URLs appearing). The signal is in the trend, not the snapshot." },
            { v: "block-on-any-deviation", t: "<strong>Block on any deviation</strong> — refuse to load any batch that shows any change from the baseline (new producers, new extension URLs, any quarantine). Maximum caution." }
          ].map(c => `
            <div class="choice-card" data-v="${c.v}" onclick="handleS11Choice('${c.v}')">${c.t}</div>
          `).join("")}
        </div>
        <div id="s11-feedback"></div>
        <div id="hint-area"></div>
        <div style="margin-top: 14px;">
          <button class="btn journey-primary" onclick="runS11Init()">
            ${State.getDecision("consume", 11, "warehouse_initialized") ? "✓ Warehouse initialized" : "▶ Initialize warehouse (loads sql.js)"}
          </button>
        </div>
      `,
      hint: "Two of these are clearly wrong: no-monitoring leaves drift invisible until it bites someone; block-on-any-deviation refuses legitimate growth (new producers and extensions are normal). Between run-once-dashboard and continuous-with-trends, ask: when did you last find an upstream issue from a snapshot vs. from noticing a metric trending the wrong way over weeks? Trend signals catch drift before snapshots do.",
      reveal: () => {
        State.setDecision("consume", 11, "s11_choice", "continuous-with-trends");
      },
      validate: () => {
        if (!State.getDecision("consume", 11, "s11_choice")) return { ok: false, message: "Pick an operational posture first." };
        if (!State.getDecision("consume", 11, "warehouse_initialized")) return { ok: false, message: "Initialize the warehouse before completing the journey." };
        return { ok: true };
      }
    },
    postRender: () => {
      UI.renderChoiceState({
        journey: "consume", stationNum: 11, decisionKey: "s11_choice",
        choicesRootId: "s11-choices", feedbackId: "s11-feedback",
        correctValue: "continuous-with-trends",
        correctHtml: "Correct. Trend signals catch drift before snapshots do. A producer whose must-support coverage drops from 95% to 87% over six weeks is telling you something a single snapshot (87% looks fine) hides. The same applies to quarantine sizes, unrecognized-extension URLs, and per-producer pass rates. Ongoing operational health is a longitudinal signal.",
        incorrectHtml: "Snapshots miss drift; blocking on any deviation refuses legitimate growth. The right answer is longitudinal. Try again or reveal."
      });
      // After render, hydrate the warehouse if it has been initialized
      if (State.getDecision("consume", 11, "warehouse_initialized")) {
        // Update row count display if the warehouse is live
        if (window.__cascadeWarehouseDb) {
          const counts = ["dim_patient", "fact_condition", "fact_medication_request", "quarantine_log"]
            .map(t => {
              try {
                const r = window.__cascadeWarehouseDb.exec(`SELECT COUNT(*) FROM ${t}`);
                return `${t}: ${r[0].values[0][0]}`;
              } catch (e) { return `${t}: ?`; }
            }).join(" · ");
          const el = document.getElementById("sqljs-row-counts");
          if (el) el.innerHTML = "  " + counts;
        }
      }
    }
  }
];

/* Station scaffolder — minimal valid station for Phase 2 fill-in */
function scaffoldStation(number, title, overview) {
  return {
    number,
    title,
    lecture: () => `
      <p><strong>Station ${number} — ${title}.</strong></p>
      <p>${overview}</p>
      <div class="hint-box small">
        <strong>Phase 1 scaffold.</strong> This station's full lecture, before/after payloads, and decision task are reserved for Phase 2 authoring. The framework wiring (state persistence, navigation, reveal/hint plumbing, cross-reference eligibility) is already in place — Phase 2 only needs to fill the <code>lecture()</code>, <code>beforeAfter</code>, and <code>task</code> fields in <code>js/consume-stations.js</code>.
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

/* ===== Station 1 interaction handlers ===== */
window.handleS1Choice = function(v) {
  State.setDecision("consume", 1, "s1_choice", v);
  Runtime.renderAll();
};

window.runS1Fetch = function() {
  State.setDecision("consume", 1, "metadata_fetched", true);
  Runtime.renderAll();
};

/* ===== Station 2 interaction handlers ===== */
window.handleS2Choice = function(v) {
  State.setDecision("consume", 2, "s2_choice", v);
  const scopeMap = {
    "wildcard":         "system/*.rs",
    "enumerated":       "system/Patient.rs system/Condition.rs system/MedicationRequest.rs system/Observation.rs system/Immunization.rs system/AllergyIntolerance.rs system/Procedure.rs system/Encounter.rs",
    "read-only-single": "system/*.r",
    "patient-scoped":   "patient/*.rs"
  };
  State.setDecision("consume", 2, "scope_chosen", scopeMap[v]);
  Runtime.renderAll();  // postRender restores CSS class + feedback from state
};

window.runS2Token = function() {
  if (!State.getDecision("consume", 2, "scope_chosen")) {
    alert("Pick a scope strategy first.");
    return;
  }
  State.setDecision("consume", 2, "token_granted", true);
  Runtime.renderAll();
};

/* ===== Station 3 interaction handlers ===== */
window.handleS3Choice = function(v) {
  State.setDecision("consume", 3, "s3_choice", v);
  Runtime.renderAll();
};

window.runS3Search = function() {
  if (!State.getDecision("consume", 3, "s3_choice")) {
    alert("Pick a retrieval strategy first.");
    return;
  }
  State.setDecision("consume", 3, "search_done", true);
  Runtime.renderAll();
};

/* ===== Station 4 interaction handlers ===== */
window.handleS4Choice = function(v) {
  State.setDecision("consume", 4, "s4_choice", v);
  Runtime.renderAll();
};

window.runS4Export = function() {
  if (!State.getDecision("consume", 4, "s4_choice")) {
    alert("Pick a polling strategy first.");
    return;
  }
  const stage = State.getDecision("consume", 4, "export_stage") || "idle";
  if (stage === "idle") {
    State.setDecision("consume", 4, "export_stage", "polling");
  } else if (stage === "polling") {
    State.setDecision("consume", 4, "export_stage", "complete");
  }
  Runtime.renderAll();
};

/* ===== Station 5 interaction handlers ===== */
window.handleS5Choice = function(v) {
  State.setDecision("consume", 5, "s5_choice", v);
  Runtime.renderAll();
};

window.runS5Resolve = function() {
  if (!State.getDecision("consume", 5, "s5_choice")) {
    alert("Pick a resolution strategy first.");
    return;
  }
  State.setDecision("consume", 5, "resolution_done", true);
  Runtime.renderAll();
};

/* ===== Station 6 interaction handlers ===== */
window.handleS6Choice = function(v) {
  State.setDecision("consume", 6, "s6_choice", v);
  Runtime.renderAll();
};

window.runS6Validate = function() {
  if (!State.getDecision("consume", 6, "s6_choice")) {
    alert("Pick a quarantine policy first.");
    return;
  }
  State.setDecision("consume", 6, "validation_ran", true);
  Runtime.renderAll();
};

/* ===== Station 7 interaction handlers ===== */
window.handleS7Choice = function(v) {
  State.setDecision("consume", 7, "s7_choice", v);
  Runtime.renderAll();
};

window.runS7Checks = function() {
  if (!State.getDecision("consume", 7, "s7_choice")) {
    alert("Pick a check ordering first.");
    return;
  }
  State.setDecision("consume", 7, "checks_ran", true);
  Runtime.renderAll();
};

/* ===== Station 8 interaction handlers ===== */
window.handleS8Choice = function(v) {
  State.setDecision("consume", 8, "s8_choice", v);
  Runtime.renderAll();
};

window.runS8Process = function() {
  if (!State.getDecision("consume", 8, "s8_choice")) {
    alert("Pick a policy first.");
    return;
  }
  State.setDecision("consume", 8, "extensions_processed", true);
  Runtime.renderAll();
};

/* ===== Station 9 interaction handlers ===== */
window.handleS9Choice = function(v) {
  State.setDecision("consume", 9, "s9_choice", v);
  Runtime.renderAll();
};

window.runS9Reconcile = function() {
  if (!State.getDecision("consume", 9, "s9_choice")) {
    alert("Pick a reconciliation policy first.");
    return;
  }
  State.setDecision("consume", 9, "reconciliation_done", true);
  Runtime.renderAll();
};

/* ===== Station 10 interaction handlers ===== */
window.handleS10Choice = function(v) {
  State.setDecision("consume", 10, "s10_choice", v);
  Runtime.renderAll();
};

window.runS10Flatten = function() {
  if (!State.getDecision("consume", 10, "s10_choice")) {
    alert("Pick a flattening strategy first.");
    return;
  }
  State.setDecision("consume", 10, "flattening_done", true);
  Runtime.renderAll();
};

/* ===== Station 11 interaction handlers ===== */
window.handleS11Choice = function(v) {
  State.setDecision("consume", 11, "s11_choice", v);
  Runtime.renderAll();
};

/* ----- sql.js bootstrap and warehouse seeding ----- */
async function loadSqlJs() {
  if (window.__sqlJsLoaded) return window.__sqlJsLoaded;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js";
    script.onload = async () => {
      try {
        const SQL = await window.initSqlJs({
          locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}`
        });
        window.__sqlJsLoaded = SQL;
        resolve(SQL);
      } catch (e) { reject(e); }
    };
    script.onerror = () => reject(new Error("Failed to load sql.js from CDN"));
    document.head.appendChild(script);
  });
}

function seedCascadeWarehouse(db) {
  // DDL — six tables matching the lecture
  db.run(`
    CREATE TABLE dim_patient (
      patient_key INTEGER PRIMARY KEY,
      mrn TEXT NOT NULL UNIQUE,
      family_name TEXT,
      given_names TEXT,
      birth_date TEXT,
      gender TEXT,
      race_omb TEXT,
      race_text TEXT,
      ethnicity_omb TEXT,
      birth_sex TEXT,
      potential_duplicate_flag INTEGER DEFAULT 0
    );

    CREATE TABLE patient_name_xref (
      xref_id INTEGER PRIMARY KEY,
      patient_key INTEGER NOT NULL,
      name_use TEXT,
      family TEXT,
      given TEXT,
      FOREIGN KEY (patient_key) REFERENCES dim_patient(patient_key)
    );

    CREATE TABLE fact_condition (
      condition_key INTEGER PRIMARY KEY,
      patient_key INTEGER NOT NULL,
      icd10_code TEXT,
      icd10_display TEXT,
      snomed_code TEXT,
      snomed_display TEXT,
      onset_date TEXT,
      clinical_status TEXT,
      verification_status TEXT,
      FOREIGN KEY (patient_key) REFERENCES dim_patient(patient_key)
    );

    CREATE TABLE condition_coding_xref (
      xref_id INTEGER PRIMARY KEY,
      condition_key INTEGER NOT NULL,
      code_system TEXT,
      code TEXT,
      display TEXT,
      FOREIGN KEY (condition_key) REFERENCES fact_condition(condition_key)
    );

    CREATE TABLE fact_medication_request (
      med_req_key INTEGER PRIMARY KEY,
      patient_key INTEGER NOT NULL,
      rxnorm_code TEXT,
      medication_display TEXT,
      status TEXT,
      authored_date TEXT,
      FOREIGN KEY (patient_key) REFERENCES dim_patient(patient_key)
    );

    CREATE TABLE quarantine_log (
      quarantine_id INTEGER PRIMARY KEY,
      source_resource_type TEXT,
      source_resource_id TEXT,
      patient_mrn TEXT,
      reason TEXT,
      stage TEXT,
      logged_at TEXT
    );
  `);

  // Seed dim_patient — 5 patients from the cohort
  db.run(`
    INSERT INTO dim_patient (patient_key, mrn, family_name, given_names, birth_date, gender, race_omb, race_text, ethnicity_omb, birth_sex, potential_duplicate_flag) VALUES
    (1, 'CRH-10001', 'Gonzalez',   'Maria',  '1963-04-12', 'female', '2106-3', 'White',  '2186-5', 'F', 1),
    (2, 'CRH-10002', 'Kowalski',   'Robert', '1954-08-30', 'male',   '2106-3', 'White',  '2186-5', 'M', 0),
    (3, 'CRH-10003', 'Washington', 'Jamal',  '1980-11-15', 'male',   '2054-5', 'Black or African American', '2186-5', 'M', 0),
    (4, 'CRH-10004', 'Chen',       'Emily',  '1991-06-22', 'female', '2028-9', 'Asian',  '2186-5', 'F', 0),
    (5, 'CRH-10005', 'Gonzales',   'Maria',  '1965-04-12', 'female', '2106-3', 'White',  '2186-5', 'F', 1);
  `);

  // patient_name_xref — P003 has 3 names; others have 1
  db.run(`
    INSERT INTO patient_name_xref (xref_id, patient_key, name_use, family, given) VALUES
    (1, 1, 'official', 'Gonzalez', 'Maria'),
    (2, 2, 'official', 'Kowalski', 'Robert'),
    (3, 3, 'official', 'Washington', 'Jamal'),
    (4, 3, 'old',      'Smith',      'Jamal'),
    (5, 3, 'nickname', NULL,         'JW'),
    (6, 4, 'official', 'Chen',       'Emily'),
    (7, 5, 'official', 'Gonzales',   'Maria');
  `);

  // fact_condition
  db.run(`
    INSERT INTO fact_condition (condition_key, patient_key, icd10_code, icd10_display, snomed_code, snomed_display, onset_date, clinical_status, verification_status) VALUES
    (1, 1, 'E11.9',  'Type 2 diabetes mellitus without complications', '44054006',  'Diabetes mellitus type 2', '2018-03-10', 'active', 'confirmed'),
    (2, 1, 'I10',    'Essential (primary) hypertension',               '59621000',  'Essential hypertension',   '2019-07-22', 'active', 'confirmed'),
    (3, 2, 'I50.9',  'Heart failure, unspecified',                     '84114007',  'Heart failure',            '2022-01-15', 'active', 'confirmed'),
    (4, 2, 'I48.91', 'Unspecified atrial fibrillation',                '49436004',  'Atrial fibrillation',      '2020-08-05', 'active', 'confirmed'),
    (5, 3, 'F33.1',  'Major depressive disorder, recurrent, moderate', '66344007',  'Recurrent major depression','2015-02-18','active', 'confirmed'),
    (6, 3, 'F11.21', 'Opioid dependence, in remission',                '90734009',  'Opioid use disorder, in remission', '2019-11-30', 'active', 'confirmed'),
    (7, 4, NULL,     NULL, NULL, NULL, NULL, NULL, NULL),
    (8, 5, 'E11.9',  'Type 2 diabetes mellitus without complications', '44054006',  'Diabetes mellitus type 2', '2020-09-03', 'active', 'confirmed');
  `);

  // condition_coding_xref — P002 afib has dual coding (S7 outcome)
  db.run(`
    INSERT INTO condition_coding_xref (xref_id, condition_key, code_system, code, display) VALUES
    (1, 1, 'icd-10-cm',     'E11.9',  'Type 2 diabetes mellitus without complications'),
    (2, 1, 'snomed-ct',     '44054006','Diabetes mellitus type 2'),
    (3, 2, 'icd-10-cm',     'I10',    'Essential (primary) hypertension'),
    (4, 3, 'icd-10-cm',     'I50.9',  'Heart failure, unspecified'),
    (5, 4, 'icd-10-cm',     'I48.91', 'Unspecified atrial fibrillation'),
    (6, 4, 'icd-9-cm',      '427.31', 'Atrial fibrillation'),
    (7, 5, 'icd-10-cm',     'F33.1',  'Major depressive disorder, recurrent, moderate'),
    (8, 6, 'icd-10-cm',     'F11.21', 'Opioid dependence, in remission'),
    (9, 8, 'icd-10-cm',     'E11.9',  'Type 2 diabetes mellitus without complications');
  `);

  // fact_medication_request
  db.run(`
    INSERT INTO fact_medication_request (med_req_key, patient_key, rxnorm_code, medication_display, status, authored_date) VALUES
    (1, 1, '860975', 'Metformin 500 MG Oral Tablet',          'active', '2026-04-08'),
    (2, 1, '314076', 'Lisinopril 10 MG Oral Tablet',          'active', '2026-04-08'),
    (3, 2, '310429', 'Furosemide 40 MG Oral Tablet',          'active', '2026-04-09'),
    (4, 2, '855332', 'Warfarin Sodium 5 MG Oral Tablet',      'active', '2026-04-09'),
    (5, 2, '866412', 'Metoprolol Tartrate 50 MG Oral Tablet', 'active', '2026-04-09'),
    (6, 3, '316049', 'Sertraline 100 MG Oral Tablet',         'active', '2026-04-10'),
    (7, 5, '861007', 'Metformin 1000 MG Oral Tablet',         'active', '2026-04-11');
  `);

  // quarantine_log — tied to decisions made on prior stations
  db.run(`
    INSERT INTO quarantine_log (quarantine_id, source_resource_type, source_resource_id, patient_mrn, reason, stage, logged_at) VALUES
    (1, 'MedicationRequest', 'medreq-p003-bup', 'CRH-10003', 'RxNorm code 1250000 does not exist; no translation possible', 'S7-binding-checks',     '2026-04-14T09:30:00Z'),
    (2, 'Patient',           'p005',            'CRH-10005', 'Possible duplicate of P001 (Maria Gonzalez); flagged for steward review', 'S9-reconciliation',     '2026-04-14T09:32:00Z'),
    (3, 'MedicationRequest', 'medreq-p002-lis', 'CRH-10002', 'Active dose conflict: 10 MG cardiologist order vs 20 MG PCP order — clinical reviewer required', 'S9-reconciliation', '2026-04-14T09:32:00Z');
  `);
}

window.runS11Init = async function() {
  if (State.getDecision("consume", 11, "warehouse_initialized")) return;
  if (!State.getDecision("consume", 11, "s11_choice")) {
    alert("Pick an operational posture first.");
    return;
  }
  const btn = event && event.target;
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Loading sql.js..."; }
  try {
    const SQL = await loadSqlJs();
    const db = new SQL.Database();
    seedCascadeWarehouse(db);
    window.__cascadeWarehouseDb = db;
    State.setDecision("consume", 11, "warehouse_initialized", true);
    Runtime.renderAll();
  } catch (e) {
    alert("Warehouse initialization failed: " + e.message + "\n\nIf you're running offline (file://), sql.js needs network access to load its WebAssembly binary. Try running the lab via a local server.");
    if (btn) { btn.disabled = false; btn.textContent = "▶ Initialize warehouse (loads sql.js)"; }
  }
};

function s11RenderQueryResult(sql, output) {
  const out = document.getElementById("s11-query-output");
  if (!out) return;
  if (output.error) {
    out.innerHTML = `<div class="hint-box"><strong>Error:</strong> ${output.error}</div>`;
    return;
  }
  if (!output.results || output.results.length === 0) {
    out.innerHTML = `<div class="explanation-box">Query executed; no rows returned.</div>`;
    return;
  }
  let html = `<div style="font-size: 11px; color: #5a6878; margin-bottom: 6px;">SQL: <code>${sql.replace(/</g,"&lt;").substring(0, 200)}${sql.length > 200 ? "..." : ""}</code></div>`;
  for (const r of output.results) {
    html += `<div style="overflow-x: auto; margin-bottom: 10px;"><table style="border-collapse: collapse; font-size: 11px; font-family: monospace;">`;
    html += `<thead><tr style="background: #1e6670; color: #fff;">`;
    for (const c of r.columns) html += `<th style="padding: 6px 10px; text-align: left; border: 1px solid #2a7a8a;">${c}</th>`;
    html += `</tr></thead><tbody>`;
    for (const row of r.values) {
      html += `<tr>`;
      for (const v of row) html += `<td style="padding: 4px 10px; border: 1px solid #c8cfd6; background: #fff;">${v === null ? '<span style="color:#999;">NULL</span>' : String(v)}</td>`;
      html += `</tr>`;
    }
    html += `</tbody></table><div style="font-size: 10px; color: #5a6878; margin-top: 4px;">${r.values.length} row${r.values.length === 1 ? "" : "s"}</div></div>`;
  }
  out.innerHTML = html;
}

const SUGGESTED_QUERIES = {
  roster:     "SELECT mrn, family_name, given_names, birth_date, gender, potential_duplicate_flag FROM dim_patient ORDER BY mrn;",
  diabetic:   `SELECT p.mrn, p.family_name, p.given_names, c.icd10_code, c.icd10_display, c.onset_date
FROM dim_patient p
JOIN fact_condition c ON c.patient_key = p.patient_key
WHERE c.icd10_code = 'E11.9'
ORDER BY c.onset_date DESC;`,
  dual_coded: `SELECT p.mrn, p.family_name, x.code_system, x.code, x.display
FROM dim_patient p
JOIN fact_condition c   ON c.patient_key   = p.patient_key
JOIN condition_coding_xref x ON x.condition_key = c.condition_key
WHERE p.mrn = 'CRH-10002' AND c.icd10_code = 'I48.91'
ORDER BY x.code_system;`,
  quarantine: "SELECT source_resource_type, patient_mrn, stage, reason FROM quarantine_log ORDER BY logged_at;"
};

window.runS11SuggestedQuery = function(key) {
  const sql = SUGGESTED_QUERIES[key];
  if (!sql) return;
  runS11Sql(sql);
};

window.runS11CustomQuery = function() {
  const ta = document.getElementById("s11-sql-input");
  const sql = (ta && ta.value || "").trim();
  if (!sql) { alert("Enter a SQL query first."); return; }
  runS11Sql(sql);
};

function runS11Sql(sql) {
  const db = window.__cascadeWarehouseDb;
  if (!db) { alert("Warehouse not initialized."); return; }
  try {
    const results = db.exec(sql);
    s11RenderQueryResult(sql, { results });
  } catch (e) {
    s11RenderQueryResult(sql, { error: e.message });
  }
}

window.CONSUME_STATIONS = CONSUME_STATIONS;
