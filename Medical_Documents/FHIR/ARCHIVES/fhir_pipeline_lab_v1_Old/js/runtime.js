/* ============================================================
   Station Runtime Engine
   Shared orchestration logic used by both consume.html and produce.html.
   Individual station definitions live in consume-stations.js and
   produce-stations.js.
   ============================================================ */

const Runtime = {
  journeyId: null,         // "consume" | "produce"
  stations: null,          // array of station definitions
  currentIndex: 0,

  init(journeyId, stations) {
    this.journeyId = journeyId;
    this.stations = stations;
    State.load();
    State.startJourney(journeyId);

    // Resume at last station
    const saved = State.get().journeys[journeyId].currentStation;
    this.currentIndex = Math.max(0, Math.min(saved - 1, stations.length - 1));

    this.renderAll();
    this.renderStationIndicators();
  },

  get currentStation() {
    return this.stations[this.currentIndex];
  },

  renderAll() {
    const s = this.currentStation;
    if (!s) return;

    State.setStation(this.journeyId, s.number);

    const root = document.getElementById("station-root");
    if (!root) return;

    root.innerHTML = `
      ${UI.renderStationHeader(this.journeyId, s, this.stations.length)}
      <section class="lecture">${s.lecture()}</section>
      ${s.beforeAfter ? `
        <section class="ba-grid">
          <div class="panel before-panel">
            <h3>Before</h3>
            <div id="before-content">${s.beforeAfter.before()}</div>
          </div>
          <div class="panel after-panel">
            <h3>After</h3>
            <div id="after-content">${s.beforeAfter.after()}</div>
          </div>
        </section>
      ` : ""}
      ${s.task ? `<section class="task-panel">${s.task.render()}</section>` : ""}
      <section class="action-bar">
        ${this.renderActionBar()}
      </section>
    `;

    // Call any post-render hook (e.g. to draw animations)
    if (s.postRender) s.postRender();

    this.renderStationIndicators();
    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  renderActionBar() {
    const s = this.currentStation;
    const isComplete = State.isStationComplete(this.journeyId, s.number);
    const hintUsed = State.isHintUsed(this.journeyId, s.number);

    return `
      <button class="btn journey-ghost"
              ${this.currentIndex === 0 ? "disabled" : ""}
              onclick="Runtime.prev()">← Previous station</button>

      ${s.task && s.task.hint ? `
        <button class="btn ghost" onclick="Runtime.showHint()">
          💡 ${hintUsed ? "Hint (shown)" : "Show hint"}
        </button>
      ` : ""}

      ${s.task && s.task.reveal ? `
        <button class="btn ghost" onclick="Runtime.reveal()">
          🔑 Reveal answer
        </button>
      ` : ""}

      <div class="spacer"></div>

      ${isComplete ? `<span class="badge completed">✓ Station complete</span>` : ""}

      <button class="btn journey-primary"
              ${this.currentIndex === this.stations.length - 1 && !isComplete ? "" : ""}
              onclick="Runtime.completeAndAdvance()">
        ${this.currentIndex === this.stations.length - 1
          ? (isComplete ? "Finish journey →" : "Complete station →")
          : "Next station →"}
      </button>
    `;
  },

  renderStationIndicators() {
    const sidebar = document.getElementById("station-indicators");
    if (!sidebar) return;
    sidebar.innerHTML = this.stations.map((s, i) => {
      const completed = State.isStationComplete(this.journeyId, s.number);
      const current = i === this.currentIndex;
      const cls = current ? "current" : (completed ? "completed" : "");
      return `<div class="station-indicator ${cls}" title="${s.title}"
                   onclick="Runtime.goto(${i})">${s.number}</div>`;
    }).join("");
  },

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.renderAll();
    }
  },

  next() {
    if (this.currentIndex < this.stations.length - 1) {
      this.currentIndex++;
      this.renderAll();
    }
  },

  goto(i) {
    if (i >= 0 && i < this.stations.length) {
      this.currentIndex = i;
      this.renderAll();
    }
  },

  completeAndAdvance() {
    const s = this.currentStation;
    // Validate: if task has a requirement, check it
    if (s.task && s.task.validate) {
      const result = s.task.validate();
      if (!result.ok) {
        alert(result.message || "Please complete the task on this station first.");
        return;
      }
    }
    State.completeStation(this.journeyId, s.number);

    // Last station? Mark journey complete
    if (this.currentIndex === this.stations.length - 1) {
      State.completeJourney(this.journeyId);
      this.renderCompletion();
      return;
    }
    this.next();
  },

  showHint() {
    const s = this.currentStation;
    if (!s.task || !s.task.hint) return;
    State.markHint(this.journeyId, s.number);
    const box = document.getElementById("hint-area");
    if (box) box.innerHTML = UI.renderHint(s.task.hint);
    this.renderAll(); // refresh to update button state
  },

  reveal() {
    const s = this.currentStation;
    if (!s.task || !s.task.reveal) return;
    s.task.reveal();
    State.markReveal(this.journeyId, s.number, "answer");
    this.renderAll();
  },

  renderCompletion() {
    const root = document.getElementById("station-root");
    if (!root) return;
    const journeyName = this.journeyId === "consume" ? "Consume" : "Produce";
    const other = this.journeyId === "consume" ? "Produce" : "Consume";
    const otherComplete = State.get().completed[this.journeyId === "consume" ? "produce" : "consume"];

    root.innerHTML = `
      <div class="journey-complete-banner">
        <h2>🎉 Journey Complete — ${journeyName}</h2>
        <p>You've reached the terminal station. ${
          this.journeyId === "consume"
            ? "The US Core-conformant warehouse is populated and queryable."
            : "The transaction Bundle was accepted; all resources have server-assigned IDs."
        }</p>
      </div>
      <div class="panel">
        <h2>What's next</h2>
        <p>${
          otherComplete
            ? "Both journeys are complete. You've seen the FHIR pipeline end-to-end from both ends. Cross-references are now active on replays of either journey."
            : `The ${other} journey is now available. Cross-references from ${other} back to points in ${journeyName} will unlock automatically as you encounter them.`
        }</p>
        <div style="margin-top: 16px;">
          <a class="btn primary" href="fhir_pipeline_lab_v1.html">Return to journey selector</a>
        </div>
      </div>
    `;
    this.renderStationIndicators();
  }
};

window.Runtime = Runtime;
