# Contributing

Thanks for helping make repositories safer.

## Development

```bash
npm install
npm run dev -- scan demo-repo
npm test
npm run build
```

## Adding a detection

1. Add the rule to `src/rules.ts` (for secrets or CI patterns) or to the relevant check in `src/checks/`.
2. Add a test fixture in `tests/scanner.test.mjs`.
3. Make sure the finding never includes a raw secret.
4. Run `npm test`.

## False positives

Open an issue with:

- the rule ID,
- the file and line,
- a redacted snippet,
- why the behavior is legitimate.

Do not paste real credentials.

## Pull requests

- Keep changes focused.
- Add or update tests.
- Run `npm run typecheck` and `npm test`.
- Update the README if you add a user-facing feature.

## Code of conduct

Be direct, be kind, and assume good faith. Security work is stressful enough.
