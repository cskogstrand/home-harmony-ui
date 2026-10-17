FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-alpine
RUN apk add --no-cache poppler-utils font-dejavu
WORKDIR /app
ENV DATA_DIR=/data
COPY package.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/zod ./node_modules/zod
COPY --from=build /app/node_modules/js-yaml ./node_modules/js-yaml
COPY --from=build /app/node_modules/argparse ./node_modules/argparse
COPY --from=build /app/node_modules/ws ./node_modules/ws
COPY shared ./shared
COPY server ./server
EXPOSE 8099
CMD ["node", "server/index.mjs"]
