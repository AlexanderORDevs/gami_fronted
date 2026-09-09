# Gami operations frontend

Internal marketplace workspace built with Next.js. The current delivery includes login, session restoration and rotation, mandatory temporary-password replacement, logout, and a protected workspace shell.

## User administration

Users with the `SUPER_ADMIN` role receive the administrative workspace after establishing a permanent password. It supports:

- User search, status filters, pagination, profile details, and audit history.
- User creation with a one-time temporary password.
- Account activation, suspension, and disabling with a required audit reason.
- Role grants and revocations.
- Store membership grants, ownership changes, and revocations.
- Administrative password resets and global session revocation.

Every security-changing action asks for a business reason before calling the backend. Temporary passwords are displayed only in the immediate result and are never persisted by the frontend.

Store assignment currently requires a known store UUID. Replacing this field with a searchable store selector depends on the upcoming Stores API exposing a store-list endpoint. This dependency does not block the remaining user administration workflows.

## Local development

The API must be available at `http://localhost:4000/api`. Copy `.env.example` to `.env.local` only when a different local API URL is required.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Authentication boundary

The backend currently returns access and refresh tokens in the response body. During local development, this client retains them in `sessionStorage`, limiting persistence to the active browser tab. Access tokens are validated during restoration and renewed one minute before expiration. Refresh rotation is coordinated so only one request can consume a refresh token at a time.

This is not the production credential-storage design. Before deployment, the platform owners must define the final frontend and API domains. That external decision controls CORS and the `Domain`, `Secure`, and `SameSite` attributes for an `HttpOnly` refresh-token cookie. Once confirmed, move refresh-token handling to the backend cookie boundary and keep access tokens in memory.

## Commands

```bash
npm run build
npm run lint
```
