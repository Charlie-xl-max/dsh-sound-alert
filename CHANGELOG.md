# Changelog

## 1.1.0 — 2026-11-14

- Replace the waiting chime's three fast triangle notes with a softer two-note
  bell (C5 → G5) built from a fundamental and two quiet, fast-decaying
  partials.
- Unlock the audio context on the first pointer or keyboard gesture, so the
  first chime is not swallowed by the browser's autoplay policy.
- Add an install section, an MIT license, and a packaged release.
- Rename the bundle from `@local/sound-alert` to `dsh-sound-alert` so the public
  plugin identity is unique.

## 1.0.0 — 2026-11-13

- First release: a waiting chime and a finished chime driven by the Session UI
  status transitions, with no audio files, dependencies, or build step.
