// AchievementBadge（design §5 / §6.5）。像素徽章：
// 解锁=彩色奖牌切图（art 路径，中心可叠 badgeNum）；未解锁=灰盾 badge_shield_silver + 锁标。
Component({
  properties: {
    unlocked: { type: Boolean, value: false },
    title: { type: String, value: '' },
    // 解锁态使用的奖牌/奖杯切图路径（badges/*）。未解锁时忽略，固定显示灰盾。
    art: { type: String, value: '/images/badges/badge_medal_gold_flame.png' },
    // 中心叠加数字（如「21」），空则不显示。
    badgeNum: { type: String, value: '' },
    // 未解锁进度提示（如「3/5」），空则不显示；解锁态忽略。
    progressText: { type: String, value: '' },
  },
  methods: {
    onTap() { this.triggerEvent('tap'); },
  },
});
