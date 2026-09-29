# Stage 1: Build the React application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json ./

# Install all dependencies including devDependencies for build
RUN npm ci

# Copy application source code
COPY . .

# Build production bundle with TypeScript check and Vite minification
RUN npm run build

# Stage 2: High-performance Nginx web server
FROM nginx:alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy custom Nginx configuration with dual-port support (80 and 3000), gzip & SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose both 80 and 3000 for seamless Coolify / Traefik proxy compatibility
EXPOSE 80 3000

# Container healthcheck (verifies both port 80 and 3000 with low startup grace period)
HEALTHCHECK --interval=10s --timeout=3s --start-period=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:80/healthz || wget --quiet --tries=1 --spider http://127.0.0.1:3000/healthz || exit 1

# Start nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
