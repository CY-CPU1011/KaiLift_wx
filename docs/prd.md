# 开练KaiLift_PRD

**版本：v2.4（开发推进版）｜最近同步：2026-06-28（① 训练核心闭环 / 语音解析 / 数据页聚合接口均已落地；② 新增「等级 Lv / 段位 / 成就墙」激励体系，后端驱动，见 §2.5；③ 首页"21 天计划"改为"本月训练天数"、废弃 challenges，见 §2.4；④ 语音/分享已从 CloudBase 云函数**合并进 REST 后端、移除云函数**，后端回归单一 REST 服务，见 §4.3；⑤ 新增「训练空闲自动结束 + 待领奖励」、热力图色深改按「单日训练时长」分档。后端为单一 REST 架构，已部署到自管服务器 `kailift.chenyi.uno`）**

数据与代码产物（取代早期规划的独立 SQL/字典文件）：`prisma/schema.prisma`（数据模型唯一真相源，在后端仓库）、`prisma/migrations/`、`prisma/seed.ts`、根目录 `api.json`（**REST 接口契约 / OpenAPI 3；手维护，以后端路由代码 + schema 为准**）。

> ⚠️ 架构（v2.4 起确认）：后端是**单一 REST 服务**——
> - **全部能力**（登录/用户/动作/session/set/PR/统计/成就/**语音**/**分享**/**奖励**）统一走 **REST API**（`/api/v1/*`，Next.js 提供，**JWT Bearer**；小程序用 `wx.request` 调用，需配 request 合法域名）。
> - 基址：dev `http://localhost:20020`；线上自管服务器 `https://kailift.chenyi.uno`（阿里云 ECS + Nginx + HTTPS）。
>
> （架构演进：v2→v2.1 曾误判"全部 REST"；v2.2–v2.3 为**混合架构**——语音/分享走 CloudBase 云函数（`voiceParse`/`setsConfirm`/`setsCreate`/`shareQrcode`，OPENID）；**2026-06-21 起云函数全部并入 REST、移除云函数那条链路**，回归单一 REST，详见 §4.3 与 `docs/后端对接-语音合并到REST.md`。原 `cloudfunctions/` 目录已停用、仅留备份。）

与 v1 的主要差异：补全 AI 解析协议（四 intent）、动作归一化算法、当前动作上下文与 session 生命周期、PR 计算规则、置信度判定、录音与音频工程细节、异常/离线/手动录入、后台鉴权、分享图渲染方案、更新验收标准。

数据库约定（对齐 schema）：全表软删除 + 审计字段（created_at / updated_at / deleted_at）、不启用外键（参照完整性与级联由应用层维护，Prisma 侧 relationMode = "prisma"）。

## 实现进度快照（2026-06-28）

> 本节随开发推进维护，记录"规划 vs 已落地"，便于对照后续工作。详细里程碑见 §7。

| 模块 | 状态 | 说明 |
|---|---|---|
| 阶段 0 准备 / 阶段 1 数据层 | ✅ 已完成 | `prisma/schema.prisma` 落地全部 MVP 模型（User / Exercise / WorkoutSession / WorkoutExercise / WorkoutSet / VoiceEntry / PersonalRecord / **PersonalRecordEvent** / **UserAchievement** / **UserLevelState** / ShareCard / ParseCorrection / AdminPromptVersion）。迁移：`init` → `enrich_schema` → `add_challenge_tables`（已废弃）→ `add_achievement_tables` → `achievements_decouple_points`，+ seed（测试用户 Alex、系统动作库、一次完整训练、PR、分享图、提示词 v1）。本地双库：主库 `KaiLift` + 影子库 `KaiLift_shadow`。 |
| 阶段 2 训练核心（无 AI） | ✅ 已完成 | REST 训练 CRUD 全量上线（auth/users/exercises/sessions/sets/personal-records），含**单 active 约束**（`POST /sessions` 已有 active 返回 200+`resumed:true`）、`POST /sets/{id}/restore` 撤销恢复、PR 整动作重算；小程序训练页闭环（开始/恢复、手动加组、编辑/撤销/删除、结束、计时器/汇总）已跑通。 |
| 阶段 3 语音解析 | ✅ 已完成 | 四 intent + resolveExercise 归一化 + 智能确认；**已从 CloudBase 云函数合并进 REST**（`POST /sessions/{id}/voice`、`POST /voice-entries/{id}/confirm`，2026-06-21），鉴权统一 JWT、错误统一走 HTTP 4xx/5xx，不再用 `wx.cloud.callFunction`；小程序录音 / 确认卡 / 一键改手动已接。原云函数与打包脚本 `build:cf` 停用、留备份。 |
| 阶段 4 训练后反馈 | ✅ 基本完成 | 结束训练弹窗 + 分享图：小程序 `share-card` 页 canvas 2d 合成（核心数据 / 主要动作 / 激励行）+ 分享小程序码 REST 接口 `GET /share/qrcode`（已从 `shareQrcode` 云函数合并进 REST，`wxacode.getUnlimited` 生成可扫小程序码）+ 保存相册。另已上线「训练空闲自动结束 + 待领奖励」（§3.10 / §4.6）。训练总结页与模板细节继续打磨。 |
| 阶段 5 数据页与激励 | ✅ 已完成 | 5 个聚合接口 `GET /stats/{home,heatmap,day,trend,lifetime}`（首页含 `monthTrainedDays`）；数据页热力图 / PR 墙 / 趋势图；**新增「等级 Lv / 段位 / 成就墙」后端驱动激励体系**（`GET /achievements`，详见 §2.5）。 |
| 阶段 6 管理后台 | ✅ 已完成 | Next.js 16（Turbopack，dev 端口 20020）+ Antd v6 + Prisma 7。登录鉴权、仪表盘、用户、训练记录、动作库、语音解析日志、提示词管理、分享图（只读视图）均上线。鉴权方案与 §4.7 原计划不同（自研 jose，详见该节）。 |
| 阶段 7 上架准备 | 🚧 进行中 | 后端 + ECS 自建 PostgreSQL 已部署到自管服务器 `kailift.chenyi.uno`（阿里云 ECS + Nginx + HTTPS，HTTPS 已通、可联调）；域名 ICP 备案进行中、尚未正式过审上线；类目与审核材料待办。 |

**核心结论：** 开练 KaiLift 是一个面向力量训练用户的微信小程序，核心价值是"训练中用自然语言快速记录，训练后用数据和分享图激励坚持"。

最小可行产品（MVP 阶段）不做手表端、不做社区、不做收费，先完成个人主体可上架的小程序、REST API 后端（由 Next.js 提供，见 §4.1/§4.3）、PostgreSQL 数据库、Next.js 管理后台、语音识别服务（ASR）和大语言模型（LLM）解析闭环。

# 1. 产品定位、目标用户与痛点

## 1.1 一句话定义

**开练 KaiLift** 是一款"语音驱动的力量训练记录小程序"：用户在训练中说出自己刚完成的动作、重量、次数和组类型，系统自动拆解成结构化训练记录，并在训练结束后生成总结和分享图。

## 1.2 品牌与对外表达

| 项目 | 内容 | 说明 |
|---|---|---|
| 中文名 | 开练 | 通俗、行动感强，适合微信生态传播。 |
| 英文名 | KaiLift | 保留中文品牌发音，同时强化力量训练属性。 |
| 副标题 | Voice Workout Log | 直接说明功能，不把产品包装成 AI 教练。 |
| Slogan | Say the set. Keep the log. | 强调"说出一组，留下记录"。 |
| 中文传播语 | 练完一组，说一句就记了。 | 适合首页、分享图、小程序介绍页。 |

## 1.3 目标用户

| 用户类型 | 典型特征 | 核心诉求 | 第一版优先级 |
|---|---|---|---|
| 力量训练老手 | 有训练计划，知道动作、重量、组数、RPE 等概念。 | 快速记录、减少手机干扰、复盘训练容量和 PR。 | 最高 |
| 普通健身房用户 | 会做基础器械训练，但记录习惯不稳定。 | 不想手填表格，希望训练结束后有完成感。 | 高 |
| 健身新手 | 知道自己做了什么，但动作名、训练计划不稳定。 | 需要更低门槛的记录方式和坚持暗示。 | 中 |
| 私教 / 教练 | 关注学员训练沉淀和复盘。 | 希望学员自动上报训练数据。 | 第一版之后 |

## 1.4 需要解决的痛点

**现状问题**

- 训练中打开手机容易被微信、短视频、消息打断。
- 传统训练记录需要手动选择动作、输入重量、输入次数，休息间隔中很烦。
- 用户经常"这组记了，下组忘了"，数据不连续。
- 新手和普通用户看不到持续训练的正反馈，容易中断。

**开练的解决方式**

- 训练中只用语音自然汇报，系统负责拆解。
- 支持一组一记，也支持一句话批量记录多组。
- 解析结果清晰时自动保存，解析结果不确定时才让用户确认，兼顾速度和准确性。
- 语音失败/弱网时一键改用手动录入，记录永不丢失。
- 训练后给完成反馈、分享图、本月训练天数和数据正反馈。

## 1.5 产品边界

| 做 | 暂不做 |
|---|---|
| 训练记录、语音解析、批量记组、训练总结、分享图、基础数据分析。 | Apple Watch / 手表端原生 App。 |
| 个人主体小程序上架，微信内可搜索。 | 商业化、微信支付、会员订阅。 |
| 轻量激励机制，鼓励稳定训练。 | 社区、内容流、教练广场。 |
| 动作库与用户自定义动作；语音 + 手动两条录入路径。 | 医疗健康建议、康复建议、饮食营养诊断。 |

## 1.6 文档术语说明

| 术语 | 说明 |
|---|---|
| PRD | 产品需求文档，统一产品目标、功能范围、页面流程、技术方案和开发步骤。 |
| MVP | 第一阶段需要完成的最小闭环版本，不代表最终完整产品。 |
| ASR | 语音识别服务，把录音转成文字。 |
| LLM | 大语言模型，把识别后的文本解析成结构化训练记录。 |
| 智能确认机制 | 解析清晰可靠时自动保存；动作/重量/次数/批量拆分/修改意图存在不确定性时弹确认卡。 |
| 当前动作上下文 | 当前正在记录的动作。存于 workout_sessions.current_workout_exercise_id，是语音自动归组的依据。 |
| 训练组记录 | 一次动作下的一组数据，含动作、重量、次数、组类型、备注等字段。 |
| 个人记录墙（PR 墙） | PR = Personal Record。展示各动作最高重量、最佳组、估算 1RM。 |
| REST API | 全部能力的 HTTP 接口（`/api/v1/*`，Next.js 提供，契约见 `api.json`）。统一 `{ok,data}`/`{ok,error}` 信封 + **JWT Bearer** 鉴权。承载登录/用户/动作/训练/组/PR/统计/成就/语音/分享/奖励；小程序用 `wx.request` 调用。 |
| ~~CloudBase 云函数~~（已移除） | 早期语音/分享通道（`voiceParse`/`setsConfirm`/`setsCreate`/`shareQrcode`，`wx.cloud.callFunction` + OPENID）。**2026-06-21 起已合并进 REST**（见 §4.3），不再使用 `wx.cloud.callFunction`；音频改为随 REST 请求直传后端、识别完即弃，不再用 CloudBase 存储。 |
| PostgreSQL / Postgres | 关系型数据库，全产品唯一数据源。 |

---

# 2. 最小可行产品（MVP）阶段规划

## 2.1 阶段目标

验证一个核心闭环：**用户能否在真实训练中用语音快速、准确、低打扰地完成训练记录，并在结束后获得足够强的完成感。**

## 2.2 本阶段必须包含

- [ ] 微信登录与用户身份识别，使用 openid，不强制获取手机号。
- [ ] 开启训练模式，记录训练开始时间、当前动作上下文和训练状态；同一用户同时仅一个进行中训练。
- [ ] **语音输入**：支持一组一记，也支持一句话批量记录多组。
- [ ] **手动录入（一等公民）**：选动作 + 填重量/次数/组类型，作为语音失败/弱网的退路，且可离线写本地、联网后同步。
- [ ] AI 解析：识别动作、重量、次数、组类型、备注，输出一条或多条训练组记录（四 intent，见 4.4）。
- [ ] 智能确认机制：解析清晰自动保存，不确定弹确认卡。
- [ ] 训练中可撤销、编辑、删除已记录组。
- [ ] 结束训练弹窗：庆祝动效、完成文案、分享图选择。
- [ ] 训练成就分享图：静态背景模板 + canvas 合成真实数据 + 真实小程序码。
- [ ] 数据页：训练日历热力图、PR 墙、趋势图第一版。
- [ ] 我的页：训练计划、动作库、数据导出、提醒设置、单位/主题。
- [ ] Next.js 后台：用户、训练记录、动作库、语音解析日志、提示词版本管理（含鉴权）。

## 2.3 本阶段暂不包含

- 不做 Apple Watch、华为手表等设备端应用。
- 不做 AI 问答复盘（如"我上次卧推多少"）。后续可做，非当前核心。
- 不做训练计划智能生成；"训练计划"只做轻量目标和常用计划展示。
- 不做社区、排行榜、好友关注。
- 不做付费和会员体系。
- 不做复杂营养、体脂、医疗健康建议。
- 不做运行时图像生成（分享图背景用预生成静态模板）。

## 2.4 本月训练天数设计

> **变更记录（2026-06-20）：** 原"21 天内完成 9 次"挑战计划已废弃，首页计划卡改为记录"本月已训练多少天"。不再使用 challenges 相关接口；该指标由 `GET /api/v1/stats/home` 的 `monthTrainedDays` 实时派生。下文凡涉及"21 天计划"的旧表述以本节为准。

**设计原则：** 废弃早期「21 天内完成 9 次」挑战（连续/目标式打卡不符合恢复规律，也会给中断的用户压力）。改为一个更直觉、零压力的纯计数指标：**「本月已训练 X 天」**——实时从训练记录派生，不落库、不设目标线。

| 规则 | 第一版 |
|---|---|
| 指标名称 | 本月训练天数 |
| 统计口径 | 当前自然月（北京时间 UTC+8）内有训练的去重天数 |
| 计入条件 | status = completed 且未软删；按 started_at 落在哪个北京日计 |
| 去重 | 同一北京日多次训练只算 1 天 |
| 有效门槛 | 无——任何 completed 训练都算 1 天（不要求 ≥2 动作 / ≥6 组） |
| 首页展示 | 本月训练 · 已训练 X 天 |
| 空数据 | 显示 0 天 |
| 实现 | 由 `GET /api/v1/stats/home` 的 `monthTrainedDays` 实时返回；不新建计数字段、不自增（避免改组/删组后失真） |

> 早期的 `challenge_plans` / `user_challenges` 表与 `/api/v1/challenges/*` 接口已废弃：对外契约层面移除/标记 deprecated，数据库表暂留，待确认无回退需求后统一清理。

## 2.5 等级 / 段位 / 成就墙激励体系（v2.3 新增，后端驱动）

> 取代早期"成就墙由前端本地推导"的设想：现为**后端驱动**，前端按接口渲染即可，不再自行计算。新增数据表 `personal_record_events`（破纪录事件日志）、`user_level_states`（每用户经验缓存）、`user_achievements`（已解锁成就，append-only）。

**一句话机制：** **单轨** —— 训练 → 经验 EXP → 等级 Lv(1–100) → 段位（8 档奖牌），三者同源、奖牌随等级升级；**成就墙独立** —— 5 类共 23 枚特定成就，达标即点亮，**不给经验、不影响段位**，纯收集。

| 维度 | 规则 |
|---|---|
| EXP 来源 | **只来自训练**，`workoutFinish`（`PATCH /sessions` 首次置 completed）事务内即时结算：完赛 +300/训练天数 · 容量每 10kg +1（单次封顶 800）· 本次每破一个 max_weight 纪录 +100。 |
| 等级 Lv | 1–100；升 Lv.L→L+1 需 `100×L` 经验，满级 Lv.100 = 495,000 EXP（约 3 年）。接口直接给进度条用的 `expIntoLevel / levelSpanExp`，前端不必算。 |
| 段位（奖牌） | 8 档按等级区间划分、前松后紧：生铁 1–9 / 青铜 10–19 / 白银 20–29 / 黄金 30–44 / 铂金 45–59 / 钻石 60–74 / 宗师 75–89 / 传奇 90–100。奖牌图 = 当前段位（接口给 key/name/color/icon）。 |
| 成就墙 | 5 类 23 枚：里程碑(milestone) / 连续(streak) / 破纪录(pr) / 探索(explore) / 趣味(fun)；如"首次开练""破壁者(破纪录 5 次)""容量爆表(单次 ≥8000kg)""早练鸟/夜练者""王者归来(中断 14 天后重练)"等。`first_workout` 等一次性成就开练即解锁。 |
| 结算反馈 | 训练**首次**完成时 `PATCH /sessions/{id}` 响应多带 `achievement` 字段（升级 / 升段 / 本次新解锁成就），供前端做即时庆祝动画；再次 completed / 取消 / 改名不带。 |

> 口径与公式均在后端实现（`src/lib/achievements/{level,catalog,evaluate}.ts`），单位无关（不涉及 kg/lb）；时区一律北京时间(UTC+8)。前端对接见后端文档《成就墙 / 段位 / 等级(EXP) · 前端对接》。

---

# 3. 页面清单与核心流程

## 3.1 四个 Tab 页

| Tab | 定位 | 核心内容 |
|---|---|---|
| 首页 | 激励和入口 | 问候语、本月训练天数、本周轨迹、最近一次训练、本周概览、快速语音入口。 |
| 训练 | 高频记录工具 | 训练计时、当前动作、语音按钮、手动加组、解析状态、已记录组、加动作、结束训练。 |
| 数据 | 训练复盘 | 训练日历热力图、PR 墙、趋势图、动作历史、训练详情。 |
| 我的 | 个人资产与设置 | 累计数据、成就墙、训练计划、动作库、数据导出、提醒、单位/主题。 |

## 3.2 首页

参考图氛围保留：3D 插画、绿色训练进度、连续训练反馈制造正向情绪。但"21 天连续训练"改为"本月训练天数"（见 §2.4）。

| 模块 | 第一版内容 | 说明 |
|---|---|---|
| 顶部问候 | 下午好，Alex / 日期 | 保留亲切感。 |
| 计划卡片 | 本月已训练 X 天 | 取代 21 天计划，口径见 §2.4。 |
| 本周轨迹 | 周一到周日训练状态 | 显示训练日、休息日和今日标记。 |
| 最近一次训练 | 训练名称、动作数、组数、训练容量 | 点击进入详情。 |
| 本周概览 | 训练次数、总训练量、训练时长 | 可延续参考图 3D 卡片。 |
| 快速入口 | 说一说记录训练 / 开始训练 | 进 App 时若存在进行中训练，直接恢复进训练页（见 4.6 session 生命周期）。 |

## 3.3 训练页

**参考图需调整：** 当前更像"训练中汇总页"，缺语音识别状态、当前动作上下文、批量解析结果和确认卡。训练页必须优先服务快速记录，而非优先展示插画。

| 状态 | 页面表现 | 用户动作 |
|---|---|---|
| 未开始训练 | 展示"开始训练"按钮，可选自由训练或常用计划。 | 点击开始训练。 |
| 训练中 | 顶部计时器、总组数、动作数、总容量；中部当前动作和已记录组；底部大语音按钮 + 常驻"＋ 手动加组"。 | 说出训练内容、手动加组、编辑记录、加动作、结束训练。 |
| 语音识别中 | 麦克风动效 +"正在听…" + 可取消。 | 说出一句训练汇报。 |
| 解析清晰并自动保存 | 短提示：已记录 N 组；新增组高亮；提供撤销。 | 继续训练。 |
| 需要确认 | 弹解析确认卡，展示拆出的多组记录。 | 确认、编辑、放弃。 |
| 语音失败/弱网 | toast 提示 + 一键"改用手动"，打开手动加组表单。 | 手动补录这一组。 |

**录音交互（决策）：** 采用**点一下开始 / 再点一下结束（toggle）**，配静音约 1.5s 自动停 + 硬上限约 20s，全程可取消。健身房手忙出汗，长按易误触；toggle 更宽容。长按（微信语音消息式）作为可接受备选。

录音参数：`wx.getRecorderManager`，`format: 'mp3'`、`sampleRate: 16000`、`numberOfChannels: 1`。

## 3.4 语音记录示例

| 用户说法 | 系统解析（intent） | 处理 |
|---|---|---|
| 今天先做杠铃深蹲 | set_current_exercise：杠铃深蹲 | 创建/切换当前动作上下文。 |
| 我刚刚蹲了 12 个，20 公斤，这是热身组 | record_sets：杠铃深蹲 / 20kg / 12 次 / warmup | 上下文明确，自动保存。 |
| 深蹲三组，100 公斤，分别 5、5、4 个 | record_sets：3 条，reps 5/5/4 | 批量保存；不确定则确认。 |
| 卧推 80 公斤 8 个、7 个、6 个 | record_sets：3 条卧推，重量均 80kg | 批量保存。 |
| 下一个坐姿划船 | set_current_exercise：坐姿划船 | 切换当前动作上下文。 |
| 引体向上 15 个 | record_sets：load_type=bodyweight，weight 为空 | 自重动作，自动保存。 |
| 刚才那个记错了，是 70 公斤 | modify_last_set：改最近一组 weight=70 | 修改历史，**必弹确认**。 |
| 今天天气真好 | unknown | 不产生任何组，提示重说或手动。 |

## 3.5 智能确认机制：自动保存与风险确认

智能确认机制平衡训练中的记录效率和数据准确性。

**关键原则：LLM 自报的 confidence 未经校准、不可独信。真正的闸门是"结构完整性"，confidence 只作次要参考。**

**自动保存条件（全满足）**

- ASR 文本非空，且 intent = record_sets。
- 动作明确，或当前动作上下文明确。
- 每组都有 reps，且有可判定的负重（有 weight_kg 或 load_type = bodyweight）。
- 一句话批量拆分后每组结构完整。
- confidence ≥ 0.80（阈值放配置常量，不硬编码散落；按真机测试调）。

**需要确认条件（任一）**

- 当前无动作上下文且用户没说动作名。
- 数字歧义（无法判断重量/次数）。
- 动作名匹配到多个候选。
- intent = modify_last_set（修改历史一律确认）。
- intent = unknown。
- confidence < 0.80，或批量里任一组字段不全。

## 3.6 结束训练弹窗

点击"结束训练/完成训练"后，不直接结束，先展示完成弹窗。

| 元素 | 内容 |
|---|---|
| 视觉反馈 | 庆祝动效（撒花、彩带或轻量粒子）。 |
| 主标题 | 恭喜您完成了此次训练！ |
| 摘要 | 本次训练已记录 X 个动作，共 Y 组，总训练容量 Z kg。 |
| 按钮 1 | 完成并生成分享图。 |
| 按钮 2 | 完成训练（进训练总结页）。 |
| 按钮 3 | 取消（回到训练中，不结束）。 |

## 3.7 分享图

定位为训练成就分享图：既让用户感到"完成了一次训练"，也展示关键训练数据，适合发朋友圈或训练社群。

**渲染方案（决策）：数据准确高于一切，不用图像生成模型。**

- 背景/装饰（3D 插画、氛围底图）使用**预生成的静态模板**（设计期产出，可借助图像生成工具一次性生成数张存为模板）。
- 小程序码接口（REST `GET /api/v1/share/qrcode`，**已接线**；原 `shareQrcode` 云函数已合并进 REST）：后端用 appid/secret 取 access_token，调微信官方 `wxacode.getUnlimited` 生成**真实可扫的小程序码**返回前端（`{ image }`，https 链接或 base64）。
- **客户端用 canvas 2d**（小程序 `share-card` 页）把核心数据 / 主要动作 / 激励行 / 小程序码合成到像素风海报上 → `wx.canvasToTempFilePath` 导出 → 保存相册。当前为即时合成 + 本地保存，未落 `share_cards.image_url`（如需服务端留存可后补）。
- 原因：生成模型无法保证数字/字符每次渲染准确，且生成图里的"二维码"不可扫。**生成负责好看，canvas 负责准确。**

| 区域 | 内容 |
|---|---|
| 顶部 | 开练 KaiLift / 今日训练完成 / 日期。 |
| 主视觉 | 静态 3D 训练插画、奖章、绿色进度元素。 |
| 核心数据 | 训练时长、动作数、总组数、总训练容量。 |
| 主要动作 | 3 到 5 个主要动作 + 最佳组，如"深蹲 100kg × 5"。 |
| 激励信息 | 本月已训练 X 天（口径见 §2.4）。 |
| 底部 | Say the set. Keep the log. + 真实小程序码。 |

## 3.8 数据页

方向保留：训练日历热力图、PR 墙、趋势图。第一版避免太重，优先展示用户能理解、能被激励的指标。

| 子页 | 第一版内容 | 注意事项 |
|---|---|---|
| 训练日历热力图 | 按日期展示**单日训练时长**深浅（5 档：无训练 / 10 分钟 / 半小时 / 1 小时 / 1.5 小时+）。后端 `GET /stats/heatmap` 给每日 `durationMin`，分档在前端。 | 新用户数据少时显示空状态和引导。原按训练量/组数分档已弃用（口径与"今天练了多久"更贴合）。 |
| PR 墙 | 动作维度最佳成绩（max_weight / max_volume_set / estimated_1rm，见 4.6）。 | 口径明确，源自 personal_records 表。 |
| 趋势图 | 周 / 月训练容量趋势。 | 数据不足 2 周时不强行展示环比。 |
| 动作详情 | 某动作历史记录、最佳组、最近训练。 | 可作为 MVP 后半段。 |

## 3.9 我的页

| 模块 | 第一版内容 |
|---|---|
| 个人资料 | 头像、昵称、登录状态。**头像昵称用填写组件惰性获取（open-type="chooseAvatar" + type="nickname"），可空、不阻塞首屏。** |
| 累计统计 | 累计训练次数、总训练量、动作种类。 |
| 资料卡（等级/段位） | 当前等级 Lv 与 EXP 进度条、段位奖牌（奖牌上叠 Lv 数字）。数据源 `GET /achievements`，口径见 §2.5。 |
| 成就墙 | 5 类 23 枚成就（里程碑/连续/破纪录/探索/趣味），达标即点亮，`first_workout` 等开练即解锁；后端驱动，见 §2.5。 |
| 训练计划 | 默认自由训练；可展示"推拉腿 PPL"预设，不做复杂编排。 |
| 动作库 | 系统动作 + 用户自定义动作。 |
| 数据导出 | CSV 导出，便于备份、迁移和复盘。 |
| 提醒设置 | 本地提醒文案，第一版不依赖复杂订阅消息。 |
| 单位 / 主题 | kg / 深色模式设置入口，深色模式可后置。 |

## 3.10 异常、离线与手动录入

| 场景 | 处理 |
|---|---|
| 网络/上传失败 | toast 提示 + 直接打开手动加组表单，不丢用户这组。 |
| ASR 返回空 / intent=unknown | 友好提示"没太听清"，给手动入口；绝不写组。 |
| 弱网/离线 | 语音必须联网（断网无法 ASR）；**手动录入**写本地内存立即可见，联网后用 `POST /api/v1/sessions/{id}/sets` 同步。 |
| 重复提交（双击/重试） | 语音确认接口以 `voiceEntryId` 做幂等键；已确认过的直接返回已建 `createdSetIds`，不二次写。 |
| 忘了结束训练 | **空闲自动结束**（见 §4.6）：从最后一组算起，前台静置 30 分钟轻提醒、45 分钟明确提醒、60 分钟自动结束；自动结束的升级/升段/解锁存为「待领奖励」，下次进 App 补放庆祝（`GET/POST /api/v1/rewards/*`）。App 关闭期间由后端惰性兜底关闭。详见 `docs/后端对接-训练自动结束.md`。 |

---

# 4. 技术方案

## 4.1 总体架构

| 层级 | 技术选型 | 说明 |
|---|---|---|
| 微信小程序 | 原生微信小程序 + TypeScript | 承载用户训练记录主体验，含 canvas 合成分享图。 |
| 后端入口（统一） | **REST API（`/api/v1/*`，Next.js 提供）**；dev 基址 `http://localhost:20020`，线上 `https://kailift.chenyi.uno` | 登录/用户/动作库/训练/组/PR/统计/成就/**语音/分享/奖励**。统一信封 `{ok,data}`/`{ok,error}`；**JWT Bearer** 鉴权（除登录外均带 `Authorization`）。小程序 `wx.request` 调用，需配 request 合法域名。契约见 `api.json`。（语音/分享原为 CloudBase 云函数，2026-06-21 已并入本入口，见 §4.3.2；挑战接口已废弃。） |
| 数据库 | PostgreSQL（Prisma 7，driver adapter `@prisma/adapter-pg`） | 全产品唯一数据源。开发期本地 PostgreSQL（主库 `KaiLift`、迁移影子库 `KaiLift_shadow`）；线上为**阿里云 ECS 自建 PostgreSQL**（与后端同机/同区，后端 `DATABASE_URL` 指向它；迁移与 seed 同一套、仅换连接串）。 |
| 网页后台 + REST 后端 | Next.js 16（App Router + Turbopack）+ Ant Design v6 + Prisma 7 | **同一 Next.js 应用同时提供管理后台页面与 §4.3 的 `/api/v1` REST 接口（端口同为 20020）。** 管理动作库、训练记录、解析日志、提示词配置；含鉴权。注意 Next 16 把 middleware 改名为 `proxy`（见 §4.7）。 |
| 语音识别（ASR） | 托管 API | 当前用**腾讯云一句话识别**（后端 `TENCENT_ASR_*` 配置）。 |
| 大语言模型（LLM） | 可插拔模型服务 | 当前用 **DeepSeek**（后端 `DEEPSEEK_*` 配置）；结构化 JSON 输出，模型后端可切换。 |
| 文件存储 | 无需对象存储（音频临时） | 音频随 REST 请求（multipart 或 base64）直传后端，仅供一次性 ASR 识别、**识别完即弃、不持久化**（省掉原 CloudBase 存储那一步）。分享图为客户端 canvas 即时合成 + 本地保存相册，未落服务端。 |

## 4.2 数据流

**统一鉴权**：全部走 REST + JWT。小程序启动 `POST /auth/login` 换 JWT，之后每个请求带 `Authorization: Bearer`（语音/分享也一样，不再有 OPENID / 云开发那条轨，无需 `wx.cloud.init`）。

1. 登录：wx.login 取 code → `POST /api/v1/auth/login` 换 JWT（本地存 token，后续请求带 `Authorization: Bearer`）。
2. 训练页点语音按钮，wx.getRecorderManager 录音（mp3/16k/单声道）。
3. 音频随请求直传后端：`POST /api/v1/sessions/{id}/voice`（multipart 字段 `audio`，或读为 base64 的 JSON）；联调/降级可改传 `{ rawText }` 跳过 ASR。
4. 后端在该接口内完成：ASR 转文字 → 读 current_workout_exercise_id 作上下文 → LLM 解析四 intent（§4.4）→ resolveExercise 归一化（§4.5）→ 智能确认决策（§3.5，决策在后端）；voice_entries 由其内部写。
5. 接口返回 `status`：
   - `auto_saved`：已写库，用 `createdSetIds` 刷新列表；
   - `needs_confirmation`：渲染确认卡，用户确认/编辑后 `POST /api/v1/voice-entries/{voiceEntryId}/confirm`（`{ action, editedSets? }`，以 voiceEntryId 幂等）写入；
   - `unknown`：提示重说或改手动。
6. 手动加组：小程序与语音**统一走 REST** `POST /api/v1/sessions/{id}/sets`（归一化 + 归组 + 隐式设当前动作 + PR 重算；session 须 active 否则 409）。
7. 编辑/删除/恢复组：`PATCH`/`DELETE /api/v1/sets/{id}`、`POST /api/v1/sets/{id}/restore`；动作级删除/恢复/替换走 `DELETE`/`POST .../restore`/`PATCH /api/v1/sessions/{id}/exercises/{weId}`。服务端自动重算该动作 PR 与 session 汇总（§4.6）。
8. 结束训练：`PATCH /api/v1/sessions/{id}` status=completed，服务端重算总组数/动作数/总容量，并结算经验/成就（首次完成响应带 `achievement`，§2.5）；空闲自动结束见 §4.6。
9. 分享小程序码：`GET /api/v1/share/qrcode`（§3.7）。
10. 全部接口同属一个 Next.js 应用，经 Prisma 读写同一套 Postgres。

失败任一步：HTTP 4xx/5xx + `{ok:false, error}`（语音失败如 502 `asr_failed`/`llm_failed`）→ 小程序按 §3.10 走"改用手动"。

## 4.3 后端接口清单

后端为**单一 REST 服务**：全部能力统一走 REST（JWT）。语音/分享原为 CloudBase 云函数，2026-06-21 已合并进 REST（见 §4.3.2）。`api.json` 是 REST 接口真相源（手维护，以后端路由代码 + `prisma/schema.prisma` 为准，可能轻微漂移；语音/分享/奖励/成就/动作历史端点均已补齐，与后端 `docs/api/openapi.json` 一致——28 个路径）。

### 4.3.1 REST 接口（`/api/v1/*`，JWT Bearer，`{ok,data}`/`{ok,error}` 信封）

| 能力 | REST 接口 | 备注 |
|---|---|---|
| 登录换 token | `POST /api/v1/auth/login`（code 或 openid） | 不强制手机号；返回 token + user + isNewUser。token 默认 30 天、**无 refresh**，过期重新 wx.login 换；401 统一重登。 |
| 当前用户 / 资料 | `GET /api/v1/auth/me`、`GET`/`PATCH /api/v1/users/me` | 昵称、头像、单位(kg/lb)、主题。 |
| 动作库 | `GET`/`POST /api/v1/exercises`、`GET`/`PATCH`/`DELETE /api/v1/exercises/{id}` | 系统 + 自定义；系统/他人动作不可改删（403）。 |
| 开始 / 恢复训练 | `POST /api/v1/sessions` | **已有 active 时返回那个进行中 session（HTTP 200 + `data.resumed:true`），不新建**（新建为 201）；语义即"恢复训练"，不弹确认。**前端按 `data.resumed`（或 200/201）区分「恢复训练」与「开始新训练」的 UI 文案。** |
| 训练列表 / 详情 | `GET /api/v1/sessions`（分页/按 status）、`GET /api/v1/sessions/{id}` | 详情含动作与组（SessionDetail）。 |
| 结束 / 取消 / 改名 | `PATCH /api/v1/sessions/{id}`（status=completed/cancelled） | 自动重算汇总 + 写结束时间。 |
| 删除训练 | `DELETE /api/v1/sessions/{id}` | 软删。 |
| 手动 / 语音加组（统一） | `POST /api/v1/sessions/{id}/sets` | 小程序手动与语音确认写库都走这条。动作归一化 + 归组 + **隐式设为当前动作** + PR 重算；session 非 active 返回 409（`session_not_active`）。`loadType=weighted` 时 `weightKg` 必填否则 400。 |
| 编辑组 / 删除组 | `PATCH`/`DELETE /api/v1/sets/{id}` | 自动重算该动作 PR。 |
| **撤销删除（恢复）** 🆕 | `POST /api/v1/sets/{id}/restore` | 清软删标记、**保留原 id**、重算 PR 与 session 汇总；session 已删返回 404。 |
| **动作级操作** 🆕 | `DELETE /api/v1/sessions/{id}/exercises/{weId}`、`POST .../restore`、`PATCH .../exercises/{weId}` | 删除 / 恢复 / 替换整个动作（WorkoutExercise）；与软删、PR、session 汇总联动重算。 |
| PR 列表 | `GET /api/v1/personal-records`（可按 exerciseId 过滤） | 数据页 PR 墙。 |
| **聚合统计** 🆕 | `GET /api/v1/stats/{home,heatmap,day,trend,lifetime}` | 首页 / 数据页所有图表的聚合源。`stats/home` 含 `monthTrainedDays`（本月训练天数，§2.4）、本周轨迹/概览、最近一次训练；热力图每日返回 `setCount/volumeKg/sessionCount/durationMin`，色深默认按 `durationMin`（单日训练时长）分档、分档在前端。口径见 §3.8。 |
| **成就墙 / 等级 / 段位** 🆕 | `GET /api/v1/achievements` | 一次返回资料卡（等级/EXP/段位）+ 成就墙（5 类 23 枚）全部数据；口径见 §2.5。另：`PATCH /sessions/{id}` 首次置 completed 时响应多带 `achievement` 结算字段（庆祝动画用）。 |
| **语音解析 / 确认** 🆕 | `POST /api/v1/sessions/{id}/voice`、`POST /api/v1/voice-entries/{voiceEntryId}/confirm` | 替代原 `voiceParse`/`setsConfirm` 云函数（2026-06-21 合并）。协议见 §4.3.2。 |
| **分享小程序码** 🆕 | `GET /api/v1/share/qrcode` | 替代原 `shareQrcode` 云函数。`wxacode.getUnlimited` 生成可扫小程序码，返回 `{image}`（§3.7）。 |
| **待领奖励** 🆕 | `GET /api/v1/rewards/pending`、`POST /api/v1/rewards/ack` | 空闲自动结束的训练把升级/升段/解锁存为待领，进 App 拉取补放庆祝、ack 清除（§4.6 / §3.10）。 |
| ~~挑战计划 / 我的挑战~~（已废弃） | ~~`GET /api/v1/challenges/plans`、`GET`/`POST /api/v1/challenges`、`GET`/`PATCH /api/v1/challenges/{id}`~~ | **已废弃**：21 天计划改为"本月训练天数"（§2.4），由 `GET /stats/home` 的 `monthTrainedDays` 实时派生。接口标 deprecated、DB 表暂留待统一清理。 |

> 单位：后端只认 kg，`weightKg` 不带单位、无换算；用户 lb 时由**前端** lb↔kg 换算。`loadType` 五值 `weighted/bodyweight/assisted/duration/unknown` 以 `api.json` 为准。

### 4.3.2 语音 / 分享 / 奖励 REST 接口（已从云函数合并）

> 2026-06-21 起，原 CloudBase 云函数（`voiceParse`/`setsConfirm`/`setsCreate`/`shareQrcode`）整体并入 REST 后端：**搬入口、不重写逻辑**（ASR/DeepSeek/resolveExercise/智能确认沿用原代码）。鉴权统一 **JWT**（后端从 token 取 userId，不再用 OPENID）；错误统一走 **HTTP 4xx/5xx + `{ok:false,error}`**（不再用 `status:"failed"`，前端按 HTTP 状态码分流即可）。详见 `docs/后端对接-语音合并到REST.md`。

| 原云函数 | 现 REST 接口 | 说明 |
|---|---|---|
| `voiceParse` | `POST /api/v1/sessions/{sessionId}/voice` | 音频(multipart `audio` / base64)或 `{rawText}`(跳过 ASR) → ASR → LLM 四 intent → resolveExercise → 智能确认；auto_saved 直接写库，否则返回确认卡数据。voice_entries 由其内部写。 |
| `setsConfirm` | `POST /api/v1/voice-entries/{voiceEntryId}/confirm` | 确认卡「确认/放弃」，以 voiceEntryId 幂等。 |
| `setsCreate` | `POST /api/v1/sessions/{sessionId}/sets`（已存在） | 手动 / 语音统一加组，无需新建。 |
| `shareQrcode` | `GET /api/v1/share/qrcode` | 生成可扫小程序码。 |

**✅ 手动加组通道**：小程序手动与语音确认写库**统一走 REST `POST /sessions/{id}/sets`**（前端 `service/api.js` 即此实现）。错误处理已统一：失败用 **HTTP 状态码（400/401/404/409/502）** + `{ok:false,error}` 信封，`utils/request.js` 按状态码分流（不再有云函数那套「HTTP 200 但 `result.ok===false`」的范式）。

**调用协议：**

- **语音解析** `POST /sessions/{sessionId}/voice`：音频走 multipart（字段 `audio`，可选 `voiceFormat`）或读为 base64 的 JSON；联调/降级传 `{ rawText }`。可选 `voiceEntryId`(幂等/重试)、`currentExerciseName`(延续上下文)。成功 `data`：`{ voiceEntryId, status: auto_saved|needs_confirmation|unknown, intent, rawText, needsConfirmation, confirmationReason, createdSetIds[], parsed, currentExerciseName }`；失败 HTTP 4xx/5xx（502 `asr_failed`/`llm_failed`、404、409）。
- **语音确认** `POST /voice-entries/{voiceEntryId}/confirm`：入参 `{ action: confirm|reject, editedSets?, editedExerciseName?, targetSetId? }`（`editedSets` 用 **ParsedSet(snake_case)**，区别于 `/sets` 的 SetInput(camelCase)；`modify_last_set` 应传确认卡展示的 `targetSetId`）；成功 `data`：`{ voiceEntryId, status: confirmed|rejected, createdSetIds, currentExerciseName }`。
- **分享小程序码** `GET /share/qrcode`：query `page`(默认 `pages/home/home`)、`scene`(默认 `from=share`)、可选 `envVersion`；成功 `data`：`{ image }`（https 链接或 `data:image/png;base64`）；失败 4xx（前端拿不到画「生成中」占位，不阻塞合成）。

### 4.3.3 原语音云函数部署链路（已停用）

> 历史记录：合并前语音/分享靠 CloudBase 云函数，需「后端 `cloudfunctions/` 源码 → 构建脚本 `build:cf` 打包 → 前端 `cloudfunctionRoot` → 微信开发者工具上传 → CloudBase 配 env」整条链路。**2026-06-21 合并进 REST 后该链路整体停用**：不再需要 `wx.cloud.init`、云开发环境、`build:cf` 打包与上传。原 `cloudfunctions/` 目录已停用、仅留备份。
>
> 原云函数的环境变量（`DEEPSEEK_*`、`TENCENT_SECRET_*`/`TENCENT_ASR_*`、微信 `APPID`/`APP_SECRET`）改配在 REST 后端进程上，部署见 `docs/部署上线-runbook.md`。

### 4.3.4 决策与现状（本期）

| 能力 | 决策 / 现状 |
|---|---|
| 成就 / 徽章 / 等级 / 段位 | ✅ **已改后端驱动并落地**（单轨 EXP→Lv→段位 + 5 类 23 枚成就，`GET /achievements`）。原"前端本地推导"设想作废，见 §2.5。 |
| 热力图 / 趋势 / 汇总聚合 | ✅ **已新增 5 个 `/stats/*` 聚合接口**（home/heatmap/day/trend/lifetime），前端不再用明细临时聚合。 |
| 分享图 | ✅ **已接线**：REST `GET /share/qrcode` 出可扫小程序码（原 `shareQrcode` 云函数已并入）+ 小程序 canvas 合成（§3.7）。当前不落 `share_cards.image_url`（本地保存相册）。 |
| 训练空闲自动结束 + 待领奖励 | ✅ **已上线**：30/45 分钟提醒、60 分钟自动结束（前台前端判 + 后台后端惰性兜底）；自动结束奖励转「待领」，进 App 补放庆祝（`/rewards/*`，§4.6 / §3.10）。 |
| 切换当前动作（纯手动） | **不做**：加组自动设当前动作 + 语音可切，纯手动低频。 |
| 写组幂等 | 语音侧以 voiceEntryId 幂等；纯手动加组靠前端按钮防抖（未做服务端幂等键）。 |
| CSV 导出 / parse_corrections 纠错回流 | **后置**（后端未接线）。 |

数据库未启用外键、删除一律软删：删父记录（如 session）需在服务端联动软删其子记录（exercise / set / voice_entry）；所有读取过滤 deleted_at IS NULL。

## 4.4 AI 解析输出协议（四 intent）

LLM 统一返回一个信封，`intent` 取四值之一：`record_sets` / `set_current_exercise` / `modify_last_set` / `unknown`。

**record_sets**（记录一组或多组）：

```json
{
  "intent": "record_sets",
  "current_exercise": "杠铃深蹲",
  "sets": [
    {"exercise_name": "杠铃深蹲", "load_type": "weighted", "weight_kg": 100, "reps": 5,
     "set_type": "working", "rpe": null, "note": null, "confidence": 0.95}
  ],
  "needs_confirmation": false,
  "confirmation_reason": null
}
```

- 自重："引体向上 15 个" → load_type: "bodyweight", weight_kg: null。
- 助力（如助力引体）：load_type: "assisted"，助力值进 note 或先置 null。

**set_current_exercise**（切换当前动作）：

```json
{"intent": "set_current_exercise", "exercise_name": "坐姿划船",
 "needs_confirmation": false, "confirmation_reason": null}
```

**modify_last_set**（修改最近一组）：

```json
{"intent": "modify_last_set", "target": "last_set",
 "changes": {"weight_kg": 70},
 "needs_confirmation": true, "confirmation_reason": "modify_history"}
```

- MVP 只支持改"最后一组"（target: "last_set"）；"把第二组改成…"这类 → 走 unknown 或提示手动编辑。
- 修改永远 needs_confirmation: true。

**unknown**（非健身 / 听不清 / 空）：

```json
{"intent": "unknown", "needs_confirmation": true,
 "confirmation_reason": "not_recognized", "asr_text_echo": "今天天气真好"}
```

**写进 prompt 的硬规则：**

- 绝不补造没说过的重量/次数（缺字段宁可进确认）。
- 中文数字 → 阿拉伯数字（"八十"→80）。
- 单位默认 kg；"磅/lb" × 0.4536、"斤" × 0.5（v1 是否接受斤/磅由产品决定，不接受则只认公斤、其余进确认）。
- 多组拆分："80 公斤 8 个 7 个 6 个" → 3 组同重量、reps [8,7,6]；"三组每组 8 个 100 公斤" → 3 组 reps 8 weight 100。
- LLM 只输出动作名字符串，**不负责映射到动作库 id**（归一化在 4.5 的代码里做）。

## 4.5 动作归一化（resolveExercise）

语音解析接口（`POST /sessions/{id}/voice`）拿到 LLM 的 `exercise_name` 后，独立的 `resolveExercise()` 走级联（高内聚：改归一化不动 prompt）：

1. **精确匹配**：lower(name) = lower(parsed)。
2. **别名匹配**：parsed = ANY(aliases)（忽略大小写；已建 GIN 索引）。
3. **（可选）模糊匹配**：去空格/标点后再比；MVP 有 1+2 一般够。
4. **匹配不到** → 用 exercise_id = NULL + display_name = 用户原话 建 workout_exercise，**记录照常落库不阻塞**；未匹配动作暴露在后台动作库，后续补成别名（parse_corrections + 后台即用于此）。

## 4.6 数据模型关键决策

**数据库通用约定：** 全表含 created_at / updated_at / deleted_at（软删除，NULL=未删除）；不在 DB 层启用外键，参照完整性与级联由应用层维护；所有业务查询过滤 deleted_at IS NULL，删除一律软删（用户侧「撤销」即清空 deleted_at）。Prisma 侧设 relationMode = "prisma"，并用 Client Extension 统一做软删过滤与 delete 改写。

**当前动作上下文：** 存于 workout_sessions.current_workout_exercise_id，是唯一真相源。

- 不靠客户端 state（切后台/断线会丢）；不靠"取 sort_order 最大者"推断（用户可切回前面的动作会推错）。语音解析接口每次读它最准、可恢复。

**session 生命周期：**

- 一个用户同时仅一个 active session（DB 部分唯一索引保证）。
- 进 App 时查 active session，有就恢复进训练页。
- 读取 active session 时若空闲过久 → 后端**惰性兜底**自动结算（有数据置 completed / 空组置 cancelled），不上定时任务。
- **空闲自动结束（已上线）**：从最后一组算起，前台 30 分钟轻提醒、45 分钟明确提醒、60 分钟自动结束（前端在前台判）；App 关闭期间由后端在下次开 App / 开练时惰性关掉，两边阈值 60 分钟对齐。`finishedAt` 钳到「末组时间 + 3min」避免时长爆表。自动结束的升级/升段/解锁存为「待领奖励」，进 App 由 `GET/POST /api/v1/rewards/*` 补放庆祝。详见 `docs/后端对接-训练自动结束.md`。

**PR 计算：** personal_records 表为唯一真相源；workout_sets.is_personal_record 是给 UI 高亮的冗余标记。

- 三类：max_weight（最大重量）、max_volume_set（单组 weight_kg × reps 最大）、estimated_1rm。
- 1RM 用 Epley：estimated_1rm = weight_kg × (1 + reps / 30)，仅对 set_type='working' 且 reps ≤ 12 的组算。
- 新组 auto_saved/confirmed 后做 PR 检查，破纪录则 upsert。
- **编辑/删除一组时，整动作重算**（拉该用户该动作全部 working 且未软删的组重算三类 PR、覆盖写）——MVP 数据量下廉价，避免增量补丁留脏数据。
- **破纪录事件日志：** 破 max_weight 时写 `personal_record_events`，供「本次训练破了几个 PR」结算（每个 +100 EXP，§2.5）与「首次破 PR / 累计破 N 次」成就判定。

**单位：** 一律存 kg（weight_kg / total_volume_kg），unit_weight 仅影响展示；展示 1 kg = 2.2046 lb。

**冗余汇总：** total_sets / total_volume_kg / total_exercises 在 workoutFinish 重算写入，不手维护自增。

## 4.7 网页后台功能（Next.js + Ant Design + Prisma）

**鉴权（必做，后台暴露全部用户数据，不能裸奔）：** 单管理员账号，密码哈希存环境变量，不复用微信 openid。

**实现说明（已落地，与原 PRD 不同）：** 未用 NextAuth，改为自研轻量方案——原因是 Next 16 把 `middleware` 改名为 `proxy`、Auth.js 兼容性不确定，且单管理员场景 NextAuth 过重。

- 凭据：`.env` 的 `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH`（bcryptjs 哈希）+ `SESSION_SECRET`（jose HS256 签名密钥）。默认账号 `admin` / `KaiLift@2026`，上线前必须改。
- 会话：`src/lib/session.ts` 用 jose 签发 httpOnly cookie；`src/lib/dal.ts` 的 `requireAdmin()` 是真正的安全闸门，每个 admin 页面与 server action 开头必调。
- `src/proxy.ts`（本项目用 src/ 目录，必须放此处否则被 Next 静默忽略）只做乐观重定向，不作为唯一防线。
- 坑：`.env` 中 bcrypt 哈希的每个 `$` 必须转义成 `\$`，否则被 `@next/env` 的 dotenv-expand 当变量展开导致登录永远失败；改 .env 需重启 dev server。
- Antd v6 为 client-only：`page.tsx` 只做 `requireAdmin()` + Prisma 查询 + `toPlain()` 序列化（`src/lib/serialize.ts`，Date→string、Decimal→number），再把纯数据交给同目录 `_components/*.tsx`（"use client"）渲染。

| 模块 | 功能 | 第一版必要性 |
|---|---|---|
| 仪表盘 | 用户数、训练次数、解析成功率、接口延迟。 | 中 |
| 用户管理 | 查看用户基础信息和训练概览。 | 中 |
| 训练记录 | 查看 session、exercise、set 明细。 | 高 |
| 动作库 | 维护动作名称、别名、部位、器械；处理未匹配动作。 | 高 |
| 语音解析日志 | 查看 ASR 文本、解析 JSON、失败原因、纠错记录。 | 最高 |
| 提示词管理 | 维护 prompt 版本和 JSON Schema（admin_prompt_versions）。 | 高 |
| 分享图模板 | 管理分享图文案和模板 key。 | 中 |

> 实现现状：仪表盘、用户管理、训练记录、动作库、语音解析日志、提示词管理均已落地（只读 + 必要维护）。分享图模板暂未建独立 `share_templates` 表，当前页面仅展示已生成分享图（`share_cards`）与各模板 key 的使用情况，文案/模板维护待后续增表。

## 4.8 数据库与代码产物

早期规划的 `kailift_schema.sql` / `kailift_field_dictionary.md` 已不再单独维护，数据模型直接以 Prisma 为唯一真相源：

- `prisma/schema.prisma`：PostgreSQL MVP 表结构（含当前动作上下文、单 active session 约束、PR 枚举、parse_status 的 unknown、别名 GIN 索引、四 intent 枚举、字段注释）。
- `prisma/migrations/`：版本化迁移（首版 `20260617131925_init`）。
- `prisma/seed.ts`：可重复执行的测试数据（幂等 upsert + 固定 id）。
- 字段说明内联在 `schema.prisma` 注释中；解析 JSON 结构见 §4.4。

> 单 active session 约束已在迁移中以部分唯一索引落地：`workout_sessions_one_active_per_user`（`WHERE status = 'active' AND deleted_at IS NULL`），保证每用户同时仅一个未删除的进行中训练（§4.6）。

---

# 5. 主要风险评估

| 风险 | 影响 | 应对策略 |
|---|---|---|
| 健身房噪音导致语音识别错误 | 记录错误，用户不信任产品。 | 选短句识别稳定的托管 ASR；保留原文 raw_text；不确定弹确认卡。 |
| 大语言模型解析错误 | 生成用户没说过的数据，或拆分错。 | 严格结构化输出；禁止补造重量/次数；缺字段或拆分不确定进确认。 |
| 批量记录解析复杂 | 一句话拆多组易错。 | 解析结果必须展示训练组列表；多组字段不齐则确认。 |
| 小程序审核类目风险 | 上架受阻。 | 个人主体，定位工具/训练记录；不写医疗、康复、营养诊断。 |
| REST API 连接 Postgres 稳定性 | 接口延迟或连接数问题。 | Prisma 连接池策略；必要时迁国内 Postgres。 |
| 3D UI 过重 | 加载慢、影响训练页效率。 | 首页和分享图重视觉，训练页控制插画密度，优先交互效率。 |
| 频率指标误导天天练 | 不符合恢复规律。 | 首页改为"本月训练天数"（§2.4），只数坚持天数、不设目标次数、不暗示每天练。 |
| 音频和训练数据隐私 | 用户敏感数据泄露。 | 音频私有存储 + 7–30 天自动清理；后台不暴露永久公开音频链接。 |
| 弱网导致记录失败 | 训练中记不上，体验崩。 | 手动录入离线可写、联网同步；语音失败一键改手动。 |
| 软删不等于真删 | 用户「删除」的数据仍在库中，涉及隐私与信任/合规（PIPL）。 | MVP 默认软删；后续为「注销账号 / 彻底删除数据」提供真正的物理清除或定期硬删任务。 |

---

# 6. UI 设计方向

## 6.1 设计资产

参考目录中的 UI 已形成明显风格：浅色背景、绿色主色、3D 器械插画、圆润卡片、奖章和庆祝反馈。适合"坚持健身"的正反馈，也适合分享图。

## 6.2 需要调整的点

| 参考设计 | 问题 | 调整建议 |
|---|---|---|
| 首页 21 天连续训练 | 易暗示每天训练。 | 改成"本月训练天数"（§2.4），只数本月坚持天数。 |
| 训练页大卡片 | 展示感强，输入状态弱。 | 增加当前动作、语音文本、解析结果、确认卡、撤销、手动加组入口。 |
| 训练页"草稿"标签 | 语义不清。 | 改为"进行中""已记录 N 组"或去掉。 |
| 数据页 PR 墙 | 口径可能不清。 | 明确最高重量、最佳组、估算 1RM 的展示规则。 |
| 我的页成就墙 | 新用户全锁定有挫败感。 | 至少给一个"首次开练"可立即解锁；并叠加等级/段位资料卡，制造"开练即有进度"的正反馈（§2.5）。 |

## 6.3 视觉规范建议

| 项目 | 建议 |
|---|---|
| 主色 | 清爽绿色，用于完成、训练中、正向增长。 |
| 辅助色 | 蓝色用于数据，黄色用于成就，红色仅用于删除或风险提示。 |
| 字体 | 标题粗重，数字更大；训练页正文避免过大，确保高信息密度。 |
| 圆角 | 卡片可较圆润，训练记录列表更紧凑。 |
| 动效 | 训练结束、分享图生成、PR 达成可用庆祝动效；训练中动效克制。 |
| 插画 | 首页、我的、分享图可用 3D 资产；训练页减少插画占比。 |

---

# 7. 开发步骤

**配套开发文档：** 本章的详细落地拆解（里程碑 M0 → M7、任务清单与完成判定）见 [开练KaiLift 开发步骤与迭代计划](https://my.feishu.cn/docx/TqZ1d7V0NoPcUOxyrvScROtdnnd)，按开发顺序逐步迭代实施。

## 7.1 阶段拆分

> 状态图例：✅ 已完成 ｜ 🚧 进行中 ｜ ⬜ 未开始。实时进度见顶部「实现进度快照」。

| 阶段 | 状态 | 目标 | 产出 |
|---|---|---|---|
| 阶段 0：准备 | ✅ | 账号、环境、数据库、API Key 准备。 | 小程序项目、Postgres、Next.js 后台 + REST API 工程。 |
| 阶段 1：数据层 | ✅ | 落库结构和 Prisma schema。 | 数据库迁移、字段说明、基础 seed 动作库。 |
| 阶段 2：训练核心 | ✅ | 开始训练、当前动作、**手动新增组**、结束训练。 | 不依赖 AI 的完整训练记录闭环（REST CRUD + 小程序训练页）。 |
| 阶段 3：语音解析 | ✅ | ASR + LLM 解析 + 归一化 + 智能确认机制。 | 语音 REST 接口 `POST /sessions/{id}/voice` + `/voice-entries/{id}/confirm`（原云函数已合并，§4.3.2）、解析日志、确认卡。 |
| 阶段 4：训练后反馈 | ✅ | 完成弹窗、总结页、分享图（canvas 合成）。 | 结束弹窗 + `share-card` canvas 合成 + `shareQrcode` 小程序码；总结页/模板继续打磨。 |
| 阶段 5：数据页与激励 | ✅ | 训练日历热力图、PR 墙、趋势图、本月训练天数、等级/段位/成就墙。 | 5 个 `/stats` 聚合接口 + 数据页 + 后端驱动激励体系（§2.5）。 |
| 阶段 6：后台 | ✅ | 管理动作库、解析日志、提示词（含鉴权）。 | Next.js + Ant Design 后台（核心模块已上线，分享图模板表待补）。 |
| 阶段 7：上架准备 | ⬜ | 个人主体备案、类目、审核材料。 | 可搜索的小程序版本。 |

## 7.2 建议优先级

1. 先做无 AI 的训练记录闭环（含手动录入），确保数据模型正确。
2. 再接 ASR + LLM 解析，把语音变成增强输入，而非让基础功能依赖 AI 成败。
3. 训练页优先打磨，首页和分享图其次，后台作为调试和管理工具并行推进。
4. PR 墙和趋势图先用真实训练数据生成，不前期为图表做太多复杂指标。
5. 上架前清理所有医疗、康复、营养诊断类措辞。
6. 备案与 Postgres 迁移（开发期本地 PostgreSQL `KaiLift` → 上架国内库）跟开发并行，越早启动越好。

## 7.3 验收标准

| 能力 | 验收标准 |
|---|---|
| 语音单组记录 | "卧推 80 公斤 8 个"能在 3 秒内变成一条训练组。 |
| 语音批量记录 | "卧推三组 80 公斤，8 个、7 个、6 个"能拆出三条记录。 |
| 上下文记忆 | 说"今天做深蹲"后，再说"100 公斤 5 个"能自动归入深蹲。 |
| 切换动作 | "下一个坐姿划船"→ current_workout_exercise_id 指向新动作，后续组自动归入。 |
| 修改最后一组 | "刚才记错了是 70 公斤"→ 弹确认 → 仅改最后一组 weight，并写入 parse_corrections。 |
| 自重动作 | "引体 15 个"→ load_type=bodyweight、weight_kg=null，不报错。 |
| 智能确认机制 | 缺动作、低置信度或修改历史时不直接保存，需用户确认。 |
| 非健身/空输入 | "今天天气真好"或无声 → 不产生任何组，提示重说或手动。 |
| 断网手动录入 | 断网下手动加组本地可见，恢复网络后同步成功。 |
| 单一进行中训练 | 重复点"开始训练"不产生第二个 active session。 |
| 撤销删除 | 删除一组后点撤销，该组恢复显示（deleted_at 清空），不丢数据。 |
| PR 失效重算 | 软删/改小一组 PR 后，PR 墙该动作纪录被正确重算（软删组不计入）。 |
| 训练结束 | 点完成后弹"恭喜您完成了此次训练！"并提供三个按钮。 |
| 分享图 | 生成含品牌、训练数据、主要动作和**可扫小程序码**的图片，数据准确。 |
| 后台 | 能查看语音解析日志和训练组明细，支持动作别名维护，且需登录鉴权。 |

---

# 8. 附录

## 8.1 配套文件

- `api.json`：**REST 接口契约（OpenAPI 3，接口唯一真相源）**，dev 基址 `http://localhost:20020`、线上 `https://kailift.chenyi.uno`，统一 `{ok,data}` 信封 + JWT Bearer。（语音/分享/奖励/成就/动作历史端点均已补齐，与后端 `openapi.json` 一致。）
- `prisma/schema.prisma`：PostgreSQL MVP 表结构（数据模型唯一真相源，字段说明内联注释）。
- `prisma/migrations/`：版本化迁移；`prisma/seed.ts`：测试数据。
- `docs/design.md`、`docs/idea.md`：设计与构思补充文档。
- AI 解析 JSON 结构见 §4.4。

## 8.2 待产品确认的开放项

- v1 是否接受"斤/磅"语音单位（不接受则只认公斤）。
- 分享图静态背景模板数量与风格；分享图是否需服务端留存（落 `share_cards.image_url`，当前仅本地保存相册）。
- PR 墙首版展示哪几类（建议 max_weight + max_volume_set 先行，estimated_1rm 次之）。
- **原后端待办均已闭环（§4.3）**：① 语音/分享已从云函数合并进 REST ✅（`/sessions/{id}/voice`、`/voice-entries/{id}/confirm`、`/share/qrcode`）；② `POST /sets/{id}/restore` 与 `POST /sessions` 单 active 约束 ✅；③ 热力图/趋势/汇总聚合 ✅（5 个 `/stats/*`，热力图已加 `durationMin`）；④ 成就/等级/段位 ✅（`GET /achievements`，§2.5）；⑤ 训练空闲自动结束 + 待领奖励 ✅（`/rewards/*`，§4.6）。剩余：CSV 导出、parse_corrections 纠错回流、分享图模板维护表后置。
- **手动加组通道**：小程序手动与语音确认写库统一走 REST `POST /sessions/{id}/sets`（按 HTTP 状态码分流，§4.3.2）。

数据 / 接口真相源：`prisma/schema.prisma`（数据模型，含迁移与 seed）、`api.json`（REST 接口契约）。

> （注：内容由 AI 生成，请谨慎参考）
