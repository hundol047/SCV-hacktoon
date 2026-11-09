FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && node_modules/.bin/esbuild scripts/verify-bedrock-role.ts --bundle --platform=node --format=cjs --outfile=bedrock-role-probe.cjs
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/bedrock-role-probe.cjs ./bedrock-role-probe.cjs
USER node
EXPOSE 3000
CMD ["node","server.js"]
