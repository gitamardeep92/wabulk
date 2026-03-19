/**
 * Resolves a template string with variables
 * Template: "Hi {{name}}, your {{plan}} expires on {{date}}"
 * Variables: { name: "Rahul", plan: "Gold", date: "25 Apr" }
 * Output: "Hi Rahul, your Gold expires on 25 Apr"
 */
export function renderTemplate(template, variables = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match;
  });
}

/**
 * Extract all variable names from a template
 * Returns: ["name", "plan", "date"]
 */
export function extractVariables(template) {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

/**
 * Validate that all required variables are provided
 */
export function validateVariables(template, variables) {
  const required = extractVariables(template);
  const missing = required.filter((v) => !(v in variables));
  return { valid: missing.length === 0, missing };
}
