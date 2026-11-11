#!/usr/bin/env bash
# Never delete volumes, application containers, environment files or user data.
set -euo pipefail
root=$(sudo -n docker info --format '{{.DockerRootDir}}')
if [[ "${1:-}" == '--clean' ]]; then
  echo 'Removing unused build cache and unreferenced Bopok images.'
  sudo -n docker builder prune -af
  # No --force: Docker refuses to remove images referenced by any container.
  while IFS= read -r image; do
    [[ -n "$image" ]] || continue
    if [[ -z "$(sudo -n docker ps -aq --filter "ancestor=$image")" ]]; then
      sudo -n docker image rm "$image" || true
    fi
  done < <(sudo -n docker image ls --format '{{.Repository}}:{{.Tag}}' 'yeohaengit-preview:*')
fi
sudo -n df -h "$root" /tmp
sudo -n df -i "$root" /tmp
# Reserve room for dependencies, intermediate layers and the existing live image.
available=$(sudo -n df -Pk "$root" | awk 'END {print $4}')
inodes=$(sudo -n df -Pi "$root" | awk 'END {print $4}')
tmp_available=$(df -Pk /tmp | awk 'END {print $4}')
if (( available < 4194304 || inodes < 150000 || tmp_available < 524288 )); then
  echo 'Insufficient build space: need at least 4 GiB and 150,000 free inodes on Docker storage, and 512 MiB in /tmp.'
  echo 'The current app has not been stopped. Expand the EC2 EBS volume and filesystem (30 GiB total is a practical starting point), then retry.'
  sudo -n docker system df
  exit 1
fi
