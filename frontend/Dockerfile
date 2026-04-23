# -------- Eros Frontend (CRA build + nginx runtime) --------
# Stage 1: build the static bundle with Yarn (matches project convention).
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Build-time URL for the backend. Empty string = same-origin (the sibling
# nginx service proxies /api + /ws/* into the backend container). Override
# with docker compose build --build-arg REACT_APP_BACKEND_URL=https://your-api.tld
ARG REACT_APP_BACKEND_URL=""
ENV REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL}

# Install deps first for better caching.
COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile --network-timeout 120000

# Copy source and build.
COPY . .
RUN yarn build

# Stage 2: slim nginx serving the static bundle + proxying /api & /ws.
FROM nginx:1.27-alpine AS runtime

# Drop the default site.
RUN rm -f /etc/nginx/conf.d/default.conf

# Our SPA + reverse-proxy config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static bundle from the builder stage
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
