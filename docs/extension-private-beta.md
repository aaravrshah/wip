# Wip extension private-beta release notes

Status: implementation and release-review checklist for Milestone 2B  
Last updated: 2026-08-06

This is an engineering disclosure and store-listing draft, not a published privacy policy. Wip must not be submitted or distributed publicly until the owner supplies final support/privacy URLs, completes vendor/legal review, and separately authorizes publication.

## Stable identity and authentication

Development builds use the checked-in public manifest key in `apps/extension/src/extension-identity.ts`, which deterministically produces extension ID `cokkeghadjofigomdgpdpmfebgggmnlk`. No private key exists in the repository: the temporary private material used to derive the public key was discarded. The public key stabilizes unpacked development identity; it does not sign a release.

Configure this exact party in both places:

- Clerk allowed origin: `chrome-extension://cokkeghadjofigomdgpdpmfebgggmnlk`
- web server: `WIP_EXTENSION_ORIGINS=chrome-extension://cokkeghadjofigomdgpdpmfebgggmnlk`

Wip accepts extension requests only when the HTTP `Origin`, configured CORS party, and verified Clerk session-token `azp` are the same allowed extension origin. An expired, revoked, missing, or wrong-party session fails before database access. The popup requests a fresh short-lived token only on Save/Attach, signs out after an authentication rejection, and retains the reviewed draft for a fresh sign-in and retry.

The Chrome Web Store assigns/owns the production identity and signing flow. Before a production build, record the assigned public key/ID through the two public `WXT_WIP_EXTENSION_*` variables, update Clerk and `WIP_EXTENSION_ORIGINS`, rebuild, and verify the manifest-derived ID. Never commit or distribute private signing material.

## Permission justifications

| Permission or host | Why Wip needs it | Privacy limit |
| --- | --- | --- |
| `activeTab` | Read the current job page only after the user clicks Wip. | Temporary access to the invoked tab; no `<all_urls>` or background observation. |
| `scripting` | Inject the packaged extractor into that active tab's main frame. | User-gesture-only; no persistent content scripts or remotely hosted code. |
| `storage` | Hold an unfinished reviewed draft and SDK-managed session state. | Job content uses `chrome.storage.session` and is cleared after save/cancel or browser exit; it is not a second tracker. |
| exact Wip API host | Submit only the reviewed capture and open the resulting tracker record. | One configured origin; authenticated CORS is never wildcarded. |
| exact Clerk Frontend API host | Run Clerk's standalone extension authentication and obtain an on-demand session token. | Publishable key only; no Clerk secret, cookie permission, or Sync Host. |

Wip does not request `cookies`, `tabs`, `identity`, `history`, `webRequest`, `declarativeNetRequest`, `downloads`, `unlimitedStorage`, background browsing, persistent site matches, or broad host permissions. Incognito use is disabled. Extension pages use packaged scripts only under the manifest CSP and allow no objects, external script sources, base-URL rewriting, or framing.

## Private-beta privacy disclosure

When the user clicks Wip, it temporarily reads only the active HTTP(S) page's job-relevant title, company, location, workplace/employment type, salary text, requisition ID, URL/canonical URL, page title, and focused semantic/plain-text description. Extraction metadata records the extractor version, selected strategy, warnings, and field provenance. Missing or uncertain values stay editable or blank.

Nothing from the page is sent until the user presses Save or explicitly attaches the reviewed description to a duplicate. The Wip server validates sizes and URLs, sanitizes HTML, computes the authoritative content hash, derives ownership from Clerk, and writes through forced PostgreSQL RLS. A duplicate is never silently merged or overwritten. Snapshot attachment appends an immutable snapshot and confirmed timeline event to the explicitly displayed existing application.

Wip does not read other tabs, browsing history, cookies, employer credentials, forms or form responses, private messages, applicant-portal answers, or page scripts. It never bundles or transmits a Clerk secret, Neon URL, database credential, private signing key, or persistent JWT. Job descriptions and tracker records remain until user deletion, subject to the retention and backup limits in `docs/privacy.md`; unfinished session drafts are transient.

## Store-listing draft

**Name:** Wip – Job Application Tracker

**Short description:** Review and save the job you are viewing to your private Wip application tracker.

**Single purpose:** Let a user intentionally capture one current job posting, review/edit the extracted details, and save it to that user's Wip tracker.

**Detailed description:**

> Wip helps you keep job applications organized without copying every posting by hand. Click Wip on a job page, review the extracted company, role, location, metadata, and description, then choose whether to save. Wip sends nothing from the page before your confirmation. Already tracking the job? You can open the existing application or explicitly append the reviewed posting as a new immutable snapshot. Wip uses temporary current-tab access, keeps unfinished job content only for the browser session, and does not monitor browsing in the background.

**Data-use disclosure:** Authentication identifiers/session security data are handled by Clerk. User-confirmed job-posting content and tracker metadata are transmitted to Wip to provide the product's sole capture/tracker purpose. They are not sold, used for targeted advertising, or contributed to Hiring Pulse without a future separate opt-in. See `docs/privacy.md` for the complete product baseline.

**Required before submission:** replace these placeholders with reviewed public destinations: `PRIVACY_POLICY_URL`, `SUPPORT_URL`, and `HOMEPAGE_URL`; capture final listing screenshots; confirm the production extension ID/allowed parties; complete Chrome Web Store data-use answers; and test account deletion/support handling.

## Release checklist

1. Configure only public extension variables from `apps/extension/.env.example`; keep all secret/server/database values out of the extension environment.
2. Run `pnpm zip:extension`. Its build inspection verifies exact permissions, host scope, CSP, icon files/dimensions, stable ID, prohibited secret markers, and absence of source/tests/fixtures/maps; the ZIP inspection repeats packaging checks.
3. Load `apps/extension/.output/chrome-mv3`, confirm the expected ID, and exercise sign-in, extraction, save, duplicate attach, revoked-session recovery, cancellation, and unsupported pages with fictional data.
4. Inspect the ZIP contents and recorded checksum outside the repository release workflow. Publishing, signing, deployment, and store submission require a separate authorization.
