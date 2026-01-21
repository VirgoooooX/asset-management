FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS backend-build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm --prefix backend ci --omit=dev
COPY --from=backend-build /app/backend/build ./backend/build
COPY --from=frontend-build /app/dist ./dist
ENV PORT=8080
ENV DATA_DIR=/data
ENV FRONTEND_DIST_DIR=/app/dist
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD node -e "fetch('http://localhost:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/build/index.js"]

