import { sep } from 'node:path';

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

/**
 * Generate tool name from skill path
 * Examples:
 *   skills/brand-guidelines/SKILL.md → skills_brand_guidelines
 *   skills/document-skills/docx/SKILL.md → skills_document_skills_docx
 *   skills/image-processing/SKILL.md → skills_image_processing
 */
export function toolName(skillPath: string): string {
  return skillPath
    .replace(/SKILL\.md$/, '')
    .split(sep)
    .filter(Boolean)
    .join('_')
    .replace(/-/g, '_');
}
