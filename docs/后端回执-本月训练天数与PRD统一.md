# 后端回执：本月训练天数 + PRD 统一为单一真相源

**日期：2026-06-20｜后端 → 前端｜回执两份对接单：《后端对接-本月训练天数》《后端对接-PRD统一为单一真相源》，均已完成并提交。**

---

## 0. 一句话

两件都做完并已 push：①`/api/v1/stats/home` 用 `monthTrainedDays` 替换 `activeChallenge`、challenges 接口全废弃；②后端 `KaiLift/docs/prd.md` 已废弃成指针，PRD 唯一真相源认这份仓库的 `KaiLift_wx/docs/prd.md`（v2.2）。

后端提交：`c68f8fc`（主改动）、`9090671`（文档修正），已 push 到 `main`。

---

## 1.《后端对接-本月训练天数》—— 已完成

### 1.1 `GET /api/v1/stats/home`

- ✅ **新增** `data.monthTrainedDays`（integer，≥0）。
- ✅ **移除** `data.activeChallenge`（整个对象删除，不再返回）。

口径与你对接单 §4 **逐条一致**（已用脚本对真实数据验收：同日 2 次只 +1、跨月旧数据不计入、cancelled/软删不计入，HTTP 200 通过）：

| 项 | 实现 |
|---|---|
| 统计范围 | 当前自然月（服务器北京时间 年-月） |
| 时区 | 北京时间 UTC+8 |
| 取值字段 | `workout_sessions.started_at` 落在哪个北京日 |
| 计入条件 | `status='completed'` 且 `deleted_at IS NULL` |
| 去重 | 同一北京日多次只算 1 天 |
| 有效门槛 | 无——任何 completed 都算 1 天 |
| 空数据 | 返回 `0` |

> 附带：`data.week.days[].trained`（本周轨迹）也同口径改成「任意 completed 即训练日」，不再用「≥2 动作/≥6 组」门槛——和 `monthTrainedDays` 统一，你渲染本周轨迹时不会再和本月天数打架。

**改后返回结构：**

```json
{
  "ok": true,
  "data": {
    "week": { "sessionCount": 3, "totalVolumeKg": 9200, "totalDurationMin": 210, "days": [ ... ] },
    "lastWorkout": { "sessionId": "...", "title": "腿日", "date": "2026-06-18", "durationMin": 60, "exerciseCount": 4, "setCount": 12, "totalVolumeKg": 3000 },
    "monthTrainedDays": 7
  }
}
```

### 1.2 challenges 废弃

- ✅ `/api/v1/challenges/plans`、`GET`/`POST /api/v1/challenges`、`GET`/`PATCH /api/v1/challenges/{id}` 与 schema `ChallengePlan`/`UserChallenge` 在 OpenAPI 全部标 `deprecated`。
- DB 表 `challenge_plans`/`user_challenges` 暂留（未删），待确认无回退需求后统一清理。

### 1.3 接口契约

- ✅ 后端权威契约 = `KaiLift/docs/api/openapi.json`（由 `src/lib/api/openapi.ts` 经 `npm run openapi` 生成，永远跟路由代码一致）。本次改动已重导并提交。
- ⚠️ **你这边 `api.json`（根目录，手维护）需要据此同步**：把 stats/home 的字段换掉、challenges 标 deprecated。**要的话我可以直接帮你把 `KaiLift_wx/api.json` 改好**（按 openapi.json 对齐），你说一声。

---

## 2.《后端对接-PRD统一为单一真相源》—— 已完成

- ✅ `KaiLift/docs/prd.md` 已整体替换为你给的**指针 stub**：指向 `KaiLift_wx/docs/prd.md`（v2.2）为唯一真相源，并注明后端技术真相源不变（`prisma/schema.prisma` + `docs/api/openapi.json`）、旧 v2「全云函数」描述作废。
- ✅ 后端 `plan/02开发步骤与迭代计划.md`、`docs/api/后端实现现状-前端同步基线.md` 同步：21 天计划→本月训练天数、challenges 废弃、PRD 引用改指向 v2.2（核对过：§ 章节号 v2↔v2.2 一致，无需重排）。

以后 PRD 只改 `KaiLift_wx/docs/prd.md`，后端不再留可改副本。

---

## 3. 前端待办（建议）

1. **首页计划卡 / 分享图激励文案**：可从「客户端拉 `/sessions?status=completed` 本地聚合」切到直接读 `/stats/home` 的 `monthTrainedDays`（口径已和你一致，月初/月末边界以后端北京时区为准）。
2. **停用 challenges**：确认不再调 `/api/v1/challenges/*`、不再读 `activeChallenge`（你那边应已停用）。
3. **同步根目录 `api.json`**：见 §1.3（需要我代劳就说）。

有出入或要我补字段说明、改 `api.json`，回我即可。
