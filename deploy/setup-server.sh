#!/usr/bin/env bash
set -euo pipefail

[[ $EUID == 0 && $# == 2 ]] || { echo 'Usage: sudo bash setup-server.sh DEPLOY_PATH SSH_USER' >&2; exit 1; }
[[ $1 =~ ^/[a-zA-Z0-9_./-]+$ && $2 =~ ^[a-z_][a-z0-9_-]*$ ]] || { echo 'Invalid deployment path or SSH user' >&2; exit 1; }
deploy_path=$(realpath -m -- "$1")
[[ $deploy_path != / ]] || { echo 'Cannot deploy into the filesystem root' >&2; exit 1; }
deploy_user=$2
deploy_group=$(id -gn "$deploy_user")
directory=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

if ! id blank-backup > /dev/null 2>&1; then
  useradd --system --user-group --home-dir /var/lib/blank-backup --no-create-home --shell /usr/sbin/nologin blank-backup
fi
install -d -m 755 -o "$deploy_user" -g "$deploy_group" "$deploy_path" "$deploy_path/releases" "$deploy_path/incoming"
sed "s|/opt/browser-tabs|$deploy_path|g" "$directory/blank-backup.service" > /etc/systemd/system/blank-backup.service
chmod 644 /etc/systemd/system/blank-backup.service
if [[ ! -e /etc/blank-backup.env ]]; then
  install -m 600 "$directory/server.env.example" /etc/blank-backup.env
fi

if [[ $deploy_user != root ]]; then
  sudoers_file=$(mktemp)
  trap 'rm -f -- "$sudoers_file"' EXIT
  printf '%s ALL=(root) NOPASSWD: /usr/bin/systemctl restart blank-backup\n' "$deploy_user" > "$sudoers_file"
  visudo -cf "$sudoers_file"
  install -m 440 "$sudoers_file" /etc/sudoers.d/blank-backup-deploy
fi
systemctl daemon-reload
systemctl enable blank-backup
echo 'Service initialized. Fill /etc/blank-backup.env, then deploy a release manually or through GitHub Actions.'
