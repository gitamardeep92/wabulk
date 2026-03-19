export function extractVariables(template) {
  if (!template) return [];
  const matches = template.matchAll(/\{\{(\w+)\}\}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

export function renderTemplate(template, variables = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    variables[key] !== undefined ? String(variables[key]) : match
  );
}
