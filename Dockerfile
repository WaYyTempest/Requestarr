FROM oven/bun:alpine

RUN adduser -D -s /bin/sh requestarr

WORKDIR /srv/docker/requestarr

COPY package.json tsconfig.json ./

USER root

RUN bun install --frozen-lockfile

COPY src ./src
COPY . .

ENV TZ=Europe/Paris
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
  && echo $TZ > /etc/timezone

RUN chown -R requestarr:requestarr /srv/docker/requestarr
USER requestarr

CMD ["bun", "run", "start"]