// pages/exercise-detail/exercise-detail.js —— 动作详情 + 我的数据（二级页，navigateTo 进入）
// 详情：名称/主次肌群/难度/器械/分类/机制 + instructions 有序步骤（v1 不上图）。
// 我的数据：PR（中文三类）+ 历史（按 session 倒序逐次列各组 重量×次数）。
// 详情与历史分两路：详情失败整页重试；历史软失败只在「我的数据」区重试，不拖垮详情。
// ⚠ 禁数组解构/展开（WeChat babel arrayWithHoles 坑），用索引 / for / Object.assign。
const { Exercise } = require('../../service/api');
const auth = require('../../utils/auth');
const exVM = require('../../utils/exercise');
const mock = require('../../mock/exercises');
const { withSharePage } = require('../../utils/share-page');

Page(withSharePage({
  data: {
    statusBarHeight: 20,
    id: '',
    navTitle: '动作详情',
    unit: 'kg',

    // 详情态
    loading: true,
    error: false,
    detail: null,
    usingMock: false,

    // 我的数据态：'loading' | 'ok' | 'error'
    myStatus: 'loading',
    myData: { records: [], hasRecords: false, sessions: [], hasHistory: false },
  },

  onLoad(options) {
    const app = getApp();
    const sys = app && app.globalData && app.globalData.systemInfo;
    if (sys && sys.statusBarHeight) this.setData({ statusBarHeight: sys.statusBarHeight });

    const id = (options && options.id) || '';
    let navTitle = '动作详情';
    if (options && options.name) {
      try { navTitle = decodeURIComponent(options.name); } catch (e) { navTitle = options.name; }
    }
    const user = auth.getUser() || {};
    this.setData({ id, navTitle, unit: user.unitWeight || 'kg' });
    this._loadDetail();
  },

  onShow() {
    const app = getApp();
    if (app && !app.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
    }
  },

  // 详情：成功后再拉历史；失败回退 mock（mock 视为新用户、无个人数据）。
  async _loadDetail() {
    const id = this.data.id;
    this.setData({ loading: true, error: false });
    if (!id) {
      this.setData({ loading: false, error: true });
      return;
    }
    try {
      const data = await Exercise.detail(id);
      const detail = exVM.buildDetailVM(data.exercise || data);
      this.setData({ detail, navTitle: detail.name || this.data.navTitle, loading: false, usingMock: false });
      this._loadHistory();
    } catch (e) {
      const local = mock.findById(id);
      if (local) {
        const detail = exVM.buildDetailVM(local);
        // 离线：无个人 PR/历史，直接给空态，不再发起历史请求。
        this.setData({
          detail,
          navTitle: detail.name || this.data.navTitle,
          loading: false,
          usingMock: true,
          myStatus: 'ok',
          myData: { records: [], hasRecords: false, sessions: [], hasHistory: false },
        });
      } else {
        this.setData({ loading: false, error: true });
      }
    }
  },

  // 我的数据：PR + 历史，软失败可单独重试。
  async _loadHistory() {
    const id = this.data.id;
    this.setData({ myStatus: 'loading' });
    try {
      const data = await Exercise.history(id);
      this.setData({ myData: exVM.buildMyDataVM(data, this.data.unit), myStatus: 'ok' });
    } catch (e) {
      this.setData({ myStatus: 'error' });
    }
  },

  onRetryDetail() {
    this._loadDetail();
  },

  onRetryHistory() {
    this._loadHistory();
  },

  onBack() {
    wx.navigateBack({
      fail() {
        wx.switchTab({ url: '/pages/profile/profile' });
      },
    });
  },
}, {
  title: function () {
    return this.data.navTitle || '动作详情';
  },
  path: '/pages/exercise-detail/exercise-detail',
  queryKeys: ['id', 'name'],
}));
