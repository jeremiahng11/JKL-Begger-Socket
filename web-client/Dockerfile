# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app

ARG VITE_SENTRY_DSN=""
ARG BRANCH_NAME=main
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    BRANCH_NAME=$BRANCH_NAME

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=5s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
