// 服务层 —— 分享小程序码获取（合并进 REST 后端，PRD §3.7）。
//
// 链路：后端 `GET /api/v1/share/qrcode` 用 access_token + wxacode.getUnlimited 生成「带 scene 的真实可扫小程序码」，
//   返回 { image }（https 链接或 data:image/png;base64 ）；本层把它落成本地临时路径
//   （canvas createImage 不直接支持网络/base64 以外的写入），交页面绘进分享图。
//
// 降级约定：失败 / 拿不到图一律 resolve(null)（绝不抛错、不阻塞合成）；
//   页面拿到 null 时画「小程序码生成中」占位方块，主数据照常准确呈现。
const api = require('./api');

// 把后端返回的 image 落成本地路径：
//   - data:image/...;base64,xxx -> 写临时文件返回路径
//   - https://...               -> downloadFile 返回临时路径（需在 downloadFile 合法域名内）
//   - 其它（已是本地路径）       -> 原样返回
//   - 失败 -> null
function resolveImageToLocalPath(image) {
  return new Promise((resolve) => {
    if (!image || typeof image !== 'string') { resolve(null); return; }
    if (image.indexOf('data:image') === 0) {
      try {
        const base64 = image.slice(image.indexOf(',') + 1);
        const fs = wx.getFileSystemManager();
        const path = `${wx.env.USER_DATA_PATH}/sharecode_${Date.now()}.png`;
        fs.writeFile({
          filePath: path,
          data: base64,
          encoding: 'base64',
          success() { resolve(path); },
          fail() { resolve(null); },
        });
      } catch (e) {
        resolve(null);
      }
      return;
    }
    if (/^https?:\/\//.test(image)) {
      wx.downloadFile({
        url: image,
        success(res) { resolve((res && res.tempFilePath) || null); },
        fail() { resolve(null); },
      });
      return;
    }
    resolve(image);
  });
}

// 获取小程序码：成功返回本地临时路径（字符串），失败 / 未接线返回 null。
// payload 形如 { page?, scene?, envVersion? }；开发期未发布想扫码测试可传 envVersion:'trial'。
function fetchMiniCode(payload) {
  return new Promise((resolve) => {
    const p = payload || {};
    const params = {
      page: p.page || 'pages/home/home',
      scene: p.scene || 'from=share',
    };
    if (p.envVersion) params.envVersion = p.envVersion;
    api.Share.qrcode(params)
      .then((data) => resolveImageToLocalPath(data && data.image))
      .then(resolve)
      .catch(() => resolve(null));
  });
}

exports.fetchMiniCode = fetchMiniCode;
