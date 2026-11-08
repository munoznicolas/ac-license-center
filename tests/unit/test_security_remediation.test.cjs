const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// Test Web UI queue runner PowerShell script generator
test("generatePowerShellRecordingScript defuses command injection payloads", async () => {
  const queueRunnerPath = path.resolve(__dirname, "../../tools/web_ui/static/js/queue-runner.js");
  const { generatePowerShellRecordingScript } = await import("file://" + queueRunnerPath.replace(/\\/g, "/"));

  const maliciousCombos = [
    {
      track_id: "magione`$(calc.exe)`",
      track_layout: "club\"; Start-Process cmd.exe; #",
      car_id: "ks_toyota_gt86'; Invoke-Expression 'whoami'; '"
    },
    {
      track_id: "../../../etc/passwd",
      track_layout: "<script>alert(1)</script>",
      car_id: "car&whoami&"
    }
  ];

  const script = generatePowerShellRecordingScript(maliciousCombos, { aiLevel: 100 });

  // Assert no command injection syntax survives in $Jobs array
  const jobsBlock = script.match(/\$Jobs\s*=\s*@\([\s\S]*?\)/)[0];
  assert.equal(jobsBlock.includes("$(calc.exe)"), false, "Must not contain $(calc.exe)");
  assert.equal(jobsBlock.includes("`"), false, "Must not contain backticks in jobs block");
  assert.equal(jobsBlock.includes("; Start-Process"), false, "Must not contain command chaining");
  assert.equal(jobsBlock.includes("; Invoke-Expression"), false, "Must not contain command chaining");
  assert.equal(jobsBlock.includes("<script>"), false, "Must not contain HTML tags");
  assert.equal(jobsBlock.includes("../"), false, "Must not contain directory traversal");

  // Assert hashtables use sanitized single-quoted values
  assert.match(script, /@\{\s*Track\s*=\s*'magionecalcexe';\s*Layout\s*=\s*'clubStart-Processcmdexe';\s*Car\s*=\s*'ks_toyota_gt86Invoke-Expressionwhoami'\s*\}/);
  assert.match(script, /@\{\s*Track\s*=\s*'etcpasswd';\s*Layout\s*=\s*'scriptalert1script';\s*Car\s*=\s*'carwhoami'\s*\}/);
});

// Test Curriculum Store sanitization
test("sanitizeCurriculum strips unsafe characters from curriculum identifiers", async () => {
  const storePath = path.resolve(__dirname, "../../tools/web_ui/static/js/curriculum-store.js");
  const { sanitizeCurriculum } = await import("file://" + storePath.replace(/\\/g, "/"));

  const rawCurriculum = [
    {
      tier_name: "National B <script>",
      tests: [
        {
          test_id: "B-1; rm -rf /",
          track_id: "magione$(calc.exe)",
          track_layout: "null",
          car_id: "ks_toyota_gt86\""
        }
      ]
    }
  ];

  const sanitized = sanitizeCurriculum(rawCurriculum);
  assert.equal(sanitized[0].tier_name, "National B script");
  assert.equal(sanitized[0].tests[0].test_id, "B-1rm-rf");
  assert.equal(sanitized[0].tests[0].track_id, "magionecalcexe");
  assert.equal(sanitized[0].tests[0].track_layout, "");
  assert.equal(sanitized[0].tests[0].car_id, "ks_toyota_gt86");
});

// Test Cloudflare Worker validation & path containment logic
test("worker.js enforces authentication and rejects demo_token in production", async () => {
  const workerPath = path.resolve(__dirname, "../../serverless/telemetry_pr_gateway/worker.js");
  const { default: worker } = await import("file://" + workerPath.replace(/\\/g, "/"));

  // 1. Missing token
  const reqNoToken = new Request("https://gateway.test/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telemetry_data: { track_id: "magione", car_id: "ks_toyota_gt86", samples: new Array(10).fill({ s: 50 }) }
    })
  });
  const resNoToken = await worker.fetch(reqNoToken, { GITHUB_TOKEN: "mock" });
  assert.equal(resNoToken.status, 401);
  const dataNoToken = await resNoToken.json();
  assert.match(dataNoToken.error, /missing google_token/i);

  // 2. demo_token rejected in production
  const reqDemo = new Request("https://gateway.test/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      google_token: "demo_token",
      telemetry_data: { track_id: "magione", car_id: "ks_toyota_gt86", samples: new Array(10).fill({ s: 50 }) }
    })
  });
  const resDemo = await worker.fetch(reqDemo, { GITHUB_TOKEN: "mock" });
  assert.equal(resDemo.status, 401);
  const dataDemo = await resDemo.json();
  assert.match(dataDemo.error, /Unauthenticated demo token is not accepted/i);
});

test("worker.js enforces CORS against ALLOWED_ORIGIN allowlist", async () => {
  const workerPath = path.resolve(__dirname, "../../serverless/telemetry_pr_gateway/worker.js");
  const { default: worker } = await import("file://" + workerPath.replace(/\\/g, "/"));

  const env = {
    ALLOWED_ORIGIN: "https://munoznicolas.github.io,http://localhost:8080",
    GITHUB_TOKEN: "mock"
  };

  // Untrusted origin
  const reqEvil = new Request("https://gateway.test/submit", {
    method: "OPTIONS",
    headers: { "Origin": "https://evil-attacker.com" }
  });
  const resEvil = await worker.fetch(reqEvil, env);
  assert.equal(resEvil.headers.get("Access-Control-Allow-Origin"), "https://munoznicolas.github.io");

  // Trusted origin
  const reqGood = new Request("https://gateway.test/submit", {
    method: "OPTIONS",
    headers: { "Origin": "https://munoznicolas.github.io" }
  });
  const resGood = await worker.fetch(reqGood, env);
  assert.equal(resGood.headers.get("Access-Control-Allow-Origin"), "https://munoznicolas.github.io");
});

test("worker.js rejects oversized payloads", async () => {
  const workerPath = path.resolve(__dirname, "../../serverless/telemetry_pr_gateway/worker.js");
  const { default: worker } = await import("file://" + workerPath.replace(/\\/g, "/"));

  const reqOversized = new Request("https://gateway.test/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(3 * 1024 * 1024) // 3MB > 2MB limit
    },
    body: JSON.stringify({ google_token: "tok", telemetry_data: {} })
  });
  const resOversized = await worker.fetch(reqOversized, { GITHUB_TOKEN: "mock" });
  assert.equal(resOversized.status, 413);
  const dataOversized = await resOversized.json();
  assert.match(dataOversized.error, /Payload too large/i);
});
