# Life Dashboard — Tech

## Stack

- HTML5 — semantic markup in `index.html`.
- CSS3 — theming via CSS custom properties, responsive layout, and the decorative background; all in `css/style.css`.
- Vanilla JavaScript — all behavior in `js/script.js`, with no libraries or frameworks.
- Local Storage API — persistence for user name, theme, Pomodoro duration, to-dos, and quick links.
- Web Audio API — the synthesized timer-completion beep and the dino-reward chime.

## Backend and dependencies

- No backend, server, or database. The app is static and runs entirely client-side.
- No frameworks and no external dependencies: no npm packages, no CDN scripts, no web fonts loaded over the network, and no third-party libraries.

## Browser compatibility

The README targets modern evergreen browsers: Google Chrome, Mozilla Firefox, Microsoft Edge, and Safari. The app relies on widely supported platform features present in those browsers, including the `<dialog>` element (modal), CSS custom properties, `color-mix()`, `backdrop-filter`, `crypto.randomUUID`, `String.padStart`, and the Web Audio API.

## File rules

- All CSS stays in `css/style.css`.
- All JavaScript stays in `js/script.js`.
- No additional CSS or JavaScript files are introduced.
