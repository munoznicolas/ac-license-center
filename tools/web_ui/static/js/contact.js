/**
 * contact.js
 * Developer contact modal and issue/feedback submission via Cloudflare Worker.
 */

import { api } from "./api.js";
import { showToast } from "./ui-utils.js";

// Set email when ready to expose a direct mailto/copy option in the modal.
const DEV_CONTACT = {
  name: "Nicolas Munoz",
  email: "",
};

/**
 * Initialize the Developer Contact modal and form handlers.
 */
export function initContactModal() {
  const modal = document.getElementById("modal-contact-dev");
  const openBtn = document.getElementById("btn-contact-dev");
  const closeBtn = document.getElementById("modal-contact-close");
  const cancelBtn = document.getElementById("btn-contact-cancel");
  const form = document.getElementById("form-contact-dev");

  if (!modal || !openBtn || !form) return;

  const devNameEl = document.getElementById("contact-dev-name");
  const emailRow = document.getElementById("contact-dev-email-row");
  const emailLink = document.getElementById("contact-dev-email-link");
  const copyEmailBtn = document.getElementById("btn-copy-dev-email");

  if (devNameEl) devNameEl.textContent = DEV_CONTACT.name;
  if (DEV_CONTACT.email && emailRow && emailLink) {
    emailLink.textContent = DEV_CONTACT.email;
    emailLink.href = `mailto:${DEV_CONTACT.email}?subject=${encodeURIComponent("AC License Center")}`;
    emailRow.style.display = "flex";
  }

  copyEmailBtn?.addEventListener("click", async () => {
    if (!DEV_CONTACT.email) return;
    try {
      await navigator.clipboard.writeText(DEV_CONTACT.email);
      showToast("Developer email copied to clipboard.", "success");
    } catch {
      showToast("Could not copy email automatically.", "warning");
    }
  });

  const statusBanner = document.getElementById("contact-status-banner");
  const successCard = document.getElementById("contact-success-card");
  const issueLink = document.getElementById("contact-issue-link");
  const submitBtn = document.getElementById("btn-contact-submit");
  const nameInput = document.getElementById("contact-name");
  const emailInput = document.getElementById("contact-email");
  const topicInput = document.getElementById("contact-topic");
  const messageInput = document.getElementById("contact-message");
  const websiteInput = document.getElementById("contact-website");

  const setStatus = (text, isError = false) => {
    if (!statusBanner) return;
    if (!text) {
      statusBanner.style.display = "none";
      return;
    }
    statusBanner.textContent = text;
    statusBanner.style.display = "block";
    statusBanner.style.background = isError ? "rgba(239, 68, 68, 0.14)" : "rgba(56, 189, 248, 0.14)";
    statusBanner.style.border = `1px solid ${isError ? "var(--accent-red, #ef4444)" : "var(--accent-sky, #38bdf8)"}`;
    statusBanner.style.color = isError ? "#fca5a5" : "var(--text-main)";
  };

  const openContactModal = () => {
    setStatus("");
    if (successCard) successCard.style.display = "none";
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send Message";
    }
    modal.style.display = "flex";
    nameInput?.focus();
  };

  const closeContactModal = () => {
    modal.style.display = "none";
  };

  openBtn.addEventListener("click", openContactModal);
  closeBtn?.addEventListener("click", closeContactModal);
  cancelBtn?.addEventListener("click", closeContactModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeContactModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.style.display === "flex") {
      closeContactModal();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("");
    if (successCard) successCard.style.display = "none";

    const name = (nameInput?.value || "").trim();
    const email = (emailInput?.value || "").trim();
    const topic = topicInput?.value || "feedback";
    const message = (messageInput?.value || "").trim();
    const website = websiteInput?.value || "";

    if (name.length < 1 || name.length > 80) {
      setStatus("Please enter your name (1–80 characters).", true);
      nameInput?.focus();
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("Please enter a valid email address or leave it blank.", true);
      emailInput?.focus();
      return;
    }
    if (message.length < 10) {
      setStatus("Please enter a message of at least 10 characters.", true);
      messageInput?.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";
    }
    setStatus("Sending message...");

    try {
      const res = await api.submitContactMessage({ name, email, topic, message, website });
      if (!res || !res.success) {
        setStatus(res?.error || "Failed to send message. Please try again or use GitHub Issues.", true);
        return;
      }

      setStatus("");
      if (successCard) successCard.style.display = "block";
      if (issueLink && res.issue_url && res.issue_url.startsWith("https://github.com/")) {
        issueLink.href = res.issue_url;
        issueLink.style.display = "inline-flex";
      } else if (issueLink) {
        issueLink.style.display = "none";
      }
      form.reset();
      showToast("Message sent to developer!", "success");
    } catch (err) {
      setStatus(`Network error: ${err.message}`, true);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Message";
      }
    }
  });
}
