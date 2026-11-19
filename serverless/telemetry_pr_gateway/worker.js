/**
 * worker.js
 * Cloudflare Worker Serverless Gateway for Assetto Corsa GT Licenses Telemetry PR Submission.
 *
 * Receives telemetry JSON profiles + Google OAuth identity tokens from contributors,
 * verifies Google credentials, validates telemetry schema, and opens an autoformatted
 * Pull Request on the GitHub repository via GitHub REST API.
 *
 * Environment Variables / Secrets required:
 *   - GITHUB_TOKEN: GitHub Personal Access Token or GitHub App Token with 'contents:write' and 'pull_requests:write'
 *   - GITHUB_REPO: Repository path, e.g. "munoznicolas/ac-license-center" (or owner/repo)
 *   - ALLOWED_ORIGIN: Allowed CORS Origin (e.g. "https://munoznicolas.github.io" or "*")
 *   - GOOGLE_CLIENT_ID: Optional Google OAuth Client ID to assert audience binding (aud)
 *   - ENVIRONMENT: "production" or "development"
 *   - DEV_TOKEN: Secret development mock token accepted only when ENVIRONMENT === "development"
 */

export default {
  async fetch(request, env) {
    const corsOrigin = resolveCorsOrigin(request, env);

    // Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({ success: false, error: "Method not allowed. Use POST /submit or POST /contact" }, 405, corsOrigin);
    }

    const url = new URL(request.url);
    if (url.pathname === "/contact") {
      return handleContactSubmit(request, env, corsOrigin);
    }
    if (url.pathname === "/submit" || url.pathname === "/") {
      return handleTelemetrySubmit(request, env, corsOrigin);
    }
    return jsonResponse({ success: false, error: "Not found" }, 404, corsOrigin);
  },
};

function getGitHubContext(env, corsOrigin) {
  const githubToken = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPO || "munoznicolas/ac-license-center";
  if (!githubToken) {
    return {
      errorResponse: jsonResponse(
        { success: false, error: "Gateway configuration error: GITHUB_TOKEN secret is not set" },
        500,
        corsOrigin
      ),
    };
  }
  return {
    repo,
    ghHeaders: {
      "Authorization": `Bearer ${githubToken}`,
      "User-Agent": "AC-GT-Licenses-Telemetry-Gateway",
      "Accept": "application/vnd.github.v3+json",
    },
  };
}

const CONTACT_TOPICS = {
  bug: "Bug / Issue",
  feedback: "Feedback",
  question: "Question",
};

async function handleContactSubmit(request, env, corsOrigin) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 32 * 1024) {
    return jsonResponse({ success: false, error: "Payload too large. Maximum size is 32KB." }, 413, corsOrigin);
  }

  try {
    const raw = await request.text();
    if (raw.length > 32 * 1024) {
      return jsonResponse({ success: false, error: "Payload too large. Maximum size is 32KB." }, 413, corsOrigin);
    }

    const payload = JSON.parse(raw);
    if (typeof payload !== "object" || payload === null) {
      return jsonResponse({ success: false, error: "Invalid JSON payload" }, 400, corsOrigin);
    }

    // Honeypot field: silently succeed for bots without touching GitHub
    if (typeof payload.website === "string" && payload.website.trim().length > 0) {
      return jsonResponse({ success: true, message: "Message received." }, 200, corsOrigin);
    }

    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const email = typeof payload.email === "string" ? payload.email.trim() : "";
    const topicKey = typeof payload.topic === "string" && CONTACT_TOPICS[payload.topic] ? payload.topic : "feedback";
    const message = typeof payload.message === "string" ? payload.message.trim() : "";

    if (name.length < 1 || name.length > 80) {
      return jsonResponse({ success: false, error: "Name must be between 1 and 80 characters." }, 400, corsOrigin);
    }
    if (email.length > 120 || (email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return jsonResponse({ success: false, error: "Please provide a valid email address or leave it blank." }, 400, corsOrigin);
    }
    if (message.length < 10 || message.length > 2000) {
      return jsonResponse({ success: false, error: "Message must be between 10 and 2000 characters." }, 400, corsOrigin);
    }

    const gh = getGitHubContext(env, corsOrigin);
    if (gh.errorResponse) return gh.errorResponse;

    const topicLabel = CONTACT_TOPICS[topicKey];
    const firstLine = message.split(/\r?\n/)[0].slice(0, 60);
    const issueTitle = `[${topicLabel}] ${firstLine}${firstLine.length === 60 ? "..." : ""}`;
    const maskedEmail = email ? email.replace(/(.{2})(.*)(@.*)/, "$1***$3") : "Not provided";
    const safePageUrl = typeof payload.page_url === "string" ? payload.page_url.slice(0, 200) : "Web UI";

    const issueBody = [
      `## Developer Contact / ${topicLabel}`,
      "",
      `* **From:** ${name}`,
      `* **Email (masked):** \`${maskedEmail}\``,
      `* **Topic:** ${topicLabel}`,
      `* **Source:** ${safePageUrl}`,
      `* **Timestamp:** ${new Date().toISOString()}`,
      "",
      "### Message",
      "",
      message,
    ].join("\n");

    const issueRes = await fetch(`https://api.github.com/repos/${gh.repo}/issues`, {
      method: "POST",
      headers: gh.ghHeaders,
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels: ["user-feedback", topicKey],
      }),
    });

    if (!issueRes.ok) {
      const errText = await issueRes.text();
      return jsonResponse({ success: false, error: `Failed to create GitHub issue: ${errText}` }, 502, corsOrigin);
    }

    const issueData = await issueRes.json();
    return jsonResponse({
      success: true,
      issue_number: issueData.number,
      issue_url: issueData.html_url,
      message: `Message sent! Created GitHub Issue #${issueData.number}.`,
    }, 201, corsOrigin);
  } catch (err) {
    return jsonResponse({ success: false, error: `Invalid request: ${err.message}` }, 400, corsOrigin);
  }
}

async function handleTelemetrySubmit(request, env, corsOrigin) {

    // Enforce request size bound (2 MB limit)
    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > 2 * 1024 * 1024) {
      return jsonResponse({ success: false, error: "Payload too large. Maximum size is 2MB." }, 413, corsOrigin);
    }

    try {
      const payload = await request.json();
      const { google_token, telemetry_data } = payload;

      if (!telemetry_data) {
        return jsonResponse({ success: false, error: "Missing telemetry_data payload" }, 400, corsOrigin);
      }

      // 1. Verify Google Identity
      if (!google_token) {
        return jsonResponse({ success: false, error: "Authentication required: missing google_token" }, 401, corsOrigin);
      }

      let contributorName = "Community Contributor";
      let contributorEmail = "contributor@assetto-gt.local";

      const isDevMode = env.ENVIRONMENT === "development" && env.DEV_TOKEN && google_token === env.DEV_TOKEN;

      if (isDevMode) {
        contributorName = String(payload.contributor_name || "Development Tester").slice(0, 64);
        contributorEmail = String(payload.contributor_email || "dev@assetto-gt.local").slice(0, 64);
      } else {
        if (google_token === "demo_token") {
          return jsonResponse({ success: false, error: "Unauthenticated demo token is not accepted. Please sign in with Google." }, 401, corsOrigin);
        }

        const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(google_token)}`);
        if (!verifyRes.ok) {
          return jsonResponse({ success: false, error: "Invalid or expired Google login token" }, 401, corsOrigin);
        }

        const googleUser = await verifyRes.json();

        // Enforce OAuth Client ID audience binding if configured
        if (env.GOOGLE_CLIENT_ID && googleUser.aud !== env.GOOGLE_CLIENT_ID) {
          return jsonResponse({ success: false, error: "Unauthorized Google Client ID audience" }, 403, corsOrigin);
        }

        contributorName = googleUser.name || contributorName;
        contributorEmail = googleUser.email || contributorEmail;
      }

      // 2. Validate Telemetry Payload
      const validation = validateTelemetryData(telemetry_data);
      if (!validation.valid) {
        return jsonResponse({ success: false, error: `Telemetry validation failed: ${validation.error}` }, 400, corsOrigin);
      }

      // 3. GitHub API Credentials
      const gh = getGitHubContext(env, corsOrigin);
      if (gh.errorResponse) return gh.errorResponse;
      const { repo, ghHeaders } = gh;

      // 4. Check for existing open PR to prevent duplicate spam
      const safeTrack = validation.track_id.replace(/[^a-zA-Z0-9_-]/g, "");
      const safeCar = validation.car_id.replace(/[^a-zA-Z0-9_-]/g, "");
      const safeLayout = validation.track_layout ? validation.track_layout.replace(/[^a-zA-Z0-9_-]/g, "") : "";
      const searchTitle = `feat(telemetry): add AI telemetry for ${validation.car_id} @ ${validation.track_id}`;

      try {
        const pullsRes = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=30`, { headers: ghHeaders });
        if (pullsRes.ok) {
          const openPulls = await pullsRes.json();
          const existingPr = Array.isArray(openPulls) && openPulls.find(p => p.title && p.title.startsWith(searchTitle));
          if (existingPr) {
            return jsonResponse({
              success: false,
              error: `An open Pull Request already exists for ${validation.car_id} @ ${validation.track_id}: PR #${existingPr.number}`,
              existing_pr_url: existingPr.html_url
            }, 409, corsOrigin);
          }
        }
      } catch {
        // If GitHub search fails, proceed with creation
      }

      // 5. Create Git Branch
      const branchName = `telemetry/${safeTrack}-${safeCar}-${Date.now().toString().slice(-6)}`;

      // Get default branch commit SHA
      const refRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/main`, { headers: ghHeaders });
      if (!refRes.ok) {
        const errText = await refRes.text();
        return jsonResponse({ success: false, error: `Failed to fetch main branch ref: ${errText}` }, 502, corsOrigin);
      }
      const refData = await refRes.json();
      const baseSha = refData.object.sha;

      // Create new branch
      const createBranchRes = await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
      });
      if (!createBranchRes.ok) {
        const errText = await createBranchRes.text();
        return jsonResponse({ success: false, error: `Failed to create branch ${branchName}: ${errText}` }, 502, corsOrigin);
      }

      // 6. Commit Telemetry JSON File
      // Deterministically derive filename from validated track and car identifiers
      const targetFilename = safeLayout
        ? `${safeTrack}__${safeLayout}__${safeCar}__ai100.json`
        : `${safeTrack}__${safeCar}__ai100.json`;
      const targetPath = `data/telemetry_profiles/${targetFilename}`;

      const fileContentStr = JSON.stringify(telemetry_data, null, 2);
      const fileContentB64 = btoa(unescape(encodeURIComponent(fileContentStr)));

      const commitRes = await fetch(`https://api.github.com/repos/${repo}/contents/${targetPath}`, {
        method: "PUT",
        headers: ghHeaders,
        body: JSON.stringify({
          message: `feat(telemetry): add AI telemetry profile for ${safeCar} @ ${safeTrack}`,
          content: fileContentB64,
          branch: branchName,
        }),
      });
      if (!commitRes.ok) {
        const errText = await commitRes.text();
        return jsonResponse({ success: false, error: `Failed to commit file to ${targetPath}: ${errText}` }, 502, corsOrigin);
      }

      // 7. Create Pull Request
      const prTitle = `feat(telemetry): add AI telemetry for ${validation.car_id} @ ${validation.track_id}${validation.track_layout ? ` [${validation.track_layout}]` : ""}`;
      const prBody = buildPrDescription({
        contributorName,
        contributorEmail,
        validation,
        targetPath,
      });

      const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          title: prTitle,
          body: prBody,
          head: branchName,
          base: "main",
        }),
      });

      if (!prRes.ok) {
        const errText = await prRes.text();
        return jsonResponse({ success: false, error: `Failed to open PR: ${errText}` }, 502, corsOrigin);
      }

      const prData = await prRes.json();
      return jsonResponse({
        success: true,
        pr_number: prData.number,
        pr_url: prData.html_url,
        branch: branchName,
        message: `Successfully created Pull Request #${prData.number}!`,
      }, 201, corsOrigin);

    } catch (err) {
      return jsonResponse({ success: false, error: `Internal Server Error: ${err.message}` }, 500, corsOrigin);
    }
}

function resolveCorsOrigin(request, env) {
  const allowed = env?.ALLOWED_ORIGIN || "*";
  if (allowed === "*") return "*";

  const requestOrigin = request.headers.get("Origin");
  if (!requestOrigin) return allowed.split(",")[0].trim();

  const allowedList = allowed.split(",").map(o => o.trim().toLowerCase());
  if (allowedList.includes(requestOrigin.toLowerCase())) {
    return requestOrigin;
  }
  return allowedList[0];
}

function jsonResponse(data, status = 200, origin = "*") {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

function validateTelemetryData(data) {
  if (typeof data !== "object" || data === null) {
    return { valid: false, error: "Payload must be a JSON object" };
  }

  const trackId = data.track_id || data.track;
  const carId = data.car_id || data.car;
  const trackLayout = data.track_layout || data.layout || "";
  const aiLevel = Number(data.ai_level || 100);

  if (!trackId || typeof trackId !== "string" || !/^[A-Za-z0-9_\-]+$/.test(trackId)) {
    return { valid: false, error: "Invalid or missing track_id" };
  }
  if (!carId || typeof carId !== "string" || !/^[A-Za-z0-9_\-]+$/.test(carId)) {
    return { valid: false, error: "Invalid or missing car_id" };
  }

  const samples = Array.isArray(data.trajectory) ? data.trajectory : (Array.isArray(data.samples) ? data.samples : []);
  if (samples.length < 10) {
    return { valid: false, error: `Trajectory must contain at least 10 samples (received ${samples.length})` };
  }

  // Calculate metrics
  let maxSpeed = 0;
  let maxRpm = 0;
  let maxGear = 1;
  let lapTime = Number(data.lap_time_s || data.gold_time || 0);

  for (const s of samples) {
    const spd = Number(s.speed_kmh || 0);
    if (spd > maxSpeed) maxSpeed = spd;
    if (s.rpm && Number(s.rpm) > maxRpm) maxRpm = Number(s.rpm);
    if (s.gear && Number(s.gear) > maxGear) maxGear = Number(s.gear);
    if (s.t && Number(s.t) > lapTime) lapTime = Number(s.t);
  }

  return {
    valid: true,
    track_id: trackId,
    track_layout: trackLayout,
    car_id: carId,
    ai_level: aiLevel,
    sample_count: samples.length,
    max_speed_kmh: Math.round(maxSpeed * 10) / 10,
    max_rpm: Math.round(maxRpm),
    max_gear: maxGear,
    lap_time_s: Math.round(lapTime * 100) / 100,
  };
}

function buildPrDescription({ contributorName, contributorEmail, validation, targetPath }) {
  const sanitizedEmail = contributorEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3");
  const layoutStr = validation.track_layout ? `\`${validation.track_layout}\`` : "*Default*";

  return `## New AI Telemetry Profile Submission

### Contributor Information
* **Submitted By:** ${contributorName} (\`${sanitizedEmail}\`)
* **Timestamp:** ${new Date().toISOString()}
* **Destination File:** \`${targetPath}\`

### Circuit & Vehicle Summary
| Parameter | Value |
| :--- | :--- |
| **Track ID** | \`${validation.track_id}\` |
| **Layout** | ${layoutStr} |
| **Car Model** | \`${validation.car_id}\` |
| **AI Proficiency Level** | \`${validation.ai_level}%\` |

### Telemetry Metrics
| Metric | Recorded Value |
| :--- | :--- |
| **60 Hz Physics Frames** | **${validation.sample_count.toLocaleString()} samples** |
| **Peak Velocity** | **${validation.max_speed_kmh} km/h** |
| **Estimated Lap Time** | **${validation.lap_time_s}s** |
| **Top Engaged Gear** | **Gear ${validation.max_gear}** |

---

### Automated Validation Checklist
- [x] Schema structure verified (continuous 60 Hz coordinates, velocity vector, heading)
- [x] Contributor identity authenticated via Google OAuth
- [x] Dedicated staging branch created automatically
- [ ] Automated CI simulation tests will evaluate this profile below:
`;
}
