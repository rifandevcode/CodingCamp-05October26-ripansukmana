# Life Dashboard — Structure

## Project layout

```text
.
├── .agents/
│   └── tasks/
│       ├── review.json
│       └── review.md
├── .kiro/
│   └── steering/
│       ├── product.md
│       ├── tech.md
│       └── structure.md
├── assets/
│   └── dino/
│       ├── dino-01.webp
│       ├── dino-02.webp
│       ├── dino-03.webp
│       ├── dino-04.webp
│       ├── dino-05.webp
│       ├── dino-06.webp
│       ├── dino-07.webp
│       ├── dino-08.webp
│       ├── dino-09.webp
│       └── dino-10.webp
├── css/
│   └── style.css
├── js/
│   └── script.js
├── index.html
└── README.md
```

## assets/dino

Contains ten WebP images named `dino-01.webp` through `dino-10.webp` (zero-padded two digits). The dino completion reward picks one at random when a to-do task is marked complete.

## File rules

- One CSS file: all styles live in `css/style.css`. No other CSS files are used.
- One JavaScript file: all behavior lives in `js/script.js`. No other JavaScript files are used.

## Code quality

Keep the code clean, readable, responsive (desktop, tablet, and mobile), and accessible (semantic HTML, ARIA labels and live regions, keyboard support, visible focus states, and AA-contrast colors in both themes).
