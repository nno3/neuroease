
# NeuroEase: Smart Memory Aid for Elderly with Cognitive Impairment

## Information about this repository

This is the repository that you are going to use **individually** for developing your project. Please use the resources provided in the module to learn about **plagiarism** and how plagiarism awareness can foster your learning.

Regarding the use of this repository, once a feature (or part of it) is developed and **working** or parts of your system are integrated and **working**, define a commit and push it to the remote repository. You may find yourself making a commit after a productive hour of work (or even after 20 minutes!), for example. Choose commit message wisely and be concise.

Please choose the structure of the contents of this repository that suits the needs of your project but do indicate in this file where the main software artefacts are located.




## 1. Project Overview

NeuroEase is a dementia care platform designed to support elderly users with cognitive impairment and their caregivers. The system provides:

- A **backend API** built with Node.js, Express.js, PostgreSQL, and Sequelize ORM.
- A **caregiver dashboard** (React web app) for managing patients and reminders.
- A **patient-facing PWA** (React) focusing on accessibility and cognitive support.


---

## 2. Technology Stack

### 2.1 Backend

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL
- **ORM:** Sequelize
- **Authentication:** JWT + bcrypt
- **Configuration:** dotenv for environment variables

### 2.2 Frontend

- **Caregiver Dashboard:** React.js web application
- **Patient Application:** React-based PWA (Progressive Web App)
- **State Management:** React Context API / Hooks
- **Styling:** CSS / component library (TBC)

### 2.3 Development Tools

- **Version Control:** Git with GitFlow-style branching
- **Package Management:** npm
- **API Testing:** curl / Postman
- **Database GUI:** pgAdmin
- **IDE:** Intellij IDEA

---

## 3. System Architecture

### 3.1 High-Level Architecture
NeuroEase follows a **three-tier architecture**:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Caregiver     │    │   Backend API    │    │   PostgreSQL    │
│   Dashboard     │◄──►│   (Node.js/      │◄──►│   Database      │
│   (React)       │    │   Express.js)    │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              ▲
┌─────────────────┐           │
│   Patient PWA   │           │
│   (React PWA)   │───────────┘
└─────────────────┘
```

1. #### Presentation Layer
- **Caregiver Dashboard**: React for patient management
- **Patient PWA**: Mobile-optimized progressive web app
- **Communication**: RESTful JSON APIs over HTTPS

2. #### Application Layer
- **Express.js Server**: Handles business logic and API routing
- **Authentication Middleware**: JWT validation and role-based access
- **Data Validation**: Request payload validation and sanitization
- **Error Handling**: Structured error responses and logging
- **Implements** authentication, authorization, and business logic.

3. #### Data Layer
- **PostgreSQL**: Relational database with ACID compliance
- **Sequelize ORM**: Database abstraction and migration management
- **Connection Pooling**: Optimized database connections
- **Data Integrity**: Foreign key constraints and transactions



### 3.2 Key Architectural Decisions

#### Security-First Design
- **JWT-based authentication** with 7-day expiration
- **Password hashing** using bcrypt with salt rounds = 10
- **Role-based access control** (caregiver vs patient)
- **CORS configuration** for controlled cross-origin requests

#### Scalability Considerations
- **Stateless API design** for horizontal scaling
- **Database connection pooling** with configurable limits
- **Environment-based configuration** for different deployments
- **Modular service architecture** for maintainability

---

## 4. Project Structure Justification


The project is divided into three distinct applications to enforce **separation of concerns** and provide **optimised user experiences**:

```
neuroease-project/
├── backend/              #  Shared API Server
├── caregiver-dashboard/  #  Management Interface  
└── patient-app/          #  Simplified User Interface
```

1. **Different User Needs**: Caregivers need comprehensive management tools, while patients need simple, accessible interfaces
2. **Security Isolation**: Prevents patients from accidentally accessing caregiver functionality
3. **Performance Optimisation**: Each frontend can be optimised for its specific use case
4. **Development Efficiency**: Teams can work on different components simultaneously

### **Backend Structure (`/backend`)**

```
backend/
├── src/
│   ├── controllers/   #  Request handlers (business logic)
│   ├── models/        #  Database models & schemas
│   ├── routes/        #  API endpoint definitions
│   ├── middleware/    #  Authentication & validation
│   ├── services/      #  Business logic services
│   └── config/        #  Configuration files
```

**Design Decisions:**
- **MVC Architecture**: Follows Model-View-Controller pattern for maintainability
- **Separation of Concerns**: Business logic (controllers) separated from data models
- **Security First**: Middleware layer handles all authentication and validation
- **Scalability**: Service layer allows for complex business logic without bloating controllers

### **Caregiver Dashboard Structure (`/caregiver-dashboard`)**

```
caregiver-dashboard/
├── src/
│   ├── components/    #  Reusable UI components*
│   ├── pages/         #  Full page components
│   ├── services/      #  API communication layer
│   └── hooks/         #  Custom React hooks
```

**Design Decisions:**
- **Component-Based Architecture**: Reusable components reduce code duplication
- **Page-Based Routing**: Clear navigation structure matching user workflows
- **Service Abstraction**: Isolate API calls for easier testing and maintenance
- **Custom Hooks**: Share stateful logic across components

### **Patient App Structure (`/patient-app`)**

```
patient-app/
├── src/
│   ├── components/
│   ├── pages/ 
│   ├── games/         #  Cognitive games (specialised folder)
│   └── services/
```

**Design Decisions:**
- **Accessibility Focus**: Structure supports large touch targets and simple navigation
- **Games Isolation**: Separate folder for cognitive games to emphasise their importance
- **Progressive Web App (PWA)**: Enables mobile app-like experience without app store deployment
- **Offline Capability**: Service workers for reminder viewing and games


---
## 5. Branching Strategy Documentation



The Git branching strategy follows **GitFlow** methodology:

```
main (production-ready)
└── develop (integration)
    ├── feature/authentication
    ├── feature/backend-database
    ├── feature/caregiver-patient-management
    └── feature/patient-reminder-interface
```

### **Branch Purposes & Rationale**

#### **1. `main` Branch**
- **Purpose**: Always contains deployable, production-ready code
- **Rationale**: Represents the final submission state; only merged when features are complete and tested
- **Usage**: Final project submission and demonstration

#### **2. `develop` Branch**
- **Purpose**: Integration branch for completed features
- **Rationale**:
  - Allows testing how different features work together
  - Maintains a always-working version of the complete system
  - Serves as the foundation for new feature branches
- **Usage**: Regular merging from feature branches; pre-submission testing

#### **3. Feature Branches**

**`feature/authentication`**
- **Scope**: All 3 components (backend + both frontends)
- **Rationale**: Authentication is a cross-cutting concern affecting entire system
- **Features**: User registration, login, JWT tokens, role-based access

**`feature/backend-database`**
- **Scope**: Backend only
- **Rationale**: Database foundation must be established before building UI features
- **Features**: PostgreSQL schema, data models, relationships

**`feature/caregiver-patient-management`**
- **Scope**: Backend + Caregiver Dashboard
- **Rationale**: Caregiver-specific functionality doesn't affect patient experience
- **Features**: Patient CRUD operations, caregiver-patient relationships

**`feature/patient-reminder-interface`**
- **Scope**: Backend + Patient App
- **Rationale**: Patient-specific features can be developed independently
- **Features**: Reminder display, completion tracking, patient UI

### **Development Workflow Explanation**

1. **Start with Foundation**: Authentication → Database → Then parallel development
2. **Isolated Development**: Each feature branch is a safe workspace
3. **Integration Testing**: Regular merging to `develop` ensures components work together
4. **Quality Assurance**: Only tested, complete code reaches `main`

---
## 6. Technical Decisions & Trade-offs

### **Why PostgreSQL?**
- **Structured Data**: Relational data (users, reminders, relationships) fits SQL better
- **ACID Compliance**: Important for medication reminders and patient data
- **University Experience**: Leverages database module knowledge
- **Complex Queries**: Easier to implement reports and analytics

### **Why React for Both Frontends?**
- **Skill Leverage**: Utilises existing React knowledge
- **Code Reuse**: Shared components and patterns between applications
- **Ecosystem**: Rich library support for accessibility and UI components
- **Performance**: Virtual DOM efficient for both complex dashboards and simple interfaces

### **Why Progressive Web App (PWA) for Patients?**
- **Accessibility**: Works on any device with a browser
- **Offline Functionality**: Critical for reliability with elderly users
- **No App Store Barrier**: Easier deployment and updates
- **Cost Effective**: No developer accounts or review processes

### **Why Not Monolithic Structure?**
- **Separation of Concerns**: Clear boundaries between system parts
- **Independent Deployment**: Frontends can be updated independently
- **Focused Development**: Work on one component without affecting others
- **Testing Isolation**: Easier to test APIs and UIs separately




