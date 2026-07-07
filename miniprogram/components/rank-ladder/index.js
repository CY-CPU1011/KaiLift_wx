// 段位阶梯弹窗：点「我的」/成就墙的段位奖牌弹出，展示全部 8 档段位 + 高亮当前所在档。
// 数据由页面经 utils/achievement.buildLadder 备好（每档已解析奖牌图 + isCurrent 标记），
// 组件只管显隐动画与渲染。8 档断点/颜色/图标是后端单一真相源，前端按 ladder 动态渲染不写死。
// ⚠ 全程禁数组解构/展开（WeChat babel arrayWithHoles 坑），用索引/for 循环。
Component({
  properties: {
    // 显隐：页面控制，开启时驱动卡片入场动画
    visible: { type: Boolean, value: false },
    // 段位阶梯（已解析视图模型；空数组则不渲染列表）
    ladder: { type: Array, value: [] },
    // 顶部提示文案（如「距强健还差3级」；满段为空串则隐藏）
    tipText: { type: String, value: '' },
  },
  data: {
    entered: false, // 卡片入场动画标志（控制缩放/淡入）
  },
  observers: {
    visible(v) {
      if (v) this._play();
      else this.setData({ entered: false });
    },
  },
  methods: {
    // 入场：下一帧置 entered，借卡片自带 transition 做缩放/淡入。
    _play() {
      this.setData({ entered: false });
      const that = this;
      setTimeout(function () {
        that.setData({ entered: true });
      }, 30);
    },
    // 点遮罩 / 关闭按钮：通知页面收起。
    onClose() {
      this.triggerEvent('close');
    },
    // 卡片内空白点击不冒泡到遮罩。
    noop() {},
  },
});
