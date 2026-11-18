# Academia Unified API Gateway

**Port**: `8000` (Configurable via `PORT` or `GATEWAY_PORT`)  
**Architecture**: Reverse Proxy & Routing Layer with Request Correlation, JWT Context Enrichment, and Aggregated Health Probes.

---

## Capabilities & Responsibilities

1. **Unified Front Door**: Eliminates port fragmentation by exposing all institutional microservices under a single host and port (`http://localhost:8000`).
2. **Reverse Proxying**: Powered by `http-proxy-middleware`, streaming requests directly to downstream microservices with zero buffering (ensuring fast multipart file and assignment PDF uploads).
3. **WebSocket Pass-Through**: Routes live Socket.IO handshakes (`/socket.io`) directly to Module 4 (Notification & Chat Service).
4. **Distributed Request Tracing**: Injects unique `x-request-id` headers into every inbound request and forwards them downstream for end-to-end auditability.
5. **Gateway Auth Enrichment**: Transparently inspects JWT bearer tokens and decorates downstream headers with `x-user-id`, `x-user-role`, `x-user-name`, and `x-user-email`.
6. **Aggregated System Health**: `GET /health` asynchronously pings all 4 downstream microservices and returns a comprehensive health status dashboard.
7. **Rate Limiting & Helmet Security**: Defends against DDoS and abuse with IP-based window throttling and hardened HTTP security headers.

---

## Route Matrix

| Route Pattern | Target Service | Module | Description |
| :--- | :--- | :---: | :--- |
| `GET /` or `GET /api` | *Internal (Gateway)* | Gateway | Interactive routing directory catalog |
| `GET /health` | *Internal (Gateway)* | Gateway | Aggregated health check of all microservices |
| `/api/auth/*` | `http://localhost:4000` | Module 1 | Login, registration, OTP email verification, password reset |
| `/api/users/*` | `http://localhost:4000` | Module 1 | User profile and account management |
| `/api/classrooms/*` | `http://localhost:7000` | Module 2 | Course creation, enrollment join codes (`ICS-4163`) |
| `/api/assignments/*` | `http://localhost:7000` | Module 2 | Deliverables, deadlines, rubric definitions |
| `/api/submissions/*` | `http://localhost:7000` | Module 2 & 3 | PDF/typed submissions, Gemini OCR, Plagiarism radar |
| `/api/materials/*` | `http://localhost:7000` | Module 2 | Lecture notes, syllabus handouts, lab attachments |
| `/api/announcements/*`| `http://localhost:7000` | Module 2 | Subject stream notices & broadcasts |
| `/api/chat/*` | `http://localhost:5001` | Module 4 | Subject discussion channels & messaging history |
| `/api/notifications/*`| `http://localhost:5001` | Module 4 | Real-time notifications and alerts |
| `/socket.io/*` (WS) | `ws://localhost:5001` | Module 4 | Live Socket.IO WebSocket bi-directional transport |
| `/api/attendance/*` | `http://localhost:6500` | Module 5 | Daily roll call registers, 75% safe-leave calculator |
| `/api/marks/*` | `http://localhost:6500` | Module 5 | Academic gradebook, midterm & endsem evaluation |
| `/api/analytics/*` | `http://localhost:6500` | Module 5 | Class histograms, at-risk student detection |

---

## Quick Start

```bash
# Navigate to the API gateway directory
cd api-gateway

# Install dependencies
npm install

# Start the gateway in development mode
npm start
```

Or start the entire ecosystem via the root orchestrator:
```bash
node start-all.cjs
```
