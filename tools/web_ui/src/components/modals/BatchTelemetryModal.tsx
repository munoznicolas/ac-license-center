import React, { useState, useEffect } from "react";
import { Play, Download } from "lucide-react";
import { api } from "../../api/client";
import { TelemetryMissingCombo } from "../../types";
import { generatePowerShellRecordingScript, triggerScriptDownload } from "../../utils/queueRunner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, type?: "info" | "success" | "error") => void;
}

export const BatchTelemetryModal: React.FC<Props> = ({ isOpen, onClose, onShowToast }) => {
  const [combos, setCombos] = useState<TelemetryMissingCombo[]>([]);
  const [selectedTier, setSelectedTier] = useState("ALL");
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    api
      .getMissingTelemetry(selectedTier)
      .then((data) => {
        setCombos(data.missing_combos || []);
      })
      .catch((err) => {
        onShowToast(`Failed to load missing combos: ${err.message}`, "error");
      });
  }, [isOpen, selectedTier, onShowToast]);

  if (!isOpen) return null;

  const handleRunQueue = async () => {
    setIsRunning(true);
    try {
      const res = await api.queueMissingTelemetry(selectedTier);
      onShowToast(`Enqueued ${res.queued_count} telemetry jobs!`, "success");
      onClose();
    } catch (err: any) {
      onShowToast(`Queue failed: ${err.message}`, "error");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="modal" style={{ display: "flex" }}>
      <div className="modal-content" style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <h3 id="telemetry-modal-title">Record Missing Telemetry</h3>
          <button className="modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px", lineHeight: 1.5 }}>
            Rolling start tests require an authentic 100% AI flying lap telemetry profile for their track and car combination to calibrate initial gate speed, gear, RPM, and spawn run-up distance.
          </p>

          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              marginBottom: 14,
              background: "var(--bg-input)",
              padding: "10px 14px",
              borderRadius: 6,
              border: "1px solid var(--border-color)",
            }}
          >
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                License Tier
              </label>
              <select
                className="form-control form-control-sm"
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                style={{ minWidth: 170 }}
              >
                <option value="ALL">All License Tiers</option>
                <option value="National B">National B</option>
                <option value="National A">National A</option>
                <option value="International B">International B</option>
                <option value="International A">International A</option>
                <option value="Super License">Super License</option>
              </select>
            </div>
          </div>

          <div className="table-responsive" style={{ maxHeight: 250, overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: 8 }}>
            <table className="ref-data-table" style={{ fontSize: "12px", width: "100%" }}>
              <thead>
                <tr>
                  <th>Track</th>
                  <th>Layout</th>
                  <th>Car Model</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {combos.map((c, idx) => (
                  <tr key={`${c.track_id}-${c.car_id}-${idx}`}>
                    <td>{c.track_id}</td>
                    <td>{c.track_layout || "Default"}</td>
                    <td className="mono">{c.car_id}</td>
                    <td>
                      <span className="badge badge-warning">Missing</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={combos.length === 0}
              onClick={() => {
                const safeTier = selectedTier.toLowerCase().replace(/\s+/g, "_");
                const filename = `record_telemetry_${safeTier}.ps1`;
                const script = generatePowerShellRecordingScript(combos, { aiLevel: 100 });
                triggerScriptDownload(filename, script);
                onShowToast(`Downloaded ${filename} (${combos.length} jobs)!`, "success");
              }}
            >
              <Download size={14} />
              <span>Export PowerShell Script (.ps1)</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isRunning || combos.length === 0}
              onClick={handleRunQueue}
            >
              <Play size={14} />
              <span>{isRunning ? "Queuing..." : `Run Telemetry for ${combos.length} Missing Combos`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
