#!/bin/sh
# DEMO ONLY — enables the harmless folder-open task.
# Run from the demo repository root:
#   sh ./enable-demo.sh
set -e
cp .vscode/tasks.json.example .vscode/tasks.json
echo "Created .vscode/tasks.json."
echo "The payload is harmless, but the task runs on folder open. Run disable-demo.sh when done."
