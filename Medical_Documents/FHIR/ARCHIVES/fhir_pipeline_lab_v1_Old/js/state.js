/* ============================================================
   FHIR Pipeline Lab — State Management
   Persists to localStorage. Tracks per-journey progress and
   completion badges that survive resets.
   ============================================================ */

const STORAGE_KEY = "fhir_pipeline_lab_v1_state";

/* Default state shape */
const DEFAULT_STATE = {
  version: 1,
  activeJourney: null,          // "consume" | "produce" | null
  completed: {                  // Permanent unlocks (survive resets)
    consume: false,
    produce: false
  },
  completedAt: {                // ISO timestamps
    consume: null,
    produce: null
  },
  journeys: {
    consume: {
      currentStation: 1,
      decisions: {},            // keyed by station id
      reveals: {},              // which reveals consumed per station
      hintsUsed: {},            // which hints consumed per station
      completedStations: []
    },
    produce: {
      currentStation: 1,
      decisions: {},
      reveals: {},
      hintsUsed: {},
      completedStations: []
    }
  }
};

const State = {
  _data: null,

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this._data = JSON.parse(JSON.stringify(DEFAULT_STATE));
      } else {
        const parsed = JSON.parse(raw);
        // Merge with default to survive schema additions
        this._data = this._merge(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
      }
    } catch (e) {
      console.warn("State load failed, using defaults:", e);
      this._data = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
    return this._data;
  },

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    } catch (e) {
      console.warn("State save failed:", e);
    }
  },

  get() {
    if (!this._data) this.load();
    return this._data;
  },

  /* ===== Journey lifecycle ===== */

  startJourney(journeyId) {
    this.get();
    this._data.activeJourney = journeyId;
    this.save();
  },

  resetJourney(journeyId) {
    this.get();
    // Wipe active state for that journey, but keep completion badge
    this._data.journeys[journeyId] = {
      currentStation: 1,
      decisions: {},
      reveals: {},
      hintsUsed: {},
      completedStations: []
    };
    if (this._data.activeJourney === journeyId) {
      this._data.activeJourney = null;
    }
    this.save();
  },

  completeJourney(journeyId) {
    this.get();
    this._data.completed[journeyId] = true;
    this._data.completedAt[journeyId] = new Date().toISOString();
    this._data.activeJourney = null;
    this.save();
  },

  exitJourney() {
    this.get();
    this._data.activeJourney = null;
    this.save();
  },

  /* ===== Station-level state ===== */

  setStation(journeyId, stationNum) {
    this.get();
    this._data.journeys[journeyId].currentStation = stationNum;
    this.save();
  },

  setDecision(journeyId, stationId, key, value) {
    this.get();
    if (!this._data.journeys[journeyId].decisions[stationId]) {
      this._data.journeys[journeyId].decisions[stationId] = {};
    }
    this._data.journeys[journeyId].decisions[stationId][key] = value;
    this.save();
  },

  getDecision(journeyId, stationId, key) {
    this.get();
    const station = this._data.journeys[journeyId].decisions[stationId];
    return station ? station[key] : undefined;
  },

  markReveal(journeyId, stationId, revealKey) {
    this.get();
    if (!this._data.journeys[journeyId].reveals[stationId]) {
      this._data.journeys[journeyId].reveals[stationId] = [];
    }
    if (!this._data.journeys[journeyId].reveals[stationId].includes(revealKey)) {
      this._data.journeys[journeyId].reveals[stationId].push(revealKey);
      this.save();
    }
  },

  isRevealed(journeyId, stationId, revealKey) {
    this.get();
    const arr = this._data.journeys[journeyId].reveals[stationId];
    return arr && arr.includes(revealKey);
  },

  markHint(journeyId, stationId) {
    this.get();
    this._data.journeys[journeyId].hintsUsed[stationId] = true;
    this.save();
  },

  isHintUsed(journeyId, stationId) {
    this.get();
    return !!this._data.journeys[journeyId].hintsUsed[stationId];
  },

  completeStation(journeyId, stationId) {
    this.get();
    const list = this._data.journeys[journeyId].completedStations;
    if (!list.includes(stationId)) {
      list.push(stationId);
      this.save();
    }
  },

  isStationComplete(journeyId, stationId) {
    this.get();
    return this._data.journeys[journeyId].completedStations.includes(stationId);
  },

  /* ===== Cross-reference gating ===== */

  // Returns true if the OTHER journey is complete, so cross-references
  // FROM the current journey TO the other journey should render.
  canShowCrossRef(fromJourney, toJourney) {
    this.get();
    return !!this._data.completed[toJourney];
  },

  /* ===== Soft-gate helper ===== */

  // Which journey is locked from the start screen's perspective?
  // Returns the journey id that is locked, or null if none.
  getLockedJourney() {
    this.get();
    if (!this._data.activeJourney) return null;
    return this._data.activeJourney === "consume" ? "produce" : "consume";
  },

  /* ===== Utility ===== */

  _merge(base, override) {
    const out = Array.isArray(base) ? [...base] : { ...base };
    for (const k of Object.keys(override || {})) {
      if (override[k] && typeof override[k] === "object" && !Array.isArray(override[k])) {
        out[k] = this._merge(base[k] || {}, override[k]);
      } else {
        out[k] = override[k];
      }
    }
    return out;
  },

  /* ===== Hard reset (dev / debug) ===== */
  nukeAll() {
    localStorage.removeItem(STORAGE_KEY);
    this._data = null;
  }
};

// Expose
window.State = State;
