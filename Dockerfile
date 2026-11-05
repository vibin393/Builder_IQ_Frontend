# Frontend: Next.js 16 (React 19).
FROM node:22-slim

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# NEXT_PUBLIC_* values are inlined into the browser bundle at BUILD time, and the
# browser (not the container) calls the API — so this must be a URL reachable from
# the user's machine, i.e. the backend's published host port.
ARG NEXT_PUBLIC_API_URL=http://localhost:8700
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Install deps first for layer caching. The build tooling (Tailwind/PostCSS,
# TypeScript) is in devDependencies, so install everything — do NOT set
# NODE_ENV=production here or npm would skip them and the build would fail.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# App source + build (produces an optimized production build regardless of NODE_ENV).
COPY . .
RUN npm run build

# Production runtime only after the build is done.
ENV NODE_ENV=production
EXPOSE 4300

CMD ["npm", "run", "start"]
