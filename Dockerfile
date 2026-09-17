FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci
COPY src ./src
RUN npx esbuild src/server/standalone.ts --bundle --platform=node --format=cjs --packages=external --outfile=server.cjs
RUN npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production CONSTRUTEC_API_HOST=0.0.0.0 CONSTRUTEC_API_PORT=8080
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server.cjs ./server.cjs
USER node
EXPOSE 8080
CMD ["node", "server.cjs"]
