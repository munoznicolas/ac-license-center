import React, { useRef, useEffect, useState } from "react";
import { SplineData } from "../../types";

interface Props {
  spline: SplineData | null;
  startS: number;
  finishS: number;
  onStartChange: (s: number) => void;
  onFinishChange: (s: number) => void;
}

export const SplineCanvas: React.FC<Props> = ({
  spline,
  startS,
  finishS,
  onStartChange,
  onFinishChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 700, height: 300 });
  const [startDraft, setStartDraft] = useState<string | null>(null);
  const [finishDraft, setFinishDraft] = useState<string | null>(null);
  const [activeThumb, setActiveThumb] = useState<"start" | "finish">("start");
  const isFullLap = startS === 0 && finishS === 1;

  // Sector distance calculation
  const totalLengthM = spline?.total_length_m || 0;
  let sectorDistM = 0;
  if (totalLengthM > 0) {
    if (isFullLap) {
      sectorDistM = totalLengthM;
    } else if (finishS >= startS) {
      sectorDistM = (finishS - startS) * totalLengthM;
    } else {
      sectorDistM = (1.0 - startS + finishS) * totalLengthM;
    }
  }

  // Keep canvas backing buffer matched to CSS size so track aspect ratio never distorts
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w > 0 && h > 0) {
        setCanvasSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Draw on canvas whenever spline, positions, or container size change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvasSize.width;
    const h = canvasSize.height;
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (!spline || !spline.points || spline.points.length === 0) {
      ctx.fillStyle = "#19191b";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#71717a";
      ctx.font = "13px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Select a track with an AI spline to view 2D map", w / 2, h / 2);
      return;
    }

    const pts = spline.points;
    const isPointInSector = (s: number) => {
      if (isFullLap) return true;
      return finishS >= startS ? s >= startS && s <= finishS : s >= startS || s <= finishS;
    };

    const findClosest = (targetS: number) => {
      let closest = pts[0];
      let minDiff = Math.abs(pts[0].s - targetS);
      for (let i = 1; i < pts.length; i++) {
        const diff = Math.abs(pts[i].s - targetS);
        if (diff < minDiff) {
          minDiff = diff;
          closest = pts[i];
        }
      }
      return closest;
    };

    const startPt = findClosest(startS);
    const finishPt = findClosest(finishS);

    const boundsPts = isFullLap
      ? pts
      : [...pts.filter((p) => isPointInSector(p.s)), startPt, finishPt];
    const activePts = boundsPts.length > 0 ? boundsPts : pts;

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const p of activePts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    if (!isFullLap) {
      // Expand tight/short sector bounds slightly so entry/exit track context remains visible
      const rawW = maxX - minX;
      const rawH = maxY - minY;
      const span = Math.max(rawW, rawH, 80);
      const margin = span * 0.06;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const halfW = Math.max(rawW / 2, 40) + margin;
      const halfH = Math.max(rawH / 2, 40) + margin;
      minX = cx - halfW;
      maxX = cx + halfW;
      minY = cy - halfH;
      maxY = cy + halfH;
    }

    const bw = maxX - minX || 1;
    const bh = maxY - minY || 1;
    const pad = 14;
    const scale = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
    const ox = (w - bw * scale) / 2 - minX * scale;
    const oy = (h - bh * scale) / 2 - minY * scale;

    const toX = (wx: number) => wx * scale + ox;
    const toY = (wy: number) => wy * scale + oy;

    // 1. Draw base circuit track line
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    ctx.lineWidth = 5;
    ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.18)" : "rgba(0, 0, 0, 0.15)";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(toX(pts[0].x), toY(pts[0].y));
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(toX(pts[i].x), toY(pts[i].y));
    }
    ctx.closePath();
    ctx.stroke();

    // 2. Draw active sector ribbon
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#f59e0b"; // Gold sector
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < pts.length; i++) {
      if (isPointInSector(pts[i].s)) {
        if (!started) {
          ctx.moveTo(toX(pts[i].x), toY(pts[i].y));
          started = true;
        } else {
          ctx.lineTo(toX(pts[i].x), toY(pts[i].y));
        }
      } else {
        started = false;
      }
    }
    ctx.stroke();

    // 3. Draw Start Gate point
    if (startPt) {
      const sx = toX(startPt.x);
      const sy = toY(startPt.y);
      ctx.fillStyle = "#4cc38a";
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 4. Draw Finish Gate point
    if (finishPt) {
      const fx = toX(finishPt.x);
      const fy = toY(finishPt.y);
      ctx.fillStyle = "#e5484d";
      ctx.beginPath();
      ctx.arc(fx, fy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [spline, startS, finishS, isFullLap, canvasSize]);

  return (
    <div id="card-gates-spline" className="card form-card">
      <div className="card-title">
        <span>Test Bounds & Track Positions</span>
      </div>

      {/* Canvas */}
      <div className="map-container">
        <div className="canvas-wrapper">
          <canvas ref={canvasRef} width={700} height={300} style={{ width: "100%", height: "300px" }} />
        </div>
      </div>

      {/* Unified Dual-Thumb Sector Bar */}
      <div className="dual-range-wrap">
        <div className="dual-range-track">
          <div className="dual-range-rail" />
          {isFullLap ? (
            <div className="dual-range-fill" style={{ left: "0%", width: "100%" }} />
          ) : finishS >= startS ? (
            <div
              className="dual-range-fill"
              style={{ left: `${startS * 100}%`, width: `${(finishS - startS) * 100}%` }}
            />
          ) : (
            <>
              <div className="dual-range-fill" style={{ left: "0%", width: `${finishS * 100}%` }} />
              <div className="dual-range-fill" style={{ left: `${startS * 100}%`, width: `${(1 - startS) * 100}%` }} />
            </>
          )}
          <input
            type="range"
            id="slider-start-s"
            aria-label="Start Gate Position"
            className="range-slider range-start dual-range-input"
            style={{ zIndex: activeThumb === "start" ? 3 : 2 }}
            min="0"
            max="1"
            step="0.0005"
            value={startS}
            disabled={isFullLap}
            onPointerDown={() => setActiveThumb("start")}
            onFocus={() => setActiveThumb("start")}
            onChange={(e) => onStartChange(parseFloat(e.target.value) || 0)}
          />
          <input
            type="range"
            id="slider-finish-s"
            aria-label="Finish Gate Position"
            className="range-slider range-finish dual-range-input"
            style={{ zIndex: activeThumb === "finish" ? 3 : 2 }}
            min="0"
            max="1"
            step="0.0005"
            value={finishS}
            disabled={isFullLap}
            onPointerDown={() => setActiveThumb("finish")}
            onFocus={() => setActiveThumb("finish")}
            onChange={(e) => onFinishChange(parseFloat(e.target.value) || 0)}
          />
        </div>

        {/* Compact Gate Readout Row */}
        <div className="gate-readout-row">
          {(
            [
              {
                key: "start",
                label: "Start",
                dotClass: "is-start",
                value: startS,
                draft: startDraft,
                setDraft: setStartDraft,
                onChange: onStartChange,
                inputId: "input-start-s",
                dispSId: "disp-start-s",
                dispMId: "disp-start-m",
              },
              {
                key: "finish",
                label: "Finish",
                dotClass: "is-finish",
                value: finishS,
                draft: finishDraft,
                setDraft: setFinishDraft,
                onChange: onFinishChange,
                inputId: "input-finish-s",
                dispSId: "disp-finish-s",
                dispMId: "disp-finish-m",
              },
            ] as const
          ).map((g) => (
            <div key={g.key} className="gate-readout-item">
              <span className={`gate-dot ${g.dotClass}`} aria-hidden="true" />
              <label htmlFor={g.inputId} className="gate-readout-label">
                {g.label}
              </label>
              <span id={g.dispSId} style={{ display: "none" }}>
                {(g.value * 100).toFixed(2)}%
              </span>
              <span id={g.dispMId} className="gate-readout-meters">
                {Math.round(g.value * totalLengthM)} m
              </span>
              <input
                type="number"
                id={g.inputId}
                className="form-control num-input mono gate-readout-input"
                min="0"
                max="1"
                step="0.001"
                value={g.draft ?? g.value.toFixed(3)}
                disabled={isFullLap}
                onFocus={() => g.setDraft(g.value.toFixed(3))}
                onChange={(e) => {
                  g.setDraft(e.target.value);
                  const parsed = parseFloat(e.target.value);
                  if (!Number.isNaN(parsed)) g.onChange(Math.max(0, Math.min(1, parsed)));
                }}
                onBlur={() => g.setDraft(null)}
              />
            </div>
          ))}

          <div id="sector-stats" className="gate-sector-pill">
            Sector: <strong>{Math.round(sectorDistM)} m</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
