# Code quality standards implementation plan

Status: planned; not yet implemented.

## Objective

Establish durable standards for human and automated contributors while strengthening the existing
TypeScript, Biome, Vitest, npm, and GitHub Actions stack. Add mocked-WebHID Playwright coverage for
critical browser workflows without presenting browser emulation as physical firmware validation.

The repository currently has a healthy baseline: Biome linting, TypeScript builds, Vitest tests and
coverage thresholds, `npm audit` in CI, Dependabot, restrictive GitHub Actions permissions, and a
documented manual hardware test process. This work should extend that baseline rather than add
overlapping tools.

## Planned changes

### Contributor and agent policy

- Add `CONTRIBUTING.md` as the authoritative public quality policy.
- Require small, cohesive modules; descriptive naming; explicit error propagation; boundary input
  validation; secret-safe diagnostics; least-privilege changes; and removal of dead code.
- Define the testing pyramid:
  - Unit tests for protocol encoding, image processing, and other pure business logic.
  - Component and integration tests for UI, session, controller, and operation boundaries.
  - Playwright tests for critical browser workflows.
  - Manual tests on physical hardware for claims about firmware behavior.
- Require focused regression tests for behavioral changes. Keep the current coverage floors as
  regression gates rather than targets: 70% statements, 60% branches, 70% functions, and 70% lines.
- Document locked dependency installation, dependency review, formatting, linting, type-checking,
  tests, builds, and the required pre-pull-request commands.
- Add a concise root `AGENTS.md` with the same mandatory standards, instructions to preserve
  unrelated working-tree changes, and the existing hardware-safety constraints.
- Link `CONTRIBUTING.md` from `README.md`.

### Automated enforcement

- Enable TypeScript `strict` mode in the application and Node/Vite configurations.
- Keep Biome as the sole formatter and linter. Configure it to reject console logging in production
  source and to check formatting in CI.
- Retain the write-capable `format` command and add these non-mutating package scripts:
  - `format:check` for formatting verification.
  - `typecheck` for the TypeScript project build without output.
  - `test:e2e` for Playwright.
  - `check` as the local aggregate quality gate.
- Continue using locked npm installs, `npm audit --audit-level=high`, and Dependabot. Do not add
  ESLint, Prettier, SonarQube, or Snyk alongside the existing equivalent controls.
- Update GitHub Actions to run dependency audit, format/lint checks, strict type-checking, coverage
  tests, the production build, and Playwright E2E before deployment. Preserve minimal job
  permissions and the existing coverage summary and artifact.

### Browser end-to-end tests

- Add Playwright with Chromium and configure its web server to launch the Vite application under
  the repository base path.
- Add a reusable test-only WebHID emulator with two interfaces representing the expected control
  and data usage pages.
- Have the emulator record feature and output reports, return feature-report handshakes, emit image
  acknowledgements, and support deterministic transfer-failure and disconnect scenarios.
- Install the emulator with Playwright initialization code before application scripts run. Do not
  add a production controller injection hook or otherwise change the production bundle.
- Cover these critical paths:
  1. Connect and disconnect from the Device workspace; verify status and control availability.
  2. Apply a lighting preset; verify visible success and the expected HID transaction.
  3. Synchronize time; verify its report sequence and success status.
  4. Upload a small static image fixture; verify preparation, progress, output chunks, save framing,
     and completion.
  5. Inject a transport failure or disconnect during an operation; verify actionable error feedback,
     cleared operation state, and absence of false success.

## Acceptance criteria

- Existing unit, component, and integration tests continue to pass.
- `npm run check`, `npm run test:coverage`, `npm run test:e2e`, and `npm run build` all pass locally
  and in GitHub Actions.
- Browser tests exercise the real `WebHIDDeviceController` through the emulated browser API.
- No public application API, protocol format, or production behavior changes.
- The manual hardware checklist remains the release gate for firmware-dependent behavior.
- Existing uncommitted lighting and responsive-layout work is preserved and accommodated.

## Implementation notes

- At the time this plan was recorded, the repository passed 164 Vitest tests, Biome linting, and the
  production TypeScript/Vite build.
- An attempted Playwright dependency installation was interrupted before it changed `package.json`
  or `package-lock.json`; no partial implementation changes need cleanup.
- Run the full acceptance suite after installing Playwright and again after all configuration and CI
  changes are complete.
