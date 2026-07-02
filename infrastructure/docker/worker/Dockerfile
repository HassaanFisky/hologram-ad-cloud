FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production

FROM base AS builder
COPY . .
RUN npm ci
RUN npm run build --workspace apps/worker

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/worker/dist ./dist
EXPOSE 4000
CMD ["node", "dist/main.js"]
