// 登录态管理 —— 微信登录换取 JWT，本地缓存 token 与 user
// 注意：以命名空间方式引入 request，并在调用时取属性（req.post 等），
// 避免「顶层解构」在 WeChat 构建/加载顺序下偶发取到 undefined（post is not a function）。
const req = require('./request');
const { DEV_LOGIN, DEV_OPENID } = require('./constants');

const TOKEN_KEY = 'kl_token'; // 与 utils/request.js 保持一致
const USER_KEY = 'kl_user';
const DEV_OPENID_KEY = 'kl_dev_openid';

// 开发登录：生成并持久化一个稳定的测试 openid（每台设备一个测试账号）
function getDevOpenid() {
  // 联调对齐：优先用 constants.DEV_OPENID，便于多端复用同一个本地测试账号。
  if (DEV_OPENID) return DEV_OPENID;
  let id = wx.getStorageSync(DEV_OPENID_KEY);
  if (!id) {
    id = 'dev_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
    wx.setStorageSync(DEV_OPENID_KEY, id);
  }
  return id;
}

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || '';
}

function setToken(token) {
  if (token) wx.setStorageSync(TOKEN_KEY, token);
}

function getUser() {
  return wx.getStorageSync(USER_KEY) || null;
}

function setUser(user) {
  if (user) {
    wx.setStorageSync(USER_KEY, user);
    const app = getApp();
    if (app) app.globalData.userInfo = user;
  }
}

function clear() {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(USER_KEY);
  const app = getApp();
  if (app) app.globalData.userInfo = null;
}

// 调微信登录拿 code
function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => (res.code ? resolve(res.code) : reject(new Error('wx.login 未返回 code'))),
      fail: (e) => reject(new Error((e && e.errMsg) || 'wx.login 失败')),
    });
  });
}

/**
 * 用 code 换取 JWT 并落地登录态
 * @param {object} [profile] { nickname, avatarUrl } 可选
 * @returns {Promise<{token,user,isNewUser}>}
 */
async function login(profile = {}) {
  const body = {};
  if (DEV_LOGIN) {
    // 本地开发：直传 openid（模拟器里 code 会被微信判为 invalid）
    body.openid = getDevOpenid();
  } else {
    // 生产：用真实 wx.login 的 code 换 openid（后端需配好本小程序 appid/secret）
    body.code = await wxLogin();
  }
  if (profile.nickname) body.nickname = profile.nickname;
  if (profile.avatarUrl) body.avatarUrl = profile.avatarUrl;
  // 登录接口不需要鉴权
  const data = await req.post('/api/v1/auth/login', body, { auth: false });
  setToken(data.token);
  setUser(data.user);
  return data;
}

// 更新资料（注册补全 / 改昵称头像 / 单位 / 主题）
async function updateProfile(fields) {
  const data = await req.patch('/api/v1/users/me', fields);
  if (data && data.user) setUser(data.user);
  return data.user;
}

// 拉取当前用户（校验 token 有效性）
async function fetchMe() {
  const data = await req.get('/api/v1/auth/me');
  if (data && data.user) setUser(data.user);
  return data.user;
}

exports.getToken = getToken;
exports.setToken = setToken;
exports.getUser = getUser;
exports.setUser = setUser;
exports.clear = clear;
exports.login = login;
exports.updateProfile = updateProfile;
exports.fetchMe = fetchMe;
exports.wxLogin = wxLogin;
exports.USER_KEY = USER_KEY;
exports.TOKEN_KEY = TOKEN_KEY;
