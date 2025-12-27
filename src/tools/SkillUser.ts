import type { Skill, SkillRegistry } from '../types';

export function createSkillLoader(provider: SkillRegistry) {
  const registry = provider.controller;

  function renderResources(skill: Skill) {
    const resources = [
      ...Array.from(skill.references || []),
      ...Array.from(skill.assets || []),
      ...Array.from(skill.scripts || []),
    ]
      .map(
        ([relativePath, resourceData]) =>
          `<SkillResource relative-path="${relativePath}" absolute-path="${resourceData.absolutePath}" mime-type="${resourceData.mimeType}"/>`
      )
      .join('\n');
    return resources;
  }
  /**
   * Load a single skill into the chat
   */
  function render(skill: Skill) {
    const resources = renderResources(skill);
    const content = `
<Skill>
  <SkillName>${skill.name}</SkillName>
  <SkillDescription>${skill.description}</SkillDescription>
  ${resources && `<SkillResources>${resources}</SkillResources>`}
  <SkillContent>${skill.content}</SkillContent>
</Skill>
`;
    return content;
  }

  /**
   * Load multiple skills into the chat
   */
  async function loadSkills(skillNames: string[], onLoad: (content: string) => Promise<void>) {
    const loaded: string[] = [];
    const notFound: string[] = [];

    for (const skillName of skillNames) {
      // Try to find skill by toolName first (primary key), then by name (backward compat)

      const skill = registry.get(skillName);

      if (!skill) {
        notFound.push(skillName);
        continue;
      }

      await onLoad(render(skill));
      loaded.push(skill.toolName);
    }

    return JSON.stringify({ loaded, notFound });
  }

  return loadSkills;
}
