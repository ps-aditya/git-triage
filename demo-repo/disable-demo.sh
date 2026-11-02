#!/bin/sh
# DEMO ONLY — removes the folder-open task.
# Run from the demo repository root:
#   sh ./disable-demo.sh
if [ -f .vscode/tasks.json ]; then
  rm -f .vscode/tasks.json
  echo "Removed .vscode/tasks.json."
else
  echo "No .vscode/tasks.json to remove."
fi
