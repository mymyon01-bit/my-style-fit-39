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
export { estimateAnthropometry, bmiCategory } from "./anthropometry";
export { loadBrandCalibration, applyCalibration } from "./brandCalibration";
export type { CalibrationOffset } from "./brandCalibration";
export { submitFitFeedback } from "./feedback";
export type { FitFeedbackInput, FitFeedbackType } from "./feedback";
