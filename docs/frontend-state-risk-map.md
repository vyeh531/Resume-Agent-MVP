# Frontend State Risk Map

This app currently mixes React pages with browser-global scripts. This document records the risk so future fixes can stay scoped and avoid accidentally corrupting report output.

## Current Interaction Model

- React pages render the main markup, then call browser globals for behavior.
- Main globals include `window.submitResume`, `window.mockLogin`, `window.mockPayment`, `window.exportPDF`, `window.exportAiRewritePDF`, `window.guardSubmitted`, and `window.guardPaid`.
- The implementations live mostly in `public/assets/app.js`, `public/result-logic.js`, and `public/report-logic.js`.
- These scripts directly call `document.getElementById`, `querySelector`, `innerHTML`, `textContent`, `window.location.href`, and `window.addEventListener`.

## Persistent State

- The primary browser state key is `localStorage.resumeFixMVP`.
- `public/assets/app.js` defines `window.Store` and writes submission, login, payment, report, and ATS result data.
- Result and report scripts read the same key to render dashboard tiles, ATS details, mentor advice, premium unlocks, and report exports.
- Several React pages also read localStorage directly for guards and progress screens.

## Risk Notes

- Report content can be produced from strings in public scripts, not only React JSX or API responses.
- A text encoding regression in `public/report-logic.js`, `public/result-logic.js`, ATS scorer output, or mentor advice formatting can become user-visible report content.
- PowerShell `Get-Content` may display valid UTF-8 Chinese as mojibake in this environment. Use Node or `npm run check:encoding` to validate actual file content.
- This pass does not refactor DOM/localStorage behavior. It only adds a guardrail for text corruption and documents where stateful behavior currently lives.

## Guardrail

- Run `npm run check:encoding` after adding or editing Chinese report text, ATS advice text, DB log messages, or public script UI copy.
- Treat any finding as a content bug unless the match is clearly a legitimate non-English word and the scanner is updated with a narrower rule.
