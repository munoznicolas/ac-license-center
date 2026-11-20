import { TelemetryEngine, type TelemetryProfileInput } from "./telemetryEngine.ts";
import { resolveApiPath } from "../api/client.ts";

const DB_NAME = "gt_telemetry_db";
const DB_VERSION = 1;
const STORE_NAME = "custom_profiles";

let dbInstance: IDBDatabase | null = null;
const memoryProfileCache = new Map<string, TelemetryProfileInput>();

function openTelemetryDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error || new Error("Failed to open IndexedDB"));
    };
  });
}

export function getTelemetryFilename(
  trackId: string,
  layout: string,
  carId: string,
  aiLevel = 100
): string {
  const cleanTrack = String(trackId || "").trim().toLowerCase();
  let cleanLayout = String(layout || "").trim().toLowerCase();
  if (cleanLayout === "undefined" || cleanLayout === "null") {
    cleanLayout = "";
  }
  const cleanCar = String(carId || "").trim().toLowerCase();
  const level = Number(aiLevel || 100);

  if (cleanLayout) {
    return `${cleanTrack}__${cleanLayout}__${cleanCar}__ai${level}.json`;
  }
  return `${cleanTrack}__${cleanCar}__ai${level}.json`;
}

export async function saveCustomTelemetryProfile(profileData: TelemetryProfileInput): Promise<{
  key: string;
  filename: string;
  profile: TelemetryProfileInput;
}> {
  if (!profileData || !profileData.track_id || !profileData.car_id) {
    throw new Error("Invalid telemetry profile: missing track_id or car_id");
  }

  const key = getTelemetryFilename(
    profileData.track_id,
    profileData.track_layout || "",
    profileData.car_id,
    profileData.ai_level || 100
  );

  const entry = {
    key,
    filename: key,
    track_id: profileData.track_id,
    track_layout: profileData.track_layout || "",
    car_id: profileData.car_id,
    ai_level: profileData.ai_level || 100,
    data: profileData,
    uploaded_at: Date.now(),
  };

  try {
    const db = await openTelemetryDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fall back to in-memory cache when IndexedDB is unavailable
  }

  memoryProfileCache.set(key, profileData);
  return { key, filename: key, profile: profileData };
}

export async function getCustomTelemetryProfile(key: string): Promise<TelemetryProfileInput | null> {
  if (memoryProfileCache.has(key)) {
    return memoryProfileCache.get(key) || null;
  }

  try {
    const db = await openTelemetryDb();
    const entry = await new Promise<{ data?: TelemetryProfileInput } | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (entry && entry.data) {
      memoryProfileCache.set(key, entry.data);
      return entry.data;
    }
  } catch {
    // Ignore IndexedDB errors
  }

  return null;
}

async function fetchPrecalculatedProfile(filename: string): Promise<TelemetryProfileInput | null> {
  if (memoryProfileCache.has(filename)) {
    return memoryProfileCache.get(filename) || null;
  }

  if (typeof fetch === "undefined") return null;

  const candidateUrls = [
    resolveApiPath(`api/telemetry_profiles/${encodeURIComponent(filename)}`),
    `./data/telemetry_profiles/${encodeURIComponent(filename)}`,
    `https://raw.githubusercontent.com/munoznicolas/ac-license-center/main/data/telemetry_profiles/${encodeURIComponent(filename)}`,
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (!text.trim().startsWith("<")) {
          const data = JSON.parse(text);
          if (data && Array.isArray(data.samples)) {
            memoryProfileCache.set(filename, data);
            return data;
          }
        }
      }
    } catch {
      // Continue to next candidate URL
    }
  }

  return null;
}

export async function resolveTelemetryEngine(
  trackId: string,
  layout: string,
  carId: string,
  aiLevel = 100
): Promise<{ engine: TelemetryEngine; source: string; filename: string } | null> {
  if (!trackId || !carId) return null;

  const filename = getTelemetryFilename(trackId, layout, carId, aiLevel);

  const customData = await getCustomTelemetryProfile(filename);
  if (customData) {
    return {
      engine: new TelemetryEngine(customData),
      source: "custom_uploaded",
      filename,
    };
  }

  const precalcData = await fetchPrecalculatedProfile(filename);
  if (precalcData) {
    return {
      engine: new TelemetryEngine(precalcData),
      source: "precalculated",
      filename,
    };
  }

  if (aiLevel !== 95) {
    const fn95 = getTelemetryFilename(trackId, layout, carId, 95);
    const precalc95 = await fetchPrecalculatedProfile(fn95);
    if (precalc95) {
      return {
        engine: new TelemetryEngine(precalc95),
        source: "precalculated_ai95",
        filename,
      };
    }
  }

  return null;
}
