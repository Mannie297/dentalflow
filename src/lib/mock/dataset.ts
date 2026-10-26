import { buildMockDataset, type MockDataset } from "./generate";

let cached: MockDataset | null = null;

/**
 * Returns the singleton in-memory demo dataset. Generated once per process
 * (and once per browser session) so every page reads the same consistent
 * numbers instead of re-rolling random data on every request.
 */
export function getMockDataset(): MockDataset {
  if (!cached) {
    cached = buildMockDataset();
  }
  return cached;
}
