# ravikiranrachakonda.github.io

Personal portfolio site for Ravi Rachakonda — Staff Machine Learning Engineer.

**Hosted on:** GitHub Pages  
**Live at:** [ravikiranrachakonda.github.io](https://ravikiranrachakonda.github.io)

---

## Repo Structure

```
portfolio-site/
├── index.html                  # Entry point — thin shell, imports components
├── RaviRachakonda_Resume.pdf   # Downloadable resume
│
├── css/
│   └── styles.css              # All styling
│
├── js/
│   ├── main.js                 # Page init, nav, architecture diagram modal
│   ├── terminal.js             # Interactive terminal (state machine)
│   └── chat.js                 # AI chat widget (calls portfolio-api)
│
└── data/
    └── profile.js              # ⭐ Single source of truth for all profile data
                                #    terminal.js and chat.js both read from here
```

---

## Key Design Decisions

**`data/profile.js` as single source of truth**  
All experience, skills, patents, and contact info live here. The terminal and chat widget both import from this file — updating your profile in one place reflects everywhere.

**Component separation**  
`index.html` is intentionally thin — it only wires scripts together. Logic lives in dedicated JS modules, styling in CSS. Easy to update any layer independently.

**Interactive terminal**  
A state machine (`main → experience → exp_detail → leaf`) that mimics a shell. Zero dependencies, ~150 lines of vanilla JS.

**AI chat widget**  
Floating chat bubble that calls the `portfolio-api` Lambda backend. System prompt is built dynamically from `profile.js` so the AI always has current context.

**Architecture diagram**  
Tabbed SVG modal (AI chat flow + full system architecture), accessible via the "Architecture" button. Inline SVG — no external diagram tools needed.

---

## Local Development

Just open `index.html` in a browser. No build step needed.

For the AI chat to work locally, update `CONFIG.API_ENDPOINT` in `js/main.js` with your deployed Lambda URL.

---

## Deploying Changes

1. Edit files locally
2. Push to GitHub
3. GitHub Pages auto-deploys in ~60 seconds
