# FinRelief AI

For instructions on how to clone, configure, and run this project locally, or how to deploy it on Render and Vercel, see the [Setup and Deployment Guide](SETUP_AND_DEPLOYMENT.md).

---

FinRelief AI is a web application built to help people who are struggling with debt. Most debt management tools either overwhelm you with jargon or give you generic advice that doesn't reflect your actual situation. FinRelief AI takes a different approach — it looks at your real numbers, shows you exactly where you stand, and helps you take action.

---

## What It Does

When you sign up and add your loan details, FinRelief AI does three things for you.

**It calculates your debt stress.** Using your income, EMI amounts, overdue status, and monthly expenses, the platform computes a debt-to-income ratio and a debt stress score. These numbers tell you, in plain terms, how much financial pressure you are under — whether that is Low, Medium, High, or Critical. It also estimates how long it will take you to clear your debt at your current pace and how much monthly surplus you have to work with.

**It simulates a settlement.** Based on your stress score and overdue days, the app models a realistic One Time Settlement percentage — the proportion of your outstanding balance that a creditor might realistically agree to settle for. This gives you a concrete starting point before you ever speak to a bank or lender.

**It writes your negotiation letter.** This is where Google Gemini AI comes in. The platform uses your loan details, the simulated settlement amount, and your personal situation to draft a professional, empathetic OTS (One Time Settlement) letter addressed to your creditor's recovery department. If Gemini is unavailable, over quota, or not configured, the app falls back to a built-in professional template that is equally usable — the `source` field in every letter response tells you which one was used.

---

## How It Helps

Negotiating debt on your own is intimidating. Most people don't know what a realistic settlement looks like, and they certainly don't know how to put one in writing. FinRelief AI removes both of those barriers.

By the time you walk into a conversation with your bank, you already know your numbers, you have a defensible settlement figure, and you have a professionally written letter in your hand. That changes the dynamic entirely.

The dashboard also tracks your stress score over time. So as you pay down debt or your income changes, you can see that progress reflected in your metrics rather than just feeling like you are spinning your wheels.

---

## Who It Is For

This application is designed for individuals in India dealing with personal loans, credit card debt, or other consumer lending products who are finding regular repayments difficult. It is particularly useful for anyone who is already overdue on payments and is considering approaching their lender for a settlement.

---

## How It Is Built

The application is split into two parts that communicate over a standard REST API.

The backend is a Python API built with FastAPI. It handles everything that requires security or computation: user authentication with JWT tokens, debt stress calculations, Gemini AI integration, PDF generation via ReportLab, and all database reads and writes. The database is a Neon serverless PostgreSQL instance, with SQLite used for the test suite.

The frontend is a React single-page application built with Vite and styled with Tailwind CSS v4. It renders dashboard charts using Recharts, manages authenticated API calls through Axios, and provides the full user interface for adding loans, viewing metrics, simulating settlements, and generating and downloading OTS letters as PDFs.

The two are completely decoupled. The frontend only ever talks to the backend through JSON API calls. The backend never serves HTML. This architecture makes it straightforward to deploy them independently — the backend on Render and the frontend on Vercel — and scale either one without touching the other.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 + Vite 8 |
| Frontend styling | Tailwind CSS v4 |
| Charts | Recharts |
| Icons | Lucide React |
| HTTP client | Axios |
| Backend framework | FastAPI (Python) |
| Database ORM | SQLAlchemy 2.0 |
| Production database | Neon serverless PostgreSQL |
| Test database | SQLite (isolated per test) |
| Authentication | JWT (python-jose) + bcrypt |
| Rate limiting | SlowAPI |
| AI integration | Google Gemini 2.0 Flash |
| PDF export | ReportLab |
| Frontend linting | oxlint |
| Test framework | Pytest + HTTPX |

---

## Pages

| Route | Page | What it does |
|---|---|---|
| `/login` | Login | Email/password login + one-click demo account |
| `/register` | Register | Create a new account |
| `/dashboard` | Dashboard | Aggregate KPIs, stress trend charts, letter count |
| `/loans` | Loans | Full CRUD for your loans |
| `/settlement` | Settlement | Run a settlement simulation on any loan |
| `/letters` | Letters | Generate, edit, and download OTS letters as PDFs |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Register new user, returns JWT |
| POST | `/auth/login` | Login, returns JWT |
| GET | `/auth/me` | Current user info |
| POST | `/auth/logout` | Blacklist current JWT |
| GET | `/loans` | List user's loans |
| POST | `/loans` | Create a loan |
| GET | `/loans/{id}` | Get a single loan |
| PATCH | `/loans/{id}` | Update a loan |
| DELETE | `/loans/{id}` | Delete a loan |
| POST | `/settlement/{loan_id}` | Run settlement calculation + save snapshot |
| GET | `/snapshots` | All stress snapshots (for trend charts) |
| GET | `/snapshots/{loan_id}` | Snapshots for a specific loan |
| POST | `/letters/{loan_id}` | Generate OTS letter (Gemini or fallback template) |
| GET | `/letters` | Latest letter per loan |
| GET | `/letters/{loan_id}` | Latest letter for a loan |
| GET | `/letters/{loan_id}/history` | All letter versions for a loan |
| GET | `/letters/download/{letter_id}` | Stream letter as PDF |
| PUT | `/letters/{letter_id}` | Edit letter body |
| GET | `/dashboard` | Aggregated stats for the dashboard |
| POST | `/demo/seed` | Seed 3 sample loans for demo account |
| GET | `/health` | Database + Gemini API status |

---

## Setup and Deployment

For instructions on how to clone, configure, and run this project locally, or how to deploy it on Render and Vercel, see the [Setup and Deployment Guide](SETUP_AND_DEPLOYMENT.md).

For the test suite, see the [Testing Guide](TESTING.md).

---

## Disclaimer

FinRelief AI is created for educational and informational purposes. The metrics and recommendation models do not constitute professional financial or legal counsel. Consult a qualified advisor before negotiating with creditors.
