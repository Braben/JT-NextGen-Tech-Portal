# Responsive dashboard checks

Run `npm run dev -- --port 3011` and use a fresh browser profile at
`/test/layout-regressions.html?role=student` (also `instructor` and `admin`).
This development-only fixture renders the actual role layouts, dashboards and
shared components with simulated API responses, long names/codes and large counts.
It is not included in the production build and does not create production data.

Verify at widths 320, 768, 1024 and 1440:

- Cards and their content remain inside the main column. Dense tables scroll
  within their containers; the page itself does not scroll horizontally.
- Chart captions occupy their own row, legends wrap, and donut charts scale
  within the card. Content below the chart does not overlap its labels.
- Long program titles and class codes wrap or deliberately truncate within
  their allotted space. Status badges do not collapse into vertical letters.
- The mobile header has one menu toggle. Open/close navigation and confirm
  closed navigation is hidden. Notification and message panels fit the viewport
  and render above the search box.
- Add `&theme=dark` to check dark card backgrounds, metric tiles, form controls,
  and legible secondary text independently of the operating-system preference.

Management samples: `?role=admin&page=programs`, `enrollments`, `materials`, or
`system`. Check them at 320 and 1024 pixels. In Enrollments, open Review and check
that the long student name/email and placement controls stay inside the modal.

Browser checks completed on 2026-09-16: 12 dashboard role/width combinations,
8 management page/width combinations, mobile overlays and enrollment modal,
and dark-mode chart/card inspection. Tables' intentional internal scroll areas
are excluded from page-overflow measurements.
