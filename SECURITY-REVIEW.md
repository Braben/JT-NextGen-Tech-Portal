# Security review — 17 September 2026

## Results

This was a dependency, source-code, security-header and regression-test review,
not an exhaustive penetration test or a guarantee that no vulnerabilities exist.
No attack traffic was sent to production and no production data was changed.

| npm audit scope | Before | After |
| --- | --- | --- |
| Backend | 5 high, 7 moderate | 0 known vulnerabilities |
| Frontend | 1 high, 8 moderate | 0 known vulnerabilities |
| Root tooling | 0 | 0 |

Counts include packages affected through dependencies, not distinct exploits.
Updated Nodemailer to 9.1.1, PostCSS to 8.5.28 and React Router to 7.18.4.
Backend overrides require patched qs 6.16+ and deepmerge-ts 8.0.2+.
Recheck overrides when updating Prisma; do not remove them without auditing.

## Changes

- Explicit CSP in `netlify.toml` and `backend/lib/securityHeaders.js`.
  Script execution is restricted to the same origin, with no unsafe-inline or
  unsafe-eval permission for scripts. Objects, frames and framing are blocked;
  base URLs cannot be injected and form submissions are restricted to self.
- API/WebSocket connections allow self and the configured Render service.
  Fonts allow Google Fonts. Images allow HTTPS, data and blob sources because
  users can supply cover/avatar URLs and preview uploads.
- Inline **styles** remain allowed for React, Framer Motion, the editor and the
  home-page font style. This is an intentional remaining CSP relaxation.
- Netlify also sends nosniff, DENY framing, HSTS, referrer policy and restrictions
  on camera, microphone and geolocation. Helmet provides backend protections.
- JWT verification explicitly accepts HS256 only.
- WebSocket connections load the current database user/role instead of trusting
  stale token roles. Deleted users cannot open a new connection. Malformed
  typing payloads are ignored rather than throwing from the event handler.

## Validation at review time

- 67 backend tests pass, including authorization, private resources, content
  sanitization, publishing permissions, CSP parity and WebSocket regression tests.
- 10 frontend tests pass; production build succeeds.
- The publishing/security-specific tests and publishing preview fixtures were
  subsequently removed during the requested cleanup. The counts above record
  the original review run, not the size of the remaining test suite.
- Prisma schema validation succeeds with the dependency overrides.
- Built home and sign-in pages load under enforced CSP in a local browser with
  no observed CSP errors. Preview API responses were local fixtures.
- Reviewed rich HTML rendering for DOMPurify, material URL scheme validation,
  authenticated file downloads/path containment, CORS configuration and auth
  rate limiting. These checks do not cover every possible input or role workflow.

## Deployment and remaining limitations

Deploy both Netlify and the backend with the updated manifests and lockfiles.
Use `npm ci` in each package directory. These changes are not deployed by this
review; recheck actual response headers after deployment. If the API/socket
hostname changes, update and manually compare both CSP policies together.

The frontend still stores bearer tokens in localStorage, so XSS prevention
remains important. Role changes do not evict already connected sockets; the
current-role check occurs at connection time. A future session-revocation design
should address active sockets and existing tokens together.

Re-run npm audit regularly; zero known dependency advisories is not a complete
application-security assessment.

References: [Helmet CSP documentation](https://github.com/helmetjs/helmet),
[Nodemailer security advisories](https://github.com/nodemailer/nodemailer/security).
