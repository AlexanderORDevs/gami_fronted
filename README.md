# Gami storefront and operations portal

Next.js marketplace frontend with a public customer catalog at `/` and the internal authentication/workspace at `/portal`. The customer catalog stays the default even when an internal session exists. User-facing text is Spanish (Peru); code and documentation remain English.

## Visual direction

The supplied `Gami - Concepto UI-UX.html` is the visual reference. Shared tokens use aubergine (`#3F1F2E`), terracotta (`#C9533A`), ivory (`#F3ECDE`), Geist for controls and body text, and DM Serif Display for editorial headings. Fonts are self-hosted through `next/font`; the local logo asset follows the supplied concept's mark.

Phase 1 applies this identity to authentication, password forms, user management, drawers, and modals. The internal workspace uses a desktop sidebar and compact mobile navigation. Mobile user lists prioritize identity and status; roles, store memberships, and last login remain available in user details. No sample accounts or products are shipped in the application.

The roadmap remains authoritative for scope and permissions: customer storefront, store intranet, and administration. Operations and warehouse functions remain roles within administration, not a fourth authorization surface. Store records can now be created and edited; product management and full store onboarding remain subsequent phases. Responsive web support is not a native mobile app or an offline/PWA implementation.

## Public catalog

- Anonymous browsing, text search, category/brand filters, price/newest sorting, and pagination (24 products per page).
- Product detail at `/?producto=<uuid>`, with description, prices in PEN, variants and available stock. The dialog supports keyboard dismissal and direct links.
- Saved product IDs are browser-local (`gami.catalog.saved`), capped at 100, with no customer account required. Unpublished/deleted saved products disappear from the saved view.
- Public API: `GET /api/catalog/products`, `GET /api/catalog/products/:id`, `GET /api/catalog/filters`. List query parameters: `search`, `category`, `storeId`, `sort` (`newest`, `price-asc`, `price-desc`), and `page`.
- Only non-deleted `PUBLISHED` products belonging to non-deleted `ACTIVE` stores are exposed. Internal attributes, inventory rows, reservations, store contacts, and audit data are not returned.
- Available stock subtracts firm and unexpired live holds from inventory, with zero as the minimum. Only active variants are exposed; the update date is shown in detail.
- Brand directory eligibility uses RN-10: at least three published products. Products from smaller catalogs remain individually visible.
- Photos use the first HTTPS `ProductAttribute` with code `image_url`, ordered by position. No image means an explicit missing-photo placeholder, not a fabricated product image. No database migration or seed data is included.

This is a read-only catalog, not checkout. Full RN-08 operational eligibility (including settlement data), stale-stock policy, payments, orders, and delivery promises are not implemented by this slice. Do not treat a displayed stock count as a reservation or purchase guarantee.

Run the API first and configure `NEXT_PUBLIC_API_URL` (default `http://localhost:4000/api`). The API `FRONTEND_URL` must match the browser origin for CORS. The primary local frontend uses `http://localhost:3000`, with the API at `http://localhost:4000/api`. Restart existing servers after updating a production build; an already-running `next start` does not reliably pick up a replacement build.

## Password lifecycle

- The sign-in screen exposes one password recovery option. Email delivery requires SMTP configuration; when unavailable, an administrator must issue a temporary password. A delivered one-time email code expires in 15 minutes.
- After signing in with a temporary credential, the user enters only the new password and its confirmation. The authenticated temporary session already proves control of the credential.
- Authenticated users can open the same workflow from the key icon in the workspace header.
- Mandatory and voluntary password forms can generate a 16-character suggestion using the browser cryptographic random generator. The suggestion includes uppercase and lowercase letters, numbers, and symbols.
- Password changes revoke prior sessions and persist only the bcrypt hash in PostgreSQL.
- Administrators cannot read user passwords. They can issue a random one-time temporary password, which is shown only in the immediate reset response and must be delivered through an approved secure channel.
- Every successful password setup, change, or recovery shows five replacement backup codes once. The frontend keeps them only in memory until the user confirms they were stored.

## User administration

Users with the `SUPER_ADMIN` role receive the administrative workspace after establishing a permanent password. It supports:

- User search, status filters, pagination, profile details, and audit history.
- User creation with a required unique email and one-time temporary password.
- Account activation, suspension, and disabling with a required audit reason.
- Role grants and revocations.
- Store membership grants, ownership changes, and revocations.
- Administrative password resets and global session revocation.

Every security-changing action asks for a business reason before calling the backend. Temporary passwords are displayed only in the immediate result and are never persisted by the frontend.

The user administration form still accepts a store UUID. The store record now provides an alternative workflow: search active users by name and grant, change ownership or revoke their store access without entering UUIDs.

## Store management

`/portal#stores` supports store creation, basic data editing, split operating shifts, user assignment and the latest 20 record audit entries. All actions require `SUPER_ADMIN`, a valid session and completed password replacement.

- Stores are created as `APPLIED`. Commercial name, gallery, stand, international WhatsApp number and an audit reason are required; legal name and operating hours can be completed later.
- Hours use local Lima wall-clock time, `HH:mm`, with Sunday=0 through Saturday=6. Split shifts are supported; overlaps, inverted intervals and overnight intervals are rejected. Active stores cannot lose all operating hours.
- Changing the WhatsApp number clears its verification. This screen cannot mark a number verified.
- Updates carry the record's `updatedAt` value. Concurrent changes return a conflict instead of overwriting another editor; reload explicitly discards the local draft after confirmation.
- Store data, hours and audit are written in one transaction. Unique WhatsApp conflicts return a localized error. Soft-deleted, rejected and closed stores cannot be edited. Audit metadata records changed field names, actor and request context, not full contact values.
- Membership operations reuse the audited user service. Removing access revokes active user sessions. Membership events remain in the user's audit history; the store history shows record creation and editing.
- API: `POST /api/admin/stores`, `GET/PATCH /api/admin/stores/:id`, and `GET /api/admin/stores/:id/audit-log`. Listing continues to use the paginated information endpoint.

This is the store-record foundation, not complete onboarding: document uploads, tax evidence, bank/settlement data, signed contracts, WhatsApp verification, temporary closures and commercial state transitions are not implemented. Activation must eventually require the roadmap's approval prerequisites and three reviewed products. Suspension/reactivation must implement order, refund and strike consequences before being exposed. No delete action, migration, fake seed or automatic activation is introduced.

Validation: 16 store tests plus 15 nearby catalog/information tests, frontend/backend lint and builds, and browser-only simulated creation/editing/access flows at desktop and mobile widths. Live HTTP smoke checks verify unauthenticated rejection; no authenticated production database writes were made by these checks.

## Administrative information

The general administration workspace includes these modules, available only to `SUPER_ADMIN` after mandatory password replacement. Except for store records and user management, these remain read-only:

| Portal section   | Current information                                                                  | URL                     |
| ---------------- | ------------------------------------------------------------------------------------ | ----------------------- |
| Stores           | Editable records, split shifts, user assignment and record audit history             | `/portal#stores`        |
| Internal catalog | Registered products, publication status, prices, active variant counts, descriptions | `/portal#products`      |
| Orders           | Order numbers, stored totals, statuses and promised delivery dates                   | `/portal#orders`        |
| Warehouse        | Recorded shipments, scheduled pickup, tracking and dispatch/delivery dates           | `/portal#warehouse`     |
| Finance          | Existing payouts and ledger entries, without calculated balances or money movements  | `/portal#finance`       |
| Configuration    | Approved numeric parameters, logistics calendar and shipping rates                   | `/portal#configuration` |

Users and access remain at `/portal#users`. These are internal modules, not a link to the public customer catalog. Logout still clears the local session and navigates to `/`.

The information tables support server-side search, 20-row pagination, refresh, keyboard-accessible record detail dialogs, empty states and retry on failure. Mobile navigation and tables scroll within their own containers. Search fields are resource-specific: store name, product name, order number, setting key, calendar description or district.

The protected read-only endpoints are `GET /api/admin/information/{stores,products,orders,shipments,payouts,ledger,settings,calendar,shipping-rates}`, with `page` and optional `search` query parameters. All use the existing JWT, password-change and role guards. The frontend does not cache these requests. Non-deleted stores/products are listed; historical orders, shipments and financial records remain visible. No schema migration, seed, business mutation or new authorization role is introduced.

Only the six existing approved numeric setting keys are exposed. Arbitrary settings, secrets, gateway payloads, integration metadata, financial receipts and customer contact details are not returned. No values are inferred or fabricated when records are absent. These screens are not implementations of product approval, complete store onboarding, order transitions, quality control, settlement processing or configuration editing. Store-specific intranet workflows and specialist-role access are outside this delivery; unresolved financial decisions remain unchanged.

## Authentication boundary

The backend currently returns access and refresh tokens in the response body. During local development, this client retains them in `sessionStorage`, limiting persistence to the active browser tab. Access tokens are validated during restoration and renewed one minute before expiration. Refresh rotation is coordinated so only one request can consume a refresh token at a time.

This is not the production credential-storage design. Before deployment, the platform owners must define the final frontend and API domains. That external decision controls CORS and the `Domain`, `Secure`, and `SameSite` attributes for an `HttpOnly` refresh-token cookie. Once confirmed, move refresh-token handling to the backend cookie boundary and keep access tokens in memory.

## Commands

```bash
npm run build
npm run lint
```
