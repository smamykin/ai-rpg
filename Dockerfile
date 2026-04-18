# Stage 1: Build frontend
FROM node:24-alpine AS frontend-builder

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Build backend
FROM golang:1.26-alpine AS backend-builder

WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
RUN CGO_ENABLED=0 go build -o /server ./cmd/server

# Stage 3: Final image
FROM alpine:3.21

RUN apk add --no-cache ca-certificates

COPY --from=backend-builder /server /server
COPY --from=frontend-builder /app/dist /static

ENV PORT=8080
ENV DATA_DIR=/data
ENV STATIC_DIR=/static

EXPOSE 8080

VOLUME /data

CMD ["/server"]
