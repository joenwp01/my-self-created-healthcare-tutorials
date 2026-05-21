/* ============================================================
   Shared UI Primitives
   - JSON/XML/Python syntax highlighting (lightweight)
   - Station rendering helpers
   - Reveal, hint, and explanation box helpers
   - Animation orchestration
   ============================================================ */

/* ===== Lightweight JSON highlighter ===== */
function highlightJson(str) {
  if (typeof str !== "string") str = JSON.stringify(str, null, 2);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="pc-fn">$1</span>$2')
    .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="pc-string">$1</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="pc-keyword">$1</span>')
    .replace(/(\b\d+\.?\d*\b)/g, '<span class="pc-num">$1</span>');
}

/* ===== Lightweight XML highlighter ===== */
function highlightXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/(\&lt;\/?)([\w:-]+)/g, '$1<span class="pc-fn">$2</span>')
    .replace(/([\w:-]+)=(&quot;|")([^"&]*)(&quot;|")/g, '<span class="pc-keyword">$1</span>=<span class="pc-string">"$3"</span>')
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="pc-comment">$1</span>');
}

/* ===== Python highlighter (minimal) ===== */
function highlightPython(str) {
  str = str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const kw = /\b(def|class|import|from|return|if|elif|else|for|while|in|is|not|and|or|None|True|False|with|as|try|except|raise|pass|yield|lambda|async|await)\b/g;
  return str
    .replace(kw, '<span class="pc-keyword">$1</span>')
    .replace(/(#[^\n]*)/g, '<span class="pc-comment">$1</span>')
    .replace(/("(?:[^"\\]|\\.)*")/g, '<span class="pc-string">$1</span>')
    .replace(/('(?:[^'\\]|\\.)*')/g, '<span class="pc-string">$1</span>');
}

/* ===== Station UI helpers ===== */

function renderStationHeader(journeyId, station, totalStations) {
  return `
    <section class="station-header">
      <div class="station-accent-strip"></div>
      <div class="station-header-body">
        <div class="station-meta">
          <div class="station-number">Station ${station.number} of ${totalStations} · ${journeyId.toUpperCase()}</div>
          <h2>${station.title}</h2>
        </div>
        <div class="progress-indicator">
          ${State.get().journeys[journeyId].completedStations.length} / ${totalStations} complete
        </div>
      </div>
    </section>
  `;
}

function renderHint(text) {
  return `<div class="hint-box fade-in"><strong>Hint:</strong> ${text}</div>`;
}

function renderReveal(text) {
  return `<div class="reveal-box fade-in"><strong>Answer:</strong> ${text}</div>`;
}

function renderExplanation(text) {
  return `<div class="explanation-box fade-in">${text}</div>`;
}

/* ===== Cross-reference helper =====
   When rendering station lecture content, callers wrap cross-references
   like this:
     xref("consume", "produce", 5, "...you saw profile validation from the producer side...")
   If the referenced journey is not complete, the callout renders empty
   (silent omission).
*/
function xref(fromJourney, toJourney, stationNumber, calloutHtml) {
  if (State.canShowCrossRef(fromJourney, toJourney)) {
    return `<div class="explanation-box fade-in small">
      <strong>Cross-reference — ${toJourney.charAt(0).toUpperCase()+toJourney.slice(1)} Station ${stationNumber}:</strong>
      ${calloutHtml}
    </div>`;
  }
  return "";
}

/* ===== Patient lane rendering ===== */
function renderLanes(activePatientId, onClick) {
  return `
    <div class="lanes">
      ${COHORT.map(p => `
        <div class="lane ${p.id === activePatientId ? "active" : ""}"
             data-patient="${p.id}"
             onclick="${onClick}('${p.id}')">
          <div class="lane-id">${p.id}</div>
          <div class="lane-name">${p.name}</div>
          <div class="lane-status">${p.age}y · ${p.sex}</div>
        </div>
      `).join("")}
    </div>
  `;
}

/* ===== Animation helpers ===== */
function staggerReveal(selector, delayMs = 80) {
  const items = document.querySelectorAll(selector);
  items.forEach((el, i) => {
    el.style.animation = "none";
    el.offsetHeight; // reflow
    el.style.animation = `fadeIn 0.35s ease-out ${i * delayMs}ms both`;
  });
}

/* Draw an arrow between two DOM elements (for reference resolution viz) */
function drawRefArrow(svg, fromEl, toEl, containerEl) {
  const cRect = containerEl.getBoundingClientRect();
  const fRect = fromEl.getBoundingClientRect();
  const tRect = toEl.getBoundingClientRect();
  const x1 = fRect.right - cRect.left;
  const y1 = fRect.top + fRect.height/2 - cRect.top;
  const x2 = tRect.left - cRect.left;
  const y2 = tRect.top + tRect.height/2 - cRect.top;
  const mx = (x1 + x2) / 2;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`);
  path.setAttribute("class", "ref-arrow");
  svg.appendChild(path);
}

/* Expose */
window.UI = {
  highlightJson, highlightXml, highlightPython,
  renderStationHeader, renderHint, renderReveal, renderExplanation,
  xref, renderLanes, staggerReveal, drawRefArrow,
  renderChoiceState
};

/* ===== Choice feedback restoration =====
   Called from a station's postRender to re-apply the choice card's
   correct/incorrect CSS class AND re-render the feedback box from the
   stored decision. This exists because Runtime.renderAll() regenerates
   the entire station DOM on every re-render — handlers can no longer
   persist feedback by writing innerHTML directly; it must come from
   state on every render cycle.
*/
function renderChoiceState(opts) {
  const { journey, stationNum, decisionKey, choicesRootId, feedbackId,
          correctValue, correctHtml, incorrectHtml } = opts;
  const prior = State.getDecision(journey, stationNum, decisionKey);
  if (!prior) return;
  const el = document.querySelector(`#${choicesRootId} [data-v="${prior}"]`);
  const correct = prior === correctValue;
  if (el) {
    el.classList.remove("correct","incorrect");
    el.classList.add(correct ? "correct" : "incorrect");
  }
  const fb = document.getElementById(feedbackId);
  if (fb) {
    fb.innerHTML = correct
      ? renderExplanation(correctHtml)
      : `<div class="hint-box fade-in">${incorrectHtml}</div>`;
  }
}
