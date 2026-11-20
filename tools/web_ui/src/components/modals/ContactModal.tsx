import React, { useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Alert, Box, Typography, Link } from "@mui/material";
import { api } from "../../api/client";
import { validateContactInput } from "../../utils/contactValidation";
import { CharQuotaRing } from "../editor/LessonCard";

const MESSAGE_MAX_LENGTH = 500;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, type?: "info" | "success" | "error") => void;
}

export const ContactModal: React.FC<Props> = ({ isOpen, onClose, onShowToast }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("feedback");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);

  const handleClose = () => {
    setError(null);
    setIssueUrl(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIssueUrl(null);

    const validationError = validateContactInput({ name, email, message });
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.submitContactMessage({
        name: name.trim(),
        email: email.trim(),
        topic,
        message: message.trim(),
        website,
      });
      if (!res?.success) {
        setError(res?.error || "Failed to send message. Please try again or use GitHub Issues.");
        return;
      }
      if (res.issue_url && res.issue_url.startsWith("https://github.com/")) {
        setIssueUrl(res.issue_url);
      }
      setName("");
      setEmail("");
      setMessage("");
      onShowToast("Message sent to developer!", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Network error: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const uniformInputSx = {
    "& .MuiInputBase-root": {
      fontFamily: "var(--font-body)",
      fontSize: "13px",
      alignItems: "center",
    },
    "& .MuiInputBase-input, & .MuiSelect-select": {
      fontFamily: "var(--font-body)",
      fontSize: "13px",
      lineHeight: "20px",
      padding: "8px 12px",
      display: "flex",
      alignItems: "center",
    },
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: "16px", fontWeight: 600 }}>Contact Developer</DialogTitle>
      <form onSubmit={handleSubmit} noValidate>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: "13px" }}>
            Send feedback, bug reports, or questions directly to Nicolas Munoz via GitHub Issues.
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}
          {issueUrl && (
            <Alert severity="success">
              Message received!{" "}
              <Link href={issueUrl} target="_blank" rel="noopener noreferrer">
                View GitHub Issue
              </Link>
            </Alert>
          )}

          <TextField
            id="contact-name"
            placeholder="Your Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            size="small"
            inputProps={{ maxLength: 80, "aria-label": "Your Name" }}
            sx={uniformInputSx}
          />
          <TextField
            id="contact-email"
            type="email"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            size="small"
            inputProps={{ maxLength: 120, "aria-label": "Email (optional)" }}
            sx={uniformInputSx}
          />
          <TextField
            id="contact-topic"
            select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            fullWidth
            size="small"
            SelectProps={{ inputProps: { "aria-label": "Topic" } }}
            sx={uniformInputSx}
          >
            <MenuItem value="feedback" sx={{ fontSize: "13px" }}>General Feedback</MenuItem>
            <MenuItem value="bug" sx={{ fontSize: "13px" }}>Bug Report</MenuItem>
            <MenuItem value="feature" sx={{ fontSize: "13px" }}>Feature Request</MenuItem>
            <MenuItem value="telemetry" sx={{ fontSize: "13px" }}>Telemetry / Track Issue</MenuItem>
          </TextField>

          <div className="input-ring-wrap">
            <TextField
              id="contact-message"
              placeholder="Describe your feedback or issue (min 10 characters) *"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              multiline
              minRows={3}
              fullWidth
              size="small"
              inputProps={{ maxLength: MESSAGE_MAX_LENGTH, "aria-label": "Message" }}
              sx={{
                "& .MuiInputBase-root": {
                  fontFamily: "var(--font-body)",
                  fontSize: "13px",
                  padding: "8px 12px",
                },
                "& .MuiInputBase-inputMultiline": {
                  fontFamily: "var(--font-body)",
                  fontSize: "13px",
                  lineHeight: "20px",
                  padding: 0,
                  paddingRight: "28px",
                },
              }}
            />
            <CharQuotaRing length={message.length} max={MESSAGE_MAX_LENGTH} />
          </div>

          <Box sx={{ display: "none" }} aria-hidden="true">
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={submitting} color="inherit">
            Close
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            sx={{
              backgroundColor: "var(--gt-blue, #2563eb)",
              color: "#ffffff",
              fontWeight: 600,
              "&:hover": {
                backgroundColor: "#1d4ed8",
              },
            }}
          >
            {submitting ? "Sending..." : "Send Message"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
