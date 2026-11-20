import type { LicenseTier } from "../types";

export const STORAGE_KEY = "gt_curriculum_v1";

export function sanitizeCurriculum<T extends LicenseTier[]>(curriculum: T): T {
  if (!Array.isArray(curriculum)) return curriculum;
  for (const tier of curriculum) {
    if (tier && typeof tier.tier_name === "string") {
      tier.tier_name = tier.tier_name.replace(/[^\w\s-]/g, "").slice(0, 64);
    }
    for (const test of tier?.tests || []) {
      if ((test.track_layout as string) === "undefined" || (test.track_layout as string) === "null") {
        test.track_layout = "";
      }
      if (test.track_id) {
        test.track_id = String(test.track_id).replace(/[^a-zA-Z0-9_-]/g, "");
      }
      if (test.track_layout) {
        test.track_layout = String(test.track_layout).replace(/[^a-zA-Z0-9_-]/g, "");
      }
      if (test.car_id) {
        test.car_id = String(test.car_id).replace(/[^a-zA-Z0-9_-]/g, "");
      }
      if (test.test_id) {
        test.test_id = String(test.test_id).replace(/[^a-zA-Z0-9_-]/g, "");
      }
    }
  }
  return curriculum;
}

export function isValidCurriculum(data: unknown): data is LicenseTier[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  const structureValid = data.every(
    (tier) => tier && typeof tier.tier_name === "string" && Array.isArray(tier.tests)
  );
  if (!structureValid) return false;
  const totalTests = data.reduce(
    (sum, tier) => sum + (Array.isArray(tier.tests) ? tier.tests.length : 0),
    0
  );
  return totalTests > 0;
}

export function saveCurriculum(curriculum: LicenseTier[]): boolean {
  if (!isValidCurriculum(curriculum)) return false;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(curriculum));
    }
    return true;
  } catch {
    return false;
  }
}

export async function loadCurriculum(
  fetchBaseline: () => Promise<LicenseTier[]>
): Promise<LicenseTier[]> {
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (isValidCurriculum(parsed)) {
          return sanitizeCurriculum(parsed);
        }
      }
    }
  } catch {
    // Fall back to baseline fetch
  }

  const baseline = await fetchBaseline();
  if (isValidCurriculum(baseline)) {
    const sanitized = sanitizeCurriculum(baseline);
    saveCurriculum(sanitized);
    return sanitized;
  }

  return [];
}

export async function resetCurriculumToDefaults(
  fetchBaseline: () => Promise<LicenseTier[]>
): Promise<LicenseTier[]> {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage removal errors
  }

  const baseline = await fetchBaseline();
  if (isValidCurriculum(baseline)) {
    const sanitized = sanitizeCurriculum(baseline);
    saveCurriculum(sanitized);
    return sanitized;
  }
  throw new Error("Failed to re-fetch baseline curriculum defaults.");
}

export function exportCurriculumJson(curriculum: LicenseTier[], filename = "curriculum.json"): void {
  const jsonStr = JSON.stringify(curriculum, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importCurriculumJsonFile(file: Pick<File, "text">): Promise<LicenseTier[]> {
  if (!file) {
    throw new Error("No file selected");
  }
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid JSON file: ${msg}`);
  }

  const raw = parsed && typeof parsed === "object" && "curriculum" in parsed
    ? (parsed as { curriculum: unknown }).curriculum
    : parsed;
  const curriculumData = sanitizeCurriculum(raw as LicenseTier[]);
  if (!isValidCurriculum(curriculumData)) {
    throw new Error("Imported file does not match curriculum structure (expected array of tiers with tests).");
  }

  saveCurriculum(curriculumData);
  return curriculumData;
}
