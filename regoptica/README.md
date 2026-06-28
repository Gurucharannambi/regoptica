# RegOptica — Complete Deployment Guide
## Pin-to-Pin Setup: Vercel (Frontend) + Railway (Backend)

---

## FOLDER STRUCTURE
```
regoptica/
├── frontend/          ← Deploy this on Vercel
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       └── App.jsx
│
└── backend/           ← Deploy this on Railway
    ├── main.py
    ├── requirements.txt
    └── Procfile
```

---

## STEP 1 — Push to GitHub

1. Go to github.com → New Repository → Name it "regoptica" → Create
2. On your computer open terminal:

```bash
cd regoptica
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/regoptica.git
git push -u origin main
```

---

## STEP 2 — Deploy Backend on Railway

1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your "regoptica" repo
5. Click "Add Service" → select the repo again
6. In service settings → set ROOT DIRECTORY to: `backend`
7. Railway will auto-detect Python and install requirements.txt

### Add Environment Variables on Railway:
- Click your service → "Variables" tab → Add:
  ```
  ANTHROPIC_API_KEY = sk-ant-your-actual-key-here
  PORT = 8000
  ```

### Get your Railway URL:
- Click "Settings" → "Networking" → "Generate Domain"
- Copy the URL — looks like: `https://regoptica-production.up.railway.app`
- TEST IT: open `https://your-railway-url/` in browser → should show `{"status":"RegOptica API is running"}`

---

## STEP 3 — Deploy Frontend on Vercel

1. Go to https://vercel.com
2. Sign up with GitHub
3. Click "New Project" → Import your "regoptica" repo
4. Set ROOT DIRECTORY to: `frontend`
5. Framework Preset: select "Vite"
6. Add Environment Variable:
   ```
   VITE_BACKEND_URL = https://your-railway-url.up.railway.app
   ```
   (paste the Railway URL you copied above)
7. Click "Deploy"
8. Vercel gives you a URL like: `https://regoptica.vercel.app`

---

## STEP 4 — Test Everything

Open your Vercel URL and test:

1. ✅ Dashboard loads with compliance score and stats
2. ✅ Go to Extract → upload a SEBI circular PDF → obligations appear
3. ✅ Click "Add to Tracker" → goes to tracker tab
4. ✅ Go to AI Assistant → ask "which obligations are overdue?" → Claude responds

---

## GETTING YOUR ANTHROPIC API KEY

1. Go to https://console.anthropic.com
2. Sign up / Login
3. Click "API Keys" → "Create Key"
4. Copy the key (starts with sk-ant-...)
5. Paste it in Railway environment variables

---

## COMMON ERRORS & FIXES

| Error | Fix |
|-------|-----|
| Backend not reachable | Check Railway deployment logs, make sure PORT=8000 is set |
| CORS error in browser | Already handled in main.py with allow_origins=["*"] |
| PDF extraction fails | Make sure python-multipart is in requirements.txt |
| API key error | Double-check ANTHROPIC_API_KEY in Railway variables |
| Vercel build fails | Make sure ROOT DIRECTORY is set to "frontend" not root |

---

## LOCAL TESTING (optional before deploying)

### Run Backend locally:
```bash
cd backend
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-your-key
uvicorn main:app --reload --port 8000
```

### Run Frontend locally:
```bash
cd frontend
npm install
echo "VITE_BACKEND_URL=http://localhost:8000" > .env
npm run dev
```
Open http://localhost:5173

---

## DONE! Your app is live at your Vercel URL.
