# Life Dashboard — Product

## Purpose

Life Dashboard is a responsive, browser-based personal productivity dashboard. It combines a live clock and greeting, a Pomodoro focus timer, a to-do list, and quick links into one calm, themeable view. All user data is stored on the device via the browser's Local Storage; there is no backend and no account.

## Core features

- Real-time clock and date, updated every second.
- Time-based greeting ("Good morning / afternoon / evening / night") that changes with the time of day.
- Custom name used in the greeting.
- Light/dark theme toggle, persisted across reloads.
- Pomodoro focus timer with Start, Pause, and Reset.
- Configurable Pomodoro duration (integer 1–120 minutes; the presets 15, 25, 45, and 60 minutes are all supported).
- To-do list with add, inline edit (double-click), complete, and delete, plus a "Clear All" action with confirmation.
- Quick Links: four default links (Google, Instagram, YouTube, Gmail) seeded on first load, with the ability to add custom links and remove any link.
- Settings dialog to set the custom name and the Pomodoro duration.
- Local Storage persistence for name, theme, Pomodoro duration, to-dos, and quick links.
- Responsive layout for desktop, tablet, and mobile with no horizontal overflow.
- Browser page-translation friendliness: the clock/date and timer values use `translate="no"` so they do not flicker, while normal UI text stays translatable.

## RevoU Coding Camp challenges

This project implements three RevoU challenges:

1. Light / Dark Mode
2. Custom Name in Greeting
3. Change Pomodoro Time

## Dino completion reward

Marking a to-do task as complete triggers a brief celebratory reward:

- A randomly selected dino image from `assets/dino/dino-01.webp` through `assets/dino/dino-10.webp` is shown centered in the viewport.
- A short message is shown: "Great Job!" for a single completion, or "N Tasks Completed!" when several tasks are completed quickly together.
- A short synthesized chime (an ascending major-chord arpeggio) plays via the Web Audio API.
- The reward appears briefly (about 1–1.5 seconds) and then fades out smoothly.
- Rapid completions are batched into one reward (one dino, one sound) with the message showing the count.
- The reward fires only on completion — not on editing, deleting, or unchecking a task.
- The overlay does not block interaction (pointer-events are disabled) and is announced to assistive technology through an `aria-live` status region.
- The dino is a temporary overlay only; it is never added to the to-do list.
