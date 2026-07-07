// 登录页 —— 用户主动触发微信 openid 登录；头像昵称留到「我的」页自行编辑。
const auth = require('../../utils/auth');
const { withSharePage } = require('../../utils/share-page');

Page(withSharePage({
  data: {
    statusBarHeight: 20,   // 自定义导航栏顶部留白
    logging: false,        // 「微信一键登录」loading 态
    redirect: '',
  },

  onLoad(options) {
    const redirect = options && options.redirect ? decodeURIComponent(options.redirect) : '';
    if (redirect) this.setData({ redirect });
    const app = getApp();
    if (app && app.isLoggedIn()) {
      this.enterApp();
      return;
    }
    const sys = app && app.globalData && app.globalData.systemInfo;
    if (sys && sys.statusBarHeight) {
      this.setData({ statusBarHeight: sys.statusBarHeight });
    }
  },

  // 微信一键登录：wx.login → POST /auth/login → 存 token+user
  async onLogin() {
    if (this.data.logging) return;
    this.setData({ logging: true });
    try {
      await auth.login();
      this.enterApp();
    } catch (e) {
      this.setData({ logging: false });
      this.toastError(e);
    }
  },

  onExplore() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  enterApp() {
    const target = this.data.redirect || '/pages/home/home';
    const tabPages = {
      '/pages/home/home': true,
      '/pages/workout/workout': true,
      '/pages/stats/stats': true,
      '/pages/profile/profile': true,
    };
    if (tabPages[target]) {
      wx.switchTab({ url: target });
      return;
    }
    wx.redirectTo({ url: target });
  },

  toastError(e) {
    let title = (e && e.message) || '登录失败，请重试';
    // 后端未启动 / 无法连接（localhost:20020）
    if (e && (e.code === 'network' || /网络|连接|timeout|fail/i.test(title))) {
      title = '无法连接服务器，请确认后端已启动';
    }
    wx.showToast({ title, icon: 'none' });
  },
}, {
  title: '开练 KaiLift',
  path: '/pages/home/home',
}));
