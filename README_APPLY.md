# Web-Notion UI tuning

This package contains the two modified source files for the public `Linuxxy0/Web-Notion` repository:
- `src/App.vue`
- `src/styles.css`

## What changed
- Main page simplified into a compact web-disk style overview block
- Visible statistics moved out of the main page and kept in Settings
- UI reduced in size: header, sidebar, buttons, chips, spacing, footer
- Background particle animation made much slower and lighter
- Scroll-driven scene switching removed for a calmer feel

## How to apply
1. Replace the original repo files with the two files inside `src/`
2. Or apply `Web-Notion-ui-tuning.patch`
3. Run:
   - `npm install`
   - `npm run dev`

## Notes
This package was prepared against the current public `main` branch structure where `src/App.vue` and `src/styles.css` drive the shell UI.
