ARG BUILD_IMAGE=oven/bun
ARG RUN_IMAGE=oven/bun

FROM ${BUILD_IMAGE} AS builder
LABEL stage=build
# TS -> JS stage

WORKDIR /home/app
COPY ./src ./src
COPY ./package*.json ./
COPY ./tsconfig.json ./
# COPY ./.env.production ./
COPY bunfig.toml ./
ARG GH_TOKEN
RUN sed -i "s/\${GH_TOKEN}/$GH_TOKEN/g" ./bunfig.toml

RUN bun install

# APP
ENV FUNCTION_NAME=typology-processor
#ENV NODE_ENV=develop
ENV PORT=3000
ENV QUOTING=false
ENV APM_ACTIVE=false
ENV MAX_CPU=1

# REDIS
ENV REDIS_DB=0
ENV REDIS_AUTH=
ENV REDIS_SERVERS=
ENV REDIS_IS_CLUSTER=false

# NATS
ENV SERVER_URL=nats:4222
ENV STARTUP_TYPE=nats
ENV CONSUMER_STREAM=RuleResponse901
ENV PRODUCER_STREAM=TADP
ENV ACK_POLICY=Explicit
ENV PRODUCER_STORAGE=File
ENV PRODUCER_RETENTION_POLICY=Workqueue

# ARANGO
ENV DATABASE_URL=tcp://arango:8529
ENV DATABASE_USER=root
ENV DATABASE_PASSWORD=
ENV DATABASE_NAME=Configuration
ENV COLLECTION_NAME=typologyExpression
ENV CACHE_TTL=300

# Branches
ENV TMS_BRANCH=main
ENV CRSP_BRANCH=main
ENV TP_BRANCH=main
ENV TADP_BRANCH=main
ENV RULE_901_BRANCH=main

# Ports
ENV TMS_PORT=5000

# TLS
ENV NODE_TLS_REJECT_UNAUTHORIZED='0'

# Set healthcheck command
HEALTHCHECK --interval=60s CMD [ -e /tmp/.lock ] || exit 1

# Execute watchdog command
CMD ["bun", "src/index.ts"]