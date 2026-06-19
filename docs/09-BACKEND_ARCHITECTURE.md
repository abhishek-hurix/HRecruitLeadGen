# Backend Architecture

```
backend/
├── src/
│   ├── index.ts                 # Entry point
│   ├── app.ts                   # Express app setup
│   ├── config/
│   │   ├── index.ts             # Env config
│   │   └── database.ts          # Prisma client
│   ├── middleware/
│   │   ├── auth.ts              # JWT verification (candidate + admin)
│   │   ├── validate.ts          # Zod validation
│   │   ├── rateLimit.ts
│   │   ├── errorHandler.ts
│   │   └── upload.ts            # Multer config
│   ├── routes/
│   │   ├── index.ts
│   │   ├── register.routes.ts
│   │   ├── verify.routes.ts
│   │   ├── assessment.routes.ts
│   │   ├── admin.routes.ts
│   │   └── health.routes.ts
│   ├── controllers/
│   │   ├── register.controller.ts
│   │   ├── verify.controller.ts
│   │   ├── assessment.controller.ts
│   │   └── admin.controller.ts
│   ├── services/
│   │   ├── registration.service.ts
│   │   ├── token.service.ts
│   │   ├── assessment.service.ts
│   │   ├── execution.service.ts
│   │   ├── evaluation.service.ts
│   │   ├── email/
│   │   │   ├── email.interface.ts
│   │   │   ├── smtp.provider.ts
│   │   │   └── resend.provider.ts
│   │   ├── storage/
│   │   │   ├── storage.interface.ts
│   │   │   ├── local.provider.ts
│   │   │   └── s3.provider.ts
│   │   └── admin.service.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── jwt.ts
│   │   └── validation.ts
│   └── types/
│       └── express.d.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── docker/
│   ├── sandbox-python/
│   │   └── Dockerfile
│   └── sandbox-node/
│       └── Dockerfile
├── uploads/                     # Local resume storage
├── package.json
├── tsconfig.json
└── Dockerfile
```

## Layer Responsibilities

| Layer | Responsibility |
|-------|----------------|
| Routes | HTTP mapping, middleware chain |
| Controllers | Request/response handling, status codes |
| Services | Business logic, orchestration |
| Prisma | Data access |
| Execution | Docker sandbox orchestration |

## Dependency Injection Pattern
Services instantiated as singletons, imported where needed. Future: DI container.

## Error Handling
Custom `AppError` class with status codes. Global error handler returns consistent JSON:
```json
{ "success": false, "message": "...", "errors": [] }
```
