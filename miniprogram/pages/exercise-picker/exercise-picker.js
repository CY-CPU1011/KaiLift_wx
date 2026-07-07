// pages/exercise-picker/exercise-picker.js —— 动作选择子页
// 调 Exercise.list（带 search）；找不到可创建自定义动作 Exercise.create；
// 选中后写 storage（kl_picked_exercise），由上一页 onShow 读取。
const { Exercise } = require('../../service/api');
const { BODY_PARTS } = require('../../utils/constants');
const mock = require('../../mock/workout');
const { withSharePage } = require('../../utils/share-page');

let searchTimer = null;

Page(withSharePage({
  data: {
    statusBarHeight: 20,
    keyword: '',
    parts: BODY_PARTS,        // ['全部','胸','背',...]
    activePart: '全部',
    items: [],
    loading: false,
    usingMock: false,
    error: '',
  },

  onLoad(options) {
    const app = getApp();
    const sys = app && app.globalData && app.globalData.systemInfo;
    if (sys && sys.statusBarHeight) this.setData({ statusBarHeight: sys.statusBarHeight });
    // 记住调用方意图（manual=回填手动表单 / replace=换动作），返回时一并带回，
    // 上一页据此路由，不再依赖其弹层显隐状态（避免回填漂移）。
    this._target = (options && options.target) || '';
    this._load();
  },

  onShow() {
    const app = getApp();
    if (app && !app.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
    }
  },

  async _load() {
    const { keyword, activePart } = this.data;
    this.setData({ loading: true, error: '' });
    const params = {};
    if (keyword) params.search = keyword;
    if (activePart && activePart !== '全部') params.bodyPart = activePart;
    try {
      const data = await Exercise.list(params);
      this.setData({ items: data.items || [], loading: false, usingMock: false });
    } catch (e) {
      // 兜底：mock 本地过滤
      let items = mock.exercises.slice();
      if (keyword) items = items.filter((x) => x.name.includes(keyword) || (x.aliases || []).some((a) => a.includes(keyword)));
      if (activePart && activePart !== '全部') items = items.filter((x) => x.bodyPart === activePart);
      this.setData({ items, loading: false, usingMock: true });
    }
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
    const part = e.currentTarget.dataset.part;
    this.setData({ activePart: part });
    this._load();
  },

  onPick(e) {
    const name = e.currentTarget.dataset.name;
    this._returnName(name);
  },

  // 创建自定义动作（输入框内容作为名称）
  async onCreate() {
    const name = (this.data.keyword || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入动作名', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '创建中…' });
    try {
      const body = { name };
      if (this.data.activePart && this.data.activePart !== '全部') body.bodyPart = this.data.activePart;
      await Exercise.create(body);
      wx.hideLoading();
      this._returnName(name);
    } catch (e) {
      wx.hideLoading();
      // 创建失败也允许直接带名返回（上一页可作自定义动作名落库）
      wx.showToast({ title: '将作为自定义动作使用', icon: 'none' });
      this._returnName(name);
    }
  },

  onClose() {
    wx.navigateBack();
  },

  _returnName(name) {
    try {
      wx.setStorageSync('kl_picked_exercise', name);
      wx.setStorageSync('kl_picked_target', this._target || '');
    } catch (e) {}
    wx.navigateBack();
  },
}, {
  title: '选择训练动作',
  path: '/pages/exercise-picker/exercise-picker',
  queryKeys: ['target'],
}));
