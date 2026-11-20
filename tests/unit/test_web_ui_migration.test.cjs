const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const toFileUrl = (relPath) =>
  "file://" + path.resolve(__dirname, "../../", relPath).replace(/\\/g, "/");

// 1. Static Host & API Resolution
test("api client resolves static paths on GitHub Pages / file protocol", async () => {
  const { isStaticHost, resolveApiPath, resolveGatewayUrl } = await import(
    toFileUrl("tools/web_ui/src/api/client.ts")
  );

  // Mock window for static host
  globalThis.window = {
    location: { hostname: "munoznicolas.github.io", protocol: "https:" },
  };
  assert.equal(isStaticHost(), true);
  assert.equal(resolveApiPath("/api/curriculum"), "./api/curriculum.json");
  assert.equal(resolveApiPath("/api/tracks"), "./api/tracks.json");
  assert.equal(resolveApiPath("/api/cars"), "./api/cars.json");
  assert.equal(resolveApiPath("/api/reference_tests"), "./api/reference_tests.json");
  assert.equal(resolveApiPath("/api/telemetry/missing?tier=ALL"), "./api/missing_telemetry.json");
  assert.equal(
    resolveApiPath("/api/spline?track_id=ks_vallelunga&layout=club"),
    "./api/splines/ks_vallelunga__club.json"
  );
  assert.equal(
    resolveApiPath("/api/spline?track_id=magione&layout="),
    "./api/splines/magione.json"
  );

  // Mock window for local server
  globalThis.window = {
    location: { hostname: "127.0.0.1", protocol: "http:" },
  };
  assert.equal(isStaticHost(), false);
  assert.equal(resolveApiPath("/api/curriculum"), "./api/curriculum");

  // Gateway URL normalization
  globalThis.localStorage = { getItem: () => null };
  assert.equal(
    resolveGatewayUrl("/contact", "https://example.workers.dev/submit/"),
    "https://example.workers.dev/contact"
  );
  assert.equal(
    resolveGatewayUrl("/submit", "https://example.workers.dev/"),
    "https://example.workers.dev/submit"
  );

  delete globalThis.window;
  delete globalThis.localStorage;
});

// 2. Curriculum Store
test("curriculumStore validates, sanitizes, persists, and resets curriculum", async () => {
  const {
    STORAGE_KEY,
    isValidCurriculum,
    sanitizeCurriculum,
    saveCurriculum,
    loadCurriculum,
    resetCurriculumToDefaults,
    importCurriculumJsonFile,
  } = await import(toFileUrl("tools/web_ui/src/utils/curriculumStore.ts"));

  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };

  assert.equal(isValidCurriculum([]), false);
  assert.equal(isValidCurriculum([{ tier_name: "National B", tests: [] }]), false);

  const sample = [
    {
      tier_name: "National B<script>",
      tests: [
        {
          test_id: "B-1!",
          track_id: "magione;rm",
          track_layout: "undefined",
          car_id: "ks_toyota_gt86$",
          title: "Test 1",
          start_s: 0.1,
          finish_s: 0.3,
          targets: { gold_seconds: 10, silver_seconds: 11, bronze_seconds: 12 },
        },
      ],
    },
  ];

  const sanitized = sanitizeCurriculum(structuredClone(sample));
  assert.equal(sanitized[0].tier_name, "National Bscript");
  assert.equal(sanitized[0].tests[0].track_layout, "");
  assert.equal(sanitized[0].tests[0].track_id, "magionerm");
  assert.equal(sanitized[0].tests[0].car_id, "ks_toyota_gt86");
  assert.equal(sanitized[0].tests[0].test_id, "B-1");

  assert.equal(saveCurriculum(sanitized), true);
  assert.ok(store.has(STORAGE_KEY));

  const loaded = await loadCurriculum(async () => []);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].tests[0].test_id, "B-1");

  // Import JSON file
  const fakeFile = {
    text: async () => JSON.stringify({ curriculum: sanitized }),
  };
  const imported = await importCurriculumJsonFile(fakeFile);
  assert.equal(imported[0].tests[0].title, "Test 1");

  // Reset to defaults
  const baseline = [
    {
      tier_name: "National B",
      tests: [
        {
          test_id: "B-1",
          track_id: "magione",
          track_layout: "",
          car_id: "ks_toyota_gt86",
          title: "Baseline",
        },
      ],
    },
  ];
  const reset = await resetCurriculumToDefaults(async () => baseline);
  assert.equal(reset[0].tests[0].title, "Baseline");

  delete globalThis.localStorage;
});

// 3. Mod Packager & Kunos INI Formatting
test("modPackager validates curriculum and formats strict Kunos INIs", async () => {
  const { validateCurriculumClient, formatSeriesIni, formatEventIni } = await import(
    toFileUrl("tools/web_ui/src/utils/modPackager.ts")
  );

  const validCurriculum = [
    {
      tier_name: "National B",
      description: "Entry license\ntests",
      tests: [
        {
          test_id: "B-1",
          title: "Braking",
          description: "Stop in box",
          lesson_objective: "Brake late",
          track_id: "magione",
          track_layout: "",
          car_id: "ks_toyota_gt86",
          start_s: 0.1,
          finish_s: 0.3,
          targets: { gold_seconds: 10, silver_seconds: 11, bronze_seconds: 12 },
        },
      ],
    },
  ];

  const okReport = validateCurriculumClient(validCurriculum);
  assert.equal(okReport.success, true);
  assert.equal(okReport.passed, 1);
  assert.equal(okReport.failed, 0);

  const invalidCurriculum = [
    {
      tier_name: "National B",
      tests: [
        {
          test_id: "B-2",
          title: "",
          track_id: "magione",
          car_id: "ks_toyota_gt86",
          start_s: 1.5,
          finish_s: 0.3,
          targets: { gold_seconds: 15, silver_seconds: 12, bronze_seconds: 10 },
        },
      ],
    },
  ];
  const badReport = validateCurriculumClient(invalidCurriculum);
  assert.equal(badReport.success, false);
  assert.equal(badReport.failed, 1);
  assert.ok(badReport.errors.length >= 3);

  const seriesIni = formatSeriesIni(validCurriculum[0]);
  assert.match(seriesIni, /^\[CAREER\]/m);
  assert.match(seriesIni, /^NAME=Gran Turismo License - National B$/m);
  assert.equal(seriesIni.includes(" = "), false, "Must have no spaces around '='");

  const eventIni = formatEventIni(validCurriculum[0].tests[0], 1);
  assert.match(eventIni, /^TRACK=magione$/m);
  assert.match(eventIni, /^MODEL=ks_toyota_gt86$/m);
  assert.match(eventIni, /^MODEL_CONFIG=$/m);
  assert.match(eventIni, /^BALLAST=0$/m);
  assert.match(eventIni, /^RESTRICTOR=0$/m);
  assert.match(eventIni, /^__CM_CUSTOM_MODE=gt-license$/m);
  assert.equal(eventIni.includes(" = "), false, "Must have no spaces around '='");
});

// 4. Contact Form Validation
test("contactValidation enforces name, optional email, and message length", async () => {
  const { validateContactInput } = await import(
    toFileUrl("tools/web_ui/src/utils/contactValidation.ts")
  );

  assert.match(validateContactInput({ name: "", email: "", message: "1234567890" }) || "", /name/i);
  assert.match(validateContactInput({ name: "Nico", email: "bad-email", message: "1234567890" }) || "", /email/i);
  assert.match(validateContactInput({ name: "Nico", email: "", message: "short" }) || "", /10 characters/i);
  assert.equal(validateContactInput({ name: "Nico", email: "", message: "This is a valid bug report." }), null);
  assert.equal(validateContactInput({ name: "Nico", email: "nico@example.com", message: "This is a valid bug report." }), null);
});

// 5. Telemetry Submitter Validation
test("telemetrySubmitter validates uploaded telemetry JSON structure", async () => {
  const { validateTelemetryPayload } = await import(
    toFileUrl("tools/web_ui/src/utils/telemetrySubmitter.ts")
  );

  assert.throws(() => validateTelemetryPayload(null), /valid JSON object/i);
  assert.throws(() => validateTelemetryPayload({ track_id: "magione", car_id: "ks_toyota_gt86", samples: [] }), /samples/i);
  assert.throws(() => validateTelemetryPayload({ samples: [{ distance_m: 0, speed_kmh: 50 }] }), /track_id/i);

  const valid = validateTelemetryPayload({
    track_id: "magione",
    track_layout: "",
    car_id: "ks_toyota_gt86",
    ai_level: 100,
    total_track_length_m: 2500,
    samples: [{ distance_m: 0, speed_kmh: 100, gear: 3, rpm: 5000 }],
  });
  assert.equal(valid.filename, "magione__ks_toyota_gt86__ai100.json");
  assert.equal(valid.maxSpeed, 100);
});

// 6. Telemetry Store & Static-Host Client Calculations
test("telemetryStore caches custom profiles and powers static-host target/speed calculations", async () => {
  const { getTelemetryFilename, saveCustomTelemetryProfile, resolveTelemetryEngine } = await import(
    toFileUrl("tools/web_ui/src/utils/telemetryStore.ts")
  );
  const { api } = await import(toFileUrl("tools/web_ui/src/api/client.ts"));

  assert.equal(
    getTelemetryFilename("ks_vallelunga", "club", "ks_toyota_gt86", 100),
    "ks_vallelunga__club__ks_toyota_gt86__ai100.json"
  );
  assert.equal(
    getTelemetryFilename("magione", "undefined", "ks_toyota_gt86", 100),
    "magione__ks_toyota_gt86__ai100.json"
  );

  await saveCustomTelemetryProfile({
    track_id: "magione",
    track_layout: "",
    car_id: "ks_toyota_gt86",
    ai_level: 100,
    total_track_length_m: 2000,
    samples: [
      { distance_m: 0, speed_kmh: 90, gear: 3, rpm: 4500 },
      { distance_m: 1000, speed_kmh: 120, gear: 4, rpm: 5500 },
      { distance_m: 2000, speed_kmh: 95, gear: 3, rpm: 4700 },
    ],
  });

  const resolved = await resolveTelemetryEngine("magione", "", "ks_toyota_gt86");
  assert.ok(resolved);
  assert.equal(resolved.source, "custom_uploaded");

  globalThis.window = {
    location: { hostname: "munoznicolas.github.io", protocol: "https:" },
  };
  const targets = await api.calculateTargets("magione", "", 0.1, 0.5, "ks_toyota_gt86", "ROLLING");
  assert.ok(targets.gold_seconds > 0);
  assert.ok(targets.gold_seconds <= targets.silver_seconds);
  assert.ok(targets.silver_seconds <= targets.bronze_seconds);

  const speed = await api.calculateInitialSpeed("magione", "", 0.25, "ks_toyota_gt86");
  assert.equal(speed.telemetry_available, true);
  assert.ok(speed.speed_kmh > 0);

  delete globalThis.window;
});
