import { parsePhoneNumberFromString } from "libphonenumber-js";

export const GHANA_REGIONS = [
  "Greater Accra",
  "Ashanti",
  "Western",
  "Western North",
  "Central",
  "Eastern",
  "Volta",
  "Oti",
  "Northern",
  "North East",
  "Savannah",
  "Upper East",
  "Upper West",
  "Bono",
  "Bono East",
  "Ahafo",
] as const;

export function normalizeGhanaPhone(input: string) {
  const parsed = parsePhoneNumberFromString(input.trim(), "GH");
  if (!parsed || parsed.country !== "GH" || !parsed.isValid()) return null;
  return parsed.number;
}

export function isDigitalAddress(input: string) {
  return /^[A-Za-z]{2}-\d{3,4}-\d{4}$/.test(input.trim());
}
