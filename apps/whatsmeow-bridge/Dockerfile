FROM golang:1.22-alpine AS builder

RUN apk add --no-cache gcc musl-dev sqlite-dev git

WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download || true

COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-w -s" -o whatsmeow-bridge main.go

FROM alpine:3.19

RUN apk add --no-cache ca-certificates sqlite-libs tzdata

WORKDIR /app

COPY --from=builder /app/whatsmeow-bridge /app/whatsmeow-bridge

ENV PORT=8089
ENV DATA_PATH=/app/data

EXPOSE 8089

VOLUME ["/app/data"]

CMD ["/app/whatsmeow-bridge"]
