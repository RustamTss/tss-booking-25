FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server .

FROM gcr.io/distroless/base-debian12
WORKDIR /app
COPY --from=builder /app/server /app/server
ENV APP_PORT=8090
EXPOSE 8090
CMD ["/app/server"]

