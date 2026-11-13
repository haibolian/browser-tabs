#!/usr/bin/env bash
set -euo pipefail

for name in SSH_HOST SSH_PORT SSH_USER DEPLOY_PATH SSH_PRIVATE_KEY SSH_KNOWN_HOSTS GITHUB_SHA GITHUB_RUN_ID GITHUB_RUN_ATTEMPT RUNNER_TEMP; do
  if [[ -z ${!name:-} ]]; then
    printf 'Missing deployment setting: %s\n' "$name" >&2
    exit 1
  fi
done

[[ $SSH_HOST =~ ^[a-zA-Z0-9.:-]+$ ]] || { echo 'Invalid SSH_HOST' >&2; exit 1; }
[[ $SSH_USER =~ ^[a-z_][a-z0-9_-]*$ ]] || { echo 'Invalid SSH_USER' >&2; exit 1; }
[[ $SSH_PORT =~ ^[0-9]{1,5}$ ]] && (( 10#$SSH_PORT > 0 && 10#$SSH_PORT <= 65535 )) || { echo 'Invalid SSH_PORT' >&2; exit 1; }
[[ $DEPLOY_PATH =~ ^/[a-zA-Z0-9_./-]+$ && $DEPLOY_PATH != *'/../'* && $DEPLOY_PATH != */.. ]] || { echo 'Invalid DEPLOY_PATH' >&2; exit 1; }
[[ $GITHUB_SHA =~ ^[a-f0-9]{40}$ && $GITHUB_RUN_ID =~ ^[0-9]+$ && $GITHUB_RUN_ATTEMPT =~ ^[0-9]+$ ]] || { echo 'Invalid release identifier' >&2; exit 1; }

ssh_directory=$(mktemp -d "$RUNNER_TEMP/blank-backup-ssh.XXXXXX")
trap 'rm -f -- "$ssh_directory/key" "$ssh_directory/known_hosts" "$ssh_directory/config"; rmdir -- "$ssh_directory"' EXIT
umask 077
printf '%s\n' "$SSH_PRIVATE_KEY" | tr -d '\r' > "$ssh_directory/key"
printf '%s\n' "$SSH_KNOWN_HOSTS" | tr -d '\r' > "$ssh_directory/known_hosts"
unset SSH_PRIVATE_KEY SSH_KNOWN_HOSTS
ssh-keygen -y -P '' -f "$ssh_directory/key" > /dev/null

cat > "$ssh_directory/config" <<EOF
Host deployment
  HostName $SSH_HOST
  Port $SSH_PORT
  User $SSH_USER
  IdentityFile $ssh_directory/key
  UserKnownHostsFile $ssh_directory/known_hosts
  GlobalKnownHostsFile /dev/null
  StrictHostKeyChecking yes
  IdentitiesOnly yes
  BatchMode yes
  ConnectTimeout 15
  ServerAliveInterval 15
  ServerAliveCountMax 3
EOF

release_id="$GITHUB_SHA-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
incoming="$DEPLOY_PATH/incoming/$release_id.tar.gz"
ssh -F "$ssh_directory/config" deployment "mkdir -p -- '$DEPLOY_PATH/incoming'"
scp -F "$ssh_directory/config" browser-tabs-server.tar.gz "deployment:$incoming"
ssh -F "$ssh_directory/config" deployment "bash -s -- '$DEPLOY_PATH' '$release_id'" < deploy/remote-deploy.sh
