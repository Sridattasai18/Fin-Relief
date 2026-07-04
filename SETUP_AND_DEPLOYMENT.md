# FinRelief AI — Complete Setup & Deployment Guide

Hello there! Welcome to FinRelief AI — an AI-powered debt settlement simulation and letter generator. This platform is designed to take the stress out of debt by showing users clear visual insights into their debt stress levels, modeling settlement options, and using Google Gemini AI to draft professional, personalized creditor communication.

This guide walks you through the entire lifecycle of the project: from checking out the code on your local computer to putting it live in production on platforms like Render (for the backend) and Vercel (for the frontend).

---

## How It's Built

To make the app super fast and easy to maintain, we've split it into two main pieces:

1. **The Backend (`/backend`)**: A FastAPI JSON API written in Python. It handles database storage (via Neon PostgreSQL), security tokens, and communicates with Google Gemini AI to draft letters.
2. **The Frontend (`/frontend`)**: A modern React web app built with Vite and Tailwind CSS. It draws graphs, manages dashboard cards, and provides a polished interface.

---

## The Database Layer — Neon PostgreSQL

Every piece of user data in this application lives in a PostgreSQL database. For production, we use Neon — and it is worth spending a moment to explain why and how to get it set up.

### What is Neon?

Neon is a serverless PostgreSQL cloud platform. Think of it as a regular PostgreSQL database that you don't have to manage yourself — no servers to spin up, no config files to tweak. You sign up, create a database, and get a connection string. That's really it.

The reason we chose Neon over a traditional hosted database is that it has a generous free tier, it scales automatically, and it wakes up instantly even after periods of inactivity — which is perfect for a project hosted on Render's free tier where the backend itself can also spin down.

### What the database stores

The application manages four tables, and they are all created automatically the very first time you start the backend — no manual SQL scripts needed.

- **users** — stores registered accounts with hashed passwords. Emails are unique, so no two users can share the same address.
- **loans** — stores each loan a user enters, including the lender name, loan type, outstanding amount, EMI, overdue status, income, and monthly expenses. These numbers feed the debt stress calculations.
- **stress_snapshots** — every time the app calculates your debt-to-income ratio and stress score, it saves a snapshot. This is how the dashboard can show you historical trends over time rather than just your current state.
- **letters** — stores every negotiation letter the system generates for you, whether it came from Gemini AI or the built-in fallback template. Letters are tied to a specific loan and creditor.

### How to set up Neon for this project

1. Go to [neon.tech](https://neon.tech) and create a free account.
2. Click **New Project**, give it a name like `finrelief`, and choose a region close to you or your Render deployment.
3. Once the project is created, go to the **Connection Details** panel and copy the connection string. It will look something like this:
   ```
   postgresql://username:password@your-neon-host.neon.tech/neondb?sslmode=require
   ```
4. Paste that entire string as the value of `DATABASE_URL` in your backend `.env` file for local development, and in your Render environment variables for production.

That is all the database configuration you need to do. The backend takes care of creating the tables on startup. The first time you run the server and register a user, everything will just work.

---

## How Everything Connects — From Your Browser to the Database

This is probably the most important thing to understand before you start. The three layers of this application talk to each other in a very clean, predictable way. Here is the journey a request takes from the moment you click a button to the moment your data gets saved.

**Step 1 — You interact with the React frontend.**
When you log in, add a loan, or request a negotiation letter, the React app (running in your browser) prepares a request. It bundles your data into a standard JSON format and sends it over HTTP to the backend API. The address it sends to is whatever you set in `VITE_API_URL` inside the frontend's `.env` file.

**Step 2 — The FastAPI backend receives your request.**
The backend is the middleman. It gets your request, checks that you are authenticated (by verifying your JWT token), validates the data you sent, and then decides what to do with it. All the business logic — calculating debt stress scores, running settlement simulations, calling Gemini AI — happens here. The frontend never touches the database directly. Everything goes through the backend.

**Step 3 — The backend talks to the database.**
When data needs to be saved or fetched (like your loan records or letter history), the backend uses SQLAlchemy to speak to your PostgreSQL database. The database connection is configured entirely through the `DATABASE_URL` variable in the backend's `.env` file. You can point this at a local PostgreSQL instance for development, or at a cloud-hosted database like Neon for production. The backend handles creating all the tables automatically on startup — you don't need to run any migration scripts manually.

**Step 4 — The response flows back to you.**
Once the backend has the answer — whether that's your loan data, a debt score, or a freshly generated letter — it sends a clean JSON response back to the frontend. React then takes that data and renders it on screen.

In short: the frontend is what you see, the backend is what thinks, and the database is what remembers.

---

## 1. Local Development Setup

Let's get the application up and running on your local machine.

### Prerequisites
Make sure you have these installed:
- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher)

---

### Step A: Clone the Code
First, clone this repository to your machine and move into the project folder:
```bash
git clone https://github.com/Sridattasai18/Fin-Relief-AI.git
cd Fin-Relief-AI
```

---

### Step B: Run the Backend
1. **Navigate into the backend folder**:
   ```bash
   cd backend
   ```
2. **Create a virtual environment** to keep your dependencies separate:
   ```bash
   python -m venv .venv
   ```
   *Activate it:*
   - **Windows (PowerShell)**: `.venv\Scripts\Activate.ps1`
   - **macOS / Linux**: `source .venv/bin/activate`

3. **Install the Python packages**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up your environment variables**:
   Copy the example file to a new file named `.env`:
   ```bash
   cp .env.example .env
   ```
   Open `.env` in your editor and fill in the values:
   - `DATABASE_URL`: Your PostgreSQL connection string. (For local development, you can use a local database or a free tier on Neon DB).
   - `FINRELIEF_SECRET_KEY`: A random hex string to sign login tokens. You can generate one with `python -c "import secrets; print(secrets.token_hex(32))"`.
   - `GEMINI_API_KEY`: Your key from Google AI Studio. If left blank, the app will gracefully fall back to default text templates.
   - `FRONTEND_URL`: Set this to `http://localhost:5173` (the local React dev server address) so the backend allows requests from the frontend.

5. **Start the FastAPI server**:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   Your backend is now running at `http://localhost:8000`. You can visit `http://localhost:8000/docs` to see the interactive API docs!

---

### Step C: Run the Frontend
1. **Open a new terminal window** (keep the backend terminal running), navigate back to the root, and go to the frontend directory:
   ```bash
   cd frontend
   ```
2. **Install the packages**:
   ```bash
   npm install
   ```
3. **Configure the API endpoint**:
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and verify that `VITE_API_URL` points to your backend:
   ```env
   VITE_API_URL=http://localhost:8000
   ```
4. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open your browser to `http://localhost:5173` to see the application running locally!

---

## 2. Deploying to Production

When you are ready to share your application with the world, we recommend using Render for the Python backend and Vercel for the React frontend. Here is how to set them up.

### Deploying the Backend on Render
Render is a wonderful, simple cloud platform for web services.

1. Create a free account at [render.com](https://render.com).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository.
4. Fill in the configuration details:
   - **Name**: `finrelief-backend`
   - **Runtime**: `Python`
   - **Root Directory**: `backend` *(This is important!)*
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Scroll down to **Environment Variables** and add the following keys:
   - `DATABASE_URL`: Your production PostgreSQL connection string (e.g. from Neon).
   - `FINRELIEF_SECRET_KEY`: A secure random secret key.
   - `GEMINI_API_KEY`: Your Google AI Studio API key.
   - `FRONTEND_URL`: The URL of your Vercel frontend (you'll get this in the next step, but you can update it later).
6. Click **Deploy Web Service**.

Once deployed, Render will give you a public URL (e.g., `https://finrelief-backend.onrender.com`). Copy this URL!

---

### Deploying the Frontend on Vercel
Vercel is the gold standard for hosting frontend single-page applications.

1. Log into your account at [vercel.com](https://vercel.com).
2. Click **Add New** > **Project** and import your GitHub repository.
3. In the configuration settings:
   - **Framework Preset**: Choose **Vite**.
   - **Root Directory**: Select `frontend`.
4. Click on **Environment Variables** and add:
   - Name: `VITE_API_URL`
   - Value: The URL of your deployed Render backend (e.g., `https://finrelief-backend.onrender.com`). Do not include a trailing slash.
5. Click **Deploy**.

Vercel will build your React application and provide you with a production URL (e.g., `https://finrelief-ai.vercel.app`).

---

### Connecting the Frontend and Backend
To ensure that security features work smoothly, go back to your Render dashboard for your backend service:
1. Go to **Environment Variables**.
2. Update the `FRONTEND_URL` variable to point to your new Vercel production URL (e.g., `https://finrelief-ai.vercel.app`).
3. Save the changes. Render will automatically redeploy the backend with the new configuration.

Now, your frontend can securely communicate with your backend database and Gemini AI services in production!

---

## Disclaimer
FinRelief AI is created for educational and informational purposes. The metrics and recommendation models do not constitute professional financial or legal counsel. Consult a qualified advisor before negotiating with creditors.
