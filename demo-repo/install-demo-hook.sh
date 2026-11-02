#!/bin/sh
# DEMO ONLY — installs a harmless post-checkout hook.
# Run this from the demo repository root:
#   sh ./install-demo-hook.sh
set -e
mkdir -p .git/hooks
cp .git-hooks/post-checkout .git/hooks/post-checkout
chmod +x .git/hooks/post-checkout
echo "Installed demo hook at .git/hooks/post-checkout"
