// 成就墙页（二级页，navigateTo 进入）—— 资料卡（段位/等级/EXP）+ 5 类 23 枚成就墙。
// 单轨：训练 → EXP → Lv → 段位；成就墙独立纯收集。数据一次拉全 GET /api/v1/achievements。
// 自定义导航栏（带返回），按 statusBarHeight 留白；非 tab，不写 getTabBar 逻辑。
// ⚠ 全程禁数组解构/展开（WeChat babel arrayWithHoles 坑），用索引 / for 循环 / Object.assign。
const { Achievement } = require('../../service/api');
const { buildAchievementsViewModel } = require('../../utils/achievement');
const { withSharePage } = require('../../utils/share-page');

Page(withSharePage({
  data: {
    statusBarHeight: 20,
    loading: true,
    error: false,

    // 资料卡等级块：{ lv, exp, expMax, percent, isMax }
    level: { lv: 0, exp: 0, expMax: 0, percent: 0, isMax: false },
    // 资料卡段位块：{ key, name, color, icon, isMaxRank, nextText }
    rank: { key: '', name: '', color: '', icon: '', isMaxRank: false, nextText: '' },

    // 段位阶梯弹窗：点段位奖牌弹出（全部 8 档 + 高亮当前档）
    ladder: [],
    rankModalVisible: false,

    // 计数
    unlockedCount: 0,
    totalCount: 0,

    // 5 类分区：[{ key, label, items[{ unlocked, art, title, badgeNum, progressText }] }]
    categories: [],
  },

  onLoad() {
    const app = getApp();
    if (!app.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    const sys = app && app.globalData && app.globalData.systemInfo;
    if (sys && sys.statusBarHeight) this.setData({ statusBarHeight: sys.statusBarHeight });
  },

  onShow() {
    const app = getApp();
    if (!app.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.loadAchievements();
  },

  onPullDownRefresh() {
    this.loadAchievements().then(() => wx.stopPullDownRefresh());
  },

  // 取数：一次拉全资料卡 + 成就墙，经视图模型映射后直接 setData。
  async loadAchievements() {
    this.setData({ loading: true, error: false });
    try {
      const data = await Achievement.get();
      const vm = buildAchievementsViewModel(data);
      this.setData({
        level: vm.level,
        rank: vm.rank,
        ladder: vm.ladder,
        unlockedCount: vm.unlockedCount,
        totalCount: vm.totalCount,
        categories: vm.categories,
      });
    } catch (e) {
      this.setData({ error: true });
      wx.showToast({ title: (e && e.message) || '加载失败，请重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 点段位奖牌：弹出段位阶梯弹窗（ladder 未就绪时不弹）。
  openRankModal() {
    if (!this.data.ladder.length) return;
    this.setData({ rankModalVisible: true });
  },
  closeRankModal() {
    this.setData({ rankModalVisible: false });
  },

  // 返回上一页（二级页，从「我的」navigateTo 进入）。
  onBack() {
    wx.navigateBack({
      fail() {
        wx.switchTab({ url: '/pages/profile/profile' });
      },
    });
  },
}, {
  title: '我的开练成就',
  path: '/pages/achievements/achievements',
}));
