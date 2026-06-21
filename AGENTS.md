# Repository Guidelines

## Project Structure & Module Organization

Wavegram is a TypeScript/Vite library exposing the `wavegram-player` Web Component. Source code lives in `src/`: `component/` contains the custom element, `audio/` handles loading, decoding, playback, waveform, and spectrogram analysis, `render/` draws canvases, `utils/` holds shared helpers, and `worker/` contains the spectrogram worker. Public exports are in `src/index.ts`.

Tests are under `test/`. Unit and component tests use Vitest in `test/*.test.ts`; browser-level checks use Playwright in `test/e2e/*.spec.ts`. Example pages and demo assets live in `examples/`. Build output is generated in `dist/` and should not be edited by hand.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run dev`: start Vite on `127.0.0.1`; use pages such as `examples/basic.html` for manual checks.
- `npm run build`: type-check the build config, emit declarations, and create ES/UMD bundles in `dist/`.
- `npm test`: run Vitest unit and component tests with `happy-dom`.
- `npm run test:e2e`: run Playwright tests; the config starts `npm run dev -- --port 4173` when needed.
- `npm run typecheck`: run TypeScript without emitting files.

## Coding Style & Naming Conventions

Use TypeScript modules with explicit exports from `src/index.ts`. Keep indentation at two spaces, terminate statements with semicolons, and follow the existing double-quote import style. Use `PascalCase` for classes and types, `camelCase` for functions, properties, and locals, and hyphenated names for custom element attributes such as `show-waveform`.

Prefer small modules that match the current directory boundaries. Canvas rendering logic belongs in `src/render/`; audio analysis and playback logic belongs in `src/audio/`.

## Testing Guidelines

Add Vitest tests next to the existing unit suite for pure utilities and component behavior. Name files `*.test.ts` and use descriptive `it(...)` cases. Add Playwright specs in `test/e2e/` when behavior depends on real browser rendering, audio loading, or user interaction. Run `npm test`, `npm run typecheck`, and `npm run test:e2e` before changes that affect public behavior.

## Commit & Pull Request Guidelines

Recent history uses short imperative commit subjects, for example `Add npm package metadata`. Keep commits focused and describe the observable change. Pull requests should include a summary, test results, linked issues when applicable, and screenshots or notes for visible changes.

## Security & Configuration Tips

Do not commit generated local artifacts such as `test-results/` or machine-specific files. Remote audio examples must be CORS-compatible because the component fetches and decodes audio in the browser.
