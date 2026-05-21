/* ============================================================
   Journey Selector (Start Screen)
   - Soft gate: both journeys visible; selecting one locks the other
   - Reset button only on the locked (in-progress) card
   - Completion badges persist across resets
   ============================================================ */

function renderSelector() {
  const s = State.get();
  const locked = State.getLockedJourney();

  const consumeCard = renderJourneyCard({
    id: "consume",
    title: "Journey 1 — Consume",
    subtitle: "Download & Transform",
    tagline: "Pull FHIR data from an external source. Resolve references. Validate profiles. Land it in a US Core-conformant warehouse.",
    stationCount: 11,
    terminal: "US Core-conformant warehouse row",
    accentColor: "#52B2BF",
    completed: s.completed.consume,
    completedAt: s.completedAt.consume,
    active: s.activeJourney === "consume",
    locked: locked === "consume"
  });

  const produceCard = renderJourneyCard({
    id: "produce",
    title: "Journey 2 — Produce",
    subtitle: "Prepare & Upload",
    tagline: "Take operational data. Shape it to US Core. Validate locally. Submit a transaction Bundle and handle the server's response.",
    stationCount: 11,
    terminal: "Accepted transaction Bundle POST",
    accentColor: "#4a90c2",
    completed: s.completed.produce,
    completedAt: s.completedAt.produce,
    active: s.activeJourney === "produce",
    locked: locked === "produce"
  });

  return `
    <div class="selector-intro">
      <h2>Choose a journey</h2>
      <p class="muted">
        FHIR work splits into two practices: consuming data you don't control, and producing data someone else will judge.
        This lab treats them as separate journeys. Complete one before switching to the other.
        Cross-references between journeys unlock after the referenced journey is completed.
      </p>
    </div>
    <div class="journey-cards">
      ${consumeCard}
      ${produceCard}
    </div>
    ${
      (s.completed.consume && s.completed.produce)
        ? `<div class="both-complete fade-in">
             <strong>🎓 Both journeys complete.</strong>
             You've seen the FHIR pipeline from both ends. Replay either journey to explore with cross-references active.
           </div>`
        : ""
    }
  `;
}

function renderJourneyCard(opts) {
  const { id, title, subtitle, tagline, stationCount, terminal,
          accentColor, completed, completedAt, active, locked } = opts;

  // Determine state label and available actions
  let stateBadge = "";
  let actions = "";

  if (locked) {
    // Locked — other journey is in progress
    stateBadge = `<span class="badge locked">Locked</span>`;
    // Per spec: reset ONLY on the locked one (if it has progress to reset)
    const hasProgress = State.get().journeys[id].completedStations.length > 0 ||
                        Object.keys(State.get().journeys[id].decisions).length > 0;
    if (hasProgress) {
      actions = `
        <button class="btn danger" onclick="confirmReset('${id}')">Reset ${subtitle}</button>
        <p class="small muted">Wipes partial progress. Completion badge (if earned) is kept.</p>
      `;
    } else {
      actions = `<p class="small muted">Complete the active journey, or exit it, to begin this one.</p>`;
    }
  } else if (active) {
    stateBadge = `<span class="badge in-progress">In progress</span>`;
    actions = `
      <a class="btn primary" href="${id}.html">Resume journey</a>
      <button class="btn ghost" onclick="confirmExit('${id}')">Exit journey</button>
    `;
  } else if (completed) {
    const when = completedAt ? new Date(completedAt).toLocaleDateString() : "";
    stateBadge = `<span class="badge completed">✓ Completed${when ? " · " + when : ""}</span>`;
    actions = `
      <a class="btn primary" href="${id}.html">Replay journey</a>
      <button class="btn ghost" onclick="confirmReplayReset('${id}')">Reset & replay</button>
    `;
  } else {
    // Never-started and available
    stateBadge = `<span class="badge available">Available</span>`;
    actions = `<a class="btn primary" href="${id}.html">Begin journey</a>`;
  }

  const lockedClass = locked ? "locked" : "";
  const activeClass = active ? "active-journey" : "";

  return `
    <div class="journey-card ${lockedClass} ${activeClass}"
         style="--jc-accent: ${accentColor};">
      <div class="jc-strip"></div>
      <div class="jc-body">
        <div class="jc-head">
          <div>
            <h3>${title}</h3>
            <p class="jc-subtitle">${subtitle}</p>
          </div>
          ${stateBadge}
        </div>
        <p class="jc-tagline">${tagline}</p>
        <dl class="jc-meta">
          <dt>Stations</dt><dd>${stationCount}</dd>
          <dt>Terminal goal</dt><dd>${terminal}</dd>
        </dl>
        <div class="jc-actions">${actions}</div>
        ${locked ? `<div class="jc-lock-overlay"><span>🔒 Complete active journey to unlock</span></div>` : ""}
      </div>
    </div>
  `;
}

/* ===== Action handlers ===== */

function confirmReset(journeyId) {
  const name = journeyId === "consume" ? "Consume" : "Produce";
  const ok = confirm(`Reset the ${name} journey? This wipes all partial progress (decisions, reveals, hints, current station). Any earned completion badge is preserved. This cannot be undone.`);
  if (!ok) return;
  State.resetJourney(journeyId);
  mount();
}

function confirmReplayReset(journeyId) {
  const name = journeyId === "consume" ? "Consume" : "Produce";
  const ok = confirm(`Reset ${name} journey state for a fresh replay? The completion badge stays. Current replay progress (if any) is lost.`);
  if (!ok) return;
  State.resetJourney(journeyId);
  mount();
}

function confirmExit(journeyId) {
  const name = journeyId === "consume" ? "Consume" : "Produce";
  const ok = confirm(`Exit the ${name} journey? Progress is kept (you can resume later), but the other journey will unlock.`);
  if (!ok) return;
  State.exitJourney();
  mount();
}

function mount() {
  const root = document.getElementById("selector-root");
  if (root) root.innerHTML = renderSelector();
}

document.addEventListener("DOMContentLoaded", () => {
  State.load();
  mount();
});

window.confirmReset = confirmReset;
window.confirmReplayReset = confirmReplayReset;
window.confirmExit = confirmExit;
