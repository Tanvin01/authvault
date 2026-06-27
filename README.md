# AuthVault — Production Auth Microservice

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)

A standalone authentication and authorisation microservice — JWT access/refresh tokens, OAuth 2.0, MFA, rate limiting, audit logs, and admin panel. Drop-in auth for any project.

## ✨ Features

- **JWT Auth** — Short-lived access tokens (15m) + long-lived refresh tokens (7d) stored in httpOnly cookies
- **OAuth 2.0** — GitHub, Google, Discord providers
- **MFA / 2FA** — TOTP-based (Google Authenticator) with backup codes
- **Rate Limiting** — Redis sliding-window rate limiting (per-IP and per-user)
- **Password Security** — Argon2id hashing (bcrypt fallback), breach detection via HaveIBeenPwned API
- **Session Management** — Multi-device session tracking with remote revocation
- **Audit Log** — Immutable audit trail: logins, failures, MFA events, password changes
- **RBAC** — Role and permission system with hierarchical roles
- **Email Verification** — Time-limited verification tokens with resend logic
- **Admin Panel** — Next.js admin UI for user management and audit log review

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 + TypeScript |
| Framework | Fastify (2x faster than Express) |
| Database | PostgreSQL + Prisma |
| Cache/Sessions | Redis |
| Password | Argon2id |
| OTP | otplib (TOTP) |
| Emails | Nodemailer + Resend |
| Container | Docker + Docker Compose |
| Orchestration | Kubernetes (k8s manifests included) |

## 🏗 Architecture

```
                    ┌─────────────────┐
  Client App  ───►  │  AuthVault API  │
                    │  (Fastify)      │
                    └────────┬────────┘
                             │
               ┌─────────────┼─────────────┐
               ▼             ▼             ▼
         PostgreSQL        Redis         Mailer
         (users,         (sessions,    (Resend)
         audit log)      rate limits)
```

### Token Flow

```
1. POST /auth/login       → returns { accessToken, user }
                            sets refresh token in httpOnly cookie

2. GET  /auth/refresh     → validates refresh token from cookie
                            returns new access token

3. POST /auth/logout      → revokes refresh token in Redis
                            clears cookie
```

## 📡 API Reference

```http
POST /auth/register          Create account
POST /auth/login             Authenticate
POST /auth/logout            Revoke session
GET  /auth/refresh           Rotate access token
GET  /auth/me                Get current user

POST /auth/mfa/setup         Generate TOTP secret + QR code
POST /auth/mfa/verify        Verify TOTP and activate MFA
POST /auth/mfa/disable       Disable MFA

GET  /auth/sessions          List active sessions
DELETE /auth/sessions/:id    Revoke specific session

GET  /admin/users            List users (admin only)
GET  /admin/audit-log        Audit trail (admin only)
```

## 🐳 Docker

```bash
git clone https://github.com/Tanvin01/authvault.git
cd authvault
cp .env.example .env
docker-compose up -d
```

```yaml
# docker-compose.yml
services:
  api:
    build: .
    ports: ["4000:4000"]
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/authvault
      REDIS_URL: redis://redis:6379
    depends_on: [db, redis]
  db:
    image: postgres:16-alpine
  redis:
    image: redis:7-alpine
```

## ☸️ Kubernetes

```bash
kubectl apply -f k8s/
```

Includes: Deployment, Service, HPA (auto-scaling), ConfigMap, Secret, and Ingress manifests.

## 🔒 Security Practices

- No secrets in environment variables committed to git
- Helmet.js security headers
- CORS allowlist
- SQL injection prevention via Prisma parameterised queries
- Refresh tokens rotated on every use (rotation + reuse detection)
- Failed login attempts trigger exponential backoff
