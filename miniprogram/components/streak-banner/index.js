// StreakBanner（design §5 / §6.2 决策#1）★ 首页「本月训练天数」卡。
// 薄荷底像素方块（--px-border/shadow）；左 male_overhead_press 角色，
// 右「本月训练」+ 大绿数字 已训练 monthDays 天 + fire 图标 + 行动按钮。
// ⚠ 决策#1（已改版）：取代原 21 天计划，记录本月已训练多少天；保留火焰/卡片视觉。
Component({
  properties: {
    monthDays: { type: Number, value: 0 },   // 本月已训练天数
  },
  methods: {
    onAction() {
      this.triggerEvent('action');
    },
  },
});
