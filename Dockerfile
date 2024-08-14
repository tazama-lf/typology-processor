# SPDX-License-Identifier: Apache-2.0

ARG BUILD_IMAGE=node:20-bullseye
ARG RUN_IMAGE=gcr.io/distroless/nodejs20-debian11:nonroot

FROM ${BUILD_IMAGE} AS builder
LABEL stage=build
# TS -> JS stage

WORKDIR /home/app
COPY ./src ./src
COPY ./package*.json ./
COPY ./tsconfig.json ./
COPY .npmrc ./
ARG GH_TOKEN

RUN npm ci --ignore-scripts
RUN npm run build

FROM ${BUILD_IMAGE} AS dep-resolver
LABEL stage=pre-prod
# To filter out dev dependencies from final build

COPY package*.json ./
COPY .npmrc ./
ARG GH_TOKEN
RUN npm ci --omit=dev --ignore-scripts

FROM ${RUN_IMAGE} AS run-env
USER nonroot

WORKDIR /home/app
COPY --from=dep-resolver /node_modules ./node_modules
COPY --from=builder /home/app/build ./build
COPY package.json ./
COPY deployment.yaml ./
COPY service.yaml ./

# Turn down the verbosity to default level.
ENV NPM_CONFIG_LOGLEVEL warn

ENV mode="http"
ENV upstream_url="http://127.0.0.1:3000"
ENV prefix_logs="false"
ENV FUNCTION_NAME=typology-processor
ENV NODE_ENV=production
ENV INTERDICTION_ENDPOINT=
ENV CACHE_ENABLED=
ENV MAX_CPU=

#Redis
ENV CACHE_TTL=30
ENV REDIS_DB=0
ENV REDIS_AUTH=
ENV REDIS_SERVERS=
ENV REDIS_IS_CLUSTER=

#Nats
ENV STARTUP_TYPE=nats
ENV SERVER_URL=0.0.0.0:4222
ENV ACK_POLICY=Explicit
ENV PRODUCER_STORAGE=File
ENV PRODUCER_RETENTION_POLICY=Workqueue

#Database
ENV DATABASE_NAME=configuration
ENV DATABASE_URL=
ENV DATABASE_USER=root
ENV DATABASE_PASSWORD=
ENV DATABASE_CERT_PATH=

# Alert
ENV SUPPRESS_ALERTS=false

# Apm
ENV APM_ACTIVE=true
ENV APM_SERVICE_NAME=typology-processor
ENV APM_URL=http://apm-server.development.svc.cluster.local:8200/
ENV APM_SECRET_TOKEN=

# Logstash
ENV LOGSTASH_HOST=logstash.development.svc.cluster.local
ENV LOGSTASH_PORT=8080
ENV LOGSTASH_LEVEL='info'
ENV SIDECAR_HOST=0.0.0.0:5000

# Set healthcheck command
HEALTHCHECK --interval=60s CMD [ -e /tmp/.lock ] || exit 1
EXPOSE 4222

# Execute watchdog command
CMD ["build/index.js"]
