FROM alpine:3.19 AS downloader

ARG PB_VERSION=0.25.9
ARG TARGETARCH=amd64

RUN apk add --no-cache wget unzip ca-certificates

RUN wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" \
    -O /tmp/pocketbase.zip \
    && unzip /tmp/pocketbase.zip -d /tmp/pocketbase \
    && rm /tmp/pocketbase.zip

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

ENV TZ=America/Argentina/Buenos_Aires

WORKDIR /app

COPY --from=downloader /tmp/pocketbase/pocketbase /app/pocketbase
RUN chmod +x /app/pocketbase

COPY pb_hooks/ /app/pb_hooks/
COPY pb_public/ /app/pb_public/

EXPOSE 8090

CMD ["/app/pocketbase", "serve", "--http=0.0.0.0:8090"]
