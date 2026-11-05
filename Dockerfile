# ==============================================================================
# SOIL — Plataforma B2B de Especificações Técnicas & Orçamentos Automotivos
# Container Runtime: Node.js 20 LTS (Alpine)
# ==============================================================================
FROM node:20-alpine AS base

WORKDIR /app

# Instala dependências do monorepo (workspaces: packages/shared, apps/api)
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN npm install

# Copia código-fonte dos pacotes, API e portal Web (SPA)
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY apps/web ./apps/web

# Valida tipagem estrita do monorepo durante o build
RUN npm run typecheck

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

CMD ["npm", "run", "start"]
