# Go dev image. Backend runs entirely in Docker (host Go not required).
FROM golang:1.27-alpine

RUN apk add --no-cache git

COPY apps/api/go.mod apps/api/go.sum /tmp/api-module/
RUN cd /tmp/api-module && go mod download

WORKDIR /w/apps/api
