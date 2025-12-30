# OpenCode Skills Plugin

An interpretation of the [Anthropic Agent Skills Specification](https://github.com/anthropics/skills) for OpenCode, providing lazy-loaded skill discovery and injection.

Differentiators include:

- Conversationally the agent uses `skill_find words, words words` to discover skills
- The agent uses `skill_use fully_resolved_skill_name` and,
- The agent can use `skill_resource skill_relative/resource/path` to read reference material

## Installation

Create or edit your OpenCode configuration file (typically `~/.config/opencode/config.json`):

```json
{
  "plugins": ["@zenobius/opencode-skillful"]
}
```

## Usage

### Example 1: Finding and Loading Skills

```
I need to write a commit message. Can you find any relevant skills and load them?

1. Use skill_find to search for "commit" or "git" related skills
2. Load the most relevant skill using skill_use
3. Apply the loaded skill guidance to write my commit message
```

**Demonstrates:**

- Searching for skills by keyword
- Loading skills into the chat context
- Applying skill guidance to tasks

### Example 2: Browsing Available Skills

```
What skills are available? Show me everything under the "experts" category.

1. List all skills with skill_find "*"
2. Filter to a specific path with skill_find "experts"
3. Load a specific expert skill for deep guidance
```

**Demonstrates:**

- Listing all available skills
- Path prefix filtering (e.g., "experts", "superpowers/writing")
- Hierarchical skill organization

### Example 3: Advanced Search with Exclusions

```
Find testing-related skills but exclude anything about performance testing.

skill_find "testing -performance"
```

**Demonstrates:**

- Natural language query syntax
- Negation with `-term`
- AND logic for multiple terms

## Features

- Discover SKILL.md files from multiple locations
- Lazy loading - skills only inject when explicitly requested
- Path prefix matching for organized skill browsing
- Natural query syntax with negation and quoted phrases
- Skill ranking by relevance (name matches weighted higher)
- Silent message insertion (noReply pattern)
- **Pluggable prompt rendering** with model-aware format selection (XML, JSON, Markdown)

## Prompt Renderer Configuration

The plugin supports **multiple formats for prompt injection**, allowing you to optimize results for different LLM models and use cases.

> See the [Configuration](#configuration) section for complete configuration details, including bunfig setup and global/project-level overrides.

### Supported Formats

Choose the format that works best for your LLM:

| Format            | Best For               | Characteristics                                                        |
| ----------------- | ---------------------- | ---------------------------------------------------------------------- |
| **XML** (default) | Claude models          | Human-readable, structured, XML-optimized for Claude                   |
| **JSON**          | GPT and strict parsers | Machine-readable, strict JSON structure, strong parsing support        |
| **Markdown**      | All models             | Readable prose, heading-based structure, easy to read in conversations |

### Configuration Syntax

Set your preferences in `.opencode-skillful.json`:

```json
{
  "promptRenderer": "xml",
  "modelRenderers": {
    "claude-3-5-sonnet": "xml",
    "gpt-4": "json",
    "gpt-4-turbo": "json"
  }
}
```

**How It Works:**

1. Every tool execution checks the current active LLM model
2. If `modelRenderers[modelID]` is configured, that format is used
3. Otherwise, the global `promptRenderer` default is used
4. Results are rendered in the selected format and injected into the prompt

### Format Output Examples

#### XML Format (Claude Optimized)

```xml
<Skill>
  <name>git-commits</name>
  <description>Guidelines for writing effective git commit messages</description>
  <toolName>writing_git_commits</toolName>
</Skill>
```

**Advantages:**

- Matches Claude's native instruction format
- Clear tag-based structure
- Excellent readability for complex nested data

#### JSON Format (GPT Optimized)

```json
{
  "name": "git-commits",
  "description": "Guidelines for writing effective git commit messages",
  "toolName": "writing_git_commits"
}
```

**Advantages:**

- Strong parsing support across LLMs
- Strict, validated structure
- Familiar format for language models trained on JSON data

#### Markdown Format (Human Readable)

```markdown
# Skill

### name

- **name**: _git-commits_

### description

- **description**: _Guidelines for writing effective git commit messages_

### toolName

- **toolName**: _writing_git_commits_
```

**Advantages:**

- Most readable in conversations
- Natural language-friendly
- Works well for exploratory workflows

## Skill Discovery Paths

Skills are discovered from these locations (in priority order, last wins on duplicates):

1. `~/.config/opencode/skills/` - Standard XDG config location or (`%APPDATA%/.opencode/skills` for windows users)
2. `.opencode/skills/` - Project-local skills (highest priority)

## Usage in OpenCode

### Finding Skills

```
# List all available skills
skill_find query="*"

# Search by keyword
skill_find query="git commit"

# Exclude terms
skill_find query="testing -performance"
```

### Loading Skills

Skills must be loaded by their fully-qualified identifier (generated from the directory path).

The skill identifier is created by converting the directory path to a slug: directory separators and hyphens become underscores.

```
skills/
  experts/
    ai/
      agentic-engineer/        # Identifier: experts_ai_agentic_engineer
  superpowers/
    writing/
      code-review/             # Identifier: superpowers_writing_code_review
```

When loading skills, use the full identifier:

```
# Load a skill by its identifier
skill_use skill_names=["experts_ai_agentic_engineer"]

# Load multiple skills
skill_use skill_names=["experts_ai_agentic_engineer", "superpowers_writing_code_review"]
```

### Reading Skill Resources

```

# Read a reference document

skill_resource skill_name="writing-git-commits" relative_path="references/style-guide.md"

# Read a template

skill_resource skill_name="brand-guidelines" relative_path="assets/logo-usage.html"

```

Normally you won't need to use `skill_resource` directly, since the llm will do it for you.

When skill_use is called, it will be wrapped with instructions to the llm on
how to load references, assets, and scripts from the skill.

But when writing your skills, there's nothing stopping you from using `skill_resource` to be explicit.

(Just be aware that exotic file types might need special tooling to handle them properly.)

### Executing Skill Scripts

```

# Execute a script without arguments

skill_exec skill_name="build-utils" relative_path="scripts/generate-changelog.sh"

# Execute a script with arguments

skill_exec skill_name="code-generator" relative_path="scripts/gen.py" args=["--format", "json", "--output", "schema.json"]

```

## Plugin Tools

The plugin provides four core tools implemented in `src/tools/`:

### `skill_find` (SkillFinder.ts)

Search for skills using natural query syntax with intelligent ranking by relevance.

**Parameters:**

- `query`: Search string supporting:
  - `*` or empty: List all skills
  - Path prefixes: `experts`, `superpowers/writing` (prefix matching)
  - Keywords: `git commit` (multiple terms use AND logic)
  - Negation: `-term` (exclude results)
  - Quoted phrases: `"exact match"` (phrase matching)

**Returns:**

- List of matching skills with:
  - `skill_name`: Skill identifier (e.g., `experts_writing_git_commits`)
  - `skill_shortname`: Directory name of the skill (e.g., `writing-git-commits`)
  - `description`: Human-readable description
- If config.debug is enabled:
  - Debug information: discovered count, parsed results, rejections, duplicates, errors

**Example Response:**

```xml
<SkillSearchResults query="git commit">
  <Skills>
    <Skill skill_name="experts_writing_git_commits" skill_shortname="writing-git-commits">
      Guidelines for writing effective git commit messages
    </Skill>
  </Skills>
  <Summary>
    <Total>42</Total>
    <Matches>1</Matches>
    <Feedback>Found 1 skill matching your query</Feedback>
  </Summary>
</SkillSearchResults>
```

### `skill_use` (SkillUser.ts)

Load one or more skills into the chat context with full resource metadata.

**Parameters:**

- `skill_names`: Array of skill identifiers to load (e.g., `experts_ai_agentic_engineer`)

**Features:**

- Injects skill metadata and content including:
  - Skill name and description
  - Resource inventory:
    - `references`: Documentation and reference files
    - `assets`: Binary files, templates, images
    - `scripts`: Executable scripts with paths and MIME types
  - Full skill content formatted as Markdown for easy reading
  - Base directory context for relative path resolution

**Behavior:** Silently injects skills as user messages (persists in conversation history)

**Example Response:**

```json
{ "loaded": ["experts/writing-git-commits"], "notFound": [] }
```

### `skill_resource` (SkillResourceReader.ts)

Read a specific resource file from a skill's directory and inject silently into the chat.

**When to Use:**

- Load specific reference documents or templates from a skill
- Access supporting files without loading the entire skill
- Retrieve examples, guides, or configuration templates
- Most commonly used after loading a skill with `skill_use` to access its resources

**Parameters:**

- `skill_name`: The skill containing the resource (by toolName/FQDN or short name)
- `relative_path`: Path to the resource relative to the skill directory

**Returns:**

- MIME type of the resource
- Success confirmation with skill name, resource path, and type

**Behavior:**

- Silently injects resource content without triggering AI response (noReply pattern)
- Resolves relative paths within skill directory (e.g., `references/guide.md`, `assets/template.html`, `scripts/setup.sh`)
- Supports any text or binary file type

**Example Response:**

```
Load Skill Resource

  skill: experts/writing-git-commits
  resource: templates/commit-template.md
  type: text/markdown
```

### `skill_exec` (SkillScriptExec.ts)

Execute scripts from skill resources with optional arguments.

**Parameters:**

- `skill_name`: The skill containing the script (by toolName/FQDN or short name)
- `relative_path`: Path to the script file relative to the skill directory
- `args`: Optional array of string arguments to pass to the script

**Returns:**

- Exit code of the script execution
- Standard output (stdout)
- Standard error (stderr)
- Formatted text representation

**Behavior:**

- Locates and executes scripts within skill directories
- Passes arguments to the script
- Silently injects execution results
- Includes proper error handling and reporting

**Example Response:**

```
Executed script from skill "build-utils": scripts/generate-changelog.sh

Exit Code: 0
STDOUT: Changelog generated successfully
STDERR: (none)
```

## Error Handling

### skill_find Errors

When a search query doesn't match any skills, the response includes feedback:

```xml
<SkillSearchResults query="nonexistent">
  <Skills></Skills>
  <Summary>
    <Total>42</Total>
    <Matches>0</Matches>
    <Feedback>No skills found matching your query</Feedback>
  </Summary>
</SkillSearchResults>
```

### skill_use Errors

When loading skills, if a skill name is not found, it's returned in the `notFound` array:

```json
{ "loaded": ["writing-git-commits"], "notFound": ["nonexistent-skill"] }
```

The loaded skills are still injected into the conversation, allowing you to use available skills even if some are not found.

### skill_resource Errors

Resource loading failures occur when:

- The skill doesn't exist
- The resource path doesn't exist within the skill
- The file cannot be read due to permissions

The tool returns an error message indicating which skill or resource path was problematic.

### skill_exec Errors

Script execution includes exit codes and error output:

```
Executed script from skill "build-utils": scripts/generate-changelog.sh

Exit Code: 1
STDOUT: (partial output)
STDERR: Permission denied: scripts/generate-changelog.sh
```

Non-zero exit codes indicate script failures. Always check STDERR and the exit code when troubleshooting.

## Configuration

The plugin loads configuration from **bunfig**, supporting both project-local and global configuration files:

### Configuration Files

Configuration is loaded in this priority order (highest priority last):

1. **Global config** (standard platform locations):
   - Linux/macOS: `~/.config/opencode-skillful/config.json`
   - Windows: `%APPDATA%/opencode-skillful/config.json`

2. **Project config** (in your project root):
   - `.opencode-skillful.json`

Later configuration files override earlier ones. Use project-local `.opencode-skillful.json` to override global settings for specific projects.

### Configuration Options

#### Plugin Installation

First, register the plugin in your OpenCode config (`~/.config/opencode/config.json`):

```json
{
  "plugins": ["@zenobius/opencode-skillful"]
}
```

#### Skill Discovery Configuration

Create `.opencode-skillful.json` in your project root or global config directory:

```json
{
  "debug": false,
  "basePaths": ["~/.config/opencode/skills", ".opencode/skills"],
  "promptRenderer": "xml",
  "modelRenderers": {}
}
```

**Configuration Fields:**

- **debug** (boolean, default: `false`): Enable debug output showing skill discovery stats
  - When enabled, `skill_find` responses include discovered, parsed, rejected, and error counts
  - Useful for diagnosing skill loading and parsing issues

- **basePaths** (array, default: standard locations): Custom skill search directories
  - Paths are searched in priority order; later paths override earlier ones for duplicate skill names
  - Default: `[~/.config/opencode/skills, .opencode/skills]`
  - Use project-local `.opencode/skills/` for project-specific skills
  - Platform-aware paths: automatically resolves to XDG, macOS, or Windows standard locations

- **promptRenderer** (string, default: `'xml'`): Default format for prompt injection
  - Options: `'xml'` | `'json'` | `'md'`
  - XML (default): Claude-optimized, human-readable structured format
  - JSON: GPT-optimized, strict JSON formatting for strong parsing models
  - Markdown: Human-readable format with headings and nested lists
  - Used when no model-specific renderer is configured

- **modelRenderers** (object, default: `{}`): Per-model format overrides
  - Maps model IDs to preferred formats
  - Overrides global `promptRenderer` for specific models
  - Example: `{ "gpt-4": "json", "claude-3-5-sonnet": "xml" }`

### How Renderer Selection Works

When any tool executes (`skill_find`, `skill_use`, `skill_resource`):

1. The plugin queries the OpenCode session to determine the active LLM model
2. Builds a list of model candidates to check, from most to least specific:
   - Full model ID (e.g., `"anthropic-claude-3-5-sonnet"`)
   - Generic model pattern (e.g., `"claude-3-5-sonnet"`)
3. Checks if any candidate exists in `modelRenderers` configuration
   - First match wins (most specific takes precedence)
   - If found, uses that format
4. If no match in `modelRenderers`, falls back to `promptRenderer` default
5. Renders the results in the selected format and injects into the prompt

**Example**: If your config has `"claude-3-5-sonnet": "xml"` and the active model is `"anthropic-claude-3-5-sonnet"`, the plugin will:

- Try matching `"anthropic-claude-3-5-sonnet"` (no match)
- Try matching `"claude-3-5-sonnet"` (match found! Use XML)
- Return `"xml"` format

This allows different models to receive results in their preferred format without needing to specify every model variant. Configure the generic model name once and it works for all provider-prefixed variations.

### Example Configurations

#### Global Configuration for Multi-Model Setup

`~/.config/opencode-skillful/config.json`:

```json
{
  "debug": false,
  "promptRenderer": "xml",
  "modelRenderers": {
    "claude-3-5-sonnet": "xml",
    "claude-3-opus": "xml",
    "gpt-4": "json",
    "gpt-4-turbo": "json",
    "llama-2-70b": "md"
  }
}
```

#### Project-Specific Override

`.opencode-skillful.json` (project root):

```json
{
  "debug": true,
  "basePaths": ["~/.config/opencode/skills", ".opencode/skills", "./vendor/skills"],
  "promptRenderer": "xml",
  "modelRenderers": {
    "gpt-4": "json"
  }
}
```

This project-local config:

- Enables debug output for troubleshooting
- Adds a custom vendor skills directory
- Uses JSON format specifically for GPT-4 when it's the active model
- Falls back to XML for all other models

## Architecture

### System Design Overview

The plugin uses a **layered, modular architecture** with clear separation of concerns and two-phase initialization.

#### Design Principles

- **Async Coordination**: ReadyStateMachine ensures tools don't execute before registry initialization completes
- **Security-First Resource Access**: All resources are pre-indexed at parse time; no path traversal possible
- **Factory Pattern**: Centralized API creation for easy testing and configuration management
- **Lazy Loading**: Skills only injected when explicitly requested, minimal memory overhead

### System Layers

```
┌──────────────────────────────────────────────────────┐
│ Plugin Entry Point (index.ts)                        │
│ - Defines 3 core tools: skill_find, skill_use,      │
│   skill_resource                                     │
│ - Initializes API factory and config                │
│ - Manages message injection (XML serialization)      │
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│ API Factory Layer (api.ts, config.ts)                │
│ - createApi(): initializes logger, registry, tools   │
│ - getPluginConfig(): resolves base paths with proper │
│   precedence (project-local overrides global)        │
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│ Services Layer (src/services/)                       │
│ - SkillRegistry: discovery, parsing, resource       │
│   mapping with ReadyStateMachine coordination        │
│ - SkillSearcher: query parsing + intelligent ranking│
│ - SkillResourceResolver: safe path-based retrieval   │
│ - SkillFs (via lib): filesystem abstraction (mockable)
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│ Core Libraries (src/lib/)                            │
│ - ReadyStateMachine: async initialization sequencing │
│ - SkillFs: abstract filesystem operations            │
│ - Identifiers: path ↔ tool name conversions          │
│ - OpenCodeChat: message injection abstraction        │
│ - xml.ts: JSON → XML serialization                   │
└──────────────────────────────────────────────────────┘
```

### Initialization Flow (Why This Matters)

The plugin uses a **two-phase initialization pattern** to coordinate async discovery with tool execution:

```
PHASE 1: SYNCHRONOUS CREATION
├─ Plugin loads configuration
├─ createApi() called:
│  ├─ Creates logger
│  ├─ Creates SkillRegistry (factory, NOT initialized yet)
│  └─ Returns registry + tool creators
└─ index.ts registers tools immediately

PHASE 2: ASYNCHRONOUS DISCOVERY (Background)
├─ registry.initialise() called
│  ├─ Sets ready state to "loading"
│  ├─ Scans all base paths for SKILL.md files
│  ├─ Parses each file (YAML frontmatter + resources)
│  ├─ Pre-indexes all resources (scripts/assets/references)
│  └─ Sets ready state to "ready"
│
└─ WHY PRE-INDEXING: Prevents path traversal attacks.
   Tools can only retrieve pre-registered resources,
   never arbitrary filesystem paths.

PHASE 3: TOOL EXECUTION (User Requested)
├─ User calls: skill_find("git commits")
├─ Tool executes:
│  ├─ await registry.controller.ready.whenReady()
│  │  (blocks until Phase 2 completes)
│  ├─ Search registry
│  └─ Return results
└─ WHY THIS PATTERN: Multiple tools can call whenReady()
   at different times without race conditions.
   Simple Promise would resolve once; this allows
   concurrent waiters.
```

### Data Flow Diagram: skill_find Query

```
┌─────────────────────────────────────────┐
│ User Query: skill_find("git commit")    │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ SkillFinder Tool (tools/SkillFinder.ts) │
│ - Validates query string                │
│ - Awaits: controller.ready.whenReady()  │
└────────────┬────────────────────────────┘
             ↓ (continues when registry ready)
┌─────────────────────────────────────────┐
│ SkillSearcher.search()                  │
│ - Parse query via search-string library │
│   ("git commit" → include: [git,commit])│
│ - Filter ALL include terms must match   │
│   (name, description, or toolName)      │
│ - Exclude results matching exclude      │
│   terms                                 │
│ - Rank results:                         │
│   * nameMatches × 3 (strong signal)     │
│   * descMatches × 1 (weak signal)       │
│   * exact match bonus +10                │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ Results with Feedback                   │
│ - Matched skills array                  │
│ - Sorted by relevance score             │
│ - User-friendly feedback message        │
│   "Searching for: **git commit** |      │
│    Found 3 matches"                     │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ Format & Return (index.ts)              │
│ - Convert to XML via jsonToXml()        │
│ - Inject into message context           │
│ - Return to user                        │
└─────────────────────────────────────────┘
```

### Data Flow Diagram: skill_use Loading

```
┌──────────────────────────────────┐
│ User: skill_use("git-commits")   │
└────────────┬─────────────────────┘
             ↓
┌──────────────────────────────────┐
│ SkillUser Tool (tools/SkillUser) │
│ - Await ready state              │
│ - Validate skill names           │
└────────────┬─────────────────────┘
             ↓
┌──────────────────────────────────┐
│ Registry.controller.get(key)     │
│ - Look up skill in Map           │
│ - Return Skill object with:      │
│   * Name, description            │
│   * Content (markdown)           │
│   * Resource maps (indexed)      │
└────────────┬─────────────────────┘
             ↓
┌──────────────────────────────────┐
│ Format Skill for Injection       │
│ - Skill metadata                 │
│ - Resource inventory (with MIME) │
│ - Full content as markdown       │
│ - Base directory context         │
└────────────┬─────────────────────┘
             ↓
┌──────────────────────────────────┐
│ Silent Injection Pattern         │
│ - Inject as user message         │
│ - Persists in conversation       │
│ - Returns success summary        │
│   { loaded: [...], notFound: []}│
└──────────────────────────────────┘
```

### Data Flow Diagram: skill_resource Access

```
┌──────────────────────────────────────────────┐
│ User: skill_resource("git-commits",         │
│                     "scripts/commit.sh")     │
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ SkillResourceReader Tool                     │
│ (tools/SkillResourceReader.ts)               │
│ - Validate skill_name                       │
│ - Parse path: "scripts/commit.sh"            │
│   ├─ type = "scripts"                        │
│   └─ relative_path = "commit.sh"             │
│ - Assert type is valid (scripts|assets|refs)│
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ SkillResourceResolver                       │
│ - Fetch skill object from registry           │
│ - Look up in skill.scripts Map               │
│   (pre-indexed at parse time)                │
│ - Retrieve: { absolutePath, mimeType }      │
│                                              │
│ ★ SECURITY: Only pre-indexed paths exist    │
│   No way to request ../../../etc/passwd      │
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ File I/O (SkillFs abstraction)               │
│ - Read file content from absolutePath        │
│ - Detect MIME type (e.g., text/plain)       │
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ Return Injection Object                      │
│ {                                            │
│   skill_name,                                │
│   resource_path,                             │
│   resource_mimetype,                         │
│   content                                    │
│ }                                            │
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ Silent Injection                             │
│ - Inject content into message                │
│ - User sees resource inline                  │
└──────────────────────────────────────────────┘
```

### Key Design Decisions and Their Rationale

| Decision                     | Why                                                | Impact                                                       |
| ---------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| **ReadyStateMachine**        | Ensures tools don't race with async registry setup | Tools are guaranteed registry is ready before execution      |
| **Pre-indexed Resources**    | Prevents path traversal attacks                    | Security: only pre-registered paths retrievable              |
| **Factory Pattern (api.ts)** | Centralizes initialization                         | Easy to test, swap implementations, mock components          |
| **Removed SkillProvider**    | Eliminated unnecessary abstraction                 | Simpler code, direct registry access, easier debugging       |
| **XML Serialization**        | Human-readable message injection                   | Results display nicely formatted in chat context             |
| **Two-phase Init**           | Async discovery doesn't block tool registration    | Tools available immediately, discovery happens in background |

### Services Layer Breakdown

#### SkillRegistry (`src/services/SkillRegistry.ts`)

- **Role**: Central skill catalog and discovery engine
- **Responsibilities**:
  1. Scan multiple base paths for SKILL.md files (recursive)
  2. Parse each file's YAML frontmatter (validates schema)
  3. Index all resources (scripts/assets/references) for safe retrieval
  4. Register skills in controller.skills Map by toolName
  5. Coordinate initialization via ReadyStateMachine
- **Key Methods**:
  - `initialise()`: Async discovery and parsing pipeline
  - `register()`: Parse and store skill files
  - `parseSkill()`: Extract metadata and resource paths
- **Error Handling**: Malformed skills logged but don't halt discovery

#### SkillSearcher (`src/services/SkillSearcher.ts`)

- **Role**: Natural language query interpretation and ranking
- **Responsibilities**:
  1. Parse queries using search-string library (Gmail syntax)
  2. Filter: ALL include terms must match (AND logic)
  3. Exclude: Remove results matching exclude terms
  4. Rank by relevance (name matches 3×, description 1×, exact +10)
  5. Generate user-friendly feedback
- **Scoring Formula**: `(nameMatches × 3) + (descMatches × 1) + exactBonus`
- **Edge Cases**: Empty queries or "\*" list all skills

### Tools Layer Overview

#### SkillFinder (`src/tools/SkillFinder.ts`)

- Wraps SkillSearcher with ready-state synchronization
- Transforms results to SkillFinder schema
- Returns matched skills + summary metadata

#### SkillUser (`src/tools/SkillUser.ts`)

- Loads skills into chat context
- Injects as user message (persists in conversation)
- Returns { loaded: [...], notFound: [...] }

#### SkillResourceReader (`src/tools/SkillResourceReader.ts`)

- Safe resource path parsing and validation
- Pre-indexed path lookup (prevents traversal)
- Returns injection object with MIME type and content

### Configuration and Path Resolution

```
Configuration Priority (Last Wins):
1. Global: ~/.opencode/skills/ (lowest)
2. Project: ./.opencode/skills/ (highest)

Why This Order:
- Users install global skills once
- Projects override with local versions
- Same skill name in both → project version wins
```

## Contributing

Contributions are welcome! When adding features, follow these principles:

- **Explain the WHY, not the WHAT**: Code comments should document design decisions, not mechanics
- **Keep modules focused**: Each file has one primary responsibility
- **Test async behavior**: Ready state coordination is critical
- **Document algorithms**: Ranking, parsing, and search logic should have detailed comments

## Creating Skills

Skills follow the [Anthropic Agent Skills Specification](https://github.com/anthropics/skills). Each skill is a directory containing a `SKILL.md` file:

```
skills/
  my-skill/
    SKILL.md
    resources/
      template.md
```

### Skill Structure

```
my-skill/
  SKILL.md                 # Required: Skill metadata and instructions
  references/              # Optional: Documentation and guides
    guide.md
    examples.md
  assets/                  # Optional: Binary files and templates
    template.html
    logo.png
  scripts/                 # Optional: Executable scripts
    setup.sh
    generate.py
```

### SKILL.md Format

```yaml
---
name: my-skill
description: A brief description of what this skill does (min 20 chars)
---
# My Skill

Instructions for the AI agent when this skill is loaded...
```

**Requirements:**

- `name` must match the directory name (lowercase, alphanumeric, hyphens only)
- `description` must be at least 20 characters and should be concise (under 500 characters recommended)
  - Focus on when to use the skill, not what it does
  - Include specific triggering conditions and symptoms
  - Use third person for system prompt injection
  - Example: "Use when designing REST APIs to establish consistent patterns and improve developer experience"
- Directory name and frontmatter `name` must match exactly

### Resource Types

Skill resources are automatically discovered and categorized:

- **References** (`references/` directory): Documentation, guides, and reference materials
  - Typically Markdown, plaintext, or HTML files
  - Accessed via `skill_resource` for reading documentation
- **Assets** (`assets/` directory): Templates, images, and binary files
  - Can include HTML templates, images, configuration files
  - Useful for providing templates and examples to the AI
- **Scripts** (`scripts/` directory): Executable scripts that perform actions
  - Shell scripts (.sh), Python scripts (.py), or other executables
  - Executed via `skill_exec` with optional arguments
  - Useful for automation, code generation, or complex operations

## Considerations

- Skills are discovered at plugin initialization (requires restart to reload)
- Duplicate skill names are logged and skipped (last path wins)
- Tool restrictions in `allowed-tools` are informational (enforced at agent level)
- Skill content is injected as user messages (persists in conversation)
- Base directory context is provided for relative path resolution in skills

## Contributing

Contributions are welcome! Please file issues or submit pull requests on the GitHub repository.

## License

MIT License. See the [LICENSE](LICENSE) file for details.
