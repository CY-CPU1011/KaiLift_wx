// 自定义 TabBar（design §5.1 / §6.1）。app.json tabBar.custom=true，必须存在才能编译。
// 4 项：首页/训练/数据/我的。图标用 images/ui/nav/* 真切图（active/inactive 两态）。
// 「训练」选中态用浅绿像素胶囊高亮。tab 页 onShow 调 getTabBar().setData({ selected }) 同步。
Component({
  data: {
    selected: 0,
    // 页面弹出全屏浮层（如编辑资料 sheet）时置 true 隐藏：
    // 注入式自定义 tabBar 由框架渲染在独立图层，页面内 z-index 无法盖过它。
    hidden: false,
    // nav = images/ui/nav/ui_nav_{nav}_{active|inactive}.png 的 slug
    list: [
      { pagePath: '/pages/home/home', text: '首页', icon: 'home', nav: 'home' },
      { pagePath: '/pages/workout/workout', text: '训练', icon: 'workout', nav: 'dumbbell' },
      { pagePath: '/pages/stats/stats', text: '数据', icon: 'stats', nav: 'stats' },
      { pagePath: '/pages/profile/profile', text: '我的', icon: 'profile', nav: 'profile' },
    ],
  },
  methods: {
    onTap(e) {
      const index = e.currentTarget.dataset.index;
      const item = this.data.list[index];
      if (index === this.data.selected) return;
      wx.switchTab({ url: item.pagePath });
    },
  },
});
