# 部署上线 Runbook（KaiLift 小程序）

> 现状（2026-06-28）：**后端 + 数据库已部署到自管服务器**——阿里云 ECS（Nginx + HTTPS）跑 REST 后端、**同机 ECS 自建 PostgreSQL**，对外域名 `https://kailift.chenyi.uno`，HTTPS 已通、可联调访问。
> **剩余上线阻塞：自购域名 `chenyi.uno` 的 ICP 备案进行中、尚未正式过审**（备案过审后才能把域名登记进 request 合法域名、提交小程序审核发布）。
> 标 🧑 的步骤需你在控制台/服务器操作（我碰不到凭据）；标 🤖 的由我改代码。
> **架构为单一 REST 后端**（语音/分享已从云函数并入 REST，2026-06-21、移除云函数）：部署链路 = **库 → 后端 → 域名/备案 → 前端配置 → 发布**。

## 目标架构

```
用户手机(微信) ──HTTPS──> REST 后端(阿里云 ECS + Nginx) ──SQL──> ECS 自建 PostgreSQL(同机/同区)
                          https://kailift.chenyi.uno
```

后端一体承担：训练 CRUD + 语音(腾讯 ASR → DeepSeek 解析) + 分享小程序码(wxacode)。无云函数。
终端用户不直连数据库；数据库与后端同机（ECS 自建 PG），后端查询不跨境、不跨网。

> 📌 **部署方案变更（2026）**：原计划用「微信云托管 + 腾讯云 PG」（图平台自带 HTTPS 域名免 ICP 备案），现改为 **阿里云 ECS 自管 + ECS 自建 PG + 自购域名 `chenyi.uno`**。代价是**自购域名必须 ICP 备案**（见 ③，当前进行中），换来部署/运维完全自控、库与后端同机零跨境。**不用 Supabase**（跨境慢）。

---

## 1️⃣ 数据库：ECS 自建 PostgreSQL 🧑（已就位）

- [x] 在阿里云 ECS 上安装 PostgreSQL，建库 + 账号，后端 `DATABASE_URL` 指向本机/内网（如 `postgresql://<user>:<pwd>@localhost:5432/<db>`）
- [x] 用同一套 `prisma migrate deploy` + `prisma db seed` 初始化结构与系统动作库（与本地开发同一迁移历史）
- [ ] **备份策略**：自管库无托管快照，务必自建定时 `pg_dump` 备份（及异地留存）
- [ ] **安全**：PG 只监听本机/内网、不对公网开放端口；仅后端进程可连
- 说明：库与后端同机，连接稳定、无跨境延迟；后续若要拆成独立 DB 实例，只需换 `DATABASE_URL`，迁移/seed 不变。

## 2️⃣ REST 后端：阿里云 ECS + Nginx + HTTPS 🧑（已部署）

> 后端是独立项目（不在本仓库）。以容器或 Node 进程部署在 ECS，Nginx 反代 + HTTPS 证书，对外 `https://kailift.chenyi.uno`。

- [x] 后端部署到 ECS；Nginx 反代到后端端口、配 HTTPS 证书（已通）
- [x] 配环境变量（合并后后端要承担语音/分享，env 比以前多）：
  - `DATABASE_URL`（① 本机/内网 PG 连接串）
  - `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` / `DEEPSEEK_BASE_URL`
  - `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` / `TENCENT_ASR_REGION` / `TENCENT_ASR_ENGINE`
  - `WECHAT_APPID` / `WECHAT_SECRET`（登录 code2session + 分享 wxacode 取 access_token）
  - 独立 `API_JWT_SECRET` + `SESSION_SECRET`（生产不可共用）；确认未设置 `ALLOW_OPENID_LOGIN`
  - API 文档生产默认关闭；不要设置 `API_DOCS_ENABLED=1`（临时排障用完即撤）
- [x] 自测：`GET https://kailift.chenyi.uno/api/v1/auth/me` 返回 401（服务通）
- [ ] 进程守护（pm2 / systemd / docker）+ 开机自启 + 日志留存，按你的 ECS 习惯配

## 3️⃣ 域名备案 + 登记合法域名 🧑（备案进行中 = 当前阻塞）

- [ ] **ICP 备案**：自购域名 `chenyi.uno`（含子域 `kailift.`）走 ICP 备案——**进行中、未过审**。这是上线硬阻塞：未过审前正式版无法把它登记进 request 合法域名对外服务（联调期可在开发者工具勾「不校验合法域名」临时放行）
- [ ] 备案过审后：微信公众平台 → 开发管理 → 开发设置 → 服务器域名 → **request 合法域名** 加上 `https://kailift.chenyi.uno`
- [ ] **若 `GET /share/qrcode` 返回的是 https 图片链接**：把该图片域名加到 **downloadFile 合法域名**；若后端返回 base64（`data:image/...`）则无需登记（联调时确认是哪种）

## 4️⃣ 前端配置切换 🤖（部分已就位）

- [x] `miniprogram/utils/constants.js`：`API_BASE` 已指向 `https://kailift.chenyi.uno`（真机 `LAN_HOST` 与开发者工具 `LOCAL_HOST` 现同址线上域名；本地联调时再临时改回局域网 dev server `http://<IP>:20020`）
- [x] `DEV_OPENID` 已置空；`DEV_LOGIN` 仅在 DevTools **且 API_BASE 为本机/局域网 HTTP** 时开启，指向生产域名时强制走真实 `wx.login`
- [x] `SHARE_QR_ENV` 已切为 `'release'`（正式版）；体验版扫码联调时可临时改 `'trial'`，提交代码前恢复

## 5️⃣ 发布 🧑（待备案过审）

- [ ] 域名备案过审 + request 合法域名登记完成（③）后再走发布
- [ ] 开发者工具「上传」版本 → mp 后台设为**体验版**
- [ ] 真机扫**体验版**码全链路回归（加载/加组/语音/统计/成就/分享/自动结束）
- [ ] 提交审核 → 通过后发布正式版

---

## 部署期排错速查

| 现象 | 多半原因 |
|---|---|
| 真机 `request:fail url not in domain list` | 域名没登记(③，备案未过) 或 `API_BASE` 还指本地(④) |
| 开发者工具能调、真机不行（或反之） | `constants.js` 的 `LAN_HOST`(真机)/`LOCAL_HOST`(开发者工具) 分支；联调期在开发者工具勾「不校验合法域名」 |
| 分享码不显示 | image 是 https 但 downloadFile 域名没登记(③)，或后端 wxacode 失败 |
| 接口偶发超时 / 冷启动 | `utils/request.js` 仅对幂等 GET 做指数退避；登录与写请求不会复用一次性 code/自动重放，失败后重新操作。持续超时查 ECS 后端进程 / Nginx / PG 是否健康 |
| 后端连库失败 | ECS 自建 PG 未启动 / `DATABASE_URL` 指错 / PG 未监听对应地址 |
| 语音 502 `asr_failed`/`llm_failed` | 后端环境变量没配齐 DeepSeek / 腾讯 ASR(②)，或服务器外呼被网络挡 |

> 历史备份：原云函数（`cloudfunctions/` 目录）已停用但保留；合并方案见 `docs/后端对接-语音合并到REST.md`。原计划的「微信云托管 + 腾讯云 PG」方案已弃用（见上方目标架构下的「部署方案变更」说明）。
