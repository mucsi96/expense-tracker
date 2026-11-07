#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
POD_NAME="expense-tracker-test"
MAX_WAIT=120

if [ "${SKIP_BUILD:-}" = "1" ]; then
  echo "Skipping image build (SKIP_BUILD=1)..."
else
  echo "Building container images..."
  podman build \
    -t localhost/expense-tracker-server:test "$PROJECT_DIR/server" &
  server_build=$!
  (cd "$PROJECT_DIR/client" && npm ci && npm run lint && npm test && npm run build) &
  client_build=$!
  podman build -t localhost/expense-tracker-mock-exchange-rate:test "$PROJECT_DIR/mock_exchange_rate_server" &
  exchange_build=$!
  wait "$server_build"
  wait "$client_build"
  wait "$exchange_build"
fi

echo "Cleaning up existing pod..."
podman kube down "$PROJECT_DIR/test/test-pod.yaml" 2>/dev/null || true

echo "Starting pod..."
podman kube play "$PROJECT_DIR/test/test-pod.yaml"

container_state() {
  podman inspect "$1" \
    --format 'status={{.State.Status}} exit={{.State.ExitCode}} error={{.State.Error}}' \
    2>&1 || true
}

dump_logs() {
  for c in $CONTAINERS; do
    echo "$c" | grep -q "infra" && continue
    echo "=== $c === $(container_state "$c")"
    podman logs "$c" 2>&1 | tail -20
  done
}

wait_for_healthy() {
  local container="$1"
  echo "  Waiting for $container..."
  local elapsed=0
  # Run each container's healthcheck on demand instead of reading
  # .State.Health.Status: Podman 5 on GitHub runners never schedules or
  # records probe runs, so the status alone never becomes "healthy".
  until podman healthcheck run "$container" > /dev/null 2>&1; do
    # A container that has already exited is never going to pass its probe, and
    # its state carries the reason a crash or a failed exec leaves no logs.
    if [ "$(podman inspect "$container" --format '{{.State.Status}}' 2>/dev/null)" = "exited" ]; then
      echo "$container exited before becoming healthy: $(container_state "$container")"
      dump_logs
      exit 1
    fi
    if [ "$elapsed" -ge "$MAX_WAIT" ]; then
      echo "Timeout waiting for $container to become healthy: $(container_state "$container")"
      dump_logs
      exit 1
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  echo "  $container is healthy"
}

echo "Waiting for all containers to become healthy..."
CONTAINERS=$(podman pod inspect "$POD_NAME" --format '{{range .Containers}}{{.Name}} {{end}}')

for container in $CONTAINERS; do
  if echo "$container" | grep -q "infra"; then
    continue
  fi
  wait_for_healthy "$container"
done

# Exercise startup against an already migrated database as production does.
echo "Restarting the server against the migrated database..."
podman restart "$POD_NAME-server" > /dev/null
wait_for_healthy "$POD_NAME-server"

echo "All services are ready!"
