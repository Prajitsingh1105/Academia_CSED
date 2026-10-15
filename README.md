# Academia IAM & Auth Microservice

An event-driven Identity and Access Management (IAM) & Authentication microservice built with **Node.js**, **Express.js**, **PostgreSQL**, and **JWT**.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |       Client / API Gateway            |
                      +---------------------------------------+
                                          |
                                          | REST (JSON)
                                          v
                      +---------------------------------------+
                      |         IAM & Auth Service            |
                      |   - Express.js Router & Controllers   |
                      |   - JWT & RBAC Middleware             |
                      |   - Password Hashing (bcrypt)         |
                      |   - Institutional Domain / OTP Guard  |
                      +-------------------+-------------------+
                                          |
                        +-----------------+-----------------+
                        |                                   |
                        v                                   v
             +--------------------+              +--------------------+
             | PostgreSQL Cluster |              | Event Bus / Broker |
             | - Users            |              | (Domain Events)    |
             | - Roles & Depts    |              | - auth.user.reg    |
             | - Token Blacklist  |              | - auth.user.login  |
             | - Password Resets  |              | - auth.pwd.reset   |
             +--------------------+              +--------------------+
```

---

## Microservice Features & Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register as `student` or `faculty`. Faculty is restricted via institutional email domain (e.g. `@academia.edu`) or OTP verification code. |
| `POST` | `/api/auth/login` | Public | Authenticates credentials with bcrypt and returns a signed JWT containing `userId` and `role`. |
| `POST` | `/api/auth/logout` | Authenticated | Revokes the current JWT by hashing and storing it into the PostgreSQL token revocation blacklist. |
| `POST` | `/api/auth/forgot-password` | Public | Generates a cryptographically secure reset token and triggers `auth.password.reset_requested` event. |
| `POST` | `/api/auth/reset-password` | Public | Validates reset token and updates the user's password. |
| `GET` | `/api/auth/profile` | Authenticated | Retrieves current authenticated user's profile. |
| `PUT` | `/api/auth/profile` | Authenticated | Updates current authenticated user's profile details. |
| `GET` | `/api/auth/faculty-only-resource` | Faculty | Example role-guarded route demonstrating RBAC middleware (`requireRoles('faculty')`). |

---

## Quickstart

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and set your PostgreSQL credentials:
```bash
cp .env.example .env
```

### 3. Run Database Migrations
```bash
npm run migrate
```

### 4. Start the Microservice
```bash
# Development (with hot reloading)
npm run dev

# Production
npm start
```

### 5. Run Unit & Integration Tests
```bash
npm test
```
