/**
 * state.js
 * Central reactive application state for Assetto Corsa GT-Like License Test Designer.
 */

export const state = {
  curriculum: [],
  activeTierIndex: 0,
  activeTestIndex: 0,
  tracks: [],
  cars: [],
  currentSpline: null,
  isDirty: false,
  referenceTests: [],
  activeRefGame: "ALL",
  refCharts: {},
  refChartsAggregateByLicense: true,
  goldScaleFocus: true,
  isReferenceViewActive: false,
  cacheBuster: "",
};

/**
 * Invalidate thumbnail and asset caches for the active session (e.g. after generation or save).
 */
export function bumpCacheBuster() {
  state.cacheBuster = Date.now();
}

/**
 * Returns the currently active license tier object, or null.
 */
export function getActiveTier() {
  return state.curriculum && state.curriculum[state.activeTierIndex]
    ? state.curriculum[state.activeTierIndex]
    : null;
}

/**
 * Returns the currently active test definition object, or null.
 */
export function getActiveTest() {
  const tier = getActiveTier();
  return tier && tier.tests && tier.tests[state.activeTestIndex]
    ? tier.tests[state.activeTestIndex]
    : null;
}
