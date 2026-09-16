# Browser regression checks

Run `npm run dev` in the frontend, then open `/test/ui-regressions.html`.
The fixture uses actual application components with simulated API responses.
It is not included in the production build. Use a separate browser profile for
registration checks so saved registration drafts do not interfere.

- Default mode: open the modal and type in Name, Email, and Notes. Pause and
  continue typing without clicking again; focus and text must remain intact.
  Change Session, then Tab: focus wraps to Close, skipping the disabled button.
  Escape closes the modal and returns focus to Open form.
- `?mode=failure`: health cards stop spinning and show a network error. Refresh
  recovers to healthy API/database/storage; users/replication remain unreported.
- `?mode=degraded`: the database shows an issue and overall status is degraded.
- `?mode=timeout`: a timeout message appears and Refresh remains available.
- `?mode=enrollment`: review Test Student, change Program to Web Development
  and Session to Evening. The old class clears and only Web Evening is offered.
  Select it and save; the table and review summary must show the new program,
  class, and session. Selecting Unallocated also permits saving without a class.
- `?mode=program-failure`: complete account fields and press Enter. Only the
  Profile step opens. Program loading has an error with Retry; Retry restores
  the list. Complete the profile, review it, and submit the simulated consent
  and application. The success heading confirms navigation and the mock checks
  the submitted program and consent. No account or enrollment is created.

Verified these scenarios on 2026-09-16. Separate backend auth tests verify real
registration writes against an isolated SQLite test database.
