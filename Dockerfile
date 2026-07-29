#FROM node:20

#WORKDIR /app

#COPY package*.json ./

#RUN npm install

#COPY . .    

#EXPOSE 3000

#CMD ["npm", "run", "dev"]


# ============================
# Stage 1 - Builder
# ============================

FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# ============================
# Stage 2 - Runtime
# ============================

FROM node:20-slim AS runtime

WORKDIR /app

COPY --from=builder /app/package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/src/server.js ./
COPY --from=builder /app/src/app.js ./
COPY --from=builder /app/src/routes ./routes
COPY --from=builder /app/src/controllers ./controllers
COPY --from=builder /app/src/models ./models
COPY --from=builder /app/src/middleware ./middleware
COPY --from=builder /app/src/config ./config

EXPOSE 3000

CMD ["node", "server.js"]