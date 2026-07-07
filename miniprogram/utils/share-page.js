// 页面分享能力封装：统一开启右上角转发、朋友圈与复制链接参数。
// 用 withSharePage 包住 Page options，避免每个页面重复维护生命周期逻辑。
const DEFAULT_TITLE = '开练 KaiLift';
const DEFAULT_PATH = '/pages/home/home';

function cleanValue(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function buildCopyQuery(query) {
  const source = query || {};
  const pairs = [];
  Object.keys(source).forEach((key) => {
    const value = cleanValue(source[key]);
    if (!key || value === '') return;
    pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
  });
  return pairs.join('&');
}

function normalizePath(pagePath) {
  const path = pagePath || DEFAULT_PATH;
  return path.charAt(0) === '/' ? path : '/' + path;
}

function buildSharePath(pagePath, query) {
  const qs = buildCopyQuery(query);
  const path = normalizePath(pagePath);
  return qs ? path + '?' + qs : path;
}

function pickQuery(ctx, config, keyName) {
  const source = (ctx && ctx.__sharePageQuery) || {};
  const custom = config && config.query;
  if (typeof custom === 'function') {
    return custom.call(ctx, source) || {};
  }

  const keys = (config && config[keyName]) || (config && config.queryKeys);
  if (!keys || !keys.length) {
    const all = {};
    Object.keys(source).forEach((key) => {
      all[key] = source[key];
    });
    return all;
  }

  const result = {};
  keys.forEach((key) => {
    const value = source[key];
    if (value !== null && value !== undefined && value !== '') result[key] = value;
  });
  return result;
}

function resolveTitle(ctx, config) {
  if (config && typeof config.title === 'function') {
    return config.title.call(ctx) || DEFAULT_TITLE;
  }
  return (config && config.title) || DEFAULT_TITLE;
}

function callOriginal(fn, ctx, args) {
  if (typeof fn === 'function') return fn.apply(ctx, args);
  return undefined;
}

function showShareMenu() {
  if (typeof wx === 'undefined' || !wx || typeof wx.showShareMenu !== 'function') return;
  wx.showShareMenu({
    withShareTicket: false,
    menus: ['shareAppMessage', 'shareTimeline'],
  });
}

function bindCopyUrl(ctx, config) {
  if (typeof wx === 'undefined' || !wx || typeof wx.onCopyUrl !== 'function') return;
  const listener = function () {
    return {
      query: buildCopyQuery(pickQuery(ctx, config, 'copyQueryKeys')),
    };
  };
  ctx.__shareCopyUrlListener = listener;
  wx.onCopyUrl(listener);
}

function unbindCopyUrl(ctx) {
  if (typeof wx === 'undefined' || !wx || typeof wx.offCopyUrl !== 'function') return;
  const listener = ctx && ctx.__shareCopyUrlListener;
  try {
    if (listener) wx.offCopyUrl(listener);
    else wx.offCopyUrl();
  } catch (e) {
    wx.offCopyUrl();
  }
  if (ctx) ctx.__shareCopyUrlListener = null;
}

function withSharePage(pageOptions, shareOptions) {
  const options = pageOptions || {};
  const config = Object.assign({
    title: DEFAULT_TITLE,
    path: DEFAULT_PATH,
  }, shareOptions || {});

  const onLoad = options.onLoad;
  const onShow = options.onShow;
  const onHide = options.onHide;
  const onUnload = options.onUnload;
  const onShareAppMessage = options.onShareAppMessage;
  const onShareTimeline = options.onShareTimeline;

  options.onLoad = function () {
    this.__sharePageQuery = (arguments && arguments[0]) || {};
    return callOriginal(onLoad, this, arguments);
  };

  options.onShow = function () {
    showShareMenu();
    unbindCopyUrl(this);
    bindCopyUrl(this, config);
    return callOriginal(onShow, this, arguments);
  };

  options.onHide = function () {
    unbindCopyUrl(this);
    return callOriginal(onHide, this, arguments);
  };

  options.onUnload = function () {
    unbindCopyUrl(this);
    return callOriginal(onUnload, this, arguments);
  };

  options.onShareAppMessage = function () {
    const custom = callOriginal(onShareAppMessage, this, arguments);
    if (custom) return custom;
    return {
      title: resolveTitle(this, config),
      path: buildSharePath(config.path, pickQuery(this, config, 'queryKeys')),
    };
  };

  options.onShareTimeline = function () {
    const custom = callOriginal(onShareTimeline, this, arguments);
    if (custom) return custom;
    return {
      title: resolveTitle(this, config),
      query: buildCopyQuery(pickQuery(this, config, 'queryKeys')),
    };
  };

  return options;
}

module.exports = {
  DEFAULT_TITLE,
  DEFAULT_PATH,
  buildCopyQuery,
  buildSharePath,
  withSharePage,
};
