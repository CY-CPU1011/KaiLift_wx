// 训练分享图 —— 取 Session 详情 + PR + 本月训练天数，构造视图模型后用 canvas 合成像素风海报。
// 自定义导航栏；loading / error / ready 三态；小程序码可插拔（未接线则画占位）。
// ⚠️ 微信 babel 坑：禁用数组解构 / 数组展开，一律索引访问 / .slice() / .concat()。
const { Session, PR, Stats } = require('../../service/api');
const { buildShareViewModel } = require('../../utils/share-canvas');
const { fetchMiniCode } = require('../../service/share');
const { SHARE_QR_ENV } = require('../../utils/constants');
const { withSharePage } = require('../../utils/share-page');

// 画布逻辑尺寸（px 思路；导出时按 dpr 放大）。
// 宽度固定；高度随内容（主要动作条数）动态计算，避免底部二维码与主要动作重叠。
const CANVAS_W = 600;
const CANVAS_MIN_H = 820;     // 内容较少时的最小高度，避免海报过扁

// —— 纵向布局常量（computePosterHeight「先测高」与 drawPoster「后绘制」共用，二者必须严格对应）——
const LY_MARGIN = 28;         // 外边距（卡片到画布边）
const LY_BRAND_TOP = 40;      // 品牌块顶相对 cardY 的偏移
const LY_BRAND_BOX_H = 72;    // 品牌块高度
const LY_BRAND_TEXT_BASELINE = 49; // 品牌文字 baseline 相对品牌块顶的偏移
const LY_HEADLINE_BASELINE = 168;  // 主标题 baseline 相对 cardY 的偏移
const LY_GRID_TOP = 250;      // 四宫格顶相对 cardY 的偏移
const LY_GRID_H = 96;         // 宫格高
const LY_GRID_GAP = 16;       // 宫格间距
const LY_AFTER_GRID = 36;     // 四宫格底 → 主要动作标题 baseline
const LY_EX_LABEL_GAP = 14;   // 主要动作标题 → 首条
const LY_EX_ROW = 40;         // 每条动作行高
const LY_INC_GAP = 48;        // 上方 → 激励行 baseline
const LY_INC_BOX_UP = 34;     // 激励框相对 baseline 的上移量
const LY_INC_BOX_H = 52;      // 激励框高
const LY_CODE_GAP = 28;       // 激励框底 → 二维码块顶
const LY_CODE_SIZE = 132;     // 二维码块边长
const LY_BOTTOM_PAD = 28;     // 二维码块底 → 卡片底内边距
const BRAND_FONT_SIZE = 34;   // 品牌文字字号
const BRAND_PAD_X = 28;       // 品牌块水平内边距
const FOOTER_TITLE_OFFSET_Y = 32;  // 二维码顶 → 扫码引导 baseline
const FOOTER_SLOGAN_OFFSET_Y = 68; // 二维码顶 → slogan baseline
const FOOTER_DATE_BOTTOM_GAP = 12; // 二维码底 → 日期 baseline 间距
const DATE_FONT_SIZE = 20;    // 底部日期字号

// 像素风配色（与 tokens 对齐；canvas 不能用 var()，此处取对应色值）。
const COLOR = {
  ink: '#2B2B2B',         // 描边 / 深色 --c-ink
  surface: '#FFFFFF',     // --surface
  bgPage: '#F6F8F8',      // --bg-page
  primary: '#3DD16B',     // --c-primary
  primaryStrong: '#0F8A43', // --c-primary-strong
  primarySoft: '#E9F7EE', // --c-primary-soft
  amber: '#F5BE4B',       // --c-amber
  text1: '#1A1D1F',       // --text-1
  text2: '#6E7378',       // --text-2
  text3: '#A8ACB0',       // --text-3
  textOn: '#FFFFFF',      // --text-on
};

// 主视觉图（庆祝角色）。
const IMG_CHARACTER = '/images/characters/male_celebrating.png';

Page(withSharePage({
  data: {
    statusBarHeight: 20,
    loading: true,     // 取数 + 合成中
    error: false,      // 取数失败
    sessionId: '',
    posterPath: '',    // 合成后的海报临时路径
    saving: false,     // 保存相册中
  },

  onLoad(query) {
    const app = getApp();
    if (!app.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    const sys = app && app.globalData && app.globalData.systemInfo;
    if (sys && sys.statusBarHeight) this.setData({ statusBarHeight: sys.statusBarHeight });

    const id = query && query.id;
    if (!id) {
      this.setData({ loading: false, error: true });
      return;
    }
    this.setData({ sessionId: id });
    this.loadAndRender(id);
  },

  // 取数 + 构造视图模型 + 合成
  async loadAndRender(id) {
    this.setData({ loading: true, error: false, posterPath: '' });

    // Session 详情为致命依赖；PR / 本月训练天数失败不致命，置空继续。
    let session = null;
    let prs = [];
    let monthDays = 0;
    try {
      session = await Session.detail(id);
    } catch (e) {
      session = null;
    }
    if (!session) {
      this.setData({ loading: false, error: true });
      return;
    }
    try {
      const prRes = await PR.list({});
      prs = (prRes && prRes.items) || [];
    } catch (e) {
      prs = [];
    }
    try {
      // 本月训练天数：直接读后端聚合接口（含刚结束这次），口径与首页统一。
      const home = await Stats.home();
      monthDays = (home && Number(home.monthTrainedDays)) || 0;
    } catch (e) {
      monthDays = 0;
    }

    const unit = this.getUnit();

    const vm = buildShareViewModel({ session, prs, monthDays, unit });
    this.viewModel = vm;

    try {
      const path = await this.composePoster(vm);
      this.setData({ loading: false, error: false, posterPath: path });
    } catch (e) {
      // 合成失败也给重试入口
      this.setData({ loading: false, error: true });
    }
  },

  getUnit() {
    try {
      const app = getApp();
      const u = app && app.globalData && app.globalData.userInfo && app.globalData.userInfo.unitWeight;
      return u || 'kg';
    } catch (e) {
      return 'kg';
    }
  },

  // ============ canvas 合成 ============
  // 拿 2d node -> 加载图片（含小程序码）-> 像素风绘制 -> 导出临时文件路径。
  composePoster(vm) {
    const that = this;
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery().in(that);
      query.select('#shareCanvas').fields({ node: true, size: true }).exec((res) => {
        const first = res && res[0];
        if (!first || !first.node) {
          reject(new Error('画布未就绪'));
          return;
        }
        const canvas = first.node;
        const ctx = canvas.getContext('2d');
        let dpr = 2;
        try {
          dpr = wx.getWindowInfo().pixelRatio || 2;
        } catch (e) {
          dpr = 2;
        }
        const posterH = that.computePosterHeight(vm);
        canvas.width = CANVAS_W * dpr;
        canvas.height = posterH * dpr;
        ctx.scale(dpr, dpr);

        // 并发加载主视觉图 + 小程序码（小程序码失败时为 null，画占位）。
        const pCharacter = that.loadCanvasImage(canvas, IMG_CHARACTER);
        const pCode = fetchMiniCode({ sessionId: that.data.sessionId, envVersion: SHARE_QR_ENV })
          .then((path) => (path ? that.loadCanvasImage(canvas, path) : null))
          .catch(() => null);

        Promise.all([pCharacter, pCode]).then((imgs) => {
          const character = imgs[0];
          const code = imgs[1];
          try {
            that.drawPoster(ctx, vm, character, code, posterH);
          } catch (e) {
            reject(e);
            return;
          }
          // 显式指定截取区域与输出尺寸（逻辑坐标 0,0~CANVAS_W,posterH；按 dpr 放大输出），
          // 不依赖离屏 canvas 元素的 CSS 尺寸，弹性高度下导出不被裁切。
          wx.canvasToTempFilePath({
            canvas,
            x: 0,
            y: 0,
            width: CANVAS_W,
            height: posterH,
            destWidth: CANVAS_W * dpr,
            destHeight: posterH * dpr,
            success(r) {
              resolve(r.tempFilePath);
            },
            fail(err) {
              reject(new Error((err && err.errMsg) || '导出失败'));
            },
          }, that);
        }).catch((err) => {
          reject(err);
        });
      });
    });
  },

  // 用 canvas.createImage() 加载图片，onload 后 resolve；失败 resolve(null) 不阻塞。
  loadCanvasImage(canvas, src) {
    return new Promise((resolve) => {
      try {
        const img = canvas.createImage();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      } catch (e) {
        resolve(null);
      }
    });
  },

  // 先按内容算出画布逻辑高度（弹性高度，避免底部二维码与主要动作重叠）。
  // 纵向推进与 drawPoster 严格对应：四宫格底 → 主要动作 → 激励行 → 二维码块 → 下边距。
  // 海报无文本换行，纵向量仅由「主要动作条数」决定，故此处不依赖 ctx 即可精确预测。
  computePosterHeight(vm) {
    const cardY = LY_MARGIN;
    const stats = (vm && vm.stats) || [];
    const exs = (vm && vm.mainExercises) || [];
    const gridRows = Math.ceil(stats.length / 2) || 1;
    // 四宫格底之后的 baseline
    let y = cardY + LY_GRID_TOP + gridRows * LY_GRID_H + (gridRows - 1) * LY_GRID_GAP + LY_AFTER_GRID;
    if (exs.length) {
      y += LY_EX_LABEL_GAP + exs.length * LY_EX_ROW;
    }
    y += LY_INC_GAP;                                   // → 激励行 baseline
    const incBottom = y - LY_INC_BOX_UP + LY_INC_BOX_H; // 激励框底
    const codeBottom = incBottom + LY_CODE_GAP + LY_CODE_SIZE;
    const cardBottom = codeBottom + LY_BOTTOM_PAD;
    const H = cardBottom + LY_MARGIN;                 // 卡片底再留一个外边距（上/下对称）
    return Math.max(Math.round(H), CANVAS_MIN_H);
  },

  // 像素风绘制：浅底 + 深色硬描边方框 + 品牌/headline/date + 主视觉
  //            + 四宫格大数字 + 主要动作列表 + 激励行 + slogan + 小程序码块。
  drawPoster(ctx, vm, character, code, H) {
    const W = CANVAS_W;

    // 背景：纯浅色底
    ctx.fillStyle = COLOR.bgPage;
    ctx.fillRect(0, 0, W, H);

    // 外层像素卡：白底 + 深色硬描边 + 硬偏移阴影（先画阴影方块，再画卡片）
    const M = LY_MARGIN;     // 外边距
    const cardX = M;
    const cardY = M;
    const cardW = W - M * 2;
    const cardH = H - M * 2;
    const off = 8;           // 硬阴影偏移
    // 硬阴影（深色实心方块，向右下偏移）
    ctx.fillStyle = COLOR.ink;
    ctx.fillRect(cardX + off, cardY + off, cardW, cardH);
    // 卡面
    ctx.fillStyle = COLOR.surface;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    // 描边
    this.strokeRect(ctx, cardX, cardY, cardW, cardH, COLOR.ink, 4);

    const innerX = cardX + 28;     // 内容左边界
    const innerW = cardW - 56;     // 内容宽
    let cursorY = cardY + LY_HEADLINE_BASELINE;

    // ---- 顶部：品牌 pill + headline（日期移到底部，与二维码底边对齐）----
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    // 品牌 pill：按红框比例放大并上移，强化品牌识别。
    const brandY = cardY + LY_BRAND_TOP;
    ctx.font = '700 ' + BRAND_FONT_SIZE + 'px sans-serif';
    const brandW = ctx.measureText(vm.brand).width + BRAND_PAD_X * 2;
    this.fillPixelBox(ctx, innerX, brandY, brandW, LY_BRAND_BOX_H, COLOR.primary, COLOR.ink, 4);
    ctx.fillStyle = COLOR.textOn;
    ctx.fillText(vm.brand, innerX + BRAND_PAD_X, brandY + LY_BRAND_TEXT_BASELINE);

    // headline 大标题
    ctx.fillStyle = COLOR.text1;
    ctx.font = '800 44px sans-serif';
    ctx.fillText(vm.headline, innerX, cursorY);

    // ---- 主视觉：仅庆祝角色（右侧，按原图宽高比 contain，避免压扁） ----
    if (character) {
      ctx.imageSmoothingEnabled = false;     // 像素风不抗锯齿
      const heroMaxW = 170;                   // 角色目标框最大宽
      const heroMaxH = 210;                   // 角色目标框最大高
      const heroRight = cardX + cardW - 28;   // 角色右边界（右对齐）
      const heroTop = cardY + 26;             // 角色上边界
      const nw = character.width || 220;
      const nh = character.height || 384;
      let dw = heroMaxW;
      let dh = dw * (nh / nw);
      if (dh > heroMaxH) { dh = heroMaxH; dw = dh * (nw / nh); }  // contain 到框内
      ctx.drawImage(character, heroRight - dw, heroTop, dw, dh);
    }

    // ---- 四宫格核心数据 ----
    cursorY = cardY + LY_GRID_TOP;
    const gridGap = LY_GRID_GAP;
    const gridCols = 2;
    const gridW = (innerW - gridGap) / gridCols;
    const gridH = LY_GRID_H;
    for (let i = 0; i < vm.stats.length; i++) {
      const stat = vm.stats[i];
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);
      const gx = innerX + col * (gridW + gridGap);
      const gy = cursorY + row * (gridH + gridGap);
      // 浅绿底像素方框
      this.fillPixelBox(ctx, gx, gy, gridW, gridH, COLOR.primarySoft, COLOR.ink, 3);
      // 大数字 + 单位
      ctx.textAlign = 'left';
      ctx.fillStyle = COLOR.text1;
      ctx.font = '800 40px sans-serif';
      const valText = String(stat.value);
      ctx.fillText(valText, gx + 18, gy + 52);
      const valW = ctx.measureText(valText).width;
      if (stat.unit) {
        ctx.fillStyle = COLOR.text2;
        ctx.font = '600 22px sans-serif';
        ctx.fillText(stat.unit, gx + 18 + valW + 6, gy + 52);
      }
      // 标签
      ctx.fillStyle = COLOR.text2;
      ctx.font = '500 22px sans-serif';
      ctx.fillText(stat.label, gx + 18, gy + 80);
    }

    // 两行四宫格之后的 y
    const gridRows = Math.ceil(vm.stats.length / gridCols);
    cursorY = cursorY + gridRows * gridH + (gridRows - 1) * gridGap + LY_AFTER_GRID;

    // ---- 主要动作列表（最多 5 行） ----
    if (vm.mainExercises.length) {
      ctx.fillStyle = COLOR.text1;
      ctx.font = '700 26px sans-serif';
      ctx.fillText('主要动作', innerX, cursorY);
      cursorY += LY_EX_LABEL_GAP;
      for (let j = 0; j < vm.mainExercises.length; j++) {
        const ex = vm.mainExercises[j];
        cursorY += LY_EX_ROW;
        // 名称（左）
        ctx.fillStyle = COLOR.text1;
        ctx.font = '600 26px sans-serif';
        this.fillEllipsisText(ctx, ex.name, innerX, cursorY, innerW - 200);
        // 最佳组（右对齐）
        ctx.fillStyle = COLOR.primaryStrong;
        ctx.font = '700 26px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(ex.bestSetText, innerX + innerW, cursorY);
        ctx.textAlign = 'left';
      }
    }

    // ---- 激励行 ----
    cursorY += LY_INC_GAP;
    const incH = LY_INC_BOX_H;
    this.fillPixelBox(ctx, innerX, cursorY - LY_INC_BOX_UP, innerW, incH, COLOR.amber, COLOR.ink, 3);
    ctx.fillStyle = COLOR.text1;
    ctx.font = '700 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(vm.incentive, innerX + 18, cursorY);

    // ---- 底部：小程序码块 + slogan ----
    // 二维码块紧跟激励框之后（cursorY 驱动），随内容向下流，配合弹性画布高度避免与主要动作重叠。
    const codeSize = LY_CODE_SIZE;
    const codeX = innerX;
    const codeY = (cursorY - LY_INC_BOX_UP + LY_INC_BOX_H) + LY_CODE_GAP;
    if (code) {
      // 白底描边 + 码图
      this.fillPixelBox(ctx, codeX, codeY, codeSize, codeSize, COLOR.surface, COLOR.ink, 3);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(code, codeX + 8, codeY + 8, codeSize - 16, codeSize - 16);
    } else {
      // 占位方块 + 文案
      this.fillPixelBox(ctx, codeX, codeY, codeSize, codeSize, COLOR.bgPage, COLOR.ink, 3);
      ctx.fillStyle = COLOR.text3;
      ctx.font = '500 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('小程序码', codeX + codeSize / 2, codeY + codeSize / 2 - 4);
      ctx.fillText('生成中', codeX + codeSize / 2, codeY + codeSize / 2 + 24);
      ctx.textAlign = 'left';
    }

    // slogan + 扫码引导（码块右侧）
    const textX = codeX + codeSize + 24;
    ctx.fillStyle = COLOR.text1;
    ctx.font = '700 24px sans-serif';
    ctx.fillText('扫码一起开练', textX, codeY + FOOTER_TITLE_OFFSET_Y);
    ctx.fillStyle = COLOR.text3;
    ctx.font = '500 20px sans-serif';
    ctx.fillText(vm.slogan, textX, codeY + FOOTER_SLOGAN_OFFSET_Y);
    // 日期：左边与 slogan 对齐，baseline 位于二维码底部上方 12px。
    if (vm.dateText) {
      ctx.fillStyle = COLOR.text3;
      ctx.font = '500 ' + DATE_FONT_SIZE + 'px sans-serif';
      ctx.fillText(vm.dateText, textX, codeY + codeSize - FOOTER_DATE_BOTTOM_GAP);
    }
  },

  // 描边矩形
  strokeRect(ctx, x, y, w, h, color, lineW) {
    ctx.lineWidth = lineW;
    ctx.strokeStyle = color;
    ctx.strokeRect(x, y, w, h);
  },

  // 填充像素方框：实底 + 深色描边（无 blur）
  fillPixelBox(ctx, x, y, w, h, fill, stroke, lineW) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.lineWidth = lineW;
    ctx.strokeStyle = stroke;
    ctx.strokeRect(x, y, w, h);
  },

  // 单行文本超宽截断为「…」
  fillEllipsisText(ctx, text, x, y, maxW) {
    let str = text || '';
    if (ctx.measureText(str).width <= maxW) {
      ctx.fillText(str, x, y);
      return;
    }
    const ell = '…';
    while (str.length > 0 && ctx.measureText(str + ell).width > maxW) {
      str = str.slice(0, str.length - 1);
    }
    ctx.fillText(str + ell, x, y);
  },

  // ============ 交互 ============
  // 保存到相册（先授权 scope.writePhotosAlbum，拒绝引导去设置）
  onSave() {
    const that = this;
    const path = this.data.posterPath;
    if (!path || this.data.saving) return;
    this.setData({ saving: true });
    wx.getSetting({
      success(res) {
        const auth = res.authSetting || {};
        if (auth['scope.writePhotosAlbum']) {
          that.doSave(path);
        } else if (auth['scope.writePhotosAlbum'] === false) {
          // 曾拒绝过：引导去设置
          that.setData({ saving: false });
          that.guideToSetting();
        } else {
          // 未询问过：发起授权
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success() {
              that.doSave(path);
            },
            fail() {
              that.setData({ saving: false });
              that.guideToSetting();
            },
          });
        }
      },
      fail() {
        that.setData({ saving: false });
        wx.showToast({ title: '无法读取相册权限', icon: 'none' });
      },
    });
  },

  doSave(path) {
    const that = this;
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success() {
        that.setData({ saving: false });
        wx.showToast({ title: '已保存到相册', icon: 'success' });
      },
      fail(err) {
        that.setData({ saving: false });
        const msg = (err && err.errMsg) || '';
        if (msg.indexOf('auth deny') >= 0 || msg.indexOf('authorize') >= 0) {
          that.guideToSetting();
        } else {
          wx.showToast({ title: '保存失败，请重试', icon: 'none' });
        }
      },
    });
  },

  guideToSetting() {
    wx.showModal({
      title: '需要相册权限',
      content: '保存分享图需要访问相册，请在设置中开启。',
      confirmText: '去设置',
      success(res) {
        if (res.confirm) wx.openSetting();
      },
    });
  },

  // 重新生成（重画）
  onRegenerate() {
    if (this.data.loading) return;
    if (this.data.sessionId) this.loadAndRender(this.data.sessionId);
  },

  // 取数失败重试
  onRetry() {
    if (this.data.sessionId) this.loadAndRender(this.data.sessionId);
  },

  // 返回（无栈则回首页）
  onBack() {
    const pages = getCurrentPages();
    if (pages && pages.length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.switchTab({ url: '/pages/home/home' });
    }
  },
}, {
  title: '我的训练分享图',
  path: '/pages/share-card/share-card',
  queryKeys: ['id'],
}));
