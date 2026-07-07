// PageHeader（design §5.2）。自定义导航栏头部。
// mode='title'：大标题；mode='greeting'：问候 + 日历图标与日期行。
// 顶部按 statusBarHeight 留白；右上预留胶囊宽度。
Component({
  properties: {
    mode: { type: String, value: 'title' },      // 'title' | 'greeting'
    title: { type: String, value: '' },
    name: { type: String, value: '' },
    dateText: { type: String, value: '' },
    showCapsuleSpace: { type: Boolean, value: true },
  },
  data: {
    statusBarHeight: 20,
  },
  lifetimes: {
    attached() {
      let h = 20;
      try {
        const app = getApp();
        const sys = app && app.globalData && app.globalData.systemInfo;
        if (sys && sys.statusBarHeight) h = sys.statusBarHeight;
      } catch (e) {}
      this.setData({ statusBarHeight: h });
    },
  },
  methods: {
    onBack() {
      this.triggerEvent('back');
    },
  },
});
