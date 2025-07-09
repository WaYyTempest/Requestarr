FROM node:20-alpine

RUN adduser -D -s /bin/sh requestarr

WORKDIR /srv/docker/requestarr

COPY package*.json ./
COPY tsconfig.json ./

USER root

RUN npm install

COPY src ./src

RUN npm run build:docker

ENV TZ=Europe/Paris
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN chown -R requestarr:requestarr /srv/docker/requestarr

USER requestarr

CMD ["npm", "run", "start"]