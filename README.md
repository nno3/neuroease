
# NeuroEase: Smart Memory Aid for Elderly with Cognitive Impairment

## Information about this repository

This is the repository that you are going to use **individually** for developing your project. Please use the resources provided in the module to learn about **plagiarism** and how plagiarism awareness can foster your learning.

Regarding the use of this repository, once a feature (or part of it) is developed and **working** or parts of your system are integrated and **working**, define a commit and push it to the remote repository. You may find yourself making a commit after a productive hour of work (or even after 20 minutes!), for example. Choose commit message wisely and be concise.

Please choose the structure of the contents of this repository that suits the needs of your project but do indicate in this file where the main software artefacts are located.

## Quick Navigation

### Main Software Artifacts
- **Backend API**: [`/backend`](./backend) - Node.js/Express server, PostgreSQL database
- **Caregiver Dashboard**: [`/caregiver-dashboard`](./caregiver-dashboard) - React web application
- **Patient Application**: [`/patient-app`](./patient-app) - React PWA for elderly users
- **Documentation**: [`/docs`](./docs) - Architecture diagrams, API docs, testing plans

### Key Files
- [`DoD.md`](./DoD.md) - Definition of Done criteria
- [`PROJECTLOG.md`](./PROJECTLOG.md) - Weekly development log
- [`FAQ.md`](./FAQ.md) - Frequently asked questions
- [`README.md`](./README.md) - Quick Project overview and navigation


### Getting Started
1. **Backend Setup**: See [`docs/BackendSetUp.md`](./docs/BackendSetUp.md)
2. **Caregiver Dashboard**: See [`docs/caregiverDashboard.md`](./docs/caregiverDashboard.md)
3. **Patient App**: See [`docs/PatientApp.md`](./docs/PatientApp.md)

---

## 1. Project Overview
NeuroEase is a dementia care platform designed to support elderly users with cognitive impairment and their caregivers. The system provides:

- A **backend API** built with Node.js, Express.js, PostgreSQL, and Sequelize ORM
- A **caregiver dashboard** (React web app) for managing patients and reminders
- A **patient-facing PWA** (React) focusing on accessibility and cognitive support

---

## 2. Repository Structure

```
/
│
├── backend/                    # Express.js API Server
│   ├── src/
│   │   ├── controllers/        # Business logic
│   │   ├── models/            # Database schemas (Sequelize)
│   │   ├── routes/            # API endpoints
│   │   ├── middleware/        # Auth & validation
│   │   └── config/            # Database configuration
│   └── package.json
│
├── caregiver-dashboard/        # Caregiver Web App
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/            # Dashboard, Patients, Reminders
│   │   ├── services/         # API calls
│   │   └── hooks/            # Custom React hooks
│   └── package.json
│
├── patient-app/               # Patient PWA
│   ├── src/
│   │   ├── components/       # Accessible UI components
│   │   ├── pages/           # Home, Reminders, Profile
│   │   ├── games/           # Cognitive exercises
│   │   └── services/        # API communication
│   └── package.json
│
└── docs/                      # Project Documentation
    
```

---

## 3. Technology Stack

### Backend
- **Runtime:** Node.js | **Framework:** Express.js
- **Database:** PostgreSQL | **ORM:** Sequelize
- **Auth:** JWT + bcrypt | **Config:** dotenv

### Frontend
- **Caregiver Dashboard:** React.js web application
- **Patient App:** React PWA (Progressive Web App)
- **State Management:** React Context API / Hooks

### Tools
- **Version Control:** Git (GitFlow branching)
- **Package Manager:** npm
- **Testing:** curl / Postman
- **Database GUI:** pgAdmin
- **IDE:** IntelliJ IDEA


---

## 4. System Architecture

### High-Level Overview
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Caregiver     │    │   Backend API    │    │   PostgreSQL    │
│   Dashboard     │◄──►│   (Node.js/      │◄──►│   Database      │
│   (React)       │    │   Express.js)    │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              ▲
┌─────────────────┐           │
│   Patient App   │           │
│   (React PWA)   │───────────┘
└─────────────────┘
```

### Architecture Layers
1. **Presentation Layer**: React dashboards and PWA with RESTful JSON APIs
2. **Application Layer**: Express.js server with JWT auth, validation, and business logic
3. **Data Layer**: PostgreSQL with Sequelize ORM, connection pooling, and ACID compliance

### Key Design Decisions
- **Security**: JWT authentication (7-day expiration), bcrypt password hashing, role-based access
- **Scalability**: Stateless API design, database connection pooling, modular services
- **Separation**: Three independent apps for different user needs and security isolation

---

## 5. Development Workflow

### Branching Strategy (GitFlow)
```
main (production)
└── develop (integration)
    ├── feature/authentication
    ├── feature/backend-database
    ├── feature/caregiver-patient-management
    └── feature/patient-reminder-interface
```

**Branch Usage:**
- `main`: Production-ready code only (final submission)
- `develop`: Integration branch for completed features
- `feature/*`: Individual feature development in isolation


---

## 6. Technical Justifications

**PostgreSQL**: Structured relational data, ACID compliance for medical data, complex query support

**React (Both Frontends)**: Code reuse, rich accessibility libraries, efficient Virtual DOM

**PWA for Patients**: Works on any device, offline functionality, no app store requirements

**Separate Applications**: Clear boundaries between system parts, independent deployment, focused development, easier API and UI testing


---

## 7. Getting Started

### Prerequisites
- Node.js (v14+)
- PostgreSQL (v12+)
- npm

### Quick Setup
```bash
# Clone repository
git clone <repository-url>
cd na429

# Backend setup (Terminal 1)
cd backend
npm install
# Configure .env file (see docs/BackendSetUp.md)
npm start

# Caregiver dashboard (Terminal 2)
cd ../caregiver-dashboard
npm install
npm run dev

# Patient app (Terminal 3)
cd ../patient-app
npm install
npm run dev
```

### Development URLs (different ports)
| App | URL |
|-----|-----|
| **Caregiver Dashboard** | http://localhost:5173 |
| **Patient App** | http://localhost:5175 |
| **Backend API** | http://localhost:5001 |

Both frontends run on separate ports. If you only see the dashboard, open **http://localhost:5175** for the patient app.

**Detailed instructions**: See individual documentation files in `docs/`

---

