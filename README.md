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

The plugin reads configuration from the OpenCode config file (`~/.config/opencode/config.json`):

```json
{
  "plugins": ["@zenobius/opencode-skillful"],
  "skillful": {
    "debug": false,
    "basePaths": ["~/.config/opencode/skills", ".opencode/skills"]
  }
}
```

### Configuration Options

- **debug** (boolean, default: `false`): Enable debug output showing skill discovery stats
  - When enabled, `skill_find` includes discovered, parsed, rejected, and duplicate counts
  - Useful for diagnosing skill loading issues
- **basePaths** (array, default: standard locations): Custom skill search directories
  - Paths are searched in order; later paths override earlier ones for duplicate skill names
  - Use project-local `.opencode/skills/` for project-specific skills

## Architecture

The plugin consists of two main layers:

### Services Layer (`src/services/`)

Core business logic for skill management:

- **SkillProvider**: Main interface for accessing the skill registry and searcher
- **SkillRegistry**: Manages skill storage, lookup, and lifecycle
- **SkillSearcher**: Implements search parsing and matching logic
  - Supports natural language queries (Gmail-style syntax)
  - Handles negation, quoted phrases, and path prefix matching
  - Scores results by relevance (name matches weighted higher)
- **SkillFs**: Filesystem abstraction for skill discovery
- **SkillResourceResolver**: Resolves and reads resource files from skill directories
- **ScriptResourceExecutor**: Executes scripts from skill resources
- **OpenCodeChat**: Injects skill content and resources into chat context

### Tools Layer (`src/tools/`)

Four tool implementations that expose plugin functionality:

- **SkillFinder.ts**: `skill_find` - Search and discover skills
- **SkillUser.ts**: `skill_use` - Load skills into context
- **SkillResourceReader.ts**: `skill_resource` - Read skill resource files
- **SkillScriptExec.ts**: `skill_exec` - Execute skill scripts

Each tool:

1. Validates input parameters
2. Delegates to service layer logic
3. Formats results as XML/JSON
4. Silently injects skill content via OpenCodeChat
5. Returns human-readable feedback to the agent

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
