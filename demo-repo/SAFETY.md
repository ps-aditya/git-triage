# Safety

This demo is intentionally shaped like a malicious repository, but it is harmless.

- `public/fonts/fa-solid-400.woff2` is a Node.js script that prints two lines. It does not read files, access the network, or install anything.
- The folder-open task ships as `.vscode/tasks.json.example`. `enable-demo.ps1` / `enable-demo.sh` copies it to `.vscode/tasks.json` so you can test the detector. It still only runs the harmless script above.
- The credentials in `README.md` are fake patterns. They are not valid tokens.
- `.github/workflows/security-audit.yml` contains a suspicious string inside an `echo`; it does not download or execute a remote script.
- The optional Git hook prints a message only.

Do not replace the fake payload with real malware or live credentials. The point is to test the detector, not to build a weapon.
