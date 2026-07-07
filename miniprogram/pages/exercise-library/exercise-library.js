// pages/exercise-library/exercise-library.js —— 动作库浏览（二级页，navigateTo 进入）
// 顶部部位 Tab + 搜索 + 二级 muscle 筛选；卡片点进详情。
// 取数：GET /api/v1/exercises（带 search/bodyPart）；二级 muscle 客户端过滤、选项从数据动态去重。
// 失败回退本地 mock（usingMock 标记 + 重试条），页面始终可浏览这 50 个动作。
// ⚠ 禁数组解构/展开（WeChat babel arrayWithHoles 坑），用索引 / for / Object.assign。
const { Exercise } = require('../../service/api');
const { EXERCISE_BODY_PARTS } = require('../../utils/constants');
const exVM = require('../../utils/exercise');
const mock = require('../../mock/exercises');
const { withSharePage } = require('../../utils/share-page');

let searchTimer = null;

Page(withSharePage({
  data: {
    statusBarHeight: 20,
    keyword: '',
    parts: EXERCISE_BODY_PARTS,   // ['全部','胸','背','腿','肩','臂','核心']
    activePart: '全部',
    muscles: ['全部'],            // 二级筛选选项（按部位数据动态去重）
    activeMuscle: '全部',
    baseItems: [],                // 当前部位的原始列表（用于派生 muscle + 客户端过滤）
    items: [],                    // 卡片视图模型（已按 muscle 过滤）
    loading: false,
    usingMock: false,
    error: false,
  },

  onLoad() {
    const app = getApp();
    const sys = app && app.globalData && app.globalData.systemInfo;
    if (sys && sys.statusBarHeight) this.setData({ statusBarHeight: sys.statusBarHeight });
    this._load();
  },

  onShow() {
    const app = getApp();
    if (app && !app.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
    }
  },

  // 拉取「部位 + 搜索」列表；成功用真实数据，失败回退 mock。
  async _load() {
    const keyword = this.data.keyword;
    const activePart = this.data.activePart;
    this.setData({ loading: true, error: false });
    const params = {};
    if (keyword) params.search = keyword;
    // 展示名「手臂」→ 后端取值「臂」（其余部位不变）
    if (activePart && activePart !== '全部') params.bodyPart = exVM.toQueryPart(activePart);
    try {
      const data = await Exercise.list(params);
      this._applyBase(data.items || [], false);
    } catch (e) {
      // 兜底：本地 mock 按 search/bodyPart 过滤，页面不空白
      const filtered = exVM.filterBySearchAndPart(mock.items, keyword, activePart);
      this._applyBase(filtered, true);
    }
  },

  // 落地一批原始列表：派生 muscle 选项 + 校正当前选中 + 应用二级过滤。
  _applyBase(baseItems, usingMock) {
    const muscles = exVM.deriveMuscleOptions(baseItems);
    let activeMuscle = this.data.activeMuscle;
    if (muscles.indexOf(activeMuscle) < 0) activeMuscle = '全部';
    const items = exVM.buildCardList(exVM.filterByMuscle(baseItems, activeMuscle));
    this.setData({ baseItems, muscles, activeMuscle, items, loading: false, usingMock });
  },

  // 仅二级 muscle 变化：客户端重过滤，不重新请求。
  _applyMuscle(activeMuscle) {
    const items = exVM.buildCardList(exVM.filterByMuscle(this.data.baseItems, activeMuscle));
    this.setData({ activeMuscle, items });
  },

  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => this._load(), 300);
  },

  onClearSearch() {
    this.setData({ keyword: '' });
    this._load();
  },

  onPickPart(e) {
    const part = e.detail.value;
    if (part === this.data.activePart) return;
    // 切部位重置二级筛选（muscle 与部位联动）
    this.setData({ activePart: part, activeMuscle: '全部' });
    this._load();
  },

  onPickMuscle(e) {
    const muscle = e.detail.value;
    if (muscle === this.data.activeMuscle) return;
    this._applyMuscle(muscle);
  },

  onTapItem(e) {
    const dataset = e.currentTarget.dataset;
    wx.navigateTo({
      url: '/pages/exercise-detail/exercise-detail?id=' + dataset.id + '&name=' + encodeURIComponent(dataset.name || ''),
    });
  },

  // 找不到时自建动作（停留本页，创建后刷新列表）。
  async onCreate() {
    const name = (this.data.keyword || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入动作名', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '创建中…' });
    try {
      const body = { name };
      if (this.data.activePart && this.data.activePart !== '全部') body.bodyPart = exVM.toQueryPart(this.data.activePart);
      await Exercise.create(body);
      wx.hideLoading();
      wx.showToast({ title: '已创建', icon: 'success' });
      this.setData({ activeMuscle: '全部' });
      this._load();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: (err && err.message) || '创建失败，请重试', icon: 'none' });
    }
  },

  onBack() {
    wx.navigateBack({
      fail() {
        wx.switchTab({ url: '/pages/profile/profile' });
      },
    });
  },
}, {
  title: '开练动作库',
  path: '/pages/exercise-library/exercise-library',
}));
