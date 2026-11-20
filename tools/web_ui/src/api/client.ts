import type { LicenseTier, Track, CarModel, SplineData, ReferenceTest, Targets } from "../types";

export const API_BASE = "";

declare global {
  interface Window {
    IS_STATIC_HOST?: boolean;
  }
}

export function isStaticHost(): boolean {
  if (typeof window === "undefined" || !window.location) return false;
  return Boolean(
    window.location.hostname.endsWith("github.io") ||
      window.location.protocol === "file:" ||
      window.IS_STATIC_HOST
  );
}

export function resolveApiPath(endpoint: string): string {
  const clean = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;

  if (isStaticHost()) {
    if (clean.startsWith("api/spline?") || clean === "api/spline") {
      const url = new URL(clean, "http://dummy");
      const trackId = url.searchParams.get("track_id") || "";
      const layout = url.searchParams.get("layout") || "";
      const key = layout ? `${trackId}__${layout}` : trackId;
      return `./api/splines/${encodeURIComponent(key)}.json`;
    }

    const staticMap: Record<string, string> = {
      curriculum: "api/curriculum.json",
      tracks: "api/tracks.json",
      cars: "api/cars.json",
      reference_tests: "api/reference_tests.json",
      "telemetry/missing": "api/missing_telemetry.json",
    };

    const base = clean.replace(/^api\//, "").split("?")[0];
    if (staticMap[base]) {
      return `./${staticMap[base]}`;
    }
  }

  return `./${clean}`;
}

export function resolveGatewayUrl(route: string, gatewayUrl?: string): string {
  let stored = "";
  try {
    if (typeof localStorage !== "undefined") {
      stored = localStorage.getItem("gt_pr_gateway_url") || "";
    }
  } catch {
    stored = "";
  }
  const base = (gatewayUrl || stored || "https://ac-telemetry-pr-gateway.workers.dev")
    .replace(/\/(submit|contact)\/?$/, "")
    .replace(/\/$/, "");
  return `${base}${route}`;
}

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const targetUrl = url.startsWith("http") ? url : `${API_BASE}${resolveApiPath(url)}`;
  const res = await fetch(targetUrl, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export const api = {
  getCurriculum: () =>
    fetchJson<{ success: boolean; curriculum?: LicenseTier[]; tiers?: LicenseTier[]; static_mode?: boolean }>(
      "/api/curriculum"
    ),

  saveTier: async (tierName: string, tests: unknown[]) => {
    if (isStaticHost()) {
      return { success: true, message: "Saved locally in browser storage" };
    }
    return fetchJson<{ success: boolean; message?: string }>("/api/save_tier", {
      method: "POST",
      body: JSON.stringify({ tier_name: tierName, tests }),
    });
  },

  getTracks: () => fetchJson<{ tracks: Track[] }>("/api/tracks"),

  getCars: () => fetchJson<{ cars: CarModel[] }>("/api/cars"),

  getSpline: async (trackId: string, layout = ""): Promise<SplineData> => {
    try {
      const data = await fetchJson<{ success: boolean; spline?: SplineData } | SplineData>(
        `/api/spline?track_id=${encodeURIComponent(trackId)}&layout=${encodeURIComponent(layout)}`
      );
      if (data && typeof data === "object" && "spline" in data && data.spline) {
        return data.spline;
      }
      return data as SplineData;
    } catch (err) {
      if (layout) {
        const fallback = await fetchJson<{ success: boolean; spline?: SplineData } | SplineData>(
          `/api/spline?track_id=${encodeURIComponent(trackId)}&layout=`
        );
        if (fallback && typeof fallback === "object" && "spline" in fallback && fallback.spline) {
          return fallback.spline;
        }
        return fallback as SplineData;
      }
      throw err;
    }
  },

  calculateTargets: async (
    trackId: string,
    layout: string,
    startS: number,
    finishS: number,
    carId: string,
    mode: string,
    withStopBox = false
  ): Promise<Targets> => {
    if (isStaticHost()) {
      const { resolveTelemetryEngine } = await import("../utils/telemetryStore.ts");
      const telRes = await resolveTelemetryEngine(trackId, layout, carId);
      if (!telRes) {
        throw new Error(`No precalculated telemetry profile for ${carId} @ ${trackId}`);
      }
      const res = telRes.engine.calculateSectorTargets(startS, finishS, mode, withStopBox);
      return {
        gold_seconds: res.gold_seconds,
        silver_seconds: res.silver_seconds,
        bronze_seconds: res.bronze_seconds,
      };
    }
    return fetchJson<Targets>(
      `/api/calculate_targets?track_id=${encodeURIComponent(trackId)}&layout=${encodeURIComponent(layout)}&start_s=${startS}&finish_s=${finishS}&car_id=${encodeURIComponent(carId)}&mode=${encodeURIComponent(mode)}`
    );
  },

  calculateInitialSpeed: async (trackId: string, layout: string, startS: number, carId: string) => {
    if (isStaticHost()) {
      const { resolveTelemetryEngine } = await import("../utils/telemetryStore.ts");
      const telRes = await resolveTelemetryEngine(trackId, layout, carId);
      if (!telRes) {
        return { telemetry_available: false };
      }
      const phys = telRes.engine.calculateGatePhysics(startS, 3.0);
      return {
        speed_kmh: phys.speed_kmh,
        initial_gear: phys.gear,
        initial_rpm: phys.rpm,
        spawn_offset_meters: phys.spawn_offset_m,
        telemetry_available: true,
        source: telRes.source,
      };
    }
    return fetchJson<{
      speed_kmh?: number;
      initial_gear?: number;
      initial_rpm?: number;
      spawn_offset_meters?: number;
      telemetry_available: boolean;
      source?: string;
    }>("/api/calculate_initial_speed", {
      method: "POST",
      body: JSON.stringify({
        track_id: trackId,
        track_layout: layout,
        start_s: startS,
        car_id: carId,
      }),
    });
  },

  runLiveTest: (testId: string) => {
    if (isStaticHost()) {
      return Promise.reject(new Error("Live simulation requires local Assetto Corsa environment"));
    }
    return fetchJson<{ success: boolean; pid?: number }>("/api/run_test", {
      method: "POST",
      body: JSON.stringify({ test_id: testId }),
    });
  },

  getReferenceTests: () =>
    fetchJson<{ success: boolean; tests: ReferenceTest[]; count: number }>("/api/reference_tests"),

  getMissingTelemetry: (tier = "ALL") =>
    fetchJson<{
      missing_tests_count: number;
      unique_combos_count: number;
      missing_combos: Array<{
        track_id: string;
        track_layout: string;
        car_id: string;
        test_ids: string[];
        is_cached: boolean;
        is_queued: boolean;
      }>;
    }>(`/api/telemetry/missing?tier=${encodeURIComponent(tier)}`),

  queueMissingTelemetry: (tier = "ALL", includeFlying = true) => {
    if (isStaticHost()) {
      return Promise.reject(new Error("Batch recording requires local Assetto Corsa environment"));
    }
    return fetchJson<{ success: boolean; queued_count: number }>("/api/telemetry/queue_missing", {
      method: "POST",
      body: JSON.stringify({ tier, include_flying: includeFlying }),
    });
  },

  generateAndValidate: () => {
    if (isStaticHost()) {
      return Promise.reject(new Error("Content generation requires local Python server"));
    }
    return fetchJson<{ success: boolean; log: string }>("/api/generate", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  syncToAc: () => {
    if (isStaticHost()) {
      return Promise.reject(new Error("Direct sync requires local Assetto Corsa installation"));
    }
    return fetchJson<{ success: boolean; log: string }>("/api/sync", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  submitTelemetryProfile: async (params: {
    googleToken: string;
    filename: string;
    telemetryData: unknown;
    gatewayUrl?: string;
  }) => {
    const url = resolveGatewayUrl("/submit", params.gatewayUrl);
    return fetchJson<{ success: boolean; pr_url?: string; error?: string }>(url, {
      method: "POST",
      body: JSON.stringify({
        google_token: params.googleToken,
        filename: params.filename,
        telemetry_data: params.telemetryData,
      }),
    });
  },

  submitContactMessage: async (params: {
    name: string;
    email?: string;
    topic: string;
    message: string;
    website?: string;
    gatewayUrl?: string;
  }) => {
    const url = resolveGatewayUrl("/contact", params.gatewayUrl);
    return fetchJson<{ success: boolean; issue_url?: string; error?: string }>(url, {
      method: "POST",
      body: JSON.stringify({
        name: params.name,
        email: params.email || "",
        topic: params.topic || "feedback",
        message: params.message,
        website: params.website || "",
      }),
    });
  },
};
