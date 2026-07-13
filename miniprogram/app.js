// app.js — 开练 KaiLift 小程序入口
const auth = require('./utils/auth');

App({
  globalData: {
    userInfo: null,
    systemInfo: null,
    // 进行中的训练（active session），跨页共享，便于「恢复训练」
    activeSession: null,
  },

  onLaunch() {
    // 系统信息（状态栏高度 / 安全区），供自定义导航栏与 TabBar 使用
    try {
      const sys = wx.getWindowInfo();
      this.globalData.systemInfo = sys;
    } catch (e) {
      this.globalData.systemInfo = { statusBarHeight: 20, safeArea: null };
    }

    // 还原本地登录态
    const user = auth.getUser();
    if (user) {
      this.globalData.userInfo = user;
    }
  },

  // 是否已登录（有 token）
  isLoggedIn() {
    return !!auth.getToken();
  },
});
