# Gami storefront and operations portal

Next.js marketplace frontend with a public customer catalog at `/` and the internal authentication/workspace at `/portal`. The customer catalog stays the default even when an internal session exists. User-facing text is Spanish (Peru); code and documentation remain English.

## Visual direction

The supplied `Gami - Concepto UI-UX.html` is the visual reference. Shared tokens use aubergine (`#3F1F2E`), terracotta (`#C9533A`), ivory (`#F3ECDE`), Geist for controls and body text, and DM Serif Display for editorial headings. Fonts are self-hosted through `next/font`; the local logo asset follows the supplied concept's mark.

Phase 1 applies this identity to authentication, password forms, user management, drawers, and modals. The internal workspace uses a desktop sidebar and compact mobile navigation. Mobile user lists prioritize identity and status; roles, store memberships, and last login remain available in user details. No sample accounts or products are shipped in the application.

The roadmap remains authoritative for scope and permissions: customer storefront, store intranet, and administration. Operations and warehouse functions remain roles within administration, not a fourth authorization surface. Store records can now be created and edited; product management and full store onboarding remain subsequent phases. Responsive web support is not a native mobile app or an offline/PWA implementation.

## Public catalog

- The customer journey guide is available at `/como-funciona`, linked from the main catalog navigation and the home introduction. It explains the current order, payment, confirmation, shipping, and support boundaries without interrupting product browsing.

- Anonymous browsing, text search, category/brand filters, and pagination (24 products per page). Confirmed positive net stock always comes first, before global pagination; newest/price sorting applies within available and unavailable groups. Saved products follow the same stock-first priority while retaining save order inside each group.
- Product detail at `/?producto=<uuid>`, with description, prices in PEN, variants and available stock. The dialog supports keyboard dismissal and direct links.
- Visitors can browse without an account. Saving a favorite, keeping a cart and creating an order requires the customer account available from "Mi cuenta". Favorites (max 100) and variant quantities (max 50) are stored per Customer in PostgreSQL, not shared browser-local lists. Unpublished/deleted saved products disappear from the saved view. Old anonymous local favorites/cart data is not automatically assigned to any account.
- Public API: `GET /api/catalog/products`, `GET /api/catalog/products/:id`, `GET /api/catalog/filters`. List query parameters: `search`, canonical garment `category`, independent `gender` (`mujer`, `hombre`, `unisex`), `storeId`, `sort` (`newest`, `price-asc`, `price-desc`), and `page`.
- Catalog filters normalize legacy `category`/`garmentType` combinations into garment types and derive audience from `attributes.genero`, while retaining legacy `Mujer`/`Hombre` categories as a fallback. The filter groups are independent: choosing `tops` does not discard `Mujer`, and vice versa.
- The three Heinz Club tops named in marketplace improvement 6 are classified as `mujer` by the idempotent backend deployment seed if their audience field is missing. That data correction reaches production with the backend deploy/seed; publishing the frontend alone does not change catalog records.
- Only non-deleted `PUBLISHED` products belonging to non-deleted `ACTIVE` stores are exposed. Internal attributes, inventory rows, reservations, store contacts, and audit data are not returned.
- Available stock subtracts firm and unexpired live holds from inventory, with zero as the minimum. Only active variants are exposed; the update date is shown in detail.
- Available cards retain color photographs and a green stock label. Sold-out and unconfirmed-stock cards use grayscale photographs and distinct text badges (Agotado / Stock por confirmar); details and favorites remain usable. A mixed product with any unknown active-variant inventory remains unconfirmed, matching current cart eligibility. Unknown stock is never displayed as verified zero stock.
- Brand directory eligibility uses RN-10: at least three published products. Products from smaller catalogs remain individually visible.
- Photos use the first HTTPS `ProductAttribute` with code `image_url`, ordered by position. No image means an explicit missing-photo placeholder, not a fabricated product image. No database migration or seed data is included.

### Customer Information

The public footer links to `/informacion#terminos`, `#privacidad`, `#envios`, `#cambios`, `#reclamos`, and `#soporte`. The page describes current checkout/order behavior and explicitly labels the full legal terms, privacy notice, change/return policy, delivery promises, and official complaint/support channels as pending where they have not been approved or configured. It does not expose store phone numbers as platform support or present placeholder text as a binding policy.

The storefront includes account-owned cart and authenticated checkout, creating PENDING_PAYMENT orders and temporary stock holds without charging a payment. Missing/ambiguous delivery tariffs and unknown stock block confirmation; no free shipping or fake variants are inferred. Full RN-08 operational eligibility, payment capture, email verification, stale-stock policy and delivery promises remain separate work. Merely adding to cart does not reserve stock.

### Order Follow-Up

Customer `Mis órdenes`, store `Atención y órdenes`, and admin `/portal#orders` open one responsive order detail and event timeline. Customers see their delivery information and financial snapshot read-only. Staff see only the assigned store portion, cannot see customer delivery data or sibling-store items, and can report incidents; only order-writable store roles can confirm quantities. A captured matching payment is required before confirmation, so a `PENDING_PAYMENT` order stays blocked. Partial/zero confirmations show accepted quantities and shortages; flagged stock is labeled `Requiere recuento` and remains unavailable until inventory is physically recounted. Admin can record an internal incident review note; review does not resolve the incident or imply a refund. Cancellation, payment verification/capture, refunds and courier/delivery changes are not part of this screen.

The backend deploy applies additive migration `20261109220000_add_order_confirmation_details` through the existing `db:deploy` build. Deploy backend before frontend. Local migration, API and mocked UI flows were tested; no production writes were performed.

### Customer Account

Registration shows a fixed +51 prefix and accepts exactly nine mobile digits starting with 9; the prefix is not included in the submitted phone field. Its password suggestion reuses the portal's cryptographic 16-character generator (uppercase/lowercase/numbers/symbols), fills the password field and offers show/hide. Password confirmation is omitted only during registration; change/recovery retain confirmation. Passwords still require at least 12 characters. Existing profile phone formats are not rewritten.

Registration only submits username/displayName/email/phone/password. There is no role/store selector: the server assigns CUSTOMER and rejects injected privileges. The catalog has one neutral "Acceder" action ("Mi espacio" after customer login), not separate customer/staff entry buttons. Its branded login dialog uses `/auth/login`: CUSTOMER-only accounts remain in the catalog; staff accounts are handed to `/portal` with their existing role-based session. Registration remains customer-only. Staff and customer tokens use different sessionStorage keys (`gami.auth.session` and `gami.customer.session`); signing in through the unified entry clears the other local namespace to avoid carrying another identity into the wrong surface. No new privileges are assigned by this navigation.

Visitors do not see the Guardados navigation. Their product hearts remain clickable but open login without saving or calling a favorite mutation; the detail dialog closes first so only one modal remains open. Guardados appears only after a customer session is established and disappears on logout. The access dialog follows the catalog's wordmark, display font, paper header and action color. Closing a customer session clears in-memory personal state immediately; another account reloads only its own server data. Session restoration and on-demand refresh rotate existing refresh tokens.

Profile updates affect name/phone only. Checkout preloads customer contact and submits JWT, while the backend derives ownership and verifies the persisted cart. Idempotent retries are scoped by customer and the UI clears the cart only after confirmation. The customer account persists across devices through PostgreSQL, but each browser/tab has its own authentication session. No guest-to-account transfer of old orders based on contact data is performed. Email recovery requires the backend SMTP configuration; no password or tokens should be pasted in chat or committed.

Deploy backend migration `20261109183000_add_customer_accounts` with the existing Render `db:deploy` build step and deploy this frontend. No Shell, one-off job, restore or new seed is needed. The implementation and integrations were validated locally; production was not modified.

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

Product photos can be taken with the phone camera or selected from the device in the new-product form. JPG, PNG and WebP files up to 8 MB upload through `POST /api/store-workspace/stores/:storeId/product-images` to the configured object store; the form shows progress, errors and a preview. The product record stores only the returned HTTPS URL. Manual HTTPS URL entry remains available as an alternative. Product-writing store roles can upload; configure the private `OBJECT_STORAGE_*` endpoint, bucket, credentials, region and public CDN URL first. Without them the endpoint returns a setup error and does not fall back to PostgreSQL or local disk.

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

The general administration workspace includes these modules, available only to `SUPER_ADMIN` after mandatory password replacement. Payouts support creating audited drafts only. Configuration supports audited shipping/calendar updates and the approved AGENCY commission rate; other information remains read-only:

| Portal section   | Current information                                                                          | URL                     |
| ---------------- | -------------------------------------------------------------------------------------------- | ----------------------- |
| Stores           | Editable records, split shifts, user assignment and record audit history                     | `/portal#stores`        |
| Internal catalog | Registered products, publication status, prices, active variant counts, descriptions         | `/portal#products`      |
| Orders           | Order numbers, stored totals, statuses and promised delivery dates                           | `/portal#orders`        |
| Warehouse        | Recorded shipments, scheduled pickup, tracking and dispatch/delivery dates                   | `/portal#warehouse`     |
| Finance          | Payout list and ledger; manual PEN drafts, with a visibly marked DEMO example                | `/portal#finance`       |
| Configuration    | Approved numeric parameters; editable logistics dates, shipping rates, and AGENCY commission | `/portal#configuration` |

Users and access remain at `/portal#users`. These are internal modules, not a link to the public customer catalog. Logout still clears the local session and navigates to `/`.

The information tables support server-side search, 20-row pagination, refresh, keyboard-accessible record detail dialogs, empty states and retry on failure. Mobile navigation and tables scroll within their own containers. Search fields are resource-specific: store name, product name, order number, setting key, calendar description or district.

The information endpoints use the existing JWT, password-change and role guards. `GET /api/admin/information/{stores,products,orders,shipments,payouts,ledger,settings,calendar,shipping-rates}` supports `page` and optional `search`; `POST /api/admin/information/payouts` creates an audited `DRAFT`, while `POST /api/admin/information/shipping-rates` and `POST /api/admin/information/calendar` create/update logistics configuration with a required audit reason. Shipping-rate date/quantity overlaps for the same destination are rejected. Calendar rows record working/non-working dates; they do not yet calculate delivery promises. No public/admin rate or holiday values are invented. The UI does not cache list requests. Payout drafts do not transfer money or write the immutable ledger. The payout table labels demo rows as `DEMO`; the normal backend deployment applies the payout demo migration and inserts one idempotent DMarco `DRAFT` for S/ 1.00 through `db:seed`. Non-deleted stores/products are listed; historical orders, shipments and financial records remain visible. No new authorization role is introduced.

Store order creation uses the public server-side tariff quote. The form shows calculated shipping and total, and the API rechecks both the expected subtotal and shipping against current database values. Operators cannot type or override the shipping cost. Missing or ambiguous tariffs block order creation.

Only the six existing approved numeric setting keys are exposed. Arbitrary settings, secrets, gateway payloads, integration metadata, financial receipts and customer contact details are not returned. No values are inferred or fabricated when records are absent. Shipping rates and logistics calendar dates are editable with audit reasons; arbitrary platform-setting editing, product approval, complete store onboarding, order transitions, quality control and settlement processing remain outside these screens. Calendar entries do not yet calculate delivery promises. Store-specific intranet workflows and specialist-role access are outside this delivery; unresolved financial decisions remain unchanged.

## Authentication boundary

The backend currently returns access and refresh tokens in the response body. During local development, this client retains them in `sessionStorage`, limiting persistence to the active browser tab. Access tokens are validated during restoration and renewed one minute before expiration. Refresh rotation is coordinated so only one request can consume a refresh token at a time.

This is not the production credential-storage design. Before deployment, the platform owners must define the final frontend and API domains. That external decision controls CORS and the `Domain`, `Secure`, and `SameSite` attributes for an `HttpOnly` refresh-token cookie. Once confirmed, move refresh-token handling to the backend cookie boundary and keep access tokens in memory.

## Commands

```bash
npm run build
npm run lint
```
