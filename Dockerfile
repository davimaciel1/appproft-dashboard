# Build stage for React frontend
FROM node:18-alpine AS frontend-build

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --only=production

COPY client/ ./
RUN npm run build

# Production stage for Node.js backend
FROM node:18-alpine AS backend

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy backend package files
COPY server/package*.json ./server/
COPY package*.json ./

# Install backend dependencies
WORKDIR /app/server
RUN npm ci --only=production

# Copy backend source code
COPY server/ ./

# Copy built frontend from previous stage
COPY --from=frontend-build /app/client/build /app/server/public

# Copy environment file
COPY .env /app/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S appuser -u 1001
RUN chown -R appuser:nodejs /app
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/auth/login || exit 1

# Start the application
CMD ["node", "index.js"]