#!/bin/bash
set -e
echo "Building Hurix sandbox Docker images..."
docker build -t hurix-sandbox-python ./backend/docker/sandbox-python
docker build -t hurix-sandbox-node ./backend/docker/sandbox-node
echo "Sandbox images built successfully."
