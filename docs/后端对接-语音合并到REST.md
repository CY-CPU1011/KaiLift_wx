# 后端对接：把语音/分享从云函数合并进 REST

> 决策(2026-06-21)：放弃 CloudBase 云函数那条独立链路，语音/分享全部并入 REST 后端，**部署只剩一个后端**。
> 云函数里的解析逻辑(ASR/DeepSeek/resolveExercise/智能确认)已是现成代码，**搬入口、不重写逻辑**。
> 鉴权统一走 JWT（`Authorization: Bearer`），后端从 token 取 userId（不再用 OPENID）。
> 错误统一走 REST 范式：失败用 HTTP 4xx/5xx + `{ok:false,error}`，**不再用 `status:"failed"`**。

## 要新增/对接的接口一览

| 替代的云函数 | 新 REST 接口 | 状态 |
|---|---|---|
| voiceParse | `POST /api/v1/sessions/{sessionId}/voice` | 新增 |
| setsConfirm | `POST /api/v1/voice-entries/{voiceEntryId}/confirm` | 新增 |
| setsCreate | `POST /api/v1/sessions/{sessionId}/sets` | **已存在，无需改** |
| shareQrcode | `GET /api/v1/share/qrcode` | 新增 |

---

## 1. 语音解析 `POST /api/v1/sessions/{sessionId}/voice`

替代 voiceParse。两种输入二选一：

- **音频**：`Content-Type: multipart/form-data`，字段 `audio`(mp3, 16k 单声道)，可选 `voiceFormat`
- **文本**(联调/降级，跳过 ASR)：`Content-Type: application/json`，body `{ "rawText": "卧推60公斤8个" }`

可选参数：`voiceEntryId`(重试时幂等)、`currentExerciseName`(延续上一个动作的上下文)。

**处理**：音频 → 腾讯 ASR 转文字 → DeepSeek 解析四 intent → resolveExercise → 智能确认决策
（与云函数 `voiceParse/_handler.js` 完全相同的逻辑，搬过来即可）。

**成功响应** `{ ok:true, data:{...} }`：
```json
{
  "voiceEntryId": "string",
  "status": "auto_saved | needs_confirmation | unknown",
  "intent": "string",
  "rawText": "识别/传入的文本",
  "needsConfirmation": true,
  "confirmationReason": "string",
  "createdSetIds": ["..."],        // status=auto_saved 时已写库的组 id
  "parsed": { },                    // 解析出的组，供确认卡渲染
  "currentExerciseName": "string"
}
```
**失败**：用 HTTP 4xx/5xx + `{ok:false,error:{code,message}}`（前端 catch 后走「改用手动」）。

## 2. 语音确认 `POST /api/v1/voice-entries/{voiceEntryId}/confirm`

替代 setsConfirm，以 `voiceEntryId` 幂等。

body：
```json
{ "action": "confirm | reject", "editedSets": [/*ParsedSet snake_case*/], "editedExerciseName": "string" }
```
> `editedSets` 用 **ParsedSet(snake_case)**，区别于手动加组 `/sets` 的 SetInput(camelCase)——沿用云函数原约定。

成功响应 `data`：
```json
{ "voiceEntryId":"...", "status":"confirmed | rejected", "createdSetIds":["..."], "currentExerciseName":"..." }
```

## 3. 手动加组 —— 已存在，无需改

`POST /api/v1/sessions/{sessionId}/sets`（前端已在用 `Set.addToSession`）。合并后语音和手动**都走这条**。

## 4. 分享小程序码 `GET /api/v1/share/qrcode`

替代 shareQrcode。query：`page`(默认 `pages/home/home`)、`scene`(默认 `from=share`)、可选 `envVersion`。

**处理**：后端用 appid/secret 取 access_token → `wxacode.getUnlimited` 生成带 scene 的小程序码
（access_token 后端可缓存，比云函数更合适）。

成功响应 `data`：`{ "image": "https://… 或 data:image/png;base64,…" }`
失败：4xx（前端拿不到就画「生成中」占位，不阻塞分享图合成）。

---

## 音频存储

音频是**临时的**（只为 ASR 一次性识别），后端收到 multipart 直接转腾讯 ASR、识别完即弃，
**不需要持久化、不需要对象存储(COS)**。省掉原来 `wx.cloud.uploadFile` → 云存储那一步。

## 后端环境变量（从原云函数 .env.local 搬过来）

- `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` / `DEEPSEEK_BASE_URL`
- `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` / `TENCENT_ASR_REGION` / `TENCENT_ASR_ENGINE`
- 微信 `APPID` / `APP_SECRET`（给 share/qrcode 取 access_token 用）
- `DATABASE_URL`（已有，指向腾讯云 PG）

## 前端配合改动（我负责，在本仓库）

- `service/api.js` 新增 `Voice.parse / Voice.confirm / Share.qrcode`
- `service/share.js` 的 `fetchMiniCode` 改调 REST
- `pages/workout/workout.js` 语音路径：录音用 `wx.uploadFile` 直传 ① 接口；确认走 ② 接口；写库统一走 ③
- 删除 `service/cloud.js` 依赖；`app.js` 去掉 `wx.cloud.init`；`constants.js` 清理 `CLOUD_*`
- 整个 `cloudfunctions/` 目录上线后可移除（先留着备份逻辑）
