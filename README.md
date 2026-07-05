# FinRelief — AI Powered Debt Relief & Financial Recovery Platform

For instructions on how to clone, configure, and run this project locally, or how to deploy it on Render and Vercel, see the [Setup and Deployment Guide](SETUP_AND_DEPLOYMENT.md).

---

> **SmartBridge Internship Project**
> Built by a team of 5 as part of the SmartBridge Externship Program.
>
> **Team Members:**
> - Bhoganaduni Manogna
> - Sri Datta Sai Vithal Kaligotla -Lead
> - Jayasree Movva
> - Sri Satya Lahari Pragada
> - Krishna Sanjay Pemmaraju

---

## About

FinRelief AI is an intelligent, AI-powered web application that helps people struggling with loan payments figure out a realistic settlement amount and uses AI to write a professional negotiation letter to their bank — turning financial stress into an actionable plan.

Most debt management tools either overwhelm you with jargon or give you generic advice that doesn't reflect your actual situation. FinRelief AI takes a different approach: it looks at your real numbers, shows you exactly where you stand, and helps you take action.

---

## Core Scenarios

The platform is built around three core scenarios:

**Scenario 1 — AI-Powered Settlement Recommendation**
Analyzes your financial profile (loan details, EMI, overdue duration, monthly income) to compute a personalized debt stress score, debt-to-income ratio, and a realistic One Time Settlement (OTS) percentage — a concrete starting point before you ever speak to your bank.

**Scenario 2 — Intelligent Negotiation Letter Generation**
Uses Google Gemini AI to generate a professional, lender-specific OTS negotiation letter based on your financial standing. If Gemini is unavailable or over quota, the app falls back to a built-in professional template automatically — you always get a usable letter.

**Scenario 3 — Financial Health Tracking & Loan Analysis**
A dashboard that tracks monthly surplus, DTI ratio, debt stress levels, and settlement percentages over time, alongside your full AI negotiation letter history.

---

## How It Helps

Negotiating debt on your own is intimidating. Most people don't know what a realistic settlement looks like, and they don't know how to put one in writing. FinRelief AI removes both barriers.

By the time you walk into a conversation with your bank, you already know your numbers, you have a defensible settlement figure, and you have a professionally written letter in hand. The dashboard also tracks your stress score over time so you can see real progress as your situation changes.

---

## Who It Is For

Individuals in India dealing with personal loans, credit card debt, or other consumer lending products who are finding regular repayments difficult — particularly anyone already overdue and considering approaching their lender for a settlement.

---

## Project Metrics

| | |
|---|---|
| Epics | 10 |
| Stories | 26 |
| Tech stack layers | 6 |
| API endpoints | 21 |
| Test cases | 68 |

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

## How It Is Built

The application is split into two completely decoupled services that communicate over a standard REST API.

The **backend** is a Python API built with FastAPI. It handles authentication with JWT tokens, debt stress calculations, Gemini AI integration, PDF generation via ReportLab, and all database reads and writes. The production database is Neon serverless PostgreSQL; SQLite is used for the isolated test suite.

The **frontend** is a React SPA built with Vite and styled with Tailwind CSS v4. It renders dashboard trend charts using Recharts, manages authenticated API calls through Axios, and provides the full UI for adding loans, viewing metrics, simulating settlements, and generating and downloading OTS letters as PDFs.

The frontend only ever talks to the backend through JSON API calls — the backend never serves HTML. This makes it straightforward to deploy them independently (backend on Render, frontend on Vercel) and scale either one without touching the other.

---

## Pages

| Route | Page | What it does |
|---|---|---|
| `/login` | Login | Email/password login + one-click demo account |
| `/register` | Register | Create a new account |
| `/dashboard` | Dashboard | Aggregate KPIs, stress trend charts, letter history |
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

## Milestones

1. **Environment Setup & Dependency Configuration** — Python 3.11+, React + Vite, FastAPI, SQLite & SQLAlchemy, Google Gemini API
2. **AI Integration & Financial Processing** — Financial health calculation, DTI analysis, settlement prediction, AI negotiation strategies, letter generation
3. **Core Backend Development** — FastAPI services for authentication, user management, loan management, financial analysis, and settlement prediction
4. **Database Management & Data Persistence** — Storage for users, loans, settlement records, stress snapshots, and AI-generated letter history
5. **Frontend UI Development** — Responsive dashboard with login/registration, financial dashboard, settlement predictor, and AI letter generator
6. **Testing, Optimization & Deployment** — Validation, security testing, optimization, and deployment to Render + Vercel

---

## Setup and Deployment

For full local setup and production deployment instructions, see the [Setup and Deployment Guide](SETUP_AND_DEPLOYMENT.md).

For the test suite breakdown, see the [Testing Guide](TESTING.md).

---

## Disclaimer

FinRelief AI is created for educational and informational purposes as part of the SmartBridge Internship Program. The metrics and recommendation models do not constitute professional financial or legal counsel. Consult a qualified advisor before negotiating with creditors.
