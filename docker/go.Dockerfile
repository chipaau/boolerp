# Go dev image. Backend runs entirely in Docker (host Go not required).
FROM golang:1.27-alpine

RUN apk add --no-cache git

WORKDIR /w/apps/api
