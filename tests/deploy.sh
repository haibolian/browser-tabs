#!/usr/bin/env bash
set -euo pipefail

repository=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
temporary=$(mktemp -d "${TMPDIR:-/tmp}/blank-deploy-tests.XXXXXX")
trap '[[ $temporary == "${TMPDIR:-/tmp}/blank-deploy-tests."* && -d $temporary ]] && rm -rf -- "$temporary"' EXIT
mkdir -p "$temporary/bin" "$temporary/package/server-dist"
printf 'export const ready = true\n' > "$temporary/package/server-dist/index.mjs"
printf '{"name":"deployment-fixture","private":true}\n' > "$temporary/package/package.json"
tar -czf "$temporary/package.tar.gz" -C "$temporary/package" .

# Exercise deployment control flow with local substitutes for privileged/network commands.
cat > "$temporary/bin/systemctl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
case $1 in
  show) printf '%s/current\n' "$TEST_ROOT" ;;
  restart)
    printf '%s\n' "$(readlink -f "$TEST_ROOT/current")" >> "$TEST_ROOT/restarts"
    if [[ -n ${FAIL_RESTART:-} && $(readlink -f "$TEST_ROOT/current") == *"/$FAIL_RESTART" ]]; then exit 1; fi
    ;;
  is-active) exit 0 ;;
  *) exit 2 ;;
esac
EOF
cat > "$temporary/bin/pnpm" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[[ $* == 'install --prod --frozen-lockfile' ]] || exit 2
[[ ${FAIL_INSTALL:-0} == 0 ]] || exit 1
mkdir node_modules
EOF
cat > "$temporary/bin/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ -n ${FAIL_HEALTH:-} && $(readlink -f "$TEST_ROOT/current") == *"/$FAIL_HEALTH" ]]; then exit 22; fi
printf '{"status":"ok"}\n'
EOF
cat > "$temporary/bin/sudo" <<'EOF'
#!/usr/bin/env bash
[[ $1 == -n ]] || exit 2
shift
exec "$@"
EOF
cat > "$temporary/bin/flock" <<'EOF'
#!/usr/bin/env bash
exit "${FAIL_LOCK:-0}"
EOF
if [[ ${OS:-} == Windows_NT ]]; then
  # Directory junctions let Git Bash exercise link switching without Windows symlink privileges.
  cat > "$temporary/bin/ln" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[[ $# == 4 && $1 == -s && $2 == -- ]] || exit 2
export DEPLOY_TEST_LINK=$(cygpath -w "$4")
export DEPLOY_TEST_TARGET=$(cygpath -w "$3")
powershell.exe -NoProfile -NonInteractive -Command 'New-Item -ItemType Junction -Path $env:DEPLOY_TEST_LINK -Target $env:DEPLOY_TEST_TARGET | Out-Null'
EOF
fi
chmod +x "$temporary/bin/"*
export PATH="$temporary/bin:$PATH"

first=1111111111111111111111111111111111111111-1-1
second=2222222222222222222222222222222222222222-2-1
third=3333333333333333333333333333333333333333-3-1
fourth=4444444444444444444444444444444444444444-4-1
fifth=5555555555555555555555555555555555555555-5-1
export TEST_ROOT="$temporary/server"
mkdir -p "$TEST_ROOT/incoming"

upload() {
  cp "$temporary/package.tar.gz" "$TEST_ROOT/incoming/$1.tar.gz"
}

deploy() {
  bash "$repository/deploy/deploy.sh" "$TEST_ROOT" "$1"
}

upload "$first"
deploy "$first"
[[ $(readlink -f "$TEST_ROOT/current") == "$TEST_ROOT/releases/$first" ]]
[[ -d $TEST_ROOT/releases/$first/node_modules && ! -e $TEST_ROOT/incoming/$first.tar.gz ]]

upload "$second"
if FAIL_INSTALL=1 deploy "$second"; then echo 'Expected dependency installation to fail' >&2; exit 1; fi
[[ $(readlink -f "$TEST_ROOT/current") == "$TEST_ROOT/releases/$first" ]]
[[ $(wc -l < "$TEST_ROOT/restarts") == 1 ]]

upload "$third"
if FAIL_HEALTH=$third deploy "$third"; then echo 'Expected health check failure' >&2; exit 1; fi
[[ $(readlink -f "$TEST_ROOT/current") == "$TEST_ROOT/releases/$first" ]]
[[ $(wc -l < "$TEST_ROOT/restarts") == 3 ]]

upload "$fourth"
if FAIL_RESTART=$fourth deploy "$fourth"; then echo 'Expected restart failure' >&2; exit 1; fi
[[ $(readlink -f "$TEST_ROOT/current") == "$TEST_ROOT/releases/$first" ]]
[[ $(wc -l < "$TEST_ROOT/restarts") == 5 ]]

upload "$fifth"
if FAIL_LOCK=1 deploy "$fifth"; then echo 'Expected concurrent deployment to be rejected' >&2; exit 1; fi
[[ ! -e $TEST_ROOT/releases/$fifth ]]
deploy "$fifth"
[[ $(readlink -f "$TEST_ROOT/current") == "$TEST_ROOT/releases/$fifth" ]]
[[ -d $TEST_ROOT/releases/$first ]]

echo 'Verified deployment: first release, dependency failure, health failure rollback, restart failure rollback, deployment lock and successful update.'
