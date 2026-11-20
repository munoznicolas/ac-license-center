import React from "react";
import { Download, RefreshCw, Radio, Upload, RotateCcw, HelpCircle, Sun, Moon, Mail, GitPullRequest, FileJson } from "lucide-react";
import { api, isStaticHost } from "../../api/client";
import { useCurriculum } from "../../context/CurriculumContext";
import { buildAndExportModZip } from "../../utils/modPackager";

interface Props {
  isOpen: boolean;
  theme: "light" | "dark";
  onClose: () => void;
  onToggleTheme: () => void;
  onOpenBatchTelemetry: () => void;
  onOpenContact: () => void;
  onOpenTelemetrySubmit: () => void;
  onOpenTour: () => void;
  onShowToast: (msg: string, type?: "info" | "success" | "error") => void;
}

export const DrawerMenu: React.FC<Props> = ({
  isOpen,
  theme,
  onClose,
  onToggleTheme,
  onOpenBatchTelemetry,
  onOpenContact,
  onOpenTelemetrySubmit,
  onOpenTour,
  onShowToast,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const { curriculum, importCurriculum, exportCurriculum, resetCurriculum } = useCurriculum();
  const staticMode = isStaticHost();

  const handleExportZip = async () => {
    onShowToast("Building Content Manager mod package...", "info");
    try {
      if (staticMode) {
        await buildAndExportModZip(curriculum);
        onShowToast("Mod package ZIP downloaded!", "success");
      } else {
        await api.generateAndValidate();
        onShowToast("Export generated successfully!", "success");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast(`Export error: ${msg}`, "error");
    }
  };

  const handleSyncAc = async () => {
    onShowToast("Syncing changes to Assetto Corsa...", "info");
    try {
      await api.syncToAc();
      onShowToast("Synced to Assetto Corsa!", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast(`Sync failed: ${msg}`, "error");
    }
  };

  return (
    <>
      <div
        className={`actions-menu-backdrop ${isOpen ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={`header-actions ${isOpen ? "open" : ""}`}>
        <div className="actions-drawer-header">
          <span className="actions-drawer-title">Actions</span>
        </div>

        {/* Primary Actions */}
        <button
          id="btn-rebuild"
          className="btn btn-secondary"
          title="Export Content Manager package (.zip)"
          onClick={() => {
            onClose();
            void handleExportZip();
          }}
        >
          <Download size={15} strokeWidth={1.75} />
          <span>Export Package (.zip)</span>
        </button>

        {!staticMode && (
          <button
            id="btn-sync"
            className="btn btn-secondary"
            title="Sync changes directly to Assetto Corsa install"
            onClick={() => {
              onClose();
              void handleSyncAc();
            }}
          >
            <RefreshCw size={15} strokeWidth={1.75} />
            <span>Sync to Assetto Corsa</span>
          </button>
        )}

        <div className="menu-divider" />

        {/* Telemetry & Curriculum Tools */}
        {!staticMode && (
          <button
            id="btn-run-missing-telemetry"
            className="btn btn-secondary btn-sm"
            title="Batch run/record telemetry in Assetto Corsa for missing track+car profiles"
            onClick={() => {
              onClose();
              onOpenBatchTelemetry();
            }}
          >
            <Radio size={15} strokeWidth={1.75} />
            <span>Record Missing Telemetry</span>
          </button>
        )}

        <button
          id="btn-open-submit-pr-modal"
          className="btn btn-secondary btn-sm"
          title="Submit recorded AI telemetry JSON as a community Pull Request"
          onClick={() => {
            onClose();
            onOpenTelemetrySubmit();
          }}
        >
          <GitPullRequest size={15} strokeWidth={1.75} />
          <span>Submit Telemetry PR</span>
        </button>

        <button
          id="btn-export-json"
          className="btn btn-secondary btn-sm"
          title="Download active curriculum.json"
          onClick={() => {
            exportCurriculum();
            onClose();
            onShowToast("Exported curriculum.json", "success");
          }}
        >
          <FileJson size={15} strokeWidth={1.75} />
          <span>Export JSON</span>
        </button>

        <button
          id="btn-import-json"
          className="btn btn-secondary btn-sm"
          title="Import and restore curriculum.json configuration file"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={15} strokeWidth={1.75} />
          <span>Import JSON</span>
        </button>
        <input
          type="file"
          ref={fileInputRef}
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              await importCurriculum(file);
              onShowToast(`Imported ${file.name}`, "success");
              onClose();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              onShowToast(`Import failed: ${msg}`, "error");
            }
          }}
        />

        <button
          id="btn-reset-defaults"
          className="btn btn-secondary btn-sm"
          title="Reset curriculum back to baseline defaults"
          onClick={async () => {
            if (window.confirm("Reset all curriculum tests to original defaults?")) {
              try {
                await resetCurriculum();
                onClose();
                onShowToast("Curriculum reset to defaults", "success");
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                onShowToast(`Reset failed: ${msg}`, "error");
              }
            }
          }}
        >
          <RotateCcw size={15} strokeWidth={1.75} />
          <span>Reset Defaults</span>
        </button>

        <div className="menu-divider" />

        {/* Preferences, Contact & Tour */}
        <button
          id="btn-contact-dev"
          className="btn btn-secondary btn-sm"
          title="Send feedback or bug reports to the developer"
          onClick={() => {
            onClose();
            onOpenContact();
          }}
        >
          <Mail size={15} strokeWidth={1.75} />
          <span>Contact Developer</span>
        </button>

        <button
          id="btn-tour-help"
          className="btn btn-secondary btn-sm"
          title="Interactive Onboarding Tours & Help"
          onClick={() => {
            onClose();
            onOpenTour();
          }}
        >
          <HelpCircle size={15} strokeWidth={1.75} />
          <span>Take Tour</span>
        </button>

        <button
          id="btn-theme-toggle"
          className="btn btn-secondary btn-sm"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          onClick={onToggleTheme}
        >
          {theme === "dark" ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
          <span>{theme === "dark" ? "Light Theme" : "Dark Theme"}</span>
        </button>
      </div>
    </>
  );
};
