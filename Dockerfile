ARG BUILD_IMAGE=oven/bun
ARG RUN_IMAGE=oven/bun

FROM ${BUILD_IMAGE} AS builder
LABEL stage=build
WORKDIR /home/app
COPY ./src ./src
COPY ./package*.json ./
COPY ./tsconfig.json ./
# COPY ./.env.production ./
COPY bunfig.toml ./
ARG GH_TOKEN
RUN sed -i "s/\${GH_TOKEN}/$GH_TOKEN/g" ./bunfig.toml

RUN bun install

# Turn down the verbosity to default level.
ENV NPM_CONFIG_LOGLEVEL warn

ENV mode="http"
ENV upstream_url="http://127.0.0.1:3000"
ENV prefix_logs="false"
ENV FUNCTION_NAME=typology-processor-rel-1-0-0
ENV NODE_ENV=production
ENV CMS_ENDPOINT=
ENV CACHE_ENABLED=

#Redis
ENV CACHE_TTL=30
ENV REDIS_DB=0
ENV REDIS_AUTH=
ENV REDIS_SERVERS=
ENV REDIS_IS_CLUSTER=

#Nats
ENV STARTUP_TYPE=nats
ENV PRODUCER_STREAM=
ENV CONSUMER_STREAM=
ENV STREAM_SUBJECT=
ENV SERVER_URL=0.0.0.0:4222
ENV ACK_POLICY=Explicit
ENV PRODUCER_STORAGE=File
ENV PRODUCER_RETENTION_POLICY=Workqueue

#Database
ENV DATABASE_NAME=Configuration
ENV DATABASE_URL=
ENV DATABASE_USER=root
ENV DATABASE_PASSWORD=
ENV DATABASE_CERT_PATH=
ENV COLLECTION_NAME=typologyExpression

# Apm
ENV APM_ACTIVE=true
ENV APM_SERVICE_NAME=typology-processor
ENV APM_URL=http://apm-server.development.svc.cluster.local:8200/
ENV APM_SECRET_TOKEN=

# Logstash
ENV LOGSTASH_HOST=logstash.development.svc.cluster.local
ENV LOGSTASH_PORT=8080
ENV LOGSTASH_LEVEL='info'

# Set healthcheck command
HEALTHCHECK --interval=60s CMD [ -e /tmp/.lock ] || exit 1
EXPOSE 4222

# Execute watchdog command
CMD ["bun", "src/index.ts"]
