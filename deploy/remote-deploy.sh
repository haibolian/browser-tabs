#!/usr/bin/env bash
set -euo pipefail
umask 022

[[ $# == 2 ]] || { echo 'Usage: remote-deploy.sh DEPLOY_PATH RELEASE_ID' >&2; exit 1; }
[[ $1 =~ ^/[a-zA-Z0-9_./-]+$ ]] || { echo 'DEPLOY_PATH must be an absolute path without spaces' >&2; exit 1; }
deploy_path=$(realpath -m -- "$1")
[[ $deploy_path != / ]] || { echo 'Cannot deploy into the filesystem root' >&2; exit 1; }
release_id=$2
[[ $release_id =~ ^[a-f0-9]{40}-[0-9]+-[0-9]+$ ]] || { echo 'Invalid release identifier' >&2; exit 1; }
release="$deploy_path/releases/$release_id"
archive="$deploy_path/incoming/$release_id.tar.gz"
current="$deploy_path/current"

for command in node pnpm curl systemctl flock; do
  command -v "$command" > /dev/null || { printf 'Missing server command: %s\n' "$command" >&2; exit 1; }
done
node -e 'if (Number(process.versions.node.split(".")[0]) < 24) process.exit(1)'
[[ $(systemctl show blank-backup --property=WorkingDirectory --value) == "$current" ]] || {
  echo 'Initialize the service with deploy/setup-server.sh before deploying.' >&2
  exit 1
}
[[ -f $archive ]] || { echo 'Uploaded deployment package is missing' >&2; exit 1; }
[[ ! -e $current || -L $current ]] || { echo 'The current path must be a symbolic link' >&2; exit 1; }

exec 9> "$deploy_path/.deploy.lock"
flock -n 9 || { echo 'Another deployment is running' >&2; exit 1; }
mkdir -p -- "$deploy_path/releases"
mkdir -- "$release"
tar -xzf "$archive" -C "$release"
cd "$release"
CI=true pnpm install --prod --frozen-lockfile
node --check server-dist/index.mjs

previous=''
if [[ -L $current ]]; then
  previous=$(readlink -f -- "$current")
  [[ -d $previous && $previous == "$deploy_path/releases/"* ]] || { echo 'Current release is outside the releases directory' >&2; exit 1; }
fi

activate() {
  ln -s -- "$1" "$deploy_path/.current-$release_id"
  mv -Tf -- "$deploy_path/.current-$release_id" "$current"
}

restart() {
  if (( EUID == 0 )); then
    systemctl restart blank-backup
  else
    sudo -n systemctl restart blank-backup
  fi
}

healthy() {
  systemctl is-active --quiet blank-backup &&
    curl --fail --silent --show-error --retry 12 --retry-delay 2 --retry-all-errors --max-time 3 \
      http://127.0.0.1:3001/api/v1/health | grep -Fxq '{"status":"ok"}'
}

activate "$release"
if restart && healthy; then
  printf 'Deployment succeeded: %s\n' "$release_id"
  rm -- "$archive"
else
  echo 'Deployment failed: service restart or health check failed.' >&2
  if [[ -n $previous ]]; then
    activate "$previous"
    if restart && healthy; then
      echo 'Restored the previous application release.' >&2
    else
      echo 'Previous application release also failed its health check; inspect journalctl -u blank-backup.' >&2
    fi
  fi
  exit 1
fi
