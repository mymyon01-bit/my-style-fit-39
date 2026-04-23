// Public API for the measurement-driven sizing engine.
export * from "./types";
export { resolveBody } from "./bodyResolver";
export { loadGarmentChart } from "./garmentChart";
export type { GarmentChart, SizeMeasurements } from "./garmentChart";
export { calculateAllSizes, overallLabelText, REGION_STATUS_LABEL } from "./fitCalculator";
export { buildRecommendation } from "./recommend";
export {
  CATEGORY_RULES,
  normalizeSizingCategory,
  inferProductGender,
  classifyRegion,
  REGION_TOLERANCE,
} from "./categoryRules";
export { estimateAnthropometry } from "./anthropometry";
export { getBrandProfile, applyBrandCalibration } from "./brandCalibration";
export type { BrandFitProfile, FitBias, CalibrationApplied } from "./brandCalibration";
