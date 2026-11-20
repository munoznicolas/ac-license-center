export interface TelemetryProfileSample {
  distance_m: number;
  speed_kmh: number;
  gear: number;
  rpm: number;
  t?: number;
}

export interface TelemetryProfilePayload {
  track_id: string;
  track?: string;
  track_layout?: string;
  layout?: string;
  car_id: string;
  car?: string;
  ai_level?: number;
  total_track_length_m?: number;
  lap_time_s?: number;
  gold_time?: number;
  source?: string;
  recorded_at?: string;
  samples: TelemetryProfileSample[];
  trajectory?: TelemetryProfileSample[];
}

export interface ValidatedTelemetryResult {
  payload: TelemetryProfilePayload;
  filename: string;
  trackId: string;
  layout: string;
  carId: string;
  sampleCount: number;
  maxSpeed: number;
  lapTime: number;
}

export function validateTelemetryPayload(data: unknown): ValidatedTelemetryResult {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Telemetry payload must be a valid JSON object.");
  }

  const obj = data as Partial<TelemetryProfilePayload>;
  const rawTrack = obj.track_id || obj.track;
  const rawCar = obj.car_id || obj.car;
  const rawLayout = obj.track_layout ?? obj.layout ?? "";
  const samples = Array.isArray(obj.samples)
    ? obj.samples
    : Array.isArray(obj.trajectory)
    ? obj.trajectory
    : [];

  if (!rawTrack || typeof rawTrack !== "string") {
    throw new Error("Missing or invalid track_id in telemetry profile.");
  }
  if (!rawCar || typeof rawCar !== "string") {
    throw new Error("Missing or invalid car_id in telemetry profile.");
  }
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error("Telemetry profile must include a non-empty samples array.");
  }

  const trackId = rawTrack.replace(/[^a-zA-Z0-9_-]/g, "");
  const layout = String(rawLayout || "").replace(/[^a-zA-Z0-9_-]/g, "");
  const carId = rawCar.replace(/[^a-zA-Z0-9_-]/g, "");
  const aiLevel = Number(obj.ai_level ?? 100);
  const trackPart = layout ? `${trackId}__${layout}` : trackId;
  const filename = `${trackPart}__${carId}__ai${aiLevel}.json`;

  let maxSpeed = 0;
  let lapTime = Number(obj.lap_time_s || obj.gold_time || 0);
  for (const s of samples) {
    const spd = Number(s?.speed_kmh || 0);
    if (spd > maxSpeed) maxSpeed = spd;
    if (s?.t && Number(s.t) > lapTime) lapTime = Number(s.t);
  }

  const normalizedPayload: TelemetryProfilePayload = {
    ...(obj as TelemetryProfilePayload),
    track_id: trackId,
    track_layout: layout,
    car_id: carId,
    samples,
  };

  return {
    payload: normalizedPayload,
    filename,
    trackId,
    layout,
    carId,
    sampleCount: samples.length,
    maxSpeed: Math.round(maxSpeed * 10) / 10,
    lapTime: Math.round(lapTime * 100) / 100,
  };
}
