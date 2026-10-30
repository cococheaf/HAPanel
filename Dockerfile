FROM --platform=$BUILDPLATFORM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html display.html ./
COPY src ./src
COPY public ./public
COPY tests ./tests
RUN npm test && npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HAPANEL_MODE=ingress HAPANEL_DATA_DIR=/data/hapanel
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 8099 8098
STOPSIGNAL SIGTERM
CMD ["node", "dist/server/index.js"]
