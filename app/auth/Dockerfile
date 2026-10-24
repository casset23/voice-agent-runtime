FROM node:24-slim AS base
WORKDIR /app

# ---- Dependencies Stage ----
# Install only dependencies to leverage Docker cache
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm fetch

# ---- Build Stage ----
# Build the application
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm install -g pnpm && pnpm install --frozen-lockfile && pnpm run build

# ---- Production Stage ----
# Use a distroless image for a minimal and secure final image
FROM gcr.io/distroless/nodejs24-debian12:nonroot AS production
WORKDIR /app
# Default port, can be overridden by ENV
ENV PORT=3000

# Copy only the necessary artifacts from the build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

EXPOSE 3000
# The distroless image has 'node' as the entrypoint
# 命名规则有区别
CMD [ "dist/index.js" ]