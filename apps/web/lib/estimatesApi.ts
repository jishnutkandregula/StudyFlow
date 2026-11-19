// Time estimates from the StudyFlow API: rules that read the assignment, calibrated to
// how long this student's finished work really took. See apps/api/app/estimator.py.

import { apiFetch } from "./http";

export type EstimateInput = {
  id: string;
  title: string;
  course?: string;
  description?: string | null;
  points?: number | null;
};

export type Estimate = {
  id: string;
  minutes: number;
  category: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  /** The rules estimate before personal calibration: the baseline learning compares against. */
  base_minutes: number;
  multiplier: number;
};

export async function requestEstimates(items: EstimateInput[]): Promise<Map<string, Estimate>> {
  if (!items.length) return new Map();
  const result = await apiFetch<{ estimates: Estimate[] }>("/api/v1/estimates", {
    method: "POST",
    json: { items: items.slice(0, 300) },
  });
  return new Map(result.estimates.map((estimate) => [estimate.id, estimate]));
}
