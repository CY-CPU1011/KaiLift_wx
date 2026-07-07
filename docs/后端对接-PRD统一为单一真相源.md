# 后端对接说明：PRD 统一为单一真相源

**日期：2026-06-20｜提出方：小程序前端｜动作：请用文末 stub 覆盖 `KaiLift/docs/prd.md`**

---

## 结论

**PRD 的唯一真相源 = 小程序仓库 `KaiLift_wx/docs/prd.md`（v2.2）。**
后端仓库 `KaiLift/docs/prd.md` 不再维护，请替换为文末的「指针 stub」。

## 为什么不以后端那份为准

两份 prd.md 已分叉，逐段对比后发现**核心分歧是后端架构**，不是措辞：

| | 前端 `KaiLift_wx` v2.2 | 后端 `KaiLift` v2 |
|---|---|---|
| 架构 | **混合**：训练 CRUD 走 **REST `/api/v1/*`（JWT）**，语音走 CloudBase 云函数 | **全云函数**：authLogin / workoutStart / setsCreate / workoutFinish / dataSummary… 全是云函数，无 REST |
| §4.3 | REST 接口清单 + 云函数 + 部署链路 + 待排（约 73 行） | 仅「CloudBase 云函数清单」（约 18 行） |
| 行数 | 648 | 578 |

**决定性依据：哪份匹配实际代码？**

- 后端**实际在写的是 REST**：`src/app/api/v1/stats/home/route.ts`（Next.js REST 路由）、`docs/api/openapi.json`（`/api/v1/*` + JWT 契约）。
- 前端 `service/api.js` 全程走 REST（`Session.*`、`Stats.home` 等）。

→ 现实 = **混合架构 = 前端 v2.2**。后端 v2 prd.md 描述的"全云函数"是早期被推翻的旧方案，**和后端自己的 REST 实现自相矛盾**，留着会持续误导。

> 注：前端 v2.2 已吸收后端 v2 中唯一更好的部分——§2.4「本月训练天数」那张表的排版（北京时区写明、补"空数据 / 实现"两行）。除此之外，后端 v2 没有比 v2.2 更新的内容。

## 请后端做的事

1. 用下面的 stub **整体替换** `KaiLift/docs/prd.md` 的内容。
2. 以后 PRD 只改 `KaiLift_wx/docs/prd.md`；后端技术真相源不变，仍是 `prisma/schema.prisma`（数据模型）+ `docs/api/openapi.json`（REST 契约）。
3. 单一真相源后，两仓库不再有 PRD 副本，之前 CRLF/LF 不一致导致的"整文件 diff"问题也随之消失。

> 若后端坚持本地留一份可读副本而非指针，请改为**只读同步副本**（从 `KaiLift_wx/docs/prd.md` 定期覆盖，不在后端单独改），否则又会分叉。

---

## 文末 stub（复制为 `KaiLift/docs/prd.md` 全文）

```markdown
# 开练KaiLift_PRD

> **本文件已废弃，不再维护。**
>
> PRD 唯一真相源在小程序仓库：**`KaiLift_wx/docs/prd.md`（v2.2）**。
> 架构为混合：训练 CRUD 走 REST `/api/v1/*`（JWT），语音走 CloudBase 云函数（OPENID）。
>
> 本仓库（后端）的技术真相源不变：
> - `prisma/schema.prisma` —— 数据模型唯一真相源
> - `docs/api/openapi.json` —— REST 接口契约（由 `src/lib/api/openapi.ts` 生成）
>
> ⚠️ 本文件早期的 v2「全云函数」架构描述与当前 REST 实现（`src/app/api/v1/**/route.ts`、`openapi.json`）不符，请勿参考。
```
