export interface TelemetrySample {
  distance_m: number;
  speed_kmh: number;
  gear: number;
  rpm: number;
}

export interface TelemetryProfileInput {
  track_id?: string;
  track_layout?: string;
  car_id?: string;
  ai_level?: number;
  source?: string;
  recorded_at?: string;
  total_track_length_m?: number;
  lap_time_s?: number;
  samples: TelemetrySample[];
}

export class TelemetryEngine {
  trackId: string;
  trackLayout: string;
  carId: string;
  aiLevel: number;
  source: string;
  recordedAt: string;
  totalTrackLengthM: number;
  lapTimeS: number;
  samples: TelemetrySample[];

  constructor(profile: TelemetryProfileInput) {
    if (!profile || !Array.isArray(profile.samples) || profile.samples.length === 0) {
      throw new Error("Invalid telemetry profile: missing or empty samples array");
    }

    this.trackId = profile.track_id || "";
    this.trackLayout = profile.track_layout || "";
    this.carId = profile.car_id || "";
    this.aiLevel = Number(profile.ai_level ?? 100);
    this.source = profile.source || "custom_upload";
    this.recordedAt = profile.recorded_at || new Date().toISOString();
    this.totalTrackLengthM = Number(profile.total_track_length_m || 0);
    this.lapTimeS = Number(profile.lap_time_s || 0);

    this.samples = profile.samples.slice().sort((a, b) => a.distance_m - b.distance_m);

    if (this.totalTrackLengthM <= 0) {
      const maxSampleDist = this.samples[this.samples.length - 1].distance_m;
      this.totalTrackLengthM = maxSampleDist > 0 ? maxSampleDist : 1000.0;
    }
  }

  querySample(distanceM: number): { speedKmh: number; gear: number; rpm: number } {
    const tot = this.totalTrackLengthM;
    const d = ((distanceM % tot) + tot) % tot;
    const n = this.samples.length;

    if (d <= this.samples[0].distance_m) {
      const s0 = this.samples[n - 1];
      const s1 = this.samples[0];
      const span = s1.distance_m + (tot - s0.distance_m);
      const frac = span > 0 ? (d + (tot - s0.distance_m)) / span : 0;
      return {
        speedKmh: s0.speed_kmh + frac * (s1.speed_kmh - s0.speed_kmh),
        gear: frac < 0.5 ? s0.gear : s1.gear,
        rpm: Math.round(s0.rpm + frac * (s1.rpm - s0.rpm)),
      };
    }

    if (d >= this.samples[n - 1].distance_m) {
      const s0 = this.samples[n - 1];
      const s1 = this.samples[0];
      const span = s1.distance_m + (tot - s0.distance_m);
      const frac = span > 0 ? (d - s0.distance_m) / span : 0;
      return {
        speedKmh: s0.speed_kmh + frac * (s1.speed_kmh - s0.speed_kmh),
        gear: frac < 0.5 ? s0.gear : s1.gear,
        rpm: Math.round(s0.rpm + frac * (s1.rpm - s0.rpm)),
      };
    }

    let low = 0;
    let high = n - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.samples[mid].distance_m <= d) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx0 = Math.max(0, high);
    const idx1 = Math.min(n - 1, idx0 + 1);
    const s0 = this.samples[idx0];
    const s1 = this.samples[idx1];
    const span = s1.distance_m - s0.distance_m;
    const frac = span > 0 ? (d - s0.distance_m) / span : 0;

    return {
      speedKmh: s0.speed_kmh + frac * (s1.speed_kmh - s0.speed_kmh),
      gear: frac < 0.5 ? s0.gear : s1.gear,
      rpm: Math.round(s0.rpm + frac * (s1.rpm - s0.rpm)),
    };
  }

  integrateDistanceBackward(gateDistM: number, countdownSec = 3.0, stepDt = 0.05): number {
    const tot = this.totalTrackLengthM;
    let currDist = gateDistM;
    let tAccum = 0.0;

    while (tAccum < countdownSec) {
      const { speedKmh } = this.querySample(currDist);
      const vMs = Math.max(5.0, speedKmh / 3.6);
      const dt = Math.min(stepDt, countdownSec - tAccum);
      const ds = vMs * dt;
      currDist = ((currDist - ds) % tot + tot) % tot;
      tAccum += dt;
    }

    return currDist;
  }

  calculateGatePhysics(gateProgress: number, countdownSec = 3.0) {
    const tot = this.totalTrackLengthM;
    const gateProgNorm = ((gateProgress % 1.0) + 1.0) % 1.0;
    const gateDist = (gateProgNorm * tot) % tot;
    const gateSample = this.querySample(gateDist);

    const spawnDist = this.integrateDistanceBackward(gateDist, countdownSec);
    const spawnOffset = (gateDist - spawnDist + tot) % tot;
    const spawnSample = this.querySample(spawnDist);
    const spawnProg = tot > 0 ? spawnDist / tot : 0.0;

    return {
      gate_progress: Number(gateProgNorm.toFixed(4)),
      gate_distance_m: Number(gateDist.toFixed(2)),
      speed_kmh: Number(gateSample.speedKmh.toFixed(1)),
      gear: gateSample.gear,
      rpm: gateSample.rpm,
      spawn_offset_m: Number(spawnOffset.toFixed(1)),
      spawn_progress: Number(spawnProg.toFixed(4)),
      spawn_distance_m: Number(spawnDist.toFixed(2)),
      spawn_speed_kmh: Number(spawnSample.speedKmh.toFixed(1)),
      spawn_gear: spawnSample.gear,
      spawn_rpm: spawnSample.rpm,
      countdown_sec: countdownSec,
      total_track_length_m: Number(tot.toFixed(2)),
      source: this.source,
      recorded_at: this.recordedAt,
    };
  }

  private _computeSectorLength(startS: number, finishS: number) {
    const tot = this.totalTrackLengthM;
    const s0 = ((startS % 1.0) + 1.0) % 1.0;
    const s1 = Math.abs(finishS - 1.0) < 1e-4 ? 1.0 : ((finishS % 1.0) + 1.0) % 1.0;
    const startDist = s0 * tot;
    const finishDist = s1 * tot;

    const isFullLap = (s0 <= 0.005 && s1 >= 0.99) || Math.abs(s0 - s1) < 0.002;

    let secLen = isFullLap ? tot : s1 >= s0 ? finishDist - startDist : tot - startDist + finishDist;
    if (secLen <= 1.0) {
      secLen = isFullLap ? tot : 100.0;
    }
    return { startDist, secLen };
  }

  private _effectiveSpeed(
    vFlyingMs: number,
    distTraveled: number,
    secLen: number,
    startMode: string,
    withStopBox: boolean,
    aLaunch = 6.0,
    aBrake = 9.0
  ) {
    if (startMode !== "STANDING") {
      return vFlyingMs;
    }

    const vLaunch = Math.sqrt(2.0 * aLaunch * Math.max(0.2, distTraveled));
    let vEff = Math.min(vFlyingMs, vLaunch);

    if (withStopBox) {
      const distRem = Math.max(0.0, secLen - distTraveled);
      const vStop = Math.sqrt(2.0 * aBrake * Math.max(0.2, distRem));
      vEff = Math.min(vEff, vStop);
    }

    return Math.max(2.5, vEff);
  }

  private _integrateTraversalTime(
    startDist: number,
    secLen: number,
    startMode: string,
    withStopBox: boolean,
    stepM = 1.0
  ) {
    const tot = this.totalTrackLengthM;
    const step = Math.max(0.5, Math.min(stepM, secLen / 500.0));
    let tAccum = 0.0;
    let distTraveled = 0.0;

    while (distTraveled < secLen) {
      const currD = (startDist + distTraveled) % tot;
      const { speedKmh } = this.querySample(currD);
      const vMs = this._effectiveSpeed(
        Math.max(5.0, speedKmh / 3.6),
        distTraveled,
        secLen,
        startMode,
        withStopBox
      );
      tAccum += step / vMs;
      distTraveled += step;
    }

    if (startMode === "STANDING" && withStopBox) {
      tAccum += 0.5;
    }
    return tAccum;
  }

  private _calculateMedalTargets(tAccum: number, startMode: string) {
    if (startMode === "ROLLING") {
      const gold = Math.ceil(Number((tAccum * 0.98).toFixed(4)) * 10.0) / 10.0;
      const silver = Math.ceil(Number((tAccum * 1.05).toFixed(4)) * 10.0) / 10.0;
      const bronze = Math.ceil(Number((tAccum * 1.15).toFixed(4)) * 10.0) / 10.0;
      return { gold, silver, bronze };
    }

    const gold = Math.ceil(Number(tAccum.toFixed(4)) * 10.0) / 10.0;
    const silver = Math.ceil(Number((gold * (1.05 / 0.98)).toFixed(4)) * 10.0) / 10.0;
    const bronze = Math.ceil(Number((gold * (1.15 / 0.98)).toFixed(4)) * 10.0) / 10.0;
    return { gold, silver, bronze };
  }

  calculateSectorTargets(
    startS: number,
    finishS: number,
    startMode = "ROLLING",
    withStopBox = false,
    stepM = 1.0
  ) {
    const { startDist, secLen } = this._computeSectorLength(startS, finishS);
    const tAccum = this._integrateTraversalTime(startDist, secLen, startMode, withStopBox, stepM);
    const { gold, silver, bronze } = this._calculateMedalTargets(tAccum, startMode);

    return {
      gold_seconds: gold,
      silver_seconds: silver,
      bronze_seconds: bronze,
      sector_distance_m: Number(secLen.toFixed(1)),
      ai_lap_time_s: Number(tAccum.toFixed(2)),
      source: this.source,
    };
  }
}
