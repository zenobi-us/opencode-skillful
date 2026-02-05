# Project Summary

**Project**: opencode-skillful  
**Repository**: https://github.com/zenobi-us/opencode-skillful  
**Description**: OpenCode Skills Plugin - Implements Anthropic's Agent Skills Specification (v1.0)

## Current Status

- **Active Epic**: None
- **Active Phase**: None
- **Last Updated**: 2026-02-05

## Project Overview

This is an OpenCode plugin that provides skill discovery and loading capabilities. It implements the Anthropic Agent Skills Specification, allowing users to discover SKILL.md files and load them into chat sessions.

### Key Features

- Discovers SKILL.md files from multiple directories
- Validates skills against Anthropic's spec (YAML frontmatter + Markdown)
- Provides 3 main tools: `skill_use`, `skill_find`, `skill_resource`
- Supports multiple prompt formats (XML, JSON, Markdown)
- Model-aware format selection

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript (ES2021+)
- **Testing**: Vitest
- **Linting**: ESLint + Prettier
- **Build**: `mise run build`

## Next Milestones

- No active milestones

## Recent Completions

- Initial memory system setup (2026-02-05)
