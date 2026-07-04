# FinRelief AI

FinRelief AI is a web application built to help people who are struggling with debt. Most debt management tools either overwhelm you with jargon or give you generic advice that doesn't reflect your actual situation. FinRelief AI takes a different approach — it looks at your real numbers, shows you exactly where you stand, and helps you take action.

---

## What It Does

When you sign up and add your loan details, FinRelief AI does three things for you.

**It calculates your debt stress.** Using your income, EMI amounts, overdue status, and monthly expenses, the platform computes a debt-to-income ratio and a debt stress score. These numbers tell you, in plain terms, how much financial pressure you are under — whether that is Low, Medium, High, or Critical. It also estimates how long it will take you to clear your debt at your current pace and how much monthly surplus you have to work with.

**It simulates a settlement.** Based on your stress score and overdue days, the app models a realistic One Time Settlement percentage — the proportion of your outstanding balance that a creditor might realistically agree to settle for. This gives you a concrete starting point before you ever speak to a bank or lender.

**It writes your negotiation letter.** This is where Google Gemini AI comes in. The platform uses your loan details, the simulated settlement amount, and your personal situation to draft a professional, empathetic OTS (One Time Settlement) letter addressed to your creditor's recovery department. If Gemini is unavailable or not configured, the app falls back to a built-in professional template that is equally usable.

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

The backend is a Python API built with FastAPI. It handles everything that requires security or computation: user authentication with JWT tokens, debt stress calculations, Gemini AI integration, PDF generation, and all database reads and writes. The database is a Neon serverless PostgreSQL instance.

The frontend is a React single-page application built with Vite and styled with Tailwind CSS. It renders the dashboard charts using Recharts, manages authenticated API calls through Axios, and provides the full user interface for adding loans, viewing metrics, simulating settlements, and generating letters.

The two are completely decoupled. The frontend only ever talks to the backend through JSON API calls. The backend never serves HTML. This architecture makes it straightforward to deploy them independently — the backend on Render and the frontend on Vercel — and scale either one without touching the other.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 + Vite |
| Frontend styling | Tailwind CSS v4 |
| Charts | Recharts |
| HTTP client | Axios |
| Backend framework | FastAPI (Python) |
| Database ORM | SQLAlchemy |
| Database | Neon serverless PostgreSQL |
| Authentication | JWT (python-jose) + bcrypt |
| AI integration | Google Gemini 1.5 Flash |
| PDF export | ReportLab |

---

## Setup and Deployment

For instructions on how to clone, configure, and run this project locally, or how to deploy it on Render and Vercel, see the [Setup and Deployment Guide](SETUP_AND_DEPLOYMENT.md).

---

## Disclaimer

FinRelief AI is created for educational and informational purposes. The metrics and recommendation models do not constitute professional financial or legal counsel. Consult a qualified advisor before negotiating with creditors.
