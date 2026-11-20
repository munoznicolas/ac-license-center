import React, { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert, Box, Typography, Link } from "@mui/material";
import { FolderOpen, Check } from "lucide-react";
import { api } from "../../api/client";
import { validateTelemetryPayload, ValidatedTelemetryResult } from "../../utils/telemetrySubmitter";
import { saveCustomTelemetryProfile } from "../../utils/telemetryStore";

const DEFAULT_GOOGLE_CLIENT_ID =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GOOGLE_CLIENT_ID ||
  localStorage.getItem("gt_google_client_id") ||
  "";

interface GoogleUser {
  name: string;
  email: string;
  token: string;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

function decodeJwtPayload(jwt: string): { name?: string; email?: string } | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, type?: "info" | "success" | "error") => void;
}

export const TelemetrySubmitModal: React.FC<Props> = ({ isOpen, onClose, onShowToast }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const gsiButtonRef = useRef<HTMLDivElement | null>(null);

  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(() => {
    try {
      const name = localStorage.getItem("gt_contributor_name");
      const email = localStorage.getItem("gt_contributor_email");
      const token = localStorage.getItem("gt_google_id_token");
      if (name && email && token && token !== "demo_token") {
        return { name, email, token };
      }
    } catch {}
    return null;
  });

  const [parsed, setParsed] = useState<ValidatedTelemetryResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCredential = useCallback(
    (credential: string) => {
      const payload = decodeJwtPayload(credential);
      const user: GoogleUser = {
        name: payload?.name || "Google Contributor",
        email: payload?.email || "contributor@google.com",
        token: credential,
      };
      setGoogleUser(user);
      setError(null);
      try {
        localStorage.setItem("gt_contributor_name", user.name);
        localStorage.setItem("gt_contributor_email", user.email);
        localStorage.setItem("gt_google_id_token", user.token);
      } catch {}
      onShowToast(`Signed in as ${user.name}`, "success");
    },
    [onShowToast]
  );

  // Load Google Identity Services script on modal open if client_id is configured
  useEffect(() => {
    if (!isOpen || googleUser || !DEFAULT_GOOGLE_CLIENT_ID) return;

    const initGsi = () => {
      if (window.google?.accounts?.id && gsiButtonRef.current) {
        window.google.accounts.id.initialize({
          client_id: DEFAULT_GOOGLE_CLIENT_ID,
          callback: (resp) => {
            if (resp.credential) handleCredential(resp.credential);
          },
        });
        window.google.accounts.id.renderButton(gsiButtonRef.current, {
          theme: "outline",
          size: "medium",
          text: "signin_with",
        });
      }
    };

    if (window.google?.accounts?.id) {
      initGsi();
      return;
    }

    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (!existing) {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = initGsi;
      document.head.appendChild(s);
    }
  }, [isOpen, googleUser, handleCredential]);

  const handleManualGoogleSignIn = () => {
    if (window.google?.accounts?.id && DEFAULT_GOOGLE_CLIENT_ID) {
      window.google.accounts.id.prompt();
      return;
    }
    setError(
      "Google Sign-In is required to authenticate submissions to the Telemetry PR Gateway (guests cannot create Pull Requests). Please sign in with Google."
    );
  };

  const handleSignOut = () => {
    setGoogleUser(null);
    try {
      localStorage.removeItem("gt_contributor_name");
      localStorage.removeItem("gt_contributor_email");
      localStorage.removeItem("gt_google_id_token");
    } catch {}
  };

  const handleFile = async (file: File) => {
    setError(null);
    setPrUrl(null);
    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Please select a valid .json telemetry profile file.");
      return;
    }
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const validated = validateTelemetryPayload(json);
      setParsed(validated);
      await saveCustomTelemetryProfile(validated.payload);
      onShowToast(`Validated telemetry for ${validated.carId} @ ${validated.trackId}!`, "success");
    } catch (err: unknown) {
      setParsed(null);
      setError(err instanceof Error ? err.message : "Invalid telemetry JSON file.");
    }
  };

  const handleSubmit = async () => {
    if (!googleUser) {
      setError("Please sign in with Google before submitting a Pull Request.");
      return;
    }
    if (!parsed) {
      setError("Please select a valid telemetry JSON file first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.submitTelemetryProfile({
        googleToken: googleUser.token,
        filename: parsed.filename,
        telemetryData: {
          ...parsed.payload,
          contributor_name: googleUser.name,
          contributor_email: googleUser.email,
        },
      });
      if (!res?.success) {
        setError(res?.error || "Telemetry submission failed.");
        return;
      }
      if (res.pr_url) setPrUrl(res.pr_url);
      onShowToast("Telemetry Pull Request created!", "success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error submitting telemetry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: "16px", fontWeight: 600 }}>
        Submit Telemetry Profile (Create Pull Request)
      </DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: "13px", lineHeight: 1.5 }}>
          Submit your recorded Assetto Corsa AI telemetry profile directly to the repository.
          No Git knowledge or command-line required — just sign in with Google, drop your JSON file,
          and an autoformatted Pull Request will be created for review.
        </Typography>

        {error && <Alert severity="error">{error}</Alert>}
        {prUrl && (
          <Alert severity="success">
            Pull Request created!{" "}
            <Link href={prUrl} target="_blank" rel="noopener noreferrer">
              View Pull Request on GitHub
            </Link>
          </Alert>
        )}

        {/* Step 1: Google Authentication */}
        <Box
          sx={{
            p: 1.75,
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--bg-card)",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography
              sx={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-main)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              1. Contributor Identity
            </Typography>
            <span
              id="google-auth-status"
              className="badge"
              style={
                googleUser
                  ? {
                      background: "rgba(34, 197, 94, 0.2)",
                      color: "#4ade80",
                      border: "1px solid rgba(34, 197, 94, 0.4)",
                    }
                  : {
                      background: "rgba(148, 163, 184, 0.2)",
                      color: "#94a3b8",
                      border: "1px solid rgba(148, 163, 184, 0.3)",
                    }
              }
            >
              {googleUser ? "Authenticated" : "Not Signed In"}
            </span>
          </Box>

          <Box id="google-signin-container" sx={{ display: "flex", alignItems: "center", gap: 1.5, minHeight: 36 }}>
            {!googleUser ? (
              <>
                <div ref={gsiButtonRef} />
                {!DEFAULT_GOOGLE_CLIENT_ID && (
                  <button
                    type="button"
                    id="btn-manual-contributor-id"
                    className="btn btn-sm btn-secondary"
                    onClick={handleManualGoogleSignIn}
                  >
                    Sign in with Google
                  </button>
                )}
              </>
            ) : (
              <Box id="user-profile-badge" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                <span
                  id="user-display-name"
                  style={{ color: "var(--accent-green)", fontWeight: 500, fontSize: "13px" }}
                >
                  {googleUser.name} ({googleUser.email})
                </span>
                <button
                  type="button"
                  id="btn-signout-google"
                  className="btn btn-xs btn-secondary"
                  style={{ fontSize: "11px", padding: "2px 8px" }}
                  onClick={handleSignOut}
                >
                  Sign Out
                </button>
              </Box>
            )}
          </Box>
        </Box>

        {/* Step 2: Telemetry JSON File Dropzone */}
        <Box
          sx={{
            p: 1.75,
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--bg-card)",
          }}
        >
          <Typography
            sx={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-main)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              mb: 1,
            }}
          >
            2. Telemetry Result File (.json)
          </Typography>

          <Box
            id="telemetry-dropzone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const f = e.dataTransfer?.files?.[0];
              if (f) void handleFile(f);
            }}
            sx={{
              border: "1px dashed var(--border-color)",
              borderColor: isDragOver ? "var(--accent-sky)" : "var(--border-color)",
              borderRadius: 2,
              p: 3,
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "center", mb: 0.75, color: "var(--text-muted)" }}>
              <FolderOpen size={28} />
            </Box>
            <Typography sx={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)" }}>
              Drag &amp; drop telemetry profile JSON here
            </Typography>
            <Typography sx={{ fontSize: "11px", color: "var(--text-dim)", mt: 0.5 }}>
              or click to browse from <code>data/telemetry_profiles/</code>
            </Typography>
            <input
              id="telemetry-file-input"
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </Box>

          {/* File Preview Card */}
          {parsed && (
            <Box
              id="telemetry-file-preview"
              sx={{
                mt: 1.5,
                p: 1.5,
                borderRadius: 1.5,
                backgroundColor: "var(--accent-sky-bg)",
                border: "1px solid var(--accent-sky-border)",
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <strong
                  id="preview-filename"
                  style={{ color: "var(--accent-sky)", fontFamily: "var(--font-mono)", fontSize: "12px" }}
                >
                  {parsed.filename}
                </strong>
                <span
                  id="preview-valid-badge"
                  className="badge"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "var(--accent-green-bg)",
                    color: "var(--accent-green)",
                    border: "1px solid var(--accent-green-border)",
                  }}
                >
                  <Check size={12} /> Valid Profile
                </span>
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 1,
                  fontSize: "11.5px",
                  color: "var(--text-main)",
                }}
              >
                <div>
                  <strong>Track:</strong> <span>{parsed.trackId}</span>
                </div>
                <div>
                  <strong>Layout:</strong> <span>{parsed.layout || "(default)"}</span>
                </div>
                <div>
                  <strong>Car:</strong> <span>{parsed.carId}</span>
                </div>
                <div>
                  <strong>Samples:</strong> <span>{parsed.sampleCount.toLocaleString()} pts</span>
                </div>
                <div>
                  <strong>Top Speed:</strong> <span>{parsed.maxSpeed} km/h</span>
                </div>
                <div>
                  <strong>Lap Time:</strong> <span>{parsed.lapTime}s</span>
                </div>
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: "space-between" }}>
        <Button id="btn-submit-pr-cancel" onClick={onClose} disabled={submitting} color="inherit">
          Close
        </Button>
        <Button
          id="btn-submit-telemetry-pr"
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting || !googleUser || !parsed}
          sx={{
            backgroundColor: "var(--gt-blue, #2563eb)",
            color: "#ffffff",
            fontWeight: 600,
            "&:hover": {
              backgroundColor: "#1d4ed8",
            },
          }}
        >
          {submitting ? "Submitting Pull Request..." : "Submit Pull Request"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
