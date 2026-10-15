# Backend for the demo — Node 24 + tsx + fastembed (ONNX) + node:sqlite.
# The KB index is built at image build time so the container starts ready.
FROM node:24-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src
COPY data/seed-docs ./data/seed-docs
COPY data/mock ./data/mock
COPY public ./public
RUN npm run seed

ENV NODE_ENV=production PORT=8080
EXPOSE 8080
# tsx runs TypeScript directly — no build step needed
CMD ["npx", "tsx", "src/server.ts"]
