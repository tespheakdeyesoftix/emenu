import { posTaxModes, type PosTaxRule } from "../../../shared/posProfile";
import { boolean, choice, invalid, newId, object, recordId, string } from "./posApiCore";

export function readTaxRules(value: unknown): PosTaxRule[] {
  if (!Array.isArray(value)) invalid("tax_rules must be an array");
  const ids = new Set<string>();
  return value.map((entry, index) => {
    const rule = object(entry);
    const prefix = "tax_rules[" + index + "].";
    const id = rule.id === undefined ? newId("tax") : recordId(rule.id, prefix + "id");
    if (ids.has(id)) invalid("Tax rule IDs must be unique within the profile");
    ids.add(id);
    const name = (key: "tax_1_name" | "tax_2_name" | "tax_3_name") => {
      const value = rule[key];
      return typeof value === "string" && !value.trim()
        ? ""
        : string(value, prefix + key);
    };
    const rate = (key: "tax_1_rate" | "tax_2_rate" | "tax_3_rate") => {
      const value = rule[key];
      if (
        typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100
      ) {
        invalid(prefix + key + " must be between 0 and 100");
      }
      return value;
    };
    const flag = (key: keyof PosTaxRule) => boolean(rule[key], prefix + key);
    return {
      id,
      tax_name: string(rule.tax_name, prefix + "tax_name"),
      tax_mode: choice(rule.tax_mode === undefined ? "disabled" : rule.tax_mode, prefix + "tax_mode", posTaxModes),
      tax_1_name: name("tax_1_name"),
      tax_1_rate: rate("tax_1_rate"),
      calculate_tax_1_after_discount: flag("calculate_tax_1_after_discount"),
      tax_2_name: name("tax_2_name"),
      tax_2_rate: rate("tax_2_rate"),
      calculate_tax_2_after_adding_tax_1: flag("calculate_tax_2_after_adding_tax_1"),
      calculate_tax_2_after_discount: flag("calculate_tax_2_after_discount"),
      tax_3_name: name("tax_3_name"),
      tax_3_rate: rate("tax_3_rate"),
      calculate_tax_3_after_adding_tax_1: flag("calculate_tax_3_after_adding_tax_1"),
      calculate_tax_3_after_adding_tax_2: flag("calculate_tax_3_after_adding_tax_2"),
      calculate_tax_3_after_discount: flag("calculate_tax_3_after_discount"),
    };
  });
}
