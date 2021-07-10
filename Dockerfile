FROM node:latest

ENV DEBIAN_FRONTEND=noninteractive
ARG YTKIT_CLI_VERSION=latest

RUN npm install --global ytkit@${YTKIT_CLI_VERSION}

RUN apt-get update && apt-get install jq
RUN apt-get autoremove --assume-yes \
  && apt-get clean --assume-yes \
  && rm -rf /var/lib/apt/lists/*

ENV YTKIT_CONTAINER_MODE true
ENV DEBIAN_FRONTEND=dialog
ENV SHELL /bin/bash
