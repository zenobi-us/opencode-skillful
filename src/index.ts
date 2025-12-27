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

import { createInstructionInjector } from './services/OpenCodeChat';
import { createApi } from './api';
import { getPluginConfig } from './config';

export const SkillsPlugin: Plugin = async (ctx) => {
  const config = await getPluginConfig(ctx);
  const api = await createApi(config);
  const sendPrompt = createInstructionInjector(ctx);

  return {
    tool: {
      skill_use: tool({
        description:
          'Load one or more skills into the chat. Provide an array of skill names to load them as user messages.',
        args: {},
        execute: async (args, toolCtx: ToolContext) => {
          const results = await api.loadSkill(args.skill_names, async (content: string) => {
            sendPrompt(content, { sessionId: toolCtx.sessionID });
          });
          return results;
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
          return api.findSkills(args);
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
          await sendPrompt(result.injection, { sessionId: toolCtx.sessionID });
          return result.summary;
        },
      }),

      skill_exec: tool({
        description: 'Execute scripts from skill resources with arguments',
        args: {
          skill_name: tool.schema.string(),
          relative_path: tool.schema.string(),
          args: tool.schema.array(tool.schema.string()).optional(),
        },
        execute: async (args, toolCtx: ToolContext) => {
          const result = await api.runScript(args);
          await sendPrompt(result.injection, { sessionId: toolCtx.sessionID });
          return result.summary;
        },
      }),
    },
  };
};
