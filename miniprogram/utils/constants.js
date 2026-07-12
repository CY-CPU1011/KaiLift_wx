// 全局常量 —— 不硬编码散落（design §8）

// 自管服务器（阿里云 ECS + Nginx + HTTPS）。小程序业务请求走 wx.request 打这个域名。
// 真机与开发者工具同址；需在 mp 后台「request 合法域名」加入本域名（已配）。
const LAN_HOST = 'https://kailift.chenyi.uno';
// ⚠️ 本地联调：开发者工具临时指向本机 dev server（next dev -p 20020，局域网 IP）。
//    需在开发者工具勾「详情 → 本地设置 → 不校验合法域名/HTTPS 证书」（http 才放行）。
//    联调结束、上线前务必改回 'https://kailift.chenyi.uno'。
// const LOCAL_HOST = 'http://192.168.1.7:20020';
const LOCAL_HOST = 'https://kailift.chenyi.uno';

// 真机（ios/android）用 LAN_HOST，开发者工具用 LOCAL_HOST。
function resolveApiBase() {
  try {
    const info = (wx.getDeviceInfo ? wx.getDeviceInfo() : wx.getSystemInfoSync()) || {};
    if (info.platform && info.platform !== 'devtools') return LAN_HOST;
  } catch (e) {}
  return LOCAL_HOST;
}
const API_BASE = resolveApiBase();

// 微信云托管 callContainer 配置。环境 ID 必须与 kailift 服务所在环境完全一致。
// 该通道无需配置小程序 request 合法域名，也无需自购域名或 ICP 备案。
const CLOUD_ENV = 'prod-d2gk135v6be9ec84f';
const CLOUD_SERVICE = 'kailift';

// 分享小程序码「扫码打开的版本」（传给后端 /share/qrcode 的 envVersion，PRD §3.7）。
//   - 开发/联调：先在开发者工具「上传」一个版本并在 mp 后台设为体验版 → 这里填 'trial'（扫码打开体验版）。
//   - 正式上线：填 'release'（默认）。
// 注意：只影响「扫码打开哪个版本」；图片生成本身用 checkPath:false，不受发布状态影响。
const SHARE_QR_ENV = 'release';

// 开发者工具模拟器使用稳定测试 openid，避开模拟器 wx.login code 偶发 invalid code。
// 真机（含真机调试、体验版、正式版）自动关闭，始终走真实 wx.login。
function isLocalDevelopmentApi(base) {
  return /^http:\/\/(?:localhost|127(?:\.\d+){3}|10(?:\.\d+){3}|192\.168(?:\.\d+){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d+){2})(?::\d+)?(?:\/|$)/i.test(base || '');
}

function resolveDevLogin() {
  try {
    const info = (wx.getDeviceInfo ? wx.getDeviceInfo() : wx.getSystemInfoSync()) || {};
    // 开发者工具指向线上域名时也必须走真实 wx.login；只有明确指向本机/局域网 HTTP API 才直登。
    return info.platform === 'devtools' && isLocalDevelopmentApi(API_BASE);
  } catch (e) {
    return false;
  }
}
const DEV_LOGIN = resolveDevLogin();

// 开发期固定测试 openid（DEV_LOGIN 时走「直接传 openid」登录用，便于复用同一测试账号数据）。
// 留空＝每台设备生成随机稳定 openid。需要复用 seed 数据时可在本地临时改成 seed_openid_alex。
// 上线和公开源码均保持空值，避免不同开发者复用同一个测试账号。
const DEV_OPENID = '';

// 单位换算：一律存 kg，展示按 unitWeight 转换
const KG_TO_LB = 2.2046;

// 负重类型
const LOAD_TYPES = {
  weighted: '负重',
  bodyweight: '自重',
  assisted: '助力',
  duration: '计时',
  unknown: '未知',
};

// 组类型
const SET_TYPES = {
  warmup: '热身',
  working: '正式',
  drop: '递减',
  failure: '力竭',
  backoff: '退让',
  unknown: '未知',
};

// 部位（FilterChips / PR 墙）
const BODY_PARTS = ['全部', '胸', '背', '腿', '肩', '手臂', '核心'];

// 动作库一级 Tab。展示文案统一用「手臂」（与数据页 PR 墙一致）；
// ⚠ 后端 bodyPart 存的是「臂」，查询/匹配前用 utils/exercise.toQueryPart 把「手臂」换回「臂」，
// 展示时用 toDisplayPart 把「臂」换回「手臂」。二级 muscle 选项不写死，从列表数据动态去重生成。
const EXERCISE_BODY_PARTS = ['全部', '胸', '背', '腿', '肩', '手臂', '核心'];

// 动作库部位「展示名 ↔ 后端取值」仅手臂一处不同（手臂 ⇄ 臂），集中在此便于维护。
const EXERCISE_PART_DISPLAY = '手臂';
const EXERCISE_PART_QUERY = '臂';

// 动作历史 PR 类型中文映射（GET /exercises/{id}/history 的 records[].recordType）。
const PR_TYPE_LABELS = {
  max_weight: '最大重量',
  max_volume_set: '最大单组容量',
  estimated_1rm: '预估 1RM',
};

// 部位 → 强调色 token（PRCard 竖条）
const PART_TONE = {
  胸: 'pink', 背: 'blue', 腿: 'green', 肩: 'amber', 手臂: 'purple', 核心: 'blue',
};

// 录音参数（PRD §3.3）
const RECORDER_OPTIONS = {
  duration: 20000,        // 硬上限约 20s
  sampleRate: 16000,
  numberOfChannels: 1,
  encodeBitRate: 48000,
  format: 'mp3',
};

// sets/{id}/restore 端点就绪开关（计划 §4 第5轮）。
// 后端已上线 POST /sets/{id}/restore（api.json 已含），置 true 走软删恢复（保留原 id/组序/PR）。
// 若对接的后端未到最新，restore 会 404，onUndoDelete 会优雅回退到「重新加组」。
const SETS_RESTORE_READY = true;

// 热力图等级数
const HEATMAP_LEVELS = 5;

exports.API_BASE = API_BASE;
exports.CLOUD_ENV = CLOUD_ENV;
exports.CLOUD_SERVICE = CLOUD_SERVICE;
exports.SHARE_QR_ENV = SHARE_QR_ENV;
exports.DEV_LOGIN = DEV_LOGIN;
exports.DEV_OPENID = DEV_OPENID;
exports.isLocalDevelopmentApi = isLocalDevelopmentApi;
exports.KG_TO_LB = KG_TO_LB;
exports.LOAD_TYPES = LOAD_TYPES;
exports.SET_TYPES = SET_TYPES;
exports.BODY_PARTS = BODY_PARTS;
exports.EXERCISE_BODY_PARTS = EXERCISE_BODY_PARTS;
exports.EXERCISE_PART_DISPLAY = EXERCISE_PART_DISPLAY;
exports.EXERCISE_PART_QUERY = EXERCISE_PART_QUERY;
exports.PR_TYPE_LABELS = PR_TYPE_LABELS;
exports.PART_TONE = PART_TONE;
exports.RECORDER_OPTIONS = RECORDER_OPTIONS;
exports.SETS_RESTORE_READY = SETS_RESTORE_READY;
exports.HEATMAP_LEVELS = HEATMAP_LEVELS;
