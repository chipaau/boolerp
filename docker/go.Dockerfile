# Go dev image. Backend runs entirely in Docker (host Go not required).
# Using `go run` for now (fast, reliable). Hot-reload (air) can be added later via a prebuilt binary.
FROM golang:1.25-alpine

RUN apk add --no-cache git

WORKDIR /w/apps/api
