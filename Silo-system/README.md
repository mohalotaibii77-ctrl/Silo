# Silo - Multi-Tenant Restaurant Operating System

A complete Restaurant Operating System with **custom Node.js backend** and multiple frontends for different user roles.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│     Silo Backend (Port 9000)                │
│     Node.js + Express + TypeScript          │
│     Modular Monolith Architecture           │
│                                             │
│     Modules:                                │
│     • Auth (login, register, JWT)           │
│     • Business (multi-tenant management)    │
│     • POS (products, orders, inventory)     │
│     • Ready for: HR, QHSE, Operations, AI   │
└─────────────────┬───────────────────────────┘
                  │
          RESTful API (/api/*)
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
┌──────────────────┐  ┌──────────────────┐
│  Super Admin     │  │  Business App    │
│  (Next.js)       │  │  (React Native)  │
│  Port 3000       │  │  Web/iOS/Android │
│                  │  │                  │
│  • Platform      │  │  • Owner UI      │
│    Management    │  │  • Manager UI    │
│  • Business CRUD │  │  • Employee POS  │
│  • Monitoring    │  │                  │
└──────────────────┘  └──────────────────┘
```

---

## 📦 Project Structure

```
Silo-system/
├── backend/                    # Node.js/Express API Server
│   ├── src/
│   │   ├── modules/           # Feature modules
│   │   │   ├── auth/          # Authentication
│   │   │   ├── business/      # Tenant management
│   │   │   └── pos/           # POS operations
│   │   ├── shared/            # Shared utilities
│   │   ├── routes/            # API routes
│   │   └── db/                # Database scripts
│   └── README.md              # Backend documentation
│
├── super-admin/               # SuperAdmin Web App (Next.js)
│   ├── app/                   # Next.js pages
│   ├── components/            # React components
│   ├── lib/                   # API client
│   └── README.md              # SuperAdmin docs
│
├── business-app/              # Business Mobile App (Expo)
│   ├── src/
│   │   ├── screens/           # App screens
│   │   ├── navigation/        # Navigation setup
│   │   └── api/               # API client
│   └── App.tsx
│
└── STATUS.md                  # Current system status
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL (Supabase)
- npm or yarn

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env      # Configure your database and secrets
npm run db:migrate        # Create database tables
npm run db:seed           # Seed demo data
npm run dev               # Start backend (port 9000)
```

### 2. SuperAdmin Setup

```bash
cd super-admin
npm install
# Create .env.local with:
# NEXT_PUBLIC_API_URL=http://localhost:9000
npm run dev               # Start super-admin (port 3000)
```

### 3. Business App Setup

```bash
cd business-app
npm install
npm start                 # Start Expo dev server
# Press 'w' for web, or scan QR for mobile
```

---

## 🎯 What's Working

### ✅ Backend (Port 9000)
- Multi-tenant architecture
- JWT authentication
- Role-based access control (Super Admin, Owner, Manager, Employee)
- RESTful API endpoints
- Modular service layer architecture

### ✅ SuperAdmin (Port 3000)
- Login page
- Business dashboard
- Create/View/Edit/Delete businesses
- Real-time business statistics

### ✅ Business App
- Login screen
- Role-based navigation
- Owner dashboard
- Operations Manager view
- Employee POS screen

---

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/profile`

### Businesses (Super Admin)
- `GET /api/businesses`
- `POST /api/businesses`
- `GET /api/businesses/:id`
- `PUT /api/businesses/:id`
- `DELETE /api/businesses/:id`

### Products (Business Users)
- `GET /api/products`
- `POST /api/products`
- `PATCH /api/products/:id/inventory`

### Orders (Business Users)
- `GET /api/orders`
- `POST /api/orders`
- `GET /api/orders/stats`

---

## 🗄️ Database

**Platform:** Supabase PostgreSQL  
**Project:** Silo

### Tables
- `businesses` - Multi-tenant businesses
- `users` - All user accounts
- `products` - Products per business
- `inventory` - Stock tracking
- `orders` - Orders per business
- `order_items` - Order line items

### Database Scripts
```bash
npm run db:clean    # Drop all tables
npm run db:migrate  # Create tables
npm run db:seed     # Seed demo data
npm run db:reset    # Clean + Migrate + Seed
```

---

## 👥 User Roles

### Super Admin
- Platform-level access
- Manage all businesses
- View system-wide analytics
- Control subscriptions

### Business Owner
- Full business access
- HR, accounting, operations
- View all reports
- Manage staff

### Operations Manager
- Daily operations
- Task management
- Incident reporting
- EOD procedures

### Employee
- POS access
- Check-in/out
- Task completion
- Issue reporting

---

## 🔐 Security

- JWT token authentication
- bcrypt password hashing
- Tenant data isolation
- Role-based access control
- CORS protection
- SQL injection prevention

---

## 📱 Technologies

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL (Supabase)
- **Auth:** JWT + bcrypt

### SuperAdmin
- **Framework:** Next.js 15
- **UI:** React + TailwindCSS
- **Language:** TypeScript

### Business App
- **Framework:** Expo (React Native)
- **Platform:** Web, iOS, Android
- **Language:** TypeScript

---

## 🎯 Roadmap

### Current Modules (✅ Completed)
- Auth & User Management
- Business/Tenant Management
- POS (Products, Orders, Inventory)

### Planned Modules
- **HR Module** - Employee management, shifts, payroll
- **QHSE Module** - Quality, health, safety, environment
- **Operations Module** - Tasks, checklists, EOD reports
- **Accounting Module** - Invoices, expenses, reports
- **AI Core Module** - Analytics, predictions, insights
- **Training Module** - Employee training & certification
- **Customer Care Module** - Support tickets, feedback
- **Maintenance Module** - Equipment tracking, repairs

---

## 📖 Documentation

- **[Backend Documentation](./backend/README.md)** - Backend setup and API reference
- **[Architecture Guide](./backend/MODULAR_ARCHITECTURE.md)** - Detailed architecture explanation
- **[Quick Reference](./backend/QUICK_REFERENCE.md)** - Developer quick reference
- **[SuperAdmin Guide](./super-admin/README.md)** - SuperAdmin setup and features
- **[Testing Guide](./super-admin/TESTING_GUIDE.md)** - How to test SuperAdmin
- **[System Status](./STATUS.md)** - Current implementation status

---

## 🧪 Testing

### Backend Health Check
```bash
curl http://localhost:9000/health
```

### Login Test (PowerShell)
```powershell
$body = @{ email = "owner@demo-restaurant.com"; password = "owner123" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:9000/api/auth/login" -Method Post -Body $body -ContentType "application/json"
$response
```

---

## 🤝 Contributing

This is a private project for building a complete Restaurant Operating System.

---

## 📄 License

ISC

---

## 🎉 Current Status

✅ **Backend:** Running with modular architecture  
✅ **SuperAdmin:** Fully functional business management  
✅ **Business App:** Role-based navigation ready  
🚧 **Next:** Adding HR, QHSE, Operations modules

---

**Built with ❤️ for the restaurant industry**




