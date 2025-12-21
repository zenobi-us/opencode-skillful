/**
 * Normalize a query string to match against toolName paths
 * Converts slashes and hyphens to underscores for prefix matching
 */
export function normalizePathQuery(query: string): string {
  return query.replace(/[/-]/g, '_').toLowerCase();
}

/**
 * Strip the "skills_" prefix from toolName for user-facing matching
 */
export function stripSkillsPrefix(toolName: string): string {
  return toolName.replace(/^skills_/, '');
}
