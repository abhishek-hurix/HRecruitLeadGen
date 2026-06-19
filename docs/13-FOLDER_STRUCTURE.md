# Project Folder Structure

```
hurix-talent-platform/
├── docs/                          # All documentation (this folder)
├── frontend/
│   ├── public/
│   │   └── hurix-logo.png
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── types/
│   │   └── utils/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── Dockerfile
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── types/
│   ├── docker/
│   ├── uploads/
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── scripts/
│   ├── backup-db.sh
│   ├── init-production.sh
│   └── ...
├── docker-compose.prod.yml
├── .env.example
└── README.md
```
