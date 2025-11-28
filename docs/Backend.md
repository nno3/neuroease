# NeuroEase Backend 


## 1. Overview

NeuroEase Backend is a RESTful API service designed to power dementia care applications. It provides secure data management, authentication, and business logic for caregiver dashboards and patient mobile applications.

### Core Responsibilities
- **Authentication & Authorization**: JWT-based user authentication with role-based access control
- **Data Management**: Patient profiles, medical records, and caregiver relationships
- **Reminder System**: Medication and appointment scheduling with recurrence patterns
- **Cognitive Assessment**: Game session tracking and performance analytics
- **Location Services**: Real-time location logging and geofencing
- **Analytics**: Aggregated data endpoints for performance insights

---

## 2. Technology Stack

### Runtime & Framework
```javascript
Node.js >= 16.0.0          // JavaScript runtime
Express.js 4.x             // Web application framework
```

### Database & ORM
```javascript
PostgreSQL 14+             // Relational database
Sequelize 6.x              // ORM and migration tool
```

### Security
```javascript
bcrypt 5.x                 // Password hashing (10 salt rounds)
jsonwebtoken 9.x           // JWT token generation and validation
cors 2.x                   // Cross-origin resource sharing
```

### Development & Debugging
```javascript
dotenv 16.x                // Environment variable management
morgan 1.x                 // HTTP request logger (commit: 0e08a2f6)
```

**Why Morgan?**
Morgan was added in commit `0e08a2f6` to provide structured HTTP request logging. This enables:
- Request/response cycle visibility during development
- Production debugging through log analysis
- Performance monitoring by tracking response times
- API usage patterns and endpoint analytics

---

## 3. System Architecture

### Three-Tier Architecture

```
┌─────────────────────────────────────────┐
│        Client Applications              │
│  (Caregiver Dashboard / Patient App)    │
└──────────────────┬──────────────────────┘
                   │ HTTPS/REST
                   ▼
┌─────────────────────────────────────────┐
│         Application Layer               │
│  ┌───────────────────────────────────┐  │
│  │   Express.js Server (Port 5001)   │  │
│  ├───────────────────────────────────┤  │
│  │   Middleware Stack                │  │
│  │   - CORS Handler                  │  │
│  │   - JSON Body Parser              │  │
│  │   - Morgan Logger                 │  │
│  │   - JWT Authentication            │  │
│  │   - Role Authorization            │  │
│  ├───────────────────────────────────┤  │
│  │   Route Controllers               │  │
│  │   - Auth Controller               │  │
│  │   - Patient Controller            │  │
│  │   - Reminder Controller           │  │
│  │   - Game Controller               │  │
│  │   - Location Controller           │  │
│  └───────────────────────────────────┘  │
└──────────────────┬──────────────────────┘
                   │ Sequelize ORM
                   ▼
┌─────────────────────────────────────────┐
│          Data Layer                     │
│  ┌───────────────────────────────────┐  │
│  │   PostgreSQL Database             │  │
│  │   - Connection Pooling            │  │
│  │   - Transaction Support           │  │
│  │   - Foreign Key Constraints       │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Middleware Pipeline
```javascript
app.use(cors());                    // Enable cross-origin requests
app.use(express.json());            // Parse JSON request bodies
app.use(morgan('combined'));        // Log all HTTP requests
app.use('/api/*', authenticate);    // Validate JWT tokens
app.use('/api/*', authorize);       // Check user permissions
```

### Critical Architecture Fix (Commit: db474999)

**Problem**: Circular dependency errors in Sequelize models caused initialization failures and prevented proper testing.

**Solution**: Centralized model initialization pattern implemented in `models/index.js`

```javascript
// models/index.js - Centralized initialization
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const sequelize = new Sequelize(/* config */);

const db = {};

// Load all models
fs.readdirSync(__dirname)
  .filter(file => file !== 'index.js')
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// Initialize associations after all models are loaded
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

module.exports = db;
```

**Benefits**:
- Eliminated circular dependency conflicts
- Enabled proper model relationship registration
- Fixed test suite initialization issues
- Improved code maintainability

---

## 4. Database Design

### Entity Relationship Diagram
```
┌──────────────┐
│    Users     │
│──────────────│
│ id (PK)      │
│ email        │◄────────┐
│ password     │         │
│ name         │         │
│ user_type    │         │
└──────┬───────┘         │
       │                 │
       │ 1:1             │ M:M (caregiver_patients)
       ▼                 │
┌──────────────┐         │
│   Patients   │         │
│──────────────│         │
│ id (PK)      │         │
│ user_id (FK) │─────────┘
│ dob          │
│ emergency    │
└──────┬───────┘
       │
       │ 1:M
       ├──────────────┬──────────────┬──────────────┐
       ▼              ▼              ▼              ▼
┌─────────────┐ ┌────────────┐ ┌──────────────┐ ┌───────────┐
│  Reminders  │ │GameSessions│ │LocationLogs  │ │ SafeZones │
│─────────────│ │────────────│ │──────────────│ │───────────│
│ patient_id  │ │patient_id  │ │ patient_id   │ │patient_id │
│ title       │ │ game_type  │ │ latitude     │ │ name      │
│ type        │ │ score      │ │ longitude    │ │ center_lat│
│ scheduled   │ │ duration   │ │ timestamp    │ │ center_lng│
└─────────────┘ └────────────┘ └──────────────┘ └───────────┘
```

### Core Tables

#### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    user_type ENUM('caregiver', 'patient') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_type ON users(user_type);
```

#### Patients Table
```sql
CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    date_of_birth DATE,
    emergency_contact VARCHAR(255),
    medical_conditions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_patients_user ON patients(user_id);
```

#### Reminders Table
```sql
CREATE TABLE reminders (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reminder_type ENUM('medication', 'appointment', 'general') DEFAULT 'general',
    scheduled_time TIMESTAMP NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    recurrence ENUM('once', 'daily', 'weekly') DEFAULT 'once',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reminders_patient ON reminders(patient_id);
CREATE INDEX idx_reminders_schedule ON reminders(scheduled_time);
CREATE INDEX idx_reminders_active ON reminders(patient_id, scheduled_time) 
    WHERE is_completed = false;
```

#### Game Sessions Table
```sql
CREATE TABLE game_sessions (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    game_type ENUM('memory', 'math', 'sequencing') NOT NULL,
    score INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    accuracy FLOAT,
    played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_games_patient ON game_sessions(patient_id);
CREATE INDEX idx_games_type ON game_sessions(game_type);
CREATE INDEX idx_games_recent ON game_sessions(patient_id, played_at DESC);
```

#### Location Logs Table
```sql
CREATE TABLE location_logs (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    accuracy FLOAT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_location_patient ON location_logs(patient_id);
CREATE INDEX idx_location_time ON location_logs(patient_id, timestamp DESC);
CREATE INDEX idx_location_coords ON location_logs(latitude, longitude);
```

#### Safe Zones Table
```sql
CREATE TABLE safe_zones (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) DEFAULT 'Home',
    center_lat FLOAT NOT NULL,
    center_lng FLOAT NOT NULL,
    radius INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_safezones_patient ON safe_zones(patient_id);
CREATE INDEX idx_safezones_active ON safe_zones(patient_id, is_active);
```

#### Caregiver-Patient Relationships
```sql
CREATE TABLE caregiver_patients (
    caregiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    patient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (caregiver_id, patient_id),
    CHECK (caregiver_id != patient_id)
);

CREATE INDEX idx_caregiver_lookup ON caregiver_patients(caregiver_id);
CREATE INDEX idx_patient_lookup ON caregiver_patients(patient_id);
```

### Performance Optimization

#### Query Optimization Strategies
```sql
-- Composite index for frequent reminder queries
CREATE INDEX idx_reminders_patient_schedule 
ON reminders(patient_id, scheduled_time) 
WHERE is_completed = false;

-- Optimized location history retrieval
CREATE INDEX idx_location_patient_time 
ON location_logs(patient_id, timestamp DESC);

-- Game performance analytics
CREATE INDEX idx_games_analytics 
ON game_sessions(patient_id, game_type, played_at DESC);
```

#### Data Integrity Constraints
- **Cascade Deletion**: All patient-related records deleted when user is removed
- **Referential Integrity**: Foreign keys prevent orphaned records
- **Business Rules**: Check constraints enforce logical data consistency

---

## 5. API Endpoints

### Base Configuration
```
Base URL: http://localhost:5001/api
Authentication: Bearer Token (JWT)
Content-Type: application/json
```

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register

Request:
{
  "email": "caregiver@example.com",
  "password": "SecurePass123",
  "name": "Jane Doe",
  "userType": "caregiver"
}

Response (201):
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "caregiver@example.com",
      "name": "Jane Doe",
      "userType": "caregiver"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Login
```http
POST /api/auth/login

Request:
{
  "email": "caregiver@example.com",
  "password": "SecurePass123"
}

Response (200):
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { /* user object */ },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Patient Management Endpoints
```
GET    /api/patients              # List caregiver's assigned patients
POST   /api/patients              # Create patient and assign to caregiver
GET    /api/patients/:id          # Get patient details with medical info
PUT    /api/patients/:id          # Update patient information
DELETE /api/patients/:id          # Remove patient assignment
```

### Reminder Endpoints
```
GET    /api/reminders             # Get patient's reminders (filtered by date)
POST   /api/reminders             # Create new reminder
GET    /api/reminders/:id         # Get reminder details
PUT    /api/reminders/:id         # Update reminder
PATCH  /api/reminders/:id/complete # Mark reminder as completed
DELETE /api/reminders/:id         # Delete reminder
```

### Game Session Endpoints
```
GET    /api/games/sessions        # Get game history with pagination
POST   /api/games/sessions        # Record completed game session
GET    /api/games/statistics      # Get aggregated performance metrics
```

### Location Endpoints
```
GET    /api/location/history      # Get location history (time range)
POST   /api/location/update       # Log current location
GET    /api/safe-zones            # Get patient's safe zones
POST   /api/safe-zones            # Create safe zone
PUT    /api/safe-zones/:id        # Update safe zone
DELETE /api/safe-zones/:id        # Delete safe zone
```

### Health Check
```http
GET /api/health

Response (200):
{
  "success": true,
  "message": "NeuroEase Backend is running",
  "timestamp": "2024-11-13T10:30:00.000Z",
  "database": "PostgreSQL",
  "version": "1.0.0"
}
```

### Standard Response Format

#### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* response payload */ },
  "timestamp": "2024-11-13T10:30:00.000Z"
}
```

#### Error Response
```json
{
  "success": false,
  "message": "User-friendly error description",
  "error": "Technical error details for debugging",
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-11-13T10:30:00.000Z"
}
```

#### Paginated Response
```json
{
  "success": true,
  "data": [ /* array of items */ ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 47,
    "itemsPerPage": 10,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

---

## 6. Security

### Authentication Flow

#### JWT Token Structure
```json
{
  "userId": 123,
  "userType": "caregiver",
  "iat": 1699876800,
  "exp": 1700481600
}
```
**Token Lifetime**: 7 days  
**Algorithm**: HS256

#### Authentication Middleware
```javascript
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid authentication token' 
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ 
      success: false,
      message: 'Authentication failed',
      error: error.message 
    });
  }
};
```

#### Role-Based Authorization
```javascript
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.userType)) {
      return res.status(403).json({ 
        success: false,
        message: 'Insufficient permissions for this operation' 
      });
    }
    next();
  };
};

// Usage example
router.get('/patients', 
  authenticate, 
  authorize('caregiver'), 
  patientController.list
);
```

### Password Security

#### Hashing Implementation
```javascript
// User model hook for automatic password hashing
User.addHook('beforeCreate', async (user) => {
  if (user.password) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
});

// Password validation method
User.prototype.validatePassword = async function(plainPassword) {
  return await bcrypt.compare(plainPassword, this.password);
};
```

### Input Validation & Sanitization

- **SQL Injection Prevention**: Sequelize parameterized queries
- **XSS Protection**: Output encoding for all user-generated content
- **Request Validation**: Express validator middleware on all endpoints
- **Rate Limiting**: Authentication endpoints limited to prevent brute force

### Environment Security

Required environment variables:
```bash
JWT_SECRET=your-cryptographically-secure-secret-key
DB_NAME=neuroease_db
DB_USER=neuroease_user
DB_PASSWORD=strong-database-password
DB_HOST=localhost
DB_PORT=5432
NODE_ENV=production
```

---

## 7. Development Setup

### Prerequisites
```bash
Node.js >= 16.0.0
PostgreSQL >= 14
npm >= 7.0.0
```

### Installation Steps

```bash
# Clone repository
git clone <repository-url>
cd neuroease-backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Initialize database
npm run db:create
npm run db:migrate
npm run db:seed  # Optional: Load test data

# Start development server
npm run dev
```

### Database Commands

```bash
# Create database
npm run db:create

# Run migrations
npm run db:migrate

# Rollback last migration
npm run db:migrate:undo

# Seed database with test data
npm run db:seed

# Reset database (drop all tables and re-migrate)
npm run db:reset
```

### Testing the API

```bash
# Health check
curl http://localhost:5001/api/health

# Register user
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123","name":"Test User","userType":"caregiver"}'

# Login
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123"}'
```

### Production Deployment

#### Environment Configuration
```bash
NODE_ENV=production
PORT=5001
JWT_SECRET=<secure-random-string-minimum-32-characters>
DB_HOST=<production-database-host>
DB_PORT=5432
DB_NAME=neuroease_production
DB_USER=<production-db-user>
DB_PASSWORD=<strong-production-password>
```

#### Process Management
```bash
# Using PM2
npm install -g pm2
pm2 start npm --name "neuroease-api" -- start
pm2 save
pm2 startup
```
