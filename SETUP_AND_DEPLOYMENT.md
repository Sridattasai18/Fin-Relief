# FinRelief AI — Setup & Deployment Guide

This guide walks you through the full lifecycle of the project: running it locally on your machine and deploying it to production on Render (backend) and Vercel (frontend).

---

## How It's Built

The app is split into two completely decoupled services:

1. **Backend (`/backend`)** — A FastAPI JSON API written in Python. Handles authentication, debt stress calculations, Gemini AI integration, PDF generation, and all database reads and writes.
2. **Frontend (`/frontend`)** — A React SPA built with Vite and styled with Tailwind CSS v4. Renders dashboard charts, manages authenticated API calls, and provides the full user interface.

The frontend never touches the database directly. Everything goes through the backend over JSON. This makes each service independently deployable and scalable.

---

## The Database — Neon PostgreSQL

All user data lives in a PostgreSQL database. For production, the project uses [Neon](https://neon.tech) — a serverless PostgreSQL platform with a generous free tier that pairs well with Render's free tier (both can spin down during inactivity and wake up quickly).

### What the database stores

All four tables are created automatically on first backend startup — no manual SQL needed.

| Table | What it stores |
|---|---|
| `users` | Registered accounts with bcrypt-hashed passwords |
| `loans` | Each loan a user enters: lender, type, amount, EMI, overdue days, income, expenses |
| `stress_snapshots` | A saved stress/DTI calculation every time settlement is run (powers trend charts) |
| `letters` | Every OTS letter generated, with a `source` field (`"gemini"` or `"fallback"`) and full version history |

### Setting up Neon

1. Create a free account at [neon.tech](https://neon.tech)
2. Click **New Project**, name it `finrelief`, pick a region
3. Copy the connection string from **Connection Details** — it looks like:
   ```
   postgresql://username:password@host.neon.tech/neondb?sslmode=require
   ```
4. Use this as `DATABASE_URL` in `backend/.env` locally, and in your Render environment variables in production

---

## Environment Variables

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `GEMINI_API_KEY` | Google Gemini API key — get one free at [aistudio.google.com](https://aistudio.google.com). Optional: the app falls back to a professional letter template if absent or over quota |
| `FINRELIEF_SECRET_KEY` | JWT signing secret. Generate one with: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `FRONTEND_URL` | CORS allowed origin. Set to `http://localhost:5173` locally, your Vercel URL in production |

### Frontend (`frontend/.env`)

Copy `frontend/.env.example` to `frontend/.env` and fill in:

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL. Set to `http://localhost:8000` locally, your Render URL in production |

---

## Local Development

### Prerequisites

- **Node.js** v18 or higher
- **Python** 3.10 or higher

---

### Step 1 — Clone the repo

```bash
git clone https://github.com/Sridattasai18/Fin-Relief-AI.git
cd Fin-Relief-AI
```

---

### Step 2 — Run the backend

```bash
cd backend
```

Create and activate a virtual environment:

```bash
python -m venv .venv
```

- **Windows (PowerShell):** `.venv\Scripts\Activate.ps1`
- **macOS / Linux:** `source .venv/bin/activate`

Install dependencies:

```bash
pip install -r requirements.txt
```

Set up environment variables:

```bash
cp .env.example .env
# then open .env and fill in the values
```

Start the server:

```bash
uvicorn main:app --reload --port 8000
```

The backend is now running at `http://localhost:8000`. Visit `http://localhost:8000/docs` for the interactive API explorer, or `http://localhost:8000/health` to confirm the database and Gemini API are connected.

---

### Step 3 — Run the frontend

Open a new terminal (keep the backend terminal running):

```bash
cd frontend
npm install
cp .env.example .env
# verify VITE_API_URL=http://localhost:8000
npm run dev
```

Open `http://localhost:5173` in your browser.

---

### Step 4 — Try the demo account

On the login page, click **Try Demo**. This automatically creates a demo account and seeds it with three realistic sample loans (HDFC Bank, SBI Card, KreditBee) so you can explore the full app without entering data manually.

---

## Running Tests

From the repo root:

```bash
python -m pytest backend/tests/ -v
```

Expected: **65 passed**. See [TESTING.md](TESTING.md) for a full breakdown of what's covered.

---

## Production Deployment

### Deploy the backend on Render

1. Create a free account at [render.com](https://render.com)
2. Click **New +** → **Web Service** and connect your GitHub repository
3. Fill in the service configuration:
   - **Root Directory:** `backend`
   - **Runtime:** Python
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path:** `/health`
4. Under **Environment Variables**, add:
   - `DATABASE_URL` — your Neon connection string
   - `FINRELIEF_SECRET_KEY` — a secure random secret
   - `GEMINI_API_KEY` — your Google AI Studio key
   - `FRONTEND_URL` — your Vercel frontend URL (add this after the next step)
5. Click **Deploy Web Service**

Render will give you a public URL like `https://finrelief-backend.onrender.com`. Copy it.

A `render.yaml` is included in the repo root if you prefer infrastructure-as-code deployment.

---

### Deploy the frontend on Vercel

1. Log in at [vercel.com](https://vercel.com)
2. Click **Add New** → **Project** and import your GitHub repository
3. Set **Root Directory** to `frontend` and **Framework Preset** to **Vite**
4. Under **Environment Variables**, add:
   - `VITE_API_URL` — your Render backend URL (no trailing slash)
5. Click **Deploy**

Vercel will give you a production URL like `https://finrelief-ai.vercel.app`.

---

### Connect the two services

Go back to your Render backend service → **Environment Variables**, and set `FRONTEND_URL` to your Vercel URL. Render will redeploy automatically. The CORS configuration will now allow requests from your production frontend.

---

## Architecture Summary

```
Browser (React SPA on Vercel)
        │
        │  JSON over HTTPS
        ▼
FastAPI backend (Render)
        │                    │
        │                    │
        ▼                    ▼
Neon PostgreSQL         Google Gemini API
(user data,             (OTS letter generation,
 loans, letters,         falls back to template
 snapshots)              on quota/error)
```

---

## Disclaimer

FinRelief AI is created for educational and informational purposes. The metrics and recommendation models do not constitute professional financial or legal counsel. Consult a qualified advisor before negotiating with creditors.
