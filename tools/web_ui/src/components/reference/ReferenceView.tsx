import React, { useState, useEffect, useMemo } from "react";
import { Flag, Timer, Zap, Scale, Search } from "lucide-react";
import {
  ResponsiveChartContainer,
  ChartsXAxis,
  ChartsYAxis,
  ChartsGrid,
  ChartsTooltip,
  ChartsAxisHighlight,
  LineChart,
  BarChart,
  useDrawingArea,
  useXScale,
  useYScale,
  getValueToPositionMapper,
} from "@mui/x-charts";
import { ReferenceTest } from "../../types";
import { api } from "../../api/client";

const GAME_ORDER = ["GT1", "GT2", "GT3", "GT4", "GT5", "GT6", "GT7", "AC Mod"];

const LAYOUT_SPECS = [
  { key: "FR", name: "Front-Engine, Rear-Wheel Drive (FR)", color: "#8b5cf6" },
  { key: "MR", name: "Mid-Engine, Rear-Wheel Drive (MR)", color: "#06b6d4" },
  { key: "FF", name: "Front-Engine, Front-Wheel Drive (FF)", color: "#f59e0b" },
  { key: "4WD", name: "All-Wheel Drive (4WD/AWD)", color: "#10b981" },
  { key: "RR", name: "Rear-Engine, Rear-Wheel Drive (RR)", color: "#f43f5e" },
] as const;

const BOUNDED_POPPER_PROPS = {
  placement: "top" as const,
  modifiers: [
    {
      name: "preventOverflow",
      enabled: true,
      options: {
        boundary: "viewport",
        rootBoundary: "viewport",
        tether: false,
        altAxis: true,
        padding: 8,
      },
    },
    {
      name: "flip",
      enabled: true,
      options: {
        fallbackPlacements: ["bottom", "top", "left", "right"],
      },
    },
  ],
  sx: {
    maxWidth: "calc(100vw - 16px)",
    "& .MuiChartsTooltip-root, & .MuiChartsTooltip-paper, & .MuiPaper-root": {
      maxWidth: "calc(100vw - 16px)",
      boxSizing: "border-box",
      overflow: "hidden",
    },
    "& .MuiChartsTooltip-table": {
      maxWidth: "100%",
      tableLayout: "auto",
    },
    "& .MuiChartsTooltip-cell, & td, & th, & p, & span": {
      whiteSpace: "normal !important",
      wordBreak: "break-word",
      fontSize: "11.5px",
    },
  },
};

type DrivetrainKey = (typeof LAYOUT_SPECS)[number]["key"];

function normalizeLayout(raw?: string): DrivetrainKey | "Other" {
  const s = (raw || "").toUpperCase().trim();
  if (s === "FR" || s === "RWD") return "FR";
  if (s === "MR") return "MR";
  if (s === "FF" || s === "FWD") return "FF";
  if (s === "4WD" || s === "AWD" || s === "FAWD" || s === "MAWD" || s === "RAWD") return "4WD";
  if (s === "RR") return "RR";
  return "Other";
}

function getPercentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function formatShortLicense(lic?: string): string {
  if (!lic) return "";
  return lic
    .replace("-License", "")
    .replace(" License", "")
    .replace("National ", "Nat ")
    .replace("International ", "Int ")
    .replace("Master National ", "M-Nat ")
    .replace("Master International ", "M-Int ")
    .replace("Master Super", "M-Super");
}

function formatTime(sec: number): string {
  if (!sec || !isFinite(sec)) return "0:00.000";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s.toFixed(3)}`;
}

function formatShortAxisTime(val: number): string {
  const n = Math.round(Number(val));
  if (n < 60) return `${n}s`;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return s > 0 ? `${m}:${s < 10 ? "0" : ""}${s}` : `${m}m`;
}

interface CandleRange {
  avg: number | null;
  low: number | null;
  high: number | null;
}

interface AggregateGroup {
  shortLabel: string;
  game: string;
  license: string;
  testCount: number;
  avgHp: number | null;
  avgHpKg: number | null;
  avgDuration: number | null;
  hpCandle: CandleRange;
  hpKgCandle: CandleRange;
  goldCandle: CandleRange;
}

function buildGroupStats(
  game: string,
  license: string,
  shortLabel: string,
  tests: ReferenceTest[]
): AggregateGroup {
  const hpVals = tests
    .map((t) => Number(t.hp))
    .filter((v) => isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  const avgHp =
    hpVals.length > 0
      ? Math.round(hpVals.reduce((sum, v) => sum + v, 0) / hpVals.length)
      : null;

  const validHpKg: number[] = [];
  tests.forEach((t) => {
    const hp = Number(t.hp);
    const wt = Number(t.weight_kg || t.weight);
    const kgHp = Number(t.pw_kg_hp ?? t.pw);
    if (hp > 0 && wt > 0) validHpKg.push(hp / wt);
    else if (kgHp > 0) validHpKg.push(1 / kgHp);
  });
  validHpKg.sort((a, b) => a - b);
  const avgHpKg =
    validHpKg.length > 0
      ? parseFloat((validHpKg.reduce((sum, v) => sum + v, 0) / validHpKg.length).toFixed(3))
      : null;

  const validGold = tests
    .map((t) => t.gold_s ?? t.gold_seconds)
    .filter((v): v is number => v !== undefined && v !== null && isFinite(v))
    .sort((a, b) => a - b);
  const avgDuration =
    validGold.length > 0
      ? parseFloat((validGold.reduce((sum, v) => sum + v, 0) / validGold.length).toFixed(2))
      : null;

  return {
    shortLabel,
    game,
    license,
    testCount: tests.length,
    avgHp,
    avgHpKg,
    avgDuration,
    hpCandle: {
      avg: avgHp,
      low: getPercentile(hpVals, 0.1),
      high: getPercentile(hpVals, 0.9),
    },
    hpKgCandle: {
      avg: avgHpKg,
      low: getPercentile(validHpKg, 0.1),
      high: getPercentile(validHpKg, 0.9),
    },
    goldCandle: {
      avg: avgDuration,
      low: getPercentile(validGold, 0.1),
      high: getPercentile(validGold, 0.9),
    },
  };
}

function aggregateByGame(list: ReferenceTest[]): AggregateGroup[] {
  const map = new Map<string, ReferenceTest[]>();
  GAME_ORDER.forEach((g) => map.set(g, []));
  list.forEach((t) => {
    const g = t.game || "GT";
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(t);
  });

  const out: AggregateGroup[] = [];
  for (const [game, grp] of map.entries()) {
    if (grp.length > 0) {
      out.push(buildGroupStats(game, "All Tiers", game, grp));
    }
  }
  return out;
}

function aggregateByLicense(list: ReferenceTest[], activeGame: string): AggregateGroup[] {
  const map = new Map<string, { game: string; license: string; tests: ReferenceTest[] }>();
  list.forEach((t) => {
    const game = t.game || "GT";
    const license = t.license || t.tier || "Standard";
    const key = `${game}||${license}`;
    if (!map.has(key)) map.set(key, { game, license, tests: [] });
    map.get(key)!.tests.push(t);
  });

  const out: AggregateGroup[] = [];
  for (const grp of map.values()) {
    const shortLic = formatShortLicense(grp.license);
    const shortLabel = activeGame === "ALL" ? `${grp.game} ${shortLic}` : shortLic;
    out.push(buildGroupStats(grp.game, grp.license, shortLabel, grp.tests));
  }
  return out;
}

interface CandleSeriesDef {
  yAxisId: string;
  candles: CandleRange[];
  fillColor: string;
  strokeColor: string;
  xOffset: number;
  width: number;
}

const CandlePlotLayer: React.FC<{
  labels: string[];
  seriesDefs: CandleSeriesDef[];
}> = ({ labels, seriesDefs }) => {
  const { top, height, left, width: areaWidth } = useDrawingArea();
  const xScale = useXScale("x");
  const xMapper = getValueToPositionMapper(xScale);
  const bottom = top + height;

  return (
    <g>
      {seriesDefs.map((s) => (
        <CandleAxisGroup
          key={s.yAxisId}
          labels={labels}
          def={s}
          xMapper={xMapper}
          top={top}
          bottom={bottom}
          left={left}
          right={left + areaWidth}
        />
      ))}
    </g>
  );
};

const CandleAxisGroup: React.FC<{
  labels: string[];
  def: CandleSeriesDef;
  xMapper: (val: unknown) => number;
  top: number;
  bottom: number;
  left: number;
  right: number;
}> = ({ labels, def, xMapper, top, bottom, left, right }) => {
  const yScale = useYScale(def.yAxisId) as unknown as (v: number) => number | undefined;
  if (!yScale) return null;

  const clampY = (y: number) => Math.max(top, Math.min(bottom, y));
  const halfW = def.width / 2;

  return (
    <g>
      {def.candles.map((c, idx) => {
        const label = labels[idx];
        if (!label || c.avg === null) return null;
        const cx = xMapper(label) + def.xOffset;
        if (!isFinite(cx) || cx < left || cx > right) return null;

        const lowVal = c.low ?? c.avg;
        const highVal = c.high ?? c.avg;
        const rawTop = yScale(highVal);
        const rawBottom = yScale(lowVal);
        const rawAvg = yScale(c.avg);
        if (rawTop === undefined || rawBottom === undefined || rawAvg === undefined) return null;

        const yTop = clampY(rawTop);
        const yBottom = clampY(rawBottom);
        const yAvg = clampY(rawAvg);
        const boxH = Math.max(2, yBottom - yTop);

        return (
          <g key={`${def.yAxisId}-${label}`}>
            <rect
              x={cx - halfW}
              y={yTop}
              width={def.width}
              height={boxH}
              rx={1.5}
              fill={def.fillColor}
              stroke={def.strokeColor}
              strokeWidth={1.25}
            />
            <line
              x1={cx - halfW - 1}
              y1={yAvg}
              x2={cx + halfW + 1}
              y2={yAvg}
              stroke={def.strokeColor}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </g>
  );
};

export const ReferenceView: React.FC = () => {
  const [tests, setTests] = useState<ReferenceTest[]>([]);
  const [selectedGame, setSelectedGame] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let mounted = true;
    api
      .getReferenceTests()
      .then((res) => {
        if (mounted) {
          setTests(res.tests || (res as unknown as { reference_tests?: ReferenceTest[] }).reference_tests || []);
        }
      })
      .catch((err) => console.warn("Failed to load reference tests:", err));
    return () => {
      mounted = false;
    };
  }, []);

  const games = ["ALL", ...GAME_ORDER];

  const gameFilteredTests = useMemo(
    () => (selectedGame === "ALL" ? tests : tests.filter((t) => t.game === selectedGame)),
    [tests, selectedGame]
  );

  const filteredTests = useMemo(() => {
    if (!searchQuery) return gameFilteredTests;
    const q = searchQuery.toLowerCase();
    return gameFilteredTests.filter(
      (t) =>
        t.code.toLowerCase().includes(q) ||
        (t.title || t.test || "").toLowerCase().includes(q) ||
        t.car.toLowerCase().includes(q) ||
        t.track.toLowerCase().includes(q) ||
        (t.layout || t.drivetrain_layout || "").toLowerCase().includes(q)
    );
  }, [gameFilteredTests, searchQuery]);

  // Summary metrics
  const totalCount = filteredTests.length;
  const validHp = filteredTests.filter((t) => t.hp && t.hp > 0);
  const avgHp =
    validHp.length > 0
      ? Math.round(validHp.reduce((acc, t) => acc + (t.hp || 0), 0) / validHp.length)
      : 0;

  const validPw = filteredTests
    .map((t) => t.pw_kg_hp ?? t.pw)
    .filter((v): v is number => v !== undefined && v > 0);
  const avgPw =
    validPw.length > 0
      ? (validPw.reduce((acc, v) => acc + v, 0) / validPw.length).toFixed(2)
      : "5.09";

  const timed = filteredTests
    .map((t) => t.gold_s ?? t.gold_seconds)
    .filter((v): v is number => v !== undefined && isFinite(v));
  const totalGoldSec = timed.reduce((acc, v) => acc + v, 0);
  const avgGoldSec = timed.length > 0 ? totalGoldSec / timed.length : 0;

  const showPerGame = selectedGame === "ALL";

  const aggregates = useMemo(
    () => (showPerGame ? aggregateByGame(filteredTests) : aggregateByLicense(filteredTests, selectedGame)),
    [filteredTests, selectedGame, showPerGame]
  );
  const labels = useMemo(() => aggregates.map((a) => a.shortLabel), [aggregates]);

  const pwMax = useMemo(() => {
    const highs = aggregates.map((a) => a.hpKgCandle.high ?? a.avgHpKg).filter((v): v is number => v !== null);
    return highs.length > 0 ? Number((Math.max(...highs) * 1.12).toFixed(2)) : 1.2;
  }, [aggregates]);

  const hpMax = useMemo(() => {
    const highs = aggregates.map((a) => a.hpCandle.high ?? a.avgHp).filter((v): v is number => v !== null);
    return highs.length > 0 ? Math.ceil((Math.max(...highs) * 1.1) / 20) * 20 : 600;
  }, [aggregates]);

  const goldBounds = useMemo(() => {
    const lows = aggregates.map((a) => a.goldCandle.low ?? a.avgDuration).filter((v): v is number => v !== null);
    const highs = aggregates.map((a) => a.goldCandle.high ?? a.avgDuration).filter((v): v is number => v !== null);
    const min = lows.length > 0 ? Math.max(0, Math.floor(Math.min(...lows) * 0.85)) : 0;
    const max = highs.length > 0 ? Math.ceil(Math.max(...highs) * 1.1) : 120;
    return { min, max };
  }, [aggregates]);

  // Distribution curve points (Chart 3)
  const { distX, distY } = useMemo(() => {
    const maxSec = 180;
    const sigma = 3.5;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let s = 2; s <= maxSec; s += 2) {
      let density = 0;
      for (const t of timed) {
        const diff = (t - s) / sigma;
        density += Math.exp(-0.5 * diff * diff);
      }
      xs.push(s);
      ys.push(Number(density.toFixed(2)));
    }
    return { distX: xs, distY: ys };
  }, [timed]);

  // Drivetrain counts (Chart 4)
  const dtCounts = useMemo(() => {
    const counts: Record<DrivetrainKey, number> = { FR: 0, MR: 0, FF: 0, "4WD": 0, RR: 0 };
    filteredTests.forEach((t) => {
      const key = normalizeLayout(t.drivetrain_layout || t.drivetrain || t.layout);
      if (key !== "Other") counts[key]++;
    });
    return counts;
  }, [filteredTests]);

  return (
    <div id="reference-view" className="reference-view">
      <div className="ref-header">
        <div className="ref-title-group">
          <h2>Gran Turismo Driving School Benchmarks</h2>
        </div>

        {/* Game filter pills */}
        <div className="ref-controls">
          <span className="ref-control-label">Select Game:</span>
          <div id="game-selector-pills" className="game-pills">
            {games.map((g, idx) => (
              <React.Fragment key={g}>
                {idx === 5 && <div className="game-pills-break" />}
                <button
                  className={`pill-btn ${selectedGame === g ? "active" : ""}`}
                  onClick={() => setSelectedGame(g)}
                >
                  {g}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Condensed Metrics Summary Card */}
      <div className="ref-card ref-metrics-summary-card">
        <div className="metric-stat-item">
          <div className="metric-icon">
            <Flag size={18} strokeWidth={2} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Total Tests</span>
            <span className="metric-value">{totalCount}</span>
          </div>
        </div>

        <div className="metric-stat-divider" />

        <div className="metric-stat-item">
          <div className="metric-icon">
            <Timer size={18} strokeWidth={2} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Avg Gold Duration</span>
            <span className="metric-value">{timed.length > 0 ? formatTime(avgGoldSec) : "0:00.000"}</span>
          </div>
        </div>

        <div className="metric-stat-divider" />

        <div className="metric-stat-item">
          <div className="metric-icon">
            <Zap size={18} strokeWidth={2} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Average Horsepower</span>
            <span className="metric-value">{avgHp} HP</span>
          </div>
        </div>

        <div className="metric-stat-divider" />

        <div className="metric-stat-item">
          <div className="metric-icon">
            <Scale size={18} strokeWidth={2} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Avg Power / Weight</span>
            <span className="metric-value">{avgPw} kg/hp</span>
          </div>
        </div>
      </div>

      {/* 4 MUI X Charts Grid */}
      <div className="ref-charts-grid">
        {/* Chart 1: Power & Power-to-Weight Ratio (80th Percentile Candles) */}
        <div className="ref-card chart-card">
          <div className="chart-header">
            <div className="chart-title">
              <h3 id="title-chart-power">
                {showPerGame
                  ? "Average Power & Power-to-Weight Ratio by Game"
                  : "Average Power & Power-to-Weight Ratio by License"}
              </h3>
            </div>
          </div>
          <div id="chart-power-pw" className="chart-canvas-wrapper">
            {labels.length > 0 && (
              <ResponsiveChartContainer
                margin={{ top: 16, right: 56, bottom: 32, left: 52 }}
                xAxis={[
                  {
                    id: "x",
                    scaleType: "band",
                    data: labels,
                    tickLabelStyle: { fontSize: 10, fontFamily: "var(--font-mono)" },
                  },
                ]}
                yAxis={[
                  {
                    id: "yPW",
                    min: 0,
                    max: pwMax,
                    label: "Avg P/W (hp/kg)",
                    labelStyle: { fontSize: 11, fill: "#f59e0b" },
                    tickLabelStyle: { fontSize: 10, fill: "#fbbf24", fontFamily: "var(--font-mono)" },
                  },
                  {
                    id: "yHP",
                    min: 0,
                    max: hpMax,
                    label: "Avg Horsepower (HP)",
                    labelStyle: { fontSize: 11, fill: "#ef4444" },
                    tickLabelStyle: { fontSize: 10, fill: "#f87171", fontFamily: "var(--font-mono)" },
                  },
                ]}
                series={[
                  {
                    type: "line",
                    id: "pw",
                    yAxisId: "yPW",
                    label: "Avg P/W (hp/kg)",
                    color: "#f59e0b",
                    data: aggregates.map((a) => a.avgHpKg),
                    valueFormatter: (v, ctx) => {
                      const c = aggregates[ctx.dataIndex]?.hpKgCandle;
                      const band =
                        c?.low !== null && c?.high !== null && c !== undefined
                          ? ` (80% band: ${c.low.toFixed(3)} – ${c.high.toFixed(3)})`
                          : "";
                      return `${v ?? "N/A"} hp/kg${band}`;
                    },
                  },
                  {
                    type: "line",
                    id: "hp",
                    yAxisId: "yHP",
                    label: "Avg Horsepower",
                    color: "#ef4444",
                    data: aggregates.map((a) => a.avgHp),
                    valueFormatter: (v, ctx) => {
                      const c = aggregates[ctx.dataIndex]?.hpCandle;
                      const band =
                        c?.low !== null && c?.high !== null && c !== undefined
                          ? ` (80% band: ${Math.round(c.low)} – ${Math.round(c.high)} HP)`
                          : "";
                      return `${v ?? "N/A"} HP${band}`;
                    },
                  },
                ]}
              >
                <ChartsGrid horizontal />
                <CandlePlotLayer
                  labels={labels}
                  seriesDefs={[
                    {
                      yAxisId: "yPW",
                      candles: aggregates.map((a) => a.hpKgCandle),
                      fillColor: "rgba(245, 158, 11, 0.24)",
                      strokeColor: "#f59e0b",
                      xOffset: -4.5,
                      width: 5.5,
                    },
                    {
                      yAxisId: "yHP",
                      candles: aggregates.map((a) => a.hpCandle),
                      fillColor: "rgba(239, 68, 68, 0.24)",
                      strokeColor: "#ef4444",
                      xOffset: 4.5,
                      width: 5.5,
                    },
                  ]}
                />
                <ChartsAxisHighlight x="band" />
                <ChartsXAxis axisId="x" />
                <ChartsYAxis axisId="yPW" position="left" />
                <ChartsYAxis axisId="yHP" position="right" />
                <ChartsTooltip trigger="axis" slotProps={{ popper: BOUNDED_POPPER_PROPS }} />
              </ResponsiveChartContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Gold Medal Duration (80th Percentile Candles) */}
        <div className="ref-card chart-card">
          <div className="chart-header">
            <div className="chart-title">
              <h3 id="title-chart-gold">
                {showPerGame
                  ? "Average Gold Medal Duration by Game"
                  : "Average Gold Medal Duration by License"}
              </h3>
            </div>
          </div>
          <div id="chart-gold" className="chart-canvas-wrapper">
            {labels.length > 0 && (
              <ResponsiveChartContainer
                margin={{ top: 16, right: 20, bottom: 32, left: 56 }}
                xAxis={[
                  {
                    id: "x",
                    scaleType: "band",
                    data: labels,
                    tickLabelStyle: { fontSize: 10, fontFamily: "var(--font-mono)" },
                  },
                ]}
                yAxis={[
                  {
                    id: "yGold",
                    min: goldBounds.min,
                    max: goldBounds.max,
                    label: "Avg Target Duration (mm:ss)",
                    labelStyle: { fontSize: 11, fill: "#10b981" },
                    tickLabelStyle: { fontSize: 10, fontFamily: "var(--font-mono)" },
                    valueFormatter: (v) => formatShortAxisTime(Number(v)),
                  },
                ]}
                series={[
                  {
                    type: "line",
                    id: "gold",
                    yAxisId: "yGold",
                    label: "Avg Gold Duration",
                    color: "#10b981",
                    data: aggregates.map((a) => a.avgDuration),
                    valueFormatter: (v, ctx) => {
                      if (v === null || v === undefined) return "N/A";
                      const c = aggregates[ctx.dataIndex]?.goldCandle;
                      const band =
                        c?.low !== null && c?.high !== null && c !== undefined
                          ? ` (80% band: ${formatTime(c.low)} – ${formatTime(c.high)})`
                          : "";
                      return `${formatTime(v)}${band}`;
                    },
                  },
                ]}
              >
                <ChartsGrid horizontal />
                <CandlePlotLayer
                  labels={labels}
                  seriesDefs={[
                    {
                      yAxisId: "yGold",
                      candles: aggregates.map((a) => a.goldCandle),
                      fillColor: "rgba(16, 185, 129, 0.24)",
                      strokeColor: "#10b981",
                      xOffset: 0,
                      width: 7,
                    },
                  ]}
                />
                <ChartsAxisHighlight x="band" />
                <ChartsXAxis axisId="x" />
                <ChartsYAxis axisId="yGold" position="left" />
                <ChartsTooltip trigger="axis" slotProps={{ popper: BOUNDED_POPPER_PROPS }} />
              </ResponsiveChartContainer>
            )}
          </div>
        </div>

        {/* Chart 3: Distribution of Gold Times */}
        <div className="ref-card chart-card">
          <div className="chart-header">
            <div className="chart-title">
              <h3>Distribution of Gold Times</h3>
            </div>
          </div>
          <div id="chart-gold-dist" className="chart-canvas-wrapper">
            <LineChart
              margin={{ top: 16, right: 20, bottom: 42, left: 52 }}
              xAxis={[
                {
                  data: distX,
                  min: 0,
                  max: 180,
                  label: "Gold Target Time",
                  labelStyle: { fontSize: 11, fill: "#06b6d4" },
                  tickLabelStyle: { fontSize: 10, fontFamily: "var(--font-mono)" },
                  valueFormatter: (v) => `${v}s`,
                },
              ]}
              yAxis={[
                {
                  label: "Relative Test Frequency",
                  labelStyle: { fontSize: 11 },
                  tickLabelStyle: { fontSize: 10, fontFamily: "var(--font-mono)" },
                },
              ]}
              series={[
                {
                  data: distY,
                  label: "Test Concentration Density",
                  color: "#06b6d4",
                  area: true,
                  showMark: false,
                },
              ]}
              grid={{ horizontal: true, vertical: true }}
              slotProps={{ legend: { hidden: true }, popper: BOUNDED_POPPER_PROPS }}
              sx={{
                "& .MuiAreaElement-root": {
                  fillOpacity: 0.18,
                },
              }}
            />
          </div>
        </div>

        {/* Chart 4: Car Drivetrain Architecture Distribution */}
        <div className="ref-card chart-card">
          <div className="chart-header">
            <div className="chart-title">
              <h3>Car Drivetrain Architecture Distribution</h3>
            </div>
          </div>
          <div id="chart-drivetrain" className="chart-canvas-wrapper">
            <BarChart
              layout="horizontal"
              margin={{ top: 16, right: 20, bottom: 28, left: 48 }}
              yAxis={[
                {
                  scaleType: "band",
                  data: LAYOUT_SPECS.map((s) => s.key),
                  tickLabelStyle: { fontSize: 11, fontFamily: "var(--font-mono)" },
                  colorMap: {
                    type: "ordinal",
                    values: LAYOUT_SPECS.map((s) => s.key),
                    colors: LAYOUT_SPECS.map((s) => s.color),
                  },
                },
              ]}
              xAxis={[
                {
                  tickLabelStyle: { fontSize: 10, fontFamily: "var(--font-mono)" },
                },
              ]}
              series={[
                {
                  data: LAYOUT_SPECS.map((s) => dtCounts[s.key]),
                  label: "Tests Count",
                },
              ]}
              grid={{ vertical: true }}
              borderRadius={4}
              slotProps={{ legend: { hidden: true }, popper: BOUNDED_POPPER_PROPS }}
            />
          </div>
        </div>
      </div>

      {/* Documentation Table */}
      <div className="ref-card table-card" style={{ marginTop: "16px", marginBottom: "24px" }}>
        <div className="table-card-header">
          <div className="table-title">
            <h3 style={{ fontSize: "14px", fontWeight: 600 }}>Constant Values Documentation Table</h3>
          </div>
          <div className="table-filters" style={{ display: "flex", gap: "10px" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={14} style={{ position: "absolute", left: 10, color: "var(--text-dim)" }} />
              <input
                type="text"
                className="form-control table-search"
                style={{ paddingLeft: "30px", height: "32px", fontSize: "12px" }}
                placeholder="Search test, car, track, layout..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="table-responsive" style={{ maxHeight: "500px", overflowY: "auto" }}>
          <table className="ref-data-table">
            <thead>
              <tr>
                <th>Test ID</th>
                <th>Game</th>
                <th>Tier</th>
                <th>Title</th>
                <th>Car Model</th>
                <th>HP</th>
                <th>P/W (kg/hp)</th>
                <th>Track / Sector</th>
                <th>Gold Target</th>
              </tr>
            </thead>
            <tbody>
              {filteredTests.slice(0, 100).map((t, idx) => (
                <tr key={`${t.game}-${t.code}-${idx}`}>
                  <td className="mono" style={{ color: "var(--accent-gold)", fontWeight: 600 }}>
                    {t.code}
                  </td>
                  <td>{t.game}</td>
                  <td>{t.tier || t.license}</td>
                  <td style={{ fontWeight: 500 }}>{t.title || t.test}</td>
                  <td>{t.car}</td>
                  <td className="mono">{t.hp || "--"}</td>
                  <td className="mono">{(t.pw_kg_hp ?? t.pw) ? Number(t.pw_kg_hp ?? t.pw).toFixed(2) : "--"}</td>
                  <td>{t.track}</td>
                  <td className="mono" style={{ color: "var(--accent-gold)" }}>
                    {t.gold}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
