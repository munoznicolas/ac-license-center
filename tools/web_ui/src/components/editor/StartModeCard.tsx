import React from "react";
import { CircleDot, Gauge } from "lucide-react";

interface Props {
  startMode: "STANDING" | "ROLLING";
  withStopBox: boolean;
  rollingSpeedKmh?: number;
  initialGear?: number;
  initialRpm?: number;
  onStartModeChange: (mode: "STANDING" | "ROLLING") => void;
  onStopBoxToggle: (checked: boolean) => void;
}

export const StartModeCard: React.FC<Props> = ({
  startMode,
  withStopBox,
  rollingSpeedKmh,
  initialGear,
  initialRpm,
  onStartModeChange,
  onStopBoxToggle,
}) => {
  return (
    <div className="card form-card">
      <div className="card-title">Start Mode & Physics Initialization</div>
      <div className="start-mode-selector">
        {/* Standing */}
        <label
          className={`mode-card ${startMode === "STANDING" ? "active" : ""}`}
          onClick={() => onStartModeChange("STANDING")}
        >
          <input
            type="radio"
            name="start_mode"
            value="STANDING"
            checked={startMode === "STANDING"}
            onChange={() => onStartModeChange("STANDING")}
          />
          <div className="mode-body">
            <span className="mode-icon">
              <CircleDot size={18} strokeWidth={1.75} />
            </span>
            <div className="mode-text">
              <strong>Standing Start</strong>
            </div>
          </div>
        </label>

        {/* Rolling */}
        <label
          className={`mode-card ${startMode === "ROLLING" ? "active" : ""}`}
          onClick={() => onStartModeChange("ROLLING")}
        >
          <input
            type="radio"
            name="start_mode"
            value="ROLLING"
            checked={startMode === "ROLLING"}
            onChange={() => onStartModeChange("ROLLING")}
          />
          <div className="mode-body">
            <span className="mode-icon">
              <Gauge size={18} strokeWidth={1.75} />
            </span>
            <div className="mode-text">
              <strong>Rolling Start</strong>
            </div>
          </div>
        </label>
      </div>

      {startMode !== "STANDING" && rollingSpeedKmh !== undefined && (
        <div className="badge badge-gold mt-2" style={{ marginTop: "10px", display: "inline-flex" }}>
          <span>
            Initial Speed: {Math.round(rollingSpeedKmh)} km/h
            {initialGear ? ` | Gear ${initialGear}` : ""}
            {initialRpm ? ` @ ${initialRpm} RPM` : ""}
          </span>
        </div>
      )}

      <div style={{ marginTop: "12px" }}>
        <label className="checkbox-label" style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            id="check-stop-box"
            checked={withStopBox}
            onChange={(e) => onStopBoxToggle(e.target.checked)}
          />
          <span style={{ fontSize: "12.5px" }}>Require Stop Box (Acceleration & Threshold Braking Test)</span>
        </label>
      </div>
    </div>
  );
};
