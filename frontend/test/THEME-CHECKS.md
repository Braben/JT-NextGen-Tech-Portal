# Theme review

Palette tokens live in `src/theme.css`. Tailwind exposes page, surface, ink,
core, turquoise and accent colors with opacity support.

Primary buttons use the core green with white labels. Secondary buttons use
turquoise with dark labels. Priority aptitude actions use yellow with dark
labels. Light-mode small text links retain core green because the requested
turquoise on white is below 4.5:1; turquoise is used for accents and dark-mode
links. Error, success and informational states retain distinct semantic colors.

Run `node --test test/*.test.js` and `npm run build`.
For visual checks, run Vite and open `/test/layout-regressions.html` with:

- `?role=admin&theme=dark`
- `?role=instructor&theme=dark`
- `?role=student&theme=dark&admission=recommended`
- `?role=admin&page=programs&theme=dark`
- Repeat without `theme=dark` for light mode.

Check headings, muted labels, badges, fields, buttons and table hover states.
Program icons now use react-icons/fi. Legacy emoji values map to SVG icons;
new choices use stable icon keys rather than accepting arbitrary emoji text.
