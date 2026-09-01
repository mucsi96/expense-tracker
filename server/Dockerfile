# Stage 1: Compile a GraalVM native image with Maven
FROM docker.io/library/maven:3-eclipse-temurin-21 AS maven
FROM ghcr.io/graalvm/native-image-community:25 AS build

COPY --from=maven /usr/share/maven /usr/share/maven
ENV PATH=/usr/share/maven/bin:$PATH

WORKDIR /workspace

# Copy POM and download dependencies (cached separately from source)
COPY pom.xml ./
RUN mvn dependency:go-offline -B -Dorg.slf4j.simpleLogger.log.org.apache.maven.cli.transfer.Slf4jMavenTransferListener=warn

# The Azure jars are code-signed, but Spring AOT generates classes into their
# packages; native-image refuses packages with mixed signer info, so strip the
# signature entries (they only served download verification, already done)
RUN microdnf install -y zip unzip && \
    find /root/.m2/repository/com/azure /root/.m2/repository/com/microsoft -name "*.jar" | \
    while read jar; do \
      if unzip -l "$jar" | grep -qE 'META-INF/[^/]+\.SF'; then \
        zip -qd "$jar" 'META-INF/*.SF' 'META-INF/*.RSA' 'META-INF/*.DSA' 'META-INF/*.EC'; \
      fi; \
    done

# Copy source code and build the native executable (Spring AOT + native-image)
COPY src ./src
RUN mvn -Pnative native:compile -DskipTests -B -Dorg.slf4j.simpleLogger.log.org.apache.maven.cli.transfer.Slf4jMavenTransferListener=warn

# Stage 2: Runtime image
FROM docker.io/library/debian:bookworm-slim

VOLUME /tmp

ARG SPRING_PROFILES_ACTIVE=prod

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=build /workspace/target/expense-tracker /app/expense-tracker

# Set environment variables
ENV SPRING_PROFILES_ACTIVE=${SPRING_PROFILES_ACTIVE}

# Run the application
ENTRYPOINT ["/app/expense-tracker", "-XX:MaximumHeapSizePercent=75", "-Djdk.httpclient.allowRestrictedHeaders=content-length"]
