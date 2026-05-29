# 🎪 Festival Stock App

Stock management app for festival bars.

## ▶️ How to Run

1. Open this folder in VS Code
2. Open the terminal (Ctrl + `)
3. Run:
   ```
   npm install
   npm run dev
   ```
4. Open your browser at: **http://localhost:5173**

## 🔐 Default PINs

| Role | PIN |
|------|-----|
| Responsável de Bar | 1111 |
| Coordenador de Evento | 2222 |
| Gestor da Empresa | 3333 |

You can change these in `src/pages/RoleSelect.jsx`

## 📦 Where data is stored

Data is saved in your **browser's localStorage** — it persists between sessions on the same computer.

> ⚠️ This means each person's computer has its own copy of the data.
> To share data across your organization, we need to connect to a shared database (Supabase).
> Ask Claude to help set up Supabase when you're ready!

## 📁 File Structure

```
src/
  pages/
    Dashboard.jsx        — Main home screen
    SubmitReport.jsx     — Submit stock counts
    DailySheet.jsx       — Daily overview of all bars
    Reports.jsx          — View & edit all reports
    FestivalReport.jsx   — Final festival summary
    Setup.jsx            — Manage bars & products
    Financials.jsx       — Offered/waste tracking
    RoleSelect.jsx       — Role selection screen
  lib/
    db.js                — Local data storage
    RoleContext.jsx      — Role management
  App.jsx
  Layout.jsx
  main.jsx
  index.css
```
