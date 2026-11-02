import { SECRET_RULES } from "./rules.js";
import { maskSecret } from "./util.js";

/**
 * Replaces every known secret pattern with a masked value.
 * Used for evidence lines so raw credentials never reach logs or JSON.
 */
export function redactSecrets(text: string): string {
  let out = text;
  for (const rule of SECRET_RULES) {
    out = out.replace(rule.regex, (match) => maskSecret(match));
  }
  return out;
}
