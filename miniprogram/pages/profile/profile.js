// 「我的」页（design §6.4）—— 头像 + 概览卡 + 成就墙 + 设置入口
// TAB 页：onShow 同步 tabBar selected=3；自定义导航栏按 statusBarHeight 留白。
const { Achievement, Stats } = require('../../service/api');
const auth = require('../../utils/auth');
const format = require('../../utils/format');
const achievement = require('../../utils/achievement');
const { withSharePage } = require('../../utils/share-page');

// 设置行图标切图（design §6.5）。无专用图标的条目复用通用切图，宁缺毋滥不烧新图。
const SETTING_ICON = {
  profile: '/images/ui/icons/ui_icon_edit_pencil.png',
  goal: '/images/ui/icons/ui_icon_experience_star.png',
  plan: '/images/ui/icons/ui_icon_calendar.png',
  book: '/images/ui/equipment/ui_equipment_dumbbell.png',
  stats: '/images/ui/nav/ui_nav_stats_active.png',
  history: '/images/ui/icons/ui_icon_history.png',
  export: '/images/ui/icons/ui_icon_add.png',
  bell: '/images/ui/icons/ui_icon_speaker_on.png',
  gear: '/images/ui/icons/ui_icon_add.png',
};

Page(withSharePage({
  data: {
    statusBarHeight: 20,
    isGuest: true,
    loading: true,
    error: false,

    // 资料
    nickname: '',
    avatarUrl: '',
    loginState: '已登录',

    // 等级 / EXP / 段位 —— 后端驱动（GET /achievements，见 utils/achievement）。
    // 成就接口不可用时退化为占位，不影响概览三卡。
    level: { lv: 1, exp: 0, expMax: 0, percent: 0, isMax: false },
    rank: null,
    achvCount: { unlocked: 0, total: 0 },

    // 段位阶梯弹窗：点资料卡段位奖牌弹出（全部 8 档 + 高亮当前档）
    ladder: [],
    rankModalVisible: false,

    // 概览：累计训练次数 / 总训练量 / 动作种类
    stats: { count: 0, volume: 0, exerciseTypes: 0 },
    volumeText: '0',

    // 成就墙预览（精简，完整 5 类 23 枚见成就墙页）
    achievements: [],

    // 单位
    unitWeight: 'kg',
    unitText: 'kg',

    // 设置行（value 动态填充）
    settings: [],

    // 编辑资料 sheet
    showEdit: false,
    logging: false,
    saving: false,
    editNickname: '',
    editAvatarUrl: '',
  },

  onLoad() {
    const app = getApp();
    const sys = app && app.globalData && app.globalData.systemInfo;
    if (sys && sys.statusBarHeight) this.setData({ statusBarHeight: sys.statusBarHeight });
    this.fillFromUser();
  },

  onShow() {
    const app = getApp();
    const isGuest = !(app && app.isLoggedIn());
    this.setData({ isGuest });
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      // hidden 跟随 showEdit 复位，避免极端情形下 tabBar 卡在隐藏态。
      this.getTabBar().setData({ selected: 3, hidden: this.data.showEdit });
    }
    this.fillFromUser();
    if (isGuest) {
      this.applyGuestProfile();
      return;
    }
    this.loadProfile();
  },

  onPullDownRefresh() {
    const app = getApp();
    if (app && !app.isLoggedIn()) {
      this.applyGuestProfile();
      wx.stopPullDownRefresh();
      return;
    }
    this.loadProfile().then(() => wx.stopPullDownRefresh());
  },

  // 头部资料来自本地 user
  fillFromUser() {
    const app = getApp();
    const isGuest = !(app && app.isLoggedIn());
    const user = auth.getUser() || {};
    this.setData({
      isGuest,
      nickname: isGuest ? '游客' : (user.nickname || '健身者'),
      avatarUrl: isGuest ? '' : (user.avatarUrl || ''),
      unitWeight: user.unitWeight || 'kg',
      unitText: (user.unitWeight || 'kg') === 'lb' ? 'lb' : 'kg',
    });
  },

  // 取数：概览(累计训练/容量/动作种类) 与 成就(等级/段位/成就墙) 并行；成就失败不拖垮概览。
  async loadProfile() {
    const app = getApp();
    if (app && !app.isLoggedIn()) {
      this.applyGuestProfile();
      return;
    }
    this.setData({ loading: true, error: false });
    try {
      const results = await Promise.all([
        this.loadOverview(),
        this.loadAchievements(),
      ]);
      this.applyProfile({
        stats: results[0],
        preview: results[1],
        unitWeight: this.data.unitWeight,
      });
    } catch (e) {
      this.applyProfile({
        stats: { count: 0, volume: 0, exerciseTypes: 0 },
        preview: null,
        unitWeight: this.data.unitWeight,
      });
      this.setData({ error: true });
      wx.showToast({ title: (e && e.message) || '加载失败，请重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  applyGuestProfile() {
    const unit = this.data.unitWeight || 'kg';
    this.setData({
      loading: false,
      error: false,
      nickname: '游客',
      avatarUrl: '',
      level: { lv: 1, exp: 0, expMax: 0, percent: 0, isMax: false },
      rank: null,
      ladder: [],
      achvCount: { unlocked: 0, total: 0 },
      stats: { count: 0, volume: 0, exerciseTypes: 0 },
      volumeText: '0',
      achievements: [],
      unitText: unit === 'lb' ? 'lb' : 'kg',
      settings: this.buildSettings(unit === 'lb' ? 'lb' : 'kg'),
    });
  },

  // 概览三卡：直接用后端聚合接口 /stats/lifetime（累计次数/容量/动作种类），
  // 口径与首页/数据页统一。取代旧的「全量分页拉 session + 逐条拉详情」（训练多时几百请求）。
  async loadOverview() {
    const data = await Stats.lifetime();
    return {
      count: Number((data && data.totalSessions) || 0),
      volume: Number((data && data.totalVolumeKg) || 0),
      exerciseTypes: Number((data && data.exerciseTypeCount) || 0),
    };
  },

  // 成就/等级/段位：GET /achievements → 精简预览视图模型；失败返回 null（不拖垮概览）。
  async loadAchievements() {
    try {
      const data = await Achievement.get();
      return achievement.buildProfilePreview(data, 6);
    } catch (e) {
      return null;
    }
  },

  applyProfile(vm) {
    const unit = vm.unitWeight || 'kg';
    const unitText = unit === 'lb' ? 'lb' : 'kg';
    // 概览总训练量按单位换算展示
    const volumeText = format.formatVolume(
      unit === 'lb' ? vm.stats.volume * 2.2046 : vm.stats.volume
    );
    const patch = {
      stats: vm.stats,
      volumeText,
      unitWeight: unit,
      unitText,
      settings: this.buildSettings(unitText),
    };
    // 成就数据可用时更新资料卡 + 成就墙预览；不可用(null，如单位切换或接口失败)时保留现值。
    const preview = vm.preview;
    if (preview) {
      patch.level = preview.level;
      patch.rank = preview.rank;
      patch.ladder = preview.ladder;
      patch.achievements = preview.previewBadges;
      patch.achvCount = { unlocked: preview.unlockedCount, total: preview.totalCount };
    }
    this.setData(patch);
  },

  // 设置列表（design §6.5）。没有对应页面的条目走「即将上线」toast，不新建路由。
  // 保留可用项：动作库 → exercise-library（浏览）；单位 → 切换 kg/lb。
  buildSettings(unitText) {
    return [
      { key: 'profile', iconSrc: SETTING_ICON.profile, title: '个人信息', value: '' },
      { key: 'goal', iconSrc: SETTING_ICON.goal, title: '训练目标', value: '100kg' },
      { key: 'plan', iconSrc: SETTING_ICON.plan, title: '训练计划', value: '进行中' },
      { key: 'book', iconSrc: SETTING_ICON.book, title: '动作库', value: '50+ 动作' },
      { key: 'stats', iconSrc: SETTING_ICON.stats, title: '数据统计', value: '' },
      { key: 'history', iconSrc: SETTING_ICON.history, title: '历史记录', value: '' },
      { key: 'unit', iconSrc: SETTING_ICON.gear, title: '设置', value: unitText + ' · 浅色' },
      { key: 'help', iconSrc: SETTING_ICON.bell, title: '帮助与反馈', value: '' },
    ];
  },

  /* —— 编辑资料 sheet —— */
  // 注入式自定义 tabBar 处于独立图层，浮层 z-index 盖不过它，故 sheet 期间直接隐藏 tabBar。
  setTabBarHidden(hidden) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hidden });
    }
  },
  onOpenEdit() {
    if (this.data.isGuest) {
      wx.showToast({ title: '登录后可编辑资料', icon: 'none' });
      return;
    }
    this.setData({
      showEdit: true,
      editNickname: this.data.nickname,
      editAvatarUrl: this.data.avatarUrl,
    });
    this.setTabBarHidden(true);
  },
  onCloseEdit() {
    this.setData({ showEdit: false });
    this.setTabBarHidden(false);
  },
  noop() {},
  onChooseAvatar(e) {
    const url = e && e.detail && e.detail.avatarUrl;
    if (url) this.setData({ editAvatarUrl: url });
  },
  onEditNickname(e) {
    const val = (e && e.detail && e.detail.value) || '';
    this.setData({ editNickname: val });
  },
  async onSaveEdit() {
    if (this.data.isGuest) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    if (this.data.saving) return;
    const fields = {};
    const nickname = (this.data.editNickname || '').trim();
    if (nickname && nickname !== this.data.nickname) fields.nickname = nickname;
    if (this.data.editAvatarUrl && this.data.editAvatarUrl !== this.data.avatarUrl) {
      fields.avatarUrl = this.data.editAvatarUrl;
    }
    if (!fields.nickname && !fields.avatarUrl) {
      this.setData({ showEdit: false });
      this.setTabBarHidden(false);
      return;
    }
    this.setData({ saving: true });
    try {
      const user = await auth.updateProfile(fields);
      this.setData({
        saving: false,
        showEdit: false,
        nickname: (user && user.nickname) || nickname || this.data.nickname,
        avatarUrl: (user && user.avatarUrl) || this.data.editAvatarUrl || this.data.avatarUrl,
      });
      this.setTabBarHidden(false);
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (e) {
      this.setData({ saving: false });
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  async onLogin() {
    if (this.data.logging) return;
    this.setData({ logging: true });
    try {
      await auth.login();
      this.setData({ logging: false, isGuest: false });
      this.fillFromUser();
      await this.loadProfile();
      wx.showToast({ title: '已登录', icon: 'success' });
    } catch (e) {
      this.setData({ logging: false });
      this.toastError(e);
    }
  },

  toastError(e) {
    let title = (e && e.message) || '登录失败，请重试';
    if (e && (e.code === 'network' || /网络|连接|timeout|fail/i.test(title))) {
      title = '无法连接服务器，请确认后端已启动';
    }
    wx.showToast({ title, icon: 'none' });
  },

  /* —— 设置行点击 —— */
  onSettingTap(e) {
    const key = e.currentTarget.dataset.key;
    switch (key) {
      case 'profile':
        this.onOpenEdit();
        break;
      case 'unit':
        this.toggleUnit();
        break;
      case 'book':
        if (this.data.isGuest) {
          wx.showToast({ title: '登录后可管理动作库', icon: 'none' });
          return;
        }
        wx.navigateTo({ url: '/pages/exercise-library/exercise-library' });
        break;
      // 无对应页面的条目统一走「即将上线」（不新建路由）
      case 'goal':
      case 'plan':
      case 'stats':
      case 'history':
      case 'help':
        wx.showToast({ title: '即将上线', icon: 'none' });
        break;
      default:
        break;
    }
  },

  /* 成就墙「查看全部」：进独立成就墙页（5 类 23 枚 + 资料卡） */
  onAchievementMore() {
    if (this.data.isGuest) {
      wx.showToast({ title: '登录后可查看成就', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/achievements/achievements' });
  },

  /* 点资料卡段位奖牌：弹段位阶梯弹窗。注入式 tabBar 在独立图层，浮层盖不过，
     故开启期间隐藏 tabBar（与编辑 sheet 同策略）。ladder 未就绪时不弹。 */
  onOpenRank() {
    if (this.data.isGuest) return;
    if (!this.data.ladder.length) return;
    this.setData({ rankModalVisible: true });
    this.setTabBarHidden(true);
  },
  onCloseRank() {
    this.setData({ rankModalVisible: false });
    this.setTabBarHidden(false);
  },

  // 切换 kg/lb，写入 User.update
  async toggleUnit() {
    if (this.data.isGuest) {
      wx.showToast({ title: '登录后可同步设置', icon: 'none' });
      return;
    }
    const next = this.data.unitWeight === 'kg' ? 'lb' : 'kg';
    try {
      const user = await auth.updateProfile({ unitWeight: next });
      const unit = (user && user.unitWeight) || next;
      // 仅重算概览展示与设置行（不传 preview，资料卡/成就墙预览保持现值）
      this.applyProfile({
        stats: this.data.stats,
        preview: null,
        unitWeight: unit,
      });
      wx.showToast({ title: '已切换为 ' + (unit === 'lb' ? 'lb' : 'kg'), icon: 'none' });
    } catch (e) {
      wx.showToast({ title: '切换失败，请重试', icon: 'none' });
    }
  },
}, {
  title: '我的开练档案',
  path: '/pages/profile/profile',
}));
