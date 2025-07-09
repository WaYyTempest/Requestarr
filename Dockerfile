FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install --include=dev

COPY src ./src

RUN npm run build

FROM node:20-alpine

RUN adduser -D -s /bin/sh requestarr

WORKDIR /srv/docker/requestarr

COPY package*.json ./

RUN npm install --only=production

COPY --from=builder /app/dist ./dist

ENV TZ=Europe/Paris
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN chown -R requestarr:requestarr /srv/docker/requestarr

USER requestarr

CMD ["npm", "run", "start"]