# Database Relationships

## Primary Relationships
1. **Users → Patients** (One-to-One)
    - One User of type 'patient' has one Patient profile
    - Foreign Key: `patients.user_id` → `users.id`

2. **Patients → Reminders** (One-to-Many)
    - One Patient can have many Reminders
    - Foreign Key: `reminders.patient_id` → `patients.id`

3. **Patients → GameSessions** (One-to-Many)
    - One Patient can have many GameSessions
    - Foreign Key: `game_sessions.patient_id` → `patients.id`

4. **Patients → LocationLogs** (One-to-Many)
    - One Patient can have many LocationLogs
    - Foreign Key: `location_logs.patient_id` → `patients.id`

5. **Patients → SafeZones** (One-to-Many)
    - One Patient can have multiple SafeZones
    - Foreign Key: `safe_zones.patient_id` → `patients.id`

## Indexes for Performance
- `users.email` (UNIQUE) - Fast login lookups
- `reminders.patient_id` - Quick reminder retrieval
- `reminders.scheduled_time` - Efficient scheduling queries
- `location_logs.patient_id + timestamp` - Fast location history