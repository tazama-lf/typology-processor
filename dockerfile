FROM --platform=${TARGETPLATFORM:-linux/amd64} ghcr.io/openfaas/of-watchdog:0.8.4 as watchdog
FROM --platform=${TARGETPLATFORM:-linux/amd64} node:14-alpine as ship

ARG TARGETPLATFORM
ARG BUILDPLATFORM

COPY --from=watchdog /fwatchdog /usr/bin/fwatchdog
RUN chmod +x /usr/bin/fwatchdog

RUN addgroup -S app && adduser -S -g app app

RUN apk --no-cache add curl ca-certificates

# Turn down the verbosity to default level.
ENV NPM_CONFIG_LOGLEVEL warn

# Create a folder named function
RUN mkdir -p /home/app

# Wrapper/boot-strapper
WORKDIR /home/app

COPY ./package.json ./
COPY ./package-lock.json ./
COPY ./tsconfig.json ./
COPY ./global.d.ts ./

# Install dependencies
RUN npm install

COPY ./src ./src

# Build the project
RUN npm run build

# Environment variables for openfaas
ENV cgi_headers="true"
ENV fprocess="node ./build/index.js"
ENV mode="http"
ENV upstream_url="http://127.0.0.1:3000"

ENV exec_timeout="10s"
ENV write_timeout="15s"
ENV read_timeout="15s"

ENV prefix_logs="false"

ENV FUNCTION_NAME=typology-processor
ENV NODE_ENV=production
ENV PORT=3000
ENV CADP_ENDPOINT=http://gateway.openfaas:8080/function/off-channel-aggregation-decisioning-processor.openfaas-fn/execute

ENV REDIS_DB=0
ENV REDIS_AUTH=utiYxjU3gK
ENV REDIS_HOST=20.108.120.33
ENV REDIS_PORT=6379

ENV DATABASE_NAME="Configuration"
ENV DATABASE_URL="http://arango.development:8529"
ENV DATABASE_USER="root"
ENV DATABASE_PASSWORD='$!prAtHe>Qh5X9D3'
ENV COLLECTION_NAME="typologyExpression"

ENV APM_ACTIVE=true
ENV APM_SERVICE_NAME=typology-processor
ENV APM_URL=http://apm-server.development:8200
ENV APM_SECRET_TOKEN=""

ENV LOGSTASH_HOST=logstash.development
ENV LOGSTASH_PORT=8080

HEALTHCHECK --interval=60s CMD [ -e /tmp/.lock ] || exit 1

# Execute watchdog command
CMD ["fwatchdog"]
