# ============================================================================
# Multi-Stage Docker Build for Angular 18 SSR Application (rentals-ui)
# ============================================================================
# SECURITY & OPTIMIZATION NOTES:
# - Uses Alpine Linux for minimal image size (~170MB instead of ~900MB)
# - Non-root user execution (security best practice)
# - Separate build and runtime stages (reduces final image size significantly)
# - Clean npm install (ci) ensures reproducible builds
# - Proper environment variable handling for production
# ============================================================================

# ============================================================================
# STAGE 1: Build Stage (deps-and-build)
# ============================================================================
# Purpose: Compile TypeScript → Angular → SSR bundles with node_modules
# This stage is discarded after compilation, keeping prod image lean.
FROM node:20-alpine AS deps-and-build

# Set working directory
WORKDIR /app

# Install build dependencies (if needed for native modules like Mapbox)
# Alpine uses apk instead of apt-get
# RUN apk add --no-cache python3 make g++ (uncomment if native deps needed)

# Copy package management files first (Docker layer caching optimization)
COPY package*.json ./

# Clean install: Installs exact versions from package-lock.json
# Use 'ci' (clean install) for deterministic, reproducible builds
RUN npm ci --only=production

# Copy application source code
COPY . .

# Copy remaining dev dependencies for build process
# ATTN: This re-installs devDependencies needed for Angular build
RUN npm ci

# Build the Angular application with SSR configuration
# Outputs to: dist/rentals-ui/ (contains browser/ and server/ folders)
RUN npm run build

# ============================================================================
# STAGE 2: Production Runtime Stage (production)
# ============================================================================
# Purpose: Minimal production image with only runtime dependencies
# Final image size ~300-400MB (vs ~1.5GB with all build artifacts)
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=4000
# CRITICAL: Allow localhost for Docker/development environments
# In production behind a reverse proxy, set this to your domain(s)
ENV ALLOWED_HOSTS=localhost,localhost:4000,127.0.0.1
# Optional: Set the origin explicitly if behind a proxy
# ENV ORIGIN=http://localhost:4000

# Install runtime dependencies only (excludes devDependencies)
COPY package*.json ./
RUN npm ci --only=production

# Copy ONLY the compiled dist/ folder from the build stage
# This includes:
#   - dist/rentals-ui/browser/ (browser-side Angular app)
#   - dist/rentals-ui/server/ (server-side rendered bundles)
#   - dist/rentals-ui/server/server.mjs (Express SSR server)
COPY --from=deps-and-build /app/dist ./dist

# ============================================================================
# SECURITY: Run as non-root user
# ============================================================================
# Alpine's 'node' user has UID:GID 1000:1000 by default
USER node

# Expose the application port
EXPOSE 4000

# ============================================================================
# HEALTH CHECK (Optional but recommended)
# ============================================================================
# Allows Docker/Kubernetes to monitor app readiness
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# ============================================================================
# STARTUP COMMAND
# ============================================================================
# Runs the Express SSR server from the compiled bundle
# ATTN: Verify this path matches your angular.json project name "rentals-ui"
CMD ["node", "dist/rentals-ui/server/server.mjs"]
