# Use Node.js LTS version as base image
FROM node:16-alpine

# Install necessary build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Create required directories
RUN mkdir -p public/uploads logs
RUN chmod 777 public/uploads logs

# Define environment variables with defaults
ENV PORT=3000
ENV NODE_ENV=production

# Expose the port the app runs on
EXPOSE 3000

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Set ownership of the application files
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Healthcheck to verify the application is running properly
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Define the command to run the app
CMD ["node", "src/server.js"]