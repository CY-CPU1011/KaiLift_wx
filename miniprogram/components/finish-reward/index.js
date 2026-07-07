// FinishReward —— 训练完赛即时庆祝动画覆盖层（design §3.6 结算庆祝）。
// 仅「首次完赛」播放：飘 EXP + 进度条滚动；升级 / 升段 / 解锁成就按需追加。
// 数据来自 utils/achievement.js 的 buildFinishReward（非首次为 null，组件不渲染）。
// ⚠ 全程禁数组解构/展开（WeChat babel arrayWithHoles 坑），用索引/for 循环 / Object.assign。
Component({
  properties: {
    // buildFinishReward 的返回（首次完赛视图模型；null 则不渲染内容）
    reward: { type: Object, value: null },
    // 覆盖层显隐：由页面控制，开启时驱动进度条滚动动画
    visible: { type: Boolean, value: false },
  },
  data: {
    // 进度条当前百分比：升级时从 0 滚到 afterPercent，未升级直接显示 afterPercent
    barPercent: 0,
    entered: false, // 卡片入场动画标志（控制缩放/淡入）
  },
  observers: {
    // 显隐变化驱动动画：开启时下一帧把进度条滚到目标（升级从 0 起，制造滚动观感）
    visible(v) {
      if (v) this._play();
      else this.setData({ barPercent: 0, entered: false });
    },
  },
  methods: {
    // 播放入场：先把进度条压回起点，再于下一帧滚到目标值，借进度条自带 transition 动画。
    _play() {
      const r = this.data.reward;
      if (!r) return;
      const target = Math.max(0, Math.min(100, Number(r.afterPercent) || 0));
      // 升级：从 0 滚到目标；未升级：直接坐落目标（无需空跑动画）
      const start = r.isLevelUp ? 0 : target;
      this.setData({ barPercent: start, entered: false });
      // 下一帧再设目标值与入场标志，确保 transition 生效
      const that = this;
      setTimeout(function () {
        that.setData({ barPercent: target, entered: true });
      }, 60);
    },
    // 点击遮罩 / 卡片 / 继续按钮：统一通知页面动画结束（页面据此跳转）
    onClose() {
      this.triggerEvent('close');
    },
    // 卡片内空白点击不冒泡到遮罩（避免「点卡片想看内容却关闭」）；继续按钮另走 onClose
    noop() {},
  },
});
