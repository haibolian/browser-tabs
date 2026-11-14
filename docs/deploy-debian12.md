# Debian 12 后端部署

采用 Node.js 24 + pnpm + systemd + Nginx。后端业务代码在本机或 CI 中构建为 `index.mjs`，第三方依赖由服务器按锁文件安装。扩展继续在自己的电脑加载，服务器只运行 GitHub 登录和备份 API。

使用 GitHub 自动构建和部署时，按 [自动部署文档](github-actions.md) 配置；以下步骤用于手动部署。

## 环境

- Debian 12，具备 root 或 sudo 权限。
- 服务器安装 Node.js 24.x 和 pnpm 11.25.0。Debian 12 默认仓库中的 Node.js 版本不满足项目要求。
- Nginx、Certbot；SQLite 使用 Node 内置模块，无需安装 MySQL、Redis 或独立 SQLite 服务。
- 一个解析到服务器的域名。以下使用 `backup.example.com`，所有配置处都需替换为实际域名。
- 服务器安全组/防火墙允许 TCP 80、443；后端 3001 只监听本机。保留现有 SSH 访问规则。
- 服务器可以通过 HTTPS 访问 `github.com` 和 `api.github.com`。

个人使用建议从 1 核、1 GB 内存起步。磁盘按备份大小预留空间，备份包含原始壁纸和图标，20 份是每账号的数量上限。

## 1. 安装环境

以下服务器命令在 root shell 执行；普通用户先执行 `sudo -i`。

```bash
apt update
apt install -y ca-certificates curl nano sudo nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/blank-nodesource-setup.sh
bash /tmp/blank-nodesource-setup.sh
apt install -y nodejs
npm install -g pnpm@11.25.0
node --version
pnpm --version
```

确认 Node 输出 `v24.x.x`，pnpm 输出 `11.25.0`。systemd 模板使用 NodeSource 安装的 `/usr/bin/node`。

## 2. 本机构建并上传部署包

在本机 PowerShell 的项目根目录执行，将 `服务器IP` 替换为实际地址：

```powershell
pnpm install --frozen-lockfile
pnpm server:build
pnpm verify:server
scp browser-tabs-server.tar.gz root@服务器IP:/tmp/
```

构建生成 `server-dist/index.mjs` 和 `browser-tabs-server.tar.gz`。压缩包包含后端产物、`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、部署模板及本文档。Fastify、Zod 等第三方依赖保持外部引用，由服务器安装到 `node_modules`；SQLite 由 Node.js 内置模块提供。`verify:server` 在项目外的临时目录解压部署包，安装生产依赖，再检查启动、HTTP、CORS、参数校验和重启后的 SQLite 数据保留。

在服务器执行：

```bash
release="/opt/browser-tabs/releases/manual-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$release"
tar -xzf /tmp/browser-tabs-server.tar.gz -C "$release"
cd "$release"
pnpm install --prod --frozen-lockfile
ln -sfn "$release" /opt/browser-tabs/current
```

安装成功后由 systemd 启动后端。部署包不包含 TypeScript 源码或本机 `node_modules`；服务器会按锁定版本安装生产依赖，跳过 TypeScript、测试和构建工具。

## 3. 填写后端配置

首次部署执行：

```bash
id blank-backup >/dev/null 2>&1 || useradd --system --user-group --home-dir /var/lib/blank-backup --no-create-home --shell /usr/sbin/nologin blank-backup
if [ ! -e /etc/blank-backup.env ]; then
  install -m 600 /opt/browser-tabs/current/deploy/server.env.example /etc/blank-backup.env
fi
nano /etc/blank-backup.env
```

填写 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`，将 `GITHUB_CALLBACK_URL` 中的域名换为实际域名。配置文件中的主要地址关系是：

```dotenv
DATABASE_PATH=/var/lib/blank-backup/blank.sqlite
GITHUB_CALLBACK_URL=https://backup.example.com/api/v1/auth/github/callback
GITHUB_RETURN_URLS=https://nplbljhenhbjjccehgckeanlbiknanoe.chromiumapp.org/github
```

插件 ID 已固定，因此 `GITHUB_RETURN_URLS` 保持模板中的值。仅在还需要网页版登录时，用英文逗号追加其完整返回地址。配置更新直接编辑 `/etc/blank-backup.env`，不要再次用空白模板覆盖密钥。

服务器以 `/etc/blank-backup.env` 为配置来源；systemd 创建并授权 `/var/lib/blank-backup`，数据库自动初始化及迁移。

## 4. 启动并设置开机运行

```bash
install -m 644 /opt/browser-tabs/current/deploy/blank-backup.service /etc/systemd/system/blank-backup.service
systemctl daemon-reload
systemctl enable blank-backup
systemctl restart blank-backup
systemctl status blank-backup --no-pager
curl --retry 5 --retry-connrefused --retry-delay 1 -fsS http://127.0.0.1:3001/api/v1/health
```

健康检查应返回 `{"status":"ok"}`。查看日志：

```bash
journalctl -u blank-backup -n 100 --no-pager
```

修改环境文件后执行 `systemctl restart blank-backup`。

## 5. 配置 Nginx 和 HTTPS

```bash
install -m 644 /opt/browser-tabs/current/deploy/nginx.conf /etc/nginx/sites-available/blank-backup
nano /etc/nginx/sites-available/blank-backup
```

把 `server_name backup.example.com` 改为实际域名。模板保留完整 `/api/v1/` 路径转发到本机 3001；访问日志省略 OAuth 回调中的查询参数。模板将单次请求体上限设为 **50 MiB**，备份包含图片；若实际备份更大，调整 `client_max_body_size`。

确认域名已解析到服务器，80/443 可访问，再执行：

```bash
ln -s /etc/nginx/sites-available/blank-backup /etc/nginx/sites-enabled/blank-backup
nginx -t
systemctl reload nginx
certbot --nginx -d backup.example.com --redirect
curl -fsS https://backup.example.com/api/v1/health
```

Certbot 命令和检查地址也替换为实际域名；按提示填写证书联系邮箱。已有同域名 Nginx 站点时，将代理配置合入现有站点，避免重复的 `server_name`。

确认续期：

```bash
systemctl status certbot.timer --no-pager
certbot renew --dry-run
```

## 6. 修改 GitHub 配置并连接插件

在 [GitHub OAuth Apps](https://github.com/settings/developers) 打开使用的应用：

- Homepage URL：填写你的项目主页地址。
- Authorization callback URL：`https://backup.example.com/api/v1/auth/github/callback`，与服务器的 `GITHUB_CALLBACK_URL` 完全一致。

如果还需继续使用本机后端的 OAuth 登录，为服务器单独创建一个 OAuth App，并把它的 Client ID/Secret 填到 `/etc/blank-backup.env`。

插件固定连接 `https://tabsapi.lianhb.site`，上文的示例域名应替换为该域名。打开「设置 → 数据备份 → 云端备份」，点击 GitHub 登录并允许扩展访问后端，随后点击一次「立即上传」保存当前桌面。其他设备登录同一 GitHub 账号后手动拉取备份。旧版本保存的其他服务器登录信息需要重新登录。

首次部署会创建新的服务器数据库。当前电脑的桌面可以直接上传；若需迁移旧的云端历史备份，先停止本机后端，再将本机 `server/data/` 中的数据库及同名 WAL/SHM 文件复制到服务器 `/var/lib/blank-backup/`。复制前停止服务器上的 `blank-backup` 服务，保留服务器原数据库副本，复制后设置目录归属为 `blank-backup:blank-backup`，然后启动服务。

## 更新与备份

在本机重新执行 `pnpm server:build` 和 `pnpm verify:server`，上传新的部署包。服务器先在新目录安装依赖，成功后停止服务、保存数据库副本、切换程序并启动：

```bash
release="/opt/browser-tabs/releases/manual-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$release"
tar -xzf /tmp/browser-tabs-server.tar.gz -C "$release"
cd "$release"
pnpm install --prod --frozen-lockfile
systemctl stop blank-backup
mkdir -p /root/blank-backup-snapshots
cp -a /var/lib/blank-backup "/root/blank-backup-snapshots/$(date +%Y%m%d-%H%M%S)"
ln -sfn "$release" /opt/browser-tabs/current
install -m 644 "$release/deploy/blank-backup.service" /etc/systemd/system/blank-backup.service
systemctl daemon-reload
systemctl start blank-backup
curl -fsS http://127.0.0.1:3001/api/v1/health
```

依赖安装成功后再切换并启动服务；安装失败时先处理报错。数据库位于 `/var/lib/blank-backup`，配置位于 `/etc/blank-backup.env`，更新部署包不会覆盖这两个路径。服务使用 `current/server-dist/index.mjs` 入口，旧程序保留在 `releases/` 中。数据库使用 WAL，停服后复制整个数据目录；运行时备份需使用 SQLite 在线备份方式。
