#!/bin/bash
# cleanup.sh - Clean up temporary research files

set -e

RUN_ID="${1:-}"
if [ -z "$RUN_ID" ]; then
    echo "Usage: cleanup.sh <run_id>"
    exit 1
fi

RESEARCH_DIR="/tmp/deep-research-${RUN_ID}"

# Close all browser sessions for this run
if [ -d "${RESEARCH_DIR}/sessions" ]; then
    for session in $(ls "${RESEARCH_DIR}/sessions/" 2>/dev/null || true); do
        agent-browser --session "${session}" close 2>/dev/null || true
    done
fi

# Remove temp directory
rm -rf "${RESEARCH_DIR}"

echo "Cleaned up research run: ${RUN_ID}"
