# Research Findings - {subagent_id}

**Run ID:** {run_id}
**Timestamp:** {iso_timestamp}
**Agent:** {subagent_id}
**Session:** {session_name}
**Assigned URLs:** {url_count}

## URLs Explored

| # | Title | URL | Status |
|---|-------|-----|--------|
| 1 | ... | ... | success |
| 2 | ... | ... | failed |

## Findings by URL

### {URL}
**Title:** {page_title}
**Domain:** {domain}
**Explored At:** {timestamp}
**Relevance:** {high|medium|low}

**Key Points:**
- {point 1}
- {point 2}

**Notable Quotes:**
> "{quote 1}"

**Data/Statistics:**
| Metric | Value |
|--------|-------|
| ... | ... |

---

### {URL}
...

## Cross-URL Insights

{Any patterns or connections noticed across multiple sources}

## Notes and Observations

- {observation 1}
- {observation 2}

## Errors and Failures

| URL | Error | Action Taken |
|-----|-------|--------------|
| ... | ... | skipped |

## Metadata

```yaml
run_id: {run_id}
subagent_id: {subagent_id}
session: {session_name}
urls_assigned: {count}
urls_explored: {count}
urls_succeeded: {count}
urls_failed: {count}
duration_seconds: {duration}
```
