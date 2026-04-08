# Domain Dictionary Extension

A language-agnostic domain knowledge dictionary for pi coding agent. Maps domain names to related files based on git commit history.

## Installation

This extension is bundled with pi coding agent. No separate installation needed.

## Enable (Experimental)

This is an experimental feature. Set the environment variable to enable:

```bash
export PI_ENABLE_DOMAIN_DICT=1
```

Or run pi with the flag:

```bash
PI_ENABLE_DOMAIN_DICT=1 pi
```

## Usage

Once enabled, the following commands are available:

### `/dict-build`

Build or rebuild the domain dictionary from git history.

```
/dict-build
```

This creates `.pi/domain-dictionary.jsonl` in your project root.

### `/dict [query]`

Search the dictionary for domains or files.

```
/dict session-loop    # Search for exact or partial domain match
/dict auth            # Find all auth-related files
/dict login.ts        # Search by file path
/dict                 # List all domains
```

## How It Works

The extension parses git commit messages in conventional commit format:

```
feat(session-loop): add scheduler
fix(auth): handle edge case
```

Scopes (the part in parentheses) become domain names. Files changed in those commits are mapped to the domain.

## Storage

- **Location:** `.pi/domain-dictionary.jsonl` (project root)
- **Format:** JSON Lines — one domain entry per line, grep/jq friendly

## Requirements

- Git repository with conventional commit messages (scopes become domains)
- `PI_ENABLE_DOMAIN_DICT=1` environment variable set
