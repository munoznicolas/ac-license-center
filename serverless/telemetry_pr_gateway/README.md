# Assetto Corsa GT Licenses - Telemetry PR Gateway

Lightweight, serverless Cloudflare Worker gateway that accepts AI telemetry submissions with verified Google OAuth logins and automatically opens autoformatted Pull Requests on the Assetto Corsa GT-Like Licenses GitHub repository.

---

## Deployment & Configuration

### 1. Prerequisites
* A free [Cloudflare](https://dash.cloudflare.com/) account.
* Node.js 18+ installed on your machine.
* A GitHub Fine-Grained Personal Access Token with:
  - Repository permissions: `Contents: Read and write`, `Pull requests: Read and write`.

### 2. Configure & Deploy
```bash
cd serverless/telemetry_pr_gateway

# 1. Login to Cloudflare
npx wrangler login

# 2. Set your GitHub Token
npx wrangler secret put GITHUB_TOKEN
# (Paste your GitHub Fine-Grained Personal Access Token when prompted)

# 3. Optional: Set Google Client ID for audience verification
npx wrangler secret put GOOGLE_CLIENT_ID

# 4. Deploy worker globally
npx wrangler deploy
```

Your worker will be live at `https://ac-telemetry-pr-gateway.<your-subdomain>.workers.dev`.

---

## Security Controls & Best Practices

1. **Authentication Enforcement**:
   - Submissions strictly require a valid Google OAuth ID token.
   - The worker validates tokens with Google's `oauth2.googleapis.com/tokeninfo` endpoint.
   - If `GOOGLE_CLIENT_ID` is set, the worker asserts that `googleUser.aud === GOOGLE_CLIENT_ID`.
2. **Path Traversal & Filename Sandboxing**:
   - Destination file paths are deterministically derived from validated `track_id`, `layout`, and `car_id` tokens (e.g. `data/telemetry_profiles/<track>__<layout>__<car>__ai100.json`).
   - Client-provided filenames cannot traverse directories or escape `data/telemetry_profiles/`.
3. **CORS Isolation**:
   - `ALLOWED_ORIGIN` in `wrangler.toml` defines allowed origins (default: GitHub Pages and localhost). Arbitrary `Origin` headers from untrusted websites are rejected.
4. **Duplicate PR Spam Prevention**:
   - The worker queries GitHub for existing open PRs matching the track/car combination before creating a branch, returning `409 Conflict` if a PR is already open.
5. **Cloudflare Edge Rate Limiting (Recommended)**:
   - In the Cloudflare Dashboard under **Security $\rightarrow$ WAF $\rightarrow$ Rate limiting rules**, create a rule for `URI Path equals "/submit"`:
     - Characteristic: IP address
     - Period: 1 minute
     - Requests: 5 requests
     - Action: Block or Managed Challenge (1 hour mitigation).
