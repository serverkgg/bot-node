FROM node:24-bookworm-slim

ARG BRIDGE_VERSION

LABEL gg.serverk.bridge.version="${BRIDGE_VERSION}"

LABEL org.opencontainers.image.source="https://github.com/serverkgg/bot-node"

COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      tini ca-certificates tzdata git util-linux python3 make g++ ffmpeg; \
    rm -rf /var/lib/apt/lists/*; \
    if getent passwd 1000 > /dev/null; then \
      userdel -r "$(getent passwd 1000 | cut -d: -f1)"; \
    fi; \
    if getent group 1000 > /dev/null; then \
      groupdel "$(getent group 1000 | cut -d: -f1)"; \
    fi; \
    groupadd -g 1000 container; \
    useradd -M -d /home/container -u 1000 -g 1000 -s /usr/sbin/nologin container; \
    mkdir -p /home/container /serverk/run; \
    ln -s /usr/local/bin/bun /usr/local/bin/bunx; \
    corepack enable; \
    node --version; \
    npm --version; \
    bun --version; \
    bunx --version; \
    git --version

ENV TZ=UTC \
    HOME=/home/container \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0

COPY dist/bridge /serverk/bridge

COPY image/launcher.mjs image/git-askpass image/detect.json /serverk/

RUN chmod 0755 /serverk/bridge /serverk/git-askpass; \
    chmod 0644 /serverk/launcher.mjs /serverk/detect.json

WORKDIR /home/container

ENTRYPOINT ["/usr/bin/tini", "--", "/serverk/bridge"]
