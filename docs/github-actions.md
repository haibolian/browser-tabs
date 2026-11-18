# GitHub Actions 自动部署

日常只需提交代码并推送到 `main`：

**检查后端 → 打包 → SSH 上传 → 服务器安装依赖 → 重启服务。**

工作流位于 `.github/workflows/deploy.yml`，全部步骤在同一个任务中完成。PR 执行后端检查和打包验证；推送到 `main` 后继续上传部署。也可以在 Actions 的 **Check and deploy backend → Run workflow** 中选择 `main` 手动运行。

日常部署只涉及两处：`.github/workflows/deploy.yml` 负责检查、打包和 SSH 上传，`deploy/deploy.sh` 负责服务器安装依赖、切换版本、重启及失败回退。部署控制流测试和后端包验证集中在 `tests/`。

服务器沿用 `/etc/blank-backup.env` 中的配置和 `/var/lib/blank-backup` 中的数据库。下面的仓库参数和服务器初始化只需配置一次。

## 仓库参数

打开仓库 **Settings → Secrets and variables → Actions**。

在 **Secrets → New repository secret** 添加：

| 名称              | 内容                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------- |
| `SSH_PRIVATE_KEY` | 部署私钥的完整内容，包括 BEGIN/END 行；对应公钥已加入服务器部署账户的 `authorized_keys` |
| `SSH_KNOWN_HOSTS` | 服务器的完整 SSH known_hosts 条目，用于校验主机身份                                     |

在 **Variables → New repository variable** 添加：

| 名称          | 内容                                         |
| ------------- | -------------------------------------------- |
| `SSH_HOST`    | 服务器 IP 或域名，不带 `https://`            |
| `SSH_USER`    | 已配置公钥的 SSH 用户名                      |
| `SSH_PORT`    | SSH 端口；不填时为 `22`                      |
| `DEPLOY_PATH` | 服务器部署目录；不填时为 `/opt/browser-tabs` |

`SSH_KNOWN_HOSTS` 使用服务器主机公钥，与部署账户的登录公钥是两把不同的钥匙。可以在可信的服务器控制台读取 `/etc/ssh/ssh_host_ed25519_key.pub`，将其中的 `ssh-ed25519` 和后面的 Base64 公钥组成条目：

```text
# 22 端口
服务器IP或域名 ssh-ed25519 服务器主机公钥
# 非 22 端口，例如 2222
[服务器IP或域名]:2222 ssh-ed25519 服务器主机公钥
```

只填写与实际端口对应的一行，主机名必须与 `SSH_HOST` 一致。主机指纹 `SHA256:...` 不能代替完整条目。

## 服务器初始化（一次）

先按 [Debian 12 部署文档](deploy-debian12.md) 安装 Node.js 24、pnpm 11.25.0，并配置 Nginx 和 HTTPS。自动部署使用 `/etc/blank-backup.env`，数据库放在 `/var/lib/blank-backup`；默认后端端口为 `3001`。

将 `deploy/blank-backup.service` 和 `deploy/server.env.example` 上传到服务器 `/tmp/`，然后在 root shell 执行。将下面的路径、部署用户名改为与仓库 Variables 一致：

```bash
deploy_path=/opt/browser-tabs
deploy_user=root

id blank-backup >/dev/null 2>&1 || useradd --system --user-group --home-dir /var/lib/blank-backup --no-create-home --shell /usr/sbin/nologin blank-backup
install -d -m 755 -o "$deploy_user" -g "$(id -gn "$deploy_user")" "$deploy_path" "$deploy_path/releases" "$deploy_path/incoming"
sed "s|/opt/browser-tabs|$deploy_path|g" /tmp/blank-backup.service > /etc/systemd/system/blank-backup.service
chmod 644 /etc/systemd/system/blank-backup.service
if [[ ! -e /etc/blank-backup.env ]]; then
  install -m 600 /tmp/server.env.example /etc/blank-backup.env
fi

if [[ $deploy_user != root ]]; then
  sudoers_file=$(mktemp)
  printf '%s ALL=(root) NOPASSWD: /usr/bin/systemctl restart blank-backup\n' "$deploy_user" > "$sudoers_file"
  visudo -cf "$sudoers_file"
  install -m 440 "$sudoers_file" /etc/sudoers.d/blank-backup-deploy
  rm -f -- "$sudoers_file"
fi

systemctl daemon-reload
systemctl enable blank-backup
nano /etc/blank-backup.env
```

部署用户负责上传和安装依赖，服务以 `blank-backup` 账户运行。非 root 部署用户获得免密重启该服务的权限。第一次工作流部署成功后服务开始运行。

环境文件中填写 GitHub OAuth 的 Client ID、Secret 和 HTTPS 回调域名；GitHub OAuth 后台填写同一个回调地址。当前插件固定连接 `https://tabsapi.lianhb.site`，回调地址为 `https://tabsapi.lianhb.site/api/v1/auth/github/callback`。这些配置留在服务器，Actions 不需要这些值。健康检查使用 `http://127.0.0.1:3001/api/v1/health`，因此保持 `PORT=3001`。

如果之前直接解压到 `/opt/browser-tabs` 手动部署，完成上述初始化后再运行首次自动部署。服务入口为 `/opt/browser-tabs/current/server-dist/index.mjs`，数据库继续使用环境文件指定的位置。

## 发布过程

1. GitHub 安装依赖，执行 `pnpm server:check` 和 `bash tests/deploy.sh`，再构建、验证后端部署包。
2. 在同一个任务中，将 `browser-tabs-server.tar.gz` 通过 SSH 上传到服务器 `incoming/`。
3. `deploy/deploy.sh` 在服务器的 `releases/提交号-运行ID-重试次数/` 解压，执行 `pnpm install --prod --frozen-lockfile`。
4. 依赖安装成功后，切换 `current` 软链接并重启 `blank-backup`；健康检查成功才将部署标记为成功。

检查失败就停止部署；服务器安装依赖成功后才切换 `current` 版本并重启。启动或健康检查失败时，有旧版就尝试恢复旧版，该次 Actions 仍标记为失败。数据库继续复用。

正在运行的 `main` 部署不会被新推送取消；服务器使用部署锁防止同时切换版本。

旧版本目录保留在 `releases/`，方便检查和手动回退。部署不会覆盖 `/etc/blank-backup.env` 或 `/var/lib/blank-backup`。

## 查看结果

GitHub 仓库的 **Actions** 页面展示构建和部署日志。服务器日志：

```bash
systemctl status blank-backup --no-pager
journalctl -u blank-backup -n 100 --no-pager
curl -fsS http://127.0.0.1:3001/api/v1/health
```

缺少仓库参数时，部署任务会列出缺少的参数名称；主机公钥不匹配或 SSH 认证失败时，连接会终止。配置完成后可使用 **Run workflow** 重跑，无需为此创建空提交。
