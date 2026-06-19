# Non-Functional Requirements

## Performance
- API response time P95 < 500ms (excluding code execution)
- Code execution timeout: 10 seconds per run
- Support 50 concurrent assessment sessions (MVP)
- Page load < 2s on 4G connection

## Scalability
- Stateless API servers behind Nginx load balancer
- PostgreSQL connection pooling (Prisma)
- Horizontal scaling path for API and sandbox workers

## Security
- JWT with HS256/RS256 signing, short-lived admin tokens
- bcrypt password hashing (admin)
- Helmet.js security headers
- Rate limiting on registration and auth endpoints
- File upload validation (MIME, extension, size)
- SQL injection prevention via Prisma ORM
- XSS prevention via React escaping + CSP headers
- CORS restricted to frontend origin
- Docker sandbox: `--network none`, read-only root, resource limits

## Reliability
- Database backups daily (documented strategy)
- Graceful shutdown handling
- Health check endpoints for orchestration

## Maintainability
- TypeScript throughout
- Modular service architecture with interfaces for storage/email
- Environment-based configuration
- Structured logging (Winston)

## Usability
- Premium executive UI with Hurix branding
- Fully responsive (mobile, tablet, desktop)
- Accessible form labels and error messages
- Clear progress indicators during assessment

## Compliance & Audit
- Audit log for admin actions
- Candidate data retention policy (configurable)
- Resume storage with access control (admin only)

## Deployment
- Docker + Docker Compose for VPS
- Nginx reverse proxy with SSL termination
- Environment variable configuration
- Zero-downtime deployment path documented

## Monitoring
- `/health` and `/ready` endpoints
- Structured JSON logs
- Error tracking integration path (Sentry-ready)
