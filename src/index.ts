/**
 * OpenCode Skills Plugin
 *
 * Implements Anthropic's Agent Skills Specification (v1.0) for OpenCode.
 *
 * Features:
 * - Discovers SKILL.md files from .opencode/skills/, ~/.opencode/skills/, and ~/.config/opencode/skills/
 * - Validates skills against Anthropic's spec (YAML frontmatter + Markdown)
 * - Provides unified skill discovery and loading via two main tools:
 *   - use_skills(): Load one or more skills by name
 *   - find_skills(): Search for skills by free-text query
 * - Delivers skill content via silent message insertion (noReply pattern)
 * - Supports nested skills with proper naming
 *
 * Design Decisions:
 * - Consolidates 50+ individual skill tools into 2 unified tools (cleaner namespace)
 * - Skills are discovered resources, not always-on capabilities
 * - Lazy loading: skills only inject when explicitly requested
 * - Tool restrictions handled at agent level (not skill level)
 * - Message insertion pattern ensures skill content persists (user messages not purged)
 * - Base directory context enables relative path resolution
 * - Skills require restart to reload (acceptable trade-off)
 *
 * @see https://github.com/anthropics/skills
 */

import { tool, ToolContext, type Plugin } from '@opencode-ai/plugin';

import { createInstructionInjector } from './lib/OpenCodeChat';
import { createApi } from './api';
import { getPluginConfig } from './config';
import { jsonToXml } from './lib/xml';

export const SkillsPlugin: Plugin = async (ctx) => {
  const config = await getPluginConfig(ctx);
  const api = await createApi(config);
  const sendPrompt = createInstructionInjector(ctx);

  api.registry.initialise();

  return {
    tool: {
      skill_use: tool({
        description:
          'Load one or more skills into the chat. Provide an array of skill names to load them as user messages.',
        args: {
          skill_names: tool.schema
            .array(tool.schema.string())
            .describe('An array of skill names to load.'),
        },
        execute: async (args, toolCtx: ToolContext) => {
          const results = await api.loadSkill(args.skill_names);
          for await (const skill of results.loaded) {
            await sendPrompt(jsonToXml(skill, 'Skill'), { sessionId: toolCtx.sessionID });
          }

          return JSON.stringify({
            loaded: results.loaded.map((skill) => skill!.toolName),
            not_found: results.notFound,
          });
        },
      }),

      skill_find: tool({
        description: `Search for skills using natural query syntax`,
        args: {
          query: tool.schema
            .union([tool.schema.string(), tool.schema.array(tool.schema.string())])
            .describe('The search query string or array of strings.'),
        },
        execute: async (args) => {
          const results = await api.findSkills(args);
          const output = jsonToXml(results, 'SkillSearchResults');
          return output;
        },
      }),

      skill_resource: tool({
        description: `Read a resource file from a skill.`,
        args: {
          skill_name: tool.schema.string().describe('The skill id to read the resource from.'),
          relative_path: tool.schema
            .string()
            .describe('The relative path to the resource file within the skill directory.'),
        },
        execute: async (args, toolCtx: ToolContext) => {
          const result = await api.readResource(args);
          if (!result.injection) {
            throw new Error('Failed to read resource');
          }

          await sendPrompt(jsonToXml(result.injection), { sessionId: toolCtx.sessionID });

          return JSON.stringify({
            result: 'Resource injected successfully',
            resource_path: result.injection.resource_path,
            resource_mimetype: result.injection.resource_mimetype,
          });
        },
      }),
    },
  };
};
