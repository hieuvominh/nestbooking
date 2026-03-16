# BookingCoo Repo Notes

This document captures the structure, stack, and coding conventions for this repository to help agents and contributors move quickly and consistently.

## Stack and Framework
- Next.js App Router (Next `15.5.9`) with React `19.1.0`.
- TypeScript (`^5`) with `strict` mode enabled.
- Tailwind CSS v4 via `@tailwindcss/postcss` and global styles in `src/app/globals.css`.
- UI primitives: shadcn/ui, Radix UI, class-variance-authority, lucide-react.
- Data: MongoDB with Mongoose.
- Auth: JWT with bcryptjs for password hashing.
- Forms: react-hook-form + zod.
- Data fetching: SWR.
- Charts: Recharts.
- Date utilities: date-fns.

## Repo Structure
- `src/app/`: Next.js App Router (pages, layouts, API routes).
  - `src/app/admin/`: Admin area routes.
  - `src/app/api/`: API routes.
  - `src/app/p/`: Public booking routes.
  - `src/app/layout.tsx`: Root layout and providers.
  - `src/app/page.tsx`: Home page.
- `src/components/`: App-specific React components.
  - `src/components/ui/`: shadcn/ui components.
  - `src/components/modals/`: Modal components.
- `src/contexts/`: React context providers (e.g., auth).
- `src/hooks/`: Custom hooks (e.g., `useApi`).
- `src/lib/`: Shared utilities (auth, JWT, DB connection, currency, translations).
- `src/models/`: Mongoose models for domain entities.
- `scripts/`: Local scripts (e.g., database seed).
- `public/`: Static assets.

## Conventions and Coding Style
- TypeScript everywhere; prefer `tsx` for React components.
- ESM imports with absolute path aliases via `@/*` → `src/*`.
- Tailwind utility classes for styling; `cn` helper in `src/lib/utils.ts`.
- shadcn/ui components follow class-variance-authority patterns.
- Mongoose connection is cached in `src/lib/mongodb.ts` for hot-reload safety.
- API routes live under `src/app/api` (App Router conventions).

## Configuration Notes
- `next.config.ts`:
  - `output: "standalone"`.
  - `serverExternalPackages: ["mongoose"]`.
  - Build ignores ESLint and TypeScript errors (`ignoreDuringBuilds`, `ignoreBuildErrors`).
- `tsconfig.json`: `strict: true`, `moduleResolution: "bundler"`, `paths` alias.
- ESLint: flat config extending `next/core-web-vitals` and `next/typescript`.
- Tailwind: PostCSS plugin configured; `components.json` references `tailwind.config.ts` (currently not present in repo).

## Environment
Key variables (see `README.md` for full list):
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_PUBLIC_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `PUBLIC_BOOKING_BUFFER_MINUTES`

## Common Scripts
- `npm run dev` (Next dev with Turbopack)
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run seed`
- `npm run docker:up` / `docker:down` / `docker:build`
