// 训练详情页 —— Session.detail(id)：头部 + 概览 + 动作/组列表，可删除。
// 自定义导航栏；空/错误态 + 重试。
const { Session } = require('../../service/api');
const { SET_TYPES, LOAD_TYPES } = require('../../utils/constants');
const { relativeDay, formatVolume, displayWeight } = require('../../utils/format');
const { withSharePage } = require('../../utils/share-page');

const STATUS_TEXT = {
  active: '进行中',
  completed: '已完成',
  cancelled: '已取消',
};

Page(withSharePage({
  data: {
    statusBarHeight: 20,
    loading: true,
    error: false,
    deleting: false,

    sessionId: '',
    header: null,            // { name, relativeDay, statusText, status }
    summary: null,           // { totalExercises, totalSets, totalVolume }
    exercises: [],           // 渲染用动作列表
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
    this.loadDetail(id);
  },

  async loadDetail(id) {
    this.setData({ loading: true, error: false });
    let session = null;
    try {
      session = await Session.detail(id);
    } catch (e) {
      session = null;
    }

    if (!session) {
      this.setData({ loading: false, error: true });
      return;
    }
    this.applySession(session);
  },

  applySession(session) {
    const unit = this.getUnit();
    const header = {
      name: session.name || '训练',
      relativeDay: relativeDay(session.startedAt),
      statusText: STATUS_TEXT[session.status] || session.status,
      status: session.status,
    };
    const summary = {
      totalExercises: session.totalExercises || 0,
      totalSets: session.totalSets || 0,
      totalVolume: formatVolume(session.totalVolumeKg || 0),
      unit,
    };

    const exercises = (session.workoutExercises || []).map((we) => {
      const sets = (we.sets || []).map((s) => {
        const isWeighted = s.weightKg !== null && s.weightKg !== undefined;
        const w = isWeighted ? displayWeight(s.weightKg, unit) : null;
        const loadText = isWeighted
          ? (w.value + w.unit + ' × ' + s.reps)
          : (LOAD_TYPES[s.loadType] || '') + ' × ' + s.reps;
        return {
          id: s.id,
          setOrder: s.setOrder,
          loadText,
          setTypeText: SET_TYPES[s.setType] || '',
          isPersonalRecord: !!s.isPersonalRecord,
        };
      });
      return {
        id: we.id,
        name: we.displayName || '动作',
        setCount: sets.length,
        sets,
      };
    });

    this.setData({
      loading: false,
      error: false,
      header,
      summary,
      exercises,
    });
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

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  // 生成分享图：跳转分享图页（仅已完成训练，由 wxml 的 wx:if 控制入口）
  onShareCard() {
    const id = this.data.sessionId;
    if (!id) return;
    wx.navigateTo({ url: '/pages/share-card/share-card?id=' + id });
  },

  // 删除训练（confirm + Session.remove）
  onDelete() {
    if (this.data.deleting) return;
    const id = this.data.sessionId;
    if (!id) return;
    wx.showModal({
      title: '删除训练',
      content: '删除后无法恢复，确定删除这次训练记录吗？',
      confirmText: '删除',
      confirmColor: '#F5285E',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ deleting: true });
        try {
          await Session.remove(id);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack({ delta: 1 }), 600);
        } catch (e) {
          this.setData({ deleting: false });
          wx.showToast({ title: (e && e.message) || '删除失败，请重试', icon: 'none' });
        }
      },
    });
  },

  onRetry() {
    if (this.data.sessionId) this.loadDetail(this.data.sessionId);
  },
}, {
  title: function () {
    return (this.data.header && this.data.header.name) || '训练详情';
  },
  path: '/pages/session-detail/session-detail',
  queryKeys: ['id'],
}));
