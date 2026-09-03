# BillingMaster 🚀

[![BillingMaster](https://img.shields.io/badge/BillingMaster-v1.0.0-orange.svg)](https://github.com/BillingMaster)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v19-61dafb.svg)](https://reactjs.org/)
[![Electron](https://img.shields.io/badge/Electron-v44-47848F.svg)](https://www.electronjs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-v8.0+-4479A1.svg)](https://www.mysql.com/)

**BillingMaster** is an enterprise-grade, high-performance Point of Sale (POS), KhataBook (Customer Ledger), Inventory Management, and Financial Analytics application built for desktop, web, and mobile environments.

---

## 🌟 Key Features

- **⚡ Point of Sale (POS) & Billing**
  - Fast barcode scanning & product searching
  - Multi-template custom invoice generation
  - PDF export & direct printing via `jsPDF`
  - Real-time tax calculations & automatic stock deduction

- **📘 KhataBook & Ledger Management**
  - Customer credit (`Gave` / `Got`) transactions
  - Customer profile history and balance tracking
  - Automated balance updates on invoice payments

- **📦 Inventory & Stock Control**
  - Real-time stock levels with low-stock threshold alerts
  - SKU & Barcode management
  - Category breakdown and stock movement history

- **📊 Financial Analytics & Reports**
  - Interactive charts powered by `Recharts`
  - CA Tax export modal & GST verification tools
  - Comprehensive revenue, expense, and profit reports

- **📱 Multi-Platform Deployment**
  - **Web App**: Built with Vite + React 19 + Tailwind CSS
  - **Desktop App**: Cross-platform desktop bundle via Electron
  - **Mobile App**: Native Android support via Capacitor

- **🔒 Enterprise Security & DB Fallback**
  - JWT authentication & BCrypt password hashing
  - Robust MySQL database connection pool with built-in mock/local store fallbacks

---

## 🎨 Visual Identity & UI Standards

- **Color Palette**: Premium **Orange (`#F97316`) + White + Black** with refined neutrals.
- **Notifications**: Pure custom in-app notifications (`sonner` toasts) without native browser alerts.
- **Language**: Strictly **English** throughout all user interfaces, receipts, reports, and system prompts.

---

## 🛠️ Technology Stack

| Layer | Technology / Library |
| :--- | :--- |
| **Frontend UI** | React 19, TypeScript, Tailwind CSS v4, Radix UI, Framer Motion |
| **Icons & Charts** | Lucide React, Recharts |
| **State & Fetching** | TanStack React Query v5, Wouter (Routing), React Hook Form, Zod |
| **Desktop / Mobile** | Electron v44, Electron Packager, Capacitor |
| **Backend API** | Node.js, Express, TypeScript, `tsx` watcher |
| **Database** | MySQL (mysql2 driver) with automatic schema initialization & local fallbacks |
| **Authentication** | JSON Web Tokens (JWT), BCryptJS |

---

## 📁 Repository Structure

```
BillingMaster/
├── backend/                  # Node.js + Express + MySQL API
│   ├── src/
│   │   ├── controllers/      # Auth, Business, Invoice & Generic DB controllers
│   │   ├── db/               # MySQL pool initialization & SQL schema (schema.sql)
│   │   ├── middleware/       # JWT Authentication middleware
│   │   └── server.ts         # Main server entrypoint & REST API endpoints
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                 # React 19 + Vite + Electron Frontend
│   ├── electron/             # Electron main process & preloader scripts
│   ├── src/
│   │   ├── components/       # POS, KhataBook, Reports, Expenses, Modals & Radix UI components
│   │   ├── App.tsx           # Main application routing & root view
│   │   └── main.tsx          # React application mounting point
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── .gitignore                # Git ignore configuration for dependencies & secrets
├── AGENTS.md                 # Agent instructions & rules
└── README.md                 # Technical project documentation
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MySQL**: v8.0 or higher (optional: fallback memory store will operate if MySQL is disconnected)

---

### 📦 Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/BillingMaster/billingmaster.md.git
   cd BillingMaster
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   ```

   Create a `.env` file inside `backend/`:
   ```env
   PORT=5000
   JWT_SECRET=your_super_secret_jwt_key
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=billingmaster_db
   DB_PORT=3306
   ```

3. **Setup Frontend**
   ```bash
   cd ../frontend
   npm install
   ```

   Create a `.env` file inside `frontend/`:
   ```env
   VITE_API_URL=http://localhost:5000
   ```

---

## 💻 Running the Application

### 1. Run Development Mode

**Start Backend API Server:**
```bash
cd backend
npm run dev
# Server will start on http://localhost:5000
```

**Start Frontend Web Application:**
```bash
cd frontend
npm run dev
# Vite server will start on http://localhost:5000 (or http://localhost:3000)
```

**Start Desktop (Electron) Application:**
```bash
cd frontend
npm run electron:dev
```

---

### 2. Type Checking & Building

**Run TypeScript Typechecks:**
```bash
# Backend
cd backend && npm run typecheck

# Frontend
cd frontend && npm run typecheck
```

**Build for Production:**
```bash
# Build Backend
cd backend && npm run build

# Build Frontend Web
cd frontend && npm run build

# Package Windows Desktop Application (.exe)
cd frontend && npm run package:win

# Build & Sync Native Android Mobile App
cd frontend && npm run cap:build:android

# Open in Android Studio (to run or generate signed APK/AAB)
cd frontend && npm run cap:open:android

# Build Android Debug APK directly via CLI
cd frontend && npm run apk:debug
# Generated APK will be in: frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🗄️ Database Schema & Architecture

BillingMaster includes an automated MySQL schema (`schema.sql`) covering the following core entities:

- **`businesses`**: Stores business profile, tax rates, currency, contact info.
- **`users` & `profiles`**: User credentials, roles (`owner`, `admin`, `staff`), and business association.
- **`categories` & `products`**: Inventory catalog with SKU, cost, pricing, stock levels, and low-stock alerts.
- **`customers` & `suppliers`**: Ledger contacts and addresses.
- **`invoices` & `invoice_items`**: Sales invoices, status (`draft`, `paid`, `partially_paid`), subtotal, tax, and itemized rows.
- **`khata_entries`**: Ledger balance records (`gave` credit or `got` debit).
- **`payments` & `expenses`**: Payment records and business expense tracking.
- **`stock_transactions`**: Inventory audit trails (`purchase`, `sale`, `adjustment`, `return`).

---

## 🔌 API Endpoints Summary

### Authentication Routes
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/signup` | Register a new user |
| `POST` | `/api/auth/login` | Authenticate user & receive JWT token |
| `GET` | `/api/auth/session` | Get current active user session |
| `PUT` | `/api/auth/user` | Update user profile information |

### RPC & Business Transaction Routes
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/rpc/create_business` | Initialize business profile with defaults |
| `POST` | `/api/rpc/create_invoice_transaction` | Process POS invoice creation & auto-deduct stock |

### Generic DB REST API
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/db/:table` | Query records from specified table |
| `POST` | `/api/db/:table` | Insert record into table |
| `PUT` | `/api/db/:table/upsert` | Upsert record in table |
| `PUT` | `/api/db/:table/:id` | Update record by ID |
| `DELETE` | `/api/db/:table/:id` | Delete record by ID |

---

## 📜 Available Scripts

### Backend (`/backend`)
- `npm run dev` — Starts dev server with `tsx watch`.
- `npm run build` — Compiles TypeScript code to `dist/`.
- `npm run start` — Runs compiled production backend from `dist/server.js`.
- `npm run typecheck` — Runs `tsc --noEmit` to verify type safety.

### Frontend (`/frontend`)
- `npm run dev` — Starts Vite dev server.
- `npm run build` — Builds production bundle to `dist/`.
- `npm run electron:dev` — Launches Vite server and attaches Electron desktop window.
- `npm run package:win` — Builds executable desktop installer for Windows.
- `npm run typecheck` — Runs TypeScript type check.

---

## 📄 License

This project is licensed under the **MIT License**.

---

© 2026 **BillingMaster**. All Rights Reserved.
