// 首页（design §6.2）—— 问候 + 21天计划 + 本周轨迹 + 最近训练 + 本周概览 + 语音入口
// 决策对齐：#1 计划卡用「21天计划·已完成 Y/9 次」；#5 区块=本周轨迹/本周概览。
// 取数：仅调用 api.json 已声明接口；分页拉取 completed sessions，并读取进行中挑战。
// TAB 页：onShow 同步 tabBar selected=0；自定义导航栏按 statusBarHeight 留白。
const { Stats, Reward } = require('../../service/api');
const auth = require('../../utils/auth');
const format = require('../../utils/format');
const { buildHomeViewModelFromStats } = require('../../utils/home-data');
const { buildFinishReward } = require('../../utils/achievement');
const { withSharePage } = require('../../utils/share-page');

function emptyHome() {
  return buildHomeViewModelFromStats({});
}

Page(withSharePage({
  data: {
    statusBarHeight: 20,
    loading: true,
    error: false,
    isGuest: true,
    helloLine: '',
    dateText: '',
    monthDays: 0,
    week: { days: [], completed: 0, total: 7 },
    lastWorkout: { id: '', title: '', relativeDay: '', meta: '', empty: true },
    overview: { count: 0, volume: 0, durationHours: 0 },
    overviewVolumeText: '0',
    isEmpty: false,

    // 待领奖励补放庆祝（F4，复用训练页的 finish-reward 覆盖层）
    showReward: false,
    finishReward: null,
  },

  onLoad() {
    const app = getApp();
    const sys = app && app.globalData && app.globalData.systemInfo;
    if (sys && sys.statusBarHeight) this.setData({ statusBarHeight: sys.statusBarHeight });
    this.fillHeader();
  },

  onShow() {
    const app = getApp();
    const isGuest = !(app && app.isLoggedIn());
    this.setData({ isGuest });
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.fillHeader();
    if (isGuest) {
      this.applyHome(emptyHome());
      this.setData({ loading: false, error: false });
      return;
    }
    this.loadHome();
    this._drainPendingRewards(); // F4 进首页补放自动结束训练攒下的待领奖励
  },

  onHide() {
    // 离开首页时若庆祝队列没放完：收起覆盖层并解锁，未 ack 的留到下次进首页再补。
    this._rewardBusy = false;
    this._rewardQueue = [];
    if (this.data.showReward) this.setData({ showReward: false });
  },

  onPullDownRefresh() {
    this.loadHome().then(() => wx.stopPullDownRefresh());
  },

  // 问候行（下午好，Alex）+ 日期（决策#4 并入标题行）
  fillHeader() {
    const user = auth.getUser() || {};
    const name = user.nickname || '健身者';
    this.setData({
      helloLine: `${format.greeting()}，${name}`,
      dateText: format.formatDateHeader(),
    });
  },

  // 取数：后端聚合接口一次返回本周概览 / 本周轨迹 / 最近训练 / 本月训练天数。
  async loadHome() {
    const app = getApp();
    if (app && !app.isLoggedIn()) {
      this.applyHome(emptyHome());
      this.setData({ loading: false, error: false });
      return;
    }
    this.setData({ loading: true, error: false });
    try {
      const data = await Stats.home();
      this.applyHome(buildHomeViewModelFromStats(data));
    } catch (e) {
      this.applyHome(emptyHome());
      this.setData({ error: true });
      wx.showToast({ title: (e && e.message) || '加载失败，请重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  applyHome(vm) {
    const isEmpty =
      (!vm.lastWorkout || vm.lastWorkout.empty) &&
      (!vm.overview || vm.overview.count === 0);
    this.setData({
      monthDays: vm.monthDays || 0,
      week: vm.week,
      lastWorkout: vm.lastWorkout,
      overview: vm.overview,
      overviewVolumeText: format.formatVolume((vm.overview && vm.overview.volume) || 0),
      isEmpty,
    });
  },

  // 最近训练卡 → 详情
  onTapLastWorkout() {
    if (this.data.lastWorkout.empty || !this.data.lastWorkout.id) {
      this.goWorkout();
      return;
    }
    wx.navigateTo({ url: `/pages/session-detail/session-detail?id=${this.data.lastWorkout.id}` });
  },

  onVoiceTap() {
    this.goWorkout();
  },

  onPlanAction() {
    this.goWorkout();
  },

  goWorkout() {
    wx.switchTab({ url: '/pages/workout/workout' });
  },

  /* ---------------- F4 待领奖励补放（docs/后端对接-训练自动结束.md）---------------- */

  // 拉取自动结束训练攒下的待领奖励，逐条补弹庆祝；渲染看完再 ack 清除（幂等，防断网丢弹）。
  async _drainPendingRewards() {
    if (this._rewardBusy) return; // 队列补放中不重复拉
    this._rewardBusy = true;
    try {
      const data = await Reward.pending();
      const items = (data && data.items) || [];
      if (!items.length) { this._rewardBusy = false; return; }
      this._rewardQueue = items.slice();
      this._playNextReward();
    } catch (e) {
      this._rewardBusy = false; // 拉取失败：下次进首页再试，不打扰用户
    }
  },

  // 取队首补弹一条；队列空则收尾解锁。
  _playNextReward() {
    const queue = this._rewardQueue || [];
    if (!queue.length) {
      this._rewardBusy = false;
      this._rewardQueue = [];
      this.setData({ showReward: false, finishReward: null });
      return;
    }
    const it = queue.shift();
    this._rewardQueue = queue;
    this._ackingSessionId = it && it.sessionId;
    // reward 与手动结束的 achievement 同构，直接喂 buildFinishReward 复用庆祝组件。
    const reward = buildFinishReward(it && it.reward);
    if (!reward) { this._afterRewardShown(); return; } // 无可渲染内容：跳过并 ack
    this.setData({ finishReward: reward, showReward: true });
  },

  // 覆盖层「继续」/点遮罩：渲染已看完 → ack 当前条后放下一条。
  onRewardClose() {
    this.setData({ showReward: false });
    this._afterRewardShown();
  },

  _afterRewardShown() {
    const id = this._ackingSessionId;
    this._ackingSessionId = null;
    if (id) Reward.ack([id]).catch(() => {}); // 渲染后才清；失败下次进首页再补
    // 先让覆盖层收起再放下一条，确保组件 visible false→true 重新触发入场动画。
    const that = this;
    setTimeout(function () { that._playNextReward(); }, 80);
  },
}, {
  title: '开练 KaiLift',
  path: '/pages/home/home',
}));
