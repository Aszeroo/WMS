FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci
RUN mkdir -p /data && chown node:node /data

FROM dependencies AS build
WORKDIR /app
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npm run generate && npm run build

FROM dependencies AS migration
WORKDIR /app
COPY prisma ./prisma
USER node

FROM build AS bootstrap
WORKDIR /app
RUN mkdir -p /data && chown node:node /data
USER node

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=dependencies /app/node_modules ./node_modules
RUN npm prune --omit=dev
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
RUN mkdir -p /data && chown -R node:node /app /data
USER node
EXPOSE 5000
CMD ["node", "dist/server.js"]
