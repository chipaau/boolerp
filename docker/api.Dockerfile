FROM golang:1.27-alpine AS build
WORKDIR /w/apps/api
COPY apps/api/go.mod ./
COPY apps/api/ ./
RUN CGO_ENABLED=0 go build -buildvcs=false -o /out/api ./cmd/api
RUN CGO_ENABLED=0 go build -buildvcs=false -o /out/migrate ./cmd/migrate

FROM alpine:3.22
RUN apk add --no-cache ca-certificates wget
COPY --from=build /out/api /usr/local/bin/api
COPY --from=build /out/migrate /usr/local/bin/migrate
ENTRYPOINT ["/usr/local/bin/api"]
