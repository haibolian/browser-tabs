# GitHub Actions 自动部署

工作流位于 `.github/workflows/deploy.yml`。PR 执行检查、测试和构建；推送到 `main` 后，构建成功才部署。也可以在 Actions 的 **Check and deploy backend → Run workflow** 中选择 `main` 手动运行。

## 仓库参数

打开仓库 **Settings → Secrets and variables → Actions**。

在 **Secrets → New repository secret** 添加：

| 名称 | 内容 |
| --- | --- |
| `SSH_PRIVATE_KEY` | 部署私钥的完整内容，包括 BEGIN/END 行；对应公钥已加入服务器部署账户的 `authorized_keys` |
| `SSH_KNOWN_HOSTS` | 服务器的完整 SSH known_hosts 条目，用于校验主机身份 |

在 **Variables → New repository variable** 添加：

| 名称 | 内容 |
| --- | --- |
| `SSH_HOST` | 服务器 IP 或域名，不带 `https://` |
| `SSH_USER` | 已配置公钥的 SSH 用户名 |
| `SSH_PORT` | SSH 端口；不填时为 `22` |
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

将 `deploy/setup-server.sh`、`deploy/blank-backup.service`、`deploy/server.env.example` 上传到服务器同一目录，然后在服务器执行：

```bash
sudo bash setup-server.sh /opt/browser-tabs 你的SSH用户名
sudo nano /etc/blank-backup.env
```

路径、用户名与仓库 Variables 保持一致。脚本创建部署目录和运行账户，安装并启用 systemd 服务；已有的环境配置会保留。部署用户负责上传和安装依赖，服务以 `blank-backup` 账户运行。非 root 部署用户仅获得免密重启 `blank-backup` 服务的 sudo 权限。初始化不启动服务，第一次工作流部署成功后服务开始运行。

环境文件中填写 GitHub OAuth 的 Client ID、Secret 和 HTTPS 回调域名；GitHub OAuth 后台填写同一个回调地址。它们留在服务器，Actions 不需要这些值。健康检查使用 `http://127.0.0.1:3001/api/v1/health`，因此保持 `PORT=3001`。

如果之前使用的是直接解压到 `/opt/browser-tabs` 的手动部署，执行初始化脚本后再运行首次自动部署。新的服务入口为 `/opt/browser-tabs/current/server-dist/index.mjs`。旧目录中的程序可以保留，数据库继续使用环境文件指定的位置。

## 发布过程

1. GitHub 使用 Node.js 24 和项目指定的 pnpm，安装依赖，执行 Lint、单元测试、部署脚本测试、前端和后端构建及产物校验。
2. 工作流保留 `browser-tabs-server.tar.gz` 构建产物。部署任务通过 SSH 上传到服务器 `incoming/`。
3. 服务器在 `releases/提交号-运行ID-重试次数/` 解压，执行 `pnpm install --prod --frozen-lockfile`。
4. 依赖安装成功后，切换 `current` 软链接并重启 `blank-backup`；健康检查成功才将部署标记为成功。

同一分支的工作流串行运行，部署中不会因新推送而被取消；服务器另有部署锁。安装依赖失败时，正在运行的版本不受影响。切换后如果重启或健康检查失败，有旧版时会恢复旧程序并再次检查，工作流仍标记为失败。程序回退不回滚 SQLite，数据库结构迁移需要保持与回退版本兼容。

旧版本目录保留在 `releases/`，方便检查和手动回退。部署不会覆盖 `/etc/blank-backup.env` 或 `/var/lib/blank-backup`。

## 查看结果

GitHub 仓库的 **Actions** 页面展示构建和部署日志。服务器日志：

```bash
systemctl status blank-backup --no-pager
journalctl -u blank-backup -n 100 --no-pager
curl -fsS http://127.0.0.1:3001/api/v1/health
```

缺少仓库参数时，部署任务会列出缺少的参数名称；主机公钥不匹配或 SSH 认证失败时，连接会终止。配置完成后可使用 **Run workflow** 重跑，无需为此创建空提交。
