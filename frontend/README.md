# FinRelief AI — Frontend

The frontend for FinRelief AI, built with React 19, Vite 8, and Tailwind CSS v4.

For full project setup and deployment instructions, see the [root README](../README.md) and [Setup & Deployment Guide](../SETUP_AND_DEPLOYMENT.md).

---

## Stack

| Tool | Version | Role |
|---|---|---|
| React | 19 | UI framework |
| Vite | 8 | Build tool + dev server |
| Tailwind CSS | v4 | Styling via `@theme` design tokens |
| React Router | 7 | Client-side routing |
| Recharts | 3 | Dashboard trend charts |
| Axios | 1 | HTTP client with JWT interceptor |
| Lucide React | latest | Icons |
| oxlint | latest | Linting |

---

## Pages

| Route | Component | Description |
|---|---|---|
| `/login` | `features/auth/Login` | Email/password login + one-click demo |
| `/register` | `features/auth/Register` | Create account |
| `/dashboard` | `features/dashboard/Dashboard` | KPI cards, debt trend charts, letter count |
| `/loans` | `features/loans/Loans` | Add, edit, delete loans |
| `/settlement` | `features/settlement/Settlement` | Run settlement simulation on a loan |
| `/letters` | `features/letters/Letters` | Generate, edit, version, and download OTS letters |

All authenticated routes render inside `AppShell` (sidebar on desktop, top bar + bottom nav on mobile).

---

## Design System

Design tokens are defined as Tailwind v4 `@theme` variables in `src/index.css`. The palette is a warm parchment/ink theme:

| Token | Value | Role |
|---|---|---|
| `--color-cream` | `#F4F1E8` | Page background |
| `--color-ink` | `#1B1A17` | Primary text |
| `--color-surface` | `#EFECE2` | Card and sidebar tints |
| `--color-amber` | `#B8622B` | Primary CTA, active nav, brand accent |
| `--color-green` | `#3E6B4F` | Healthy / low-stress states |
| `--color-danger` | `#B23A3A` | Error and critical states |
| `--color-info` | `#2B5CB8` | AI badge and info states |

Typography: **Fraunces** (serif, headings) + **Inter** (sans-serif, body).

---

## Running Locally

```bash
npm install
cp .env.example .env
# set VITE_API_URL=http://localhost:8000
npm run dev
```

Open `http://localhost:5173`.

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| Dev server | `npm run dev` | Starts Vite dev server with HMR |
| Build | `npm run build` | Production build to `dist/` |
| Preview | `npm run preview` | Preview the production build locally |
| Lint | `npm run lint` | Run oxlint |
