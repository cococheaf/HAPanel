# Contributing to HAPanel

HAPanel is a vibe-coded project built with AI assistance. Its creator has no programming background. Explanatory reviews, small understandable pull requests and help reproducing bugs are especially welcome.

**[Deutsch](CONTRIBUTING.md) · English**

Use Node.js 24 LTS and `npm ci`. `npm run dev` starts the sample-data API and Vite. `/preview.html` needs no HA credentials.

Before a pull request:

```sh
npm test
npm run build
npm run build:preview
```

Add focused regression tests for layout, persistence and access-control changes. Text or colour changes do not need tests that simply mirror their implementation. Format changed files with `npx prettier --write FILE`.

Put tile rendering in `src/client/ui`, configuration rules in `src/shared` and HA communication only in the backend. Tests and simulators must not contact a real HA instance. Schema changes need an explicit version/migration decision.

All interface text, including accessibility labels and HAPanel errors, belongs in the shared German and English catalogs. Avoid concatenating translated sentence fragments. See the [translation guide](docs/translations.md) for additional languages.

Do not commit tokens, private HA exports or screenshots of real household data. `.data/`, `.env` and build output are ignored. Contributions must be compatible with MIT licensing; document the provenance and licence of reused material. Tessera code requires separate licence consideration.

Bug reports should include the HAPanel/HA/browser versions, display profile and reproduction steps. See [SECURITY.en.md](SECURITY.en.md) for security reporting.
