// 统一请求封装 —— 处理 Bearer 鉴权、{ok,data}/{ok,error} 信封、401 跳登录
// 传输走 wx.request 打自管服务器（API_BASE）；需在 mp 后台配 request 合法域名。
const { API_BASE } = require('./constants');

const TOKEN_KEY = 'kl_token';

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || '';
}

function makeErr(code, message) {
  const e = new Error(message || code);
  e.code = code;
  e.message = message || code;
  return e;
}

let redirectingToLogin = false;
function handleUnauthorized() {
  // 清除登录态
  try {
    wx.removeStorageSync(TOKEN_KEY);
    wx.removeStorageSync('kl_user');
  } catch (e) {}
  const app = getApp();
  if (app) app.globalData.userInfo = null;
  if (redirectingToLogin) return;
  redirectingToLogin = true;
  const pages = getCurrentPages();
  const cur = pages.length ? pages[pages.length - 1].route : '';
  if (cur !== 'pages/login/login') {
    wx.reLaunch({
      url: '/pages/login/login',
      complete: () => { redirectingToLogin = false; },
    });
  } else {
    redirectingToLogin = false;
  }
}

/**
 * @param {object} opts
 * @param {string} opts.url    以 /api/v1 开头的路径
 * @param {string} [opts.method='GET']
 * @param {object} [opts.data]
 * @param {boolean} [opts.auth=true]  是否带 token
 * @param {object} [opts.header]
 * @returns {Promise<any>} resolve 为信封中的 data
 */
// 信封解包：callContainer 的 res.data 通常已是对象；个别情况下是字符串，做一次兜底 parse。
function resolveEnvelope(res, method, url, resolve, reject) {
  if (res.statusCode === 401) {
    handleUnauthorized();
    return reject(makeErr('unauthorized', '登录已过期，请重新登录'));
  }
  let body = res.data;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }
  if (body && body.ok) return resolve(body.data);
  // 透出 HTTP 状态码，便于定位（后端非 {ok} 信封 / 4xx5xx 时不再只显示「请求失败」）
  const err = (body && body.error)
    || { code: 'http_' + res.statusCode, message: '请求失败（HTTP ' + res.statusCode + '）' };
  console.warn('[api] 请求未成功', method, url, 'HTTP', res.statusCode, body);
  return reject(makeErr(err.code, err.message));
}

// 自动重试：扛住云托管「容器冷启动 / 数据库连接抖动」造成的瞬时失败，让登录与数据加载自愈，
// 不再「一次失败就报错」。分两类，安全第一：
//  - 503 / 超时 / 网络失败 / 其它 5xx → 只重试 GET。
//  - 登录 code 是一次性凭证：超时时后端可能已经消费，不能拿同一个 code 自动重试；
//    其余写操作也不自动重试，避免响应丢失后重复产生副作用。
const RETRY_BUDGET_MS = 25000; // 重试总预算，覆盖容器冷启动窗口（~15-25s）
function backoffMs(n) { return Math.min(Math.round(800 * Math.pow(1.6, n)), 4000); }

function request(opts) {
  const { url, method = 'GET', data, auth = true, header = {} } = opts;
  const idempotent = method === 'GET';
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const h = Object.assign(
        { 'content-type': 'application/json' },
        header,
      );
      if (auth) {
        const t = getToken();
        if (t) h.Authorization = 'Bearer ' + t;
      }
      const within = () => Date.now() - startedAt < RETRY_BUDGET_MS;
      const retryLater = () => setTimeout(() => attempt(n + 1), backoffMs(n));
      const call = {
        url: API_BASE + url,
        method,
        header: h,
        timeout: 15000,
        success(res) {
          const sc = res.statusCode;
          // 503 也只重试幂等请求；不能假设所有 503 都发生在应用执行之前。
          if (sc === 503 && idempotent && within()) return retryLater();
          // 其它 5xx（含数据库瞬时错误）→ 仅幂等请求重试
          if (sc >= 500 && sc !== 501 && idempotent && within()) return retryLater();
          resolveEnvelope(res, method, url, resolve, reject);
        },
        fail(e) {
          // 超时 / 网络失败 → 仅幂等请求重试，预算用尽再 reject
          if (idempotent && within()) return retryLater();
          reject(makeErr('network', (e && e.errMsg) || '网络异常，请检查连接'));
        },
      };
      if (data !== undefined) call.data = data;
      wx.request(call);
    };
    attempt(0);
  });
}

/**
 * 文件上传（语音音频）—— callContainer 不支持 multipart，读取为 base64 后通过 JSON 发送。
 * @param {object} opts
 * @param {string} opts.url       以 /api/v1 开头的路径
 * @param {string} opts.filePath  本地临时文件路径
 * @param {string} [opts.name='file'] base64 字段名前缀
 * @param {object} [opts.formData] 附带的普通字段
 * @param {boolean} [opts.auth=true]
 * @returns {Promise<any>} resolve 为信封中的 data
 */
function upload(opts) {
  const { url, filePath, name = 'file', formData = {}, auth = true, header = {} } = opts;
  return new Promise((resolve, reject) => {
    let base64;
    try {
      base64 = wx.getFileSystemManager().readFileSync(filePath, 'base64');
    } catch (e) {
      return reject(makeErr('file_read', '读取录音文件失败'));
    }
    const data = Object.assign({ [name + 'Base64']: base64 }, formData);
    request({ url, method: 'POST', data, auth, header }).then(resolve, reject);
  });
}

const get = (url, opts = {}) => request(Object.assign({ url, method: 'GET' }, opts));
const post = (url, data, opts = {}) => request(Object.assign({ url, method: 'POST', data }, opts));
const patch = (url, data, opts = {}) => request(Object.assign({ url, method: 'PATCH', data }, opts));
const del = (url, opts = {}) => request(Object.assign({ url, method: 'DELETE' }, opts));

// 拼 query string
function qs(params) {
  if (!params) return '';
  const parts = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
  return parts.length ? '?' + parts.join('&') : '';
}

// 显式逐项导出，避免微信开发者工具的增量模块编译缓存旧的导出成员表。
// 使用对象字面量整体替换 module.exports 时，新增方法可能不会进入已缓存模块。
exports.request = request;
exports.upload = upload;
exports.get = get;
exports.post = post;
exports.patch = patch;
exports.del = del;
exports.qs = qs;
exports.getToken = getToken;
exports.TOKEN_KEY = TOKEN_KEY;
exports.makeErr = makeErr;
