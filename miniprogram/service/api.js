// 服务层 —— 与后端 REST API（http://localhost:20020）通信
// 对齐 api.json：统一信封 {ok,data}/{ok,error}，由 utils/request 解包后这里直接拿 data。
// 组件不直接调本层；页面负责取数后传给组件（design §8）。
// 以命名空间方式引入并在调用时取属性，避免顶层解构在 WeChat 下偶发 undefined。
const req = require('../utils/request');
const { unwrapSessionDetail } = require('../utils/data');
const get = (...a) => req.get(...a);
const post = (...a) => req.post(...a);
const patch = (...a) => req.patch(...a);
const del = (...a) => req.del(...a);
const upload = (...a) => req.upload(...a);
const qs = (...a) => req.qs(...a);

/* ---------------- Auth ---------------- */
const Auth = {
  // 登录见 utils/auth.login；此处仅暴露 me
  me: () => get('/api/v1/auth/me'), // -> { user }
};

/* ---------------- User ---------------- */
const User = {
  me: () => get('/api/v1/users/me'),                  // -> { user }
  update: (fields) => patch('/api/v1/users/me', fields), // -> { user }
};

/* ---------------- Exercise 动作库 ---------------- */
const Exercise = {
  list: (params) => get('/api/v1/exercises' + qs(params)),  // {search,bodyPart,muscle,category} -> { items }
  detail: (id) => get(`/api/v1/exercises/${id}`),           // -> { exercise }
  history: (id) => get(`/api/v1/exercises/${id}/history`),  // -> { exerciseId,exerciseName,records,history }
  create: (body) => post('/api/v1/exercises', body),        // {name,aliases,bodyPart,equipment} -> { exercise }
  update: (id, body) => patch(`/api/v1/exercises/${id}`, body),
  remove: (id) => del(`/api/v1/exercises/${id}`),
};

/* ---------------- Session 训练记录 ---------------- */
const Session = {
  list: (params) => get('/api/v1/sessions' + qs(params)), // {status,page,pageSize} -> { items,total,page,pageSize }
  detail: async (id) => unwrapSessionDetail(await get(`/api/v1/sessions/${id}`)), // -> SessionDetail
  start: (name) => post('/api/v1/sessions', { name: name || null }), // -> { session }
  update: (id, body) => patch(`/api/v1/sessions/${id}`, body), // {name,status} -> { session }
  remove: (id) => del(`/api/v1/sessions/${id}`),
  // 便捷：结束 / 取消。auto:true 为「空闲自动结束」——成就/经验照常落库但响应不返回 achievement
  // （奖励转入待领，见 Reward），前端不当场弹庆祝；手动结束（默认）照旧含 achievement。
  finish: (id, auto = false) => patch(`/api/v1/sessions/${id}`, { status: 'completed', auto }),
  cancel: (id) => patch(`/api/v1/sessions/${id}`, { status: 'cancelled' }),
  // 当前进行中训练（用于恢复）
  active: async () => {
    const data = await get('/api/v1/sessions' + qs({ status: 'active', pageSize: 1 }));
    return data.items && data.items.length ? data.items[0] : null;
  },
  // 动作级（WorkoutExercise）操作 —— 单次调用替代「逐组」组合
  deleteExercise: (sessionId, weId) =>
    del(`/api/v1/sessions/${sessionId}/exercises/${weId}`), // -> { id }
  restoreExercise: (sessionId, weId) =>
    post(`/api/v1/sessions/${sessionId}/exercises/${weId}/restore`), // -> { workoutExercise }
  replaceExercise: (sessionId, weId, exerciseName) =>
    patch(`/api/v1/sessions/${sessionId}/exercises/${weId}`, { exerciseName }), // -> { workoutExercise }
};

/* ---------------- Set 训练组（语音/手动统一链路） ---------------- */
const Set = {
  // 手动/语音加组：exerciseName + sets[]，走与语音一致写库链路
  addToSession: (sessionId, exerciseName, sets) =>
    post(`/api/v1/sessions/${sessionId}/sets`, { exerciseName, sets }), // -> { createdSetIds, currentExerciseName }
  update: (setId, body) => patch(`/api/v1/sets/${setId}`, body), // SetInput -> { set }
  remove: (setId) => del(`/api/v1/sets/${setId}`),
  // 恢复软删的组（后端就绪后启用，见 constants.SETS_RESTORE_READY；未就绪时页面回退为重新加组）
  restore: (setId) => post(`/api/v1/sets/${setId}/restore`), // -> { set }
};

/* ---------------- Voice 语音（合并进 REST，替代原云函数 voiceParse/setsConfirm） ---------------- */
// 见 docs/后端对接-语音合并到REST.md。响应与原云函数同构：
//   { voiceEntryId, status: auto_saved|needs_confirmation|unknown, intent, rawText,
//     needsConfirmation, confirmationReason, createdSetIds[], parsed, currentExerciseName }
// 失败走 HTTP 4xx/5xx（502 asr_failed/llm_failed、404、409），由 request 解包后 reject。
const Voice = {
  // 文本路径（跳过 ASR，联调/降级）：rawText + 可选 { voiceEntryId, currentExerciseName }
  parseText: (sessionId, rawText, opts = {}) =>
    post(`/api/v1/sessions/${sessionId}/voice`, Object.assign({ rawText }, opts)),
  // 音频路径（callContainer JSON，字段名 audioBase64）：filePath + 可选 formData { voiceFormat, voiceEntryId, currentExerciseName }
  parseAudio: (sessionId, filePath, formData = {}) =>
    upload({ url: `/api/v1/sessions/${sessionId}/voice`, filePath, name: 'audio', formData }),
  // 确认卡「确认/放弃」，以 voiceEntryId 幂等：{ action, editedSets?, editedExerciseName?, targetSetId? }
  // -> { voiceEntryId, status: confirmed|rejected, createdSetIds, currentExerciseName }
  confirm: (voiceEntryId, body) =>
    post(`/api/v1/voice-entries/${voiceEntryId}/confirm`, body),
};

/* ---------------- Share 分享小程序码（合并进 REST，替代原云函数 shareQrcode） ---------------- */
const Share = {
  // {page, scene, envVersion?} -> { image: 'https://… 或 data:image/png;base64,…' }
  qrcode: (params) => get('/api/v1/share/qrcode' + qs(params)),
};

/* ---------------- Reward 待领奖励（空闲自动结束的庆祝补放，见 docs/后端对接-训练自动结束.md）------- */
// 自动结束的训练把升级/升段/解锁存为「待领」，进 App 时拉取补弹庆祝，渲染后 ack 清除。
const Reward = {
  pending: () => get('/api/v1/rewards/pending'),                     // -> { items: [{ sessionId,name,finishedAt,autoFinished,reward }] }
  ack: (sessionIds) => post('/api/v1/rewards/ack', { sessionIds }), // -> { cleared }
};

/* ---------------- PersonalRecord PR ---------------- */
const PR = {
  list: (params) => get('/api/v1/personal-records' + qs(params)), // {exerciseId} -> { items }
};

/* ---------------- Stats 聚合（首页 / 数据页） ---------------- */
const Stats = {
  home: () => get('/api/v1/stats/home'),                          // -> { week, lastWorkout, monthTrainedDays }
  heatmap: (params) => get('/api/v1/stats/heatmap' + qs(params)), // {year} -> { year, availableYears, days }
  day: (params) => get('/api/v1/stats/day' + qs(params)),         // {date} -> { date, totalVolumeKg, sessionCount, items }
  trend: (params) => get('/api/v1/stats/trend' + qs(params)),     // {granularity,range} -> { granularity, points }
  lifetime: () => get('/api/v1/stats/lifetime'),                  // -> { totalSessions, totalVolumeKg, exerciseTypeCount }
};

/* ---------------- Achievement 成就墙 / 段位 / 等级（EXP，单轨） ---------------- */
// 资料卡（等级/EXP/段位奖牌）+ 成就墙（5 类 23 枚）一次拉全。
// 训练完成的结算（升级/升段/解锁）走 Session.finish 返回的 achievement 字段，不在此层。
const Achievement = {
  get: () => get('/api/v1/achievements'), // -> { exp, level, rank, unlockedCount, totalCount, categories }
};

exports.Auth = Auth;
exports.User = User;
exports.Exercise = Exercise;
exports.Session = Session;
exports.Set = Set;
exports.Voice = Voice;
exports.Share = Share;
exports.Reward = Reward;
exports.PR = PR;
exports.Stats = Stats;
exports.Achievement = Achievement;
