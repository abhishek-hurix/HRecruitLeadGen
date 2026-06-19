FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma/
RUN mkdir -p uploads/resumes
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && if [ \"${INIT_DB_ON_START:-true}\" = \"true\" ]; then npm run prisma:seed; fi && node dist/index.js"]
