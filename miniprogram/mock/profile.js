// 「我的」页 mock 数据（design §6.4）。
// 默认即视觉稿当前状态（新用户：概览全 0、成就全锁定）。
// 结构与 loadProfile() 经 service 计算后的 viewmodel 同构。
module.exports = {
  // 用户资料（取自 auth.getUser 兜底）
  profile: {
    nickname: '健身新手',
    avatarUrl: '',
    loginState: '已登录',
  },

  // 三张概览卡：累计训练次数 / 总训练量(kg) / 动作种类
  stats: { count: 0, volume: 0, exerciseTypes: 0 },

  // 成就墙：横排 6 个，首版多为锁定态（结构与 buildAchievements 同构）。
  // art = 解锁态奖牌切图；badgeNum = 中心叠加数字（可空）。
  achievements: [
    { title: '首次开练', unlocked: false, art: '/images/badges/badge_medal_bronze_flame.png', badgeNum: '' },
    { title: '21天连续', unlocked: false, art: '/images/badges/badge_medal_gold_flame.png', badgeNum: '21' },
    { title: '深蹲 PR', unlocked: false, art: '/images/badges/badge_pr_squat.png', badgeNum: '' },
    { title: '卧推 PR', unlocked: false, art: '/images/badges/badge_pr_bench_press.png', badgeNum: '' },
    { title: '硬拉 PR', unlocked: false, art: '/images/badges/badge_pr_deadlift.png', badgeNum: '' },
    { title: '全能选手', unlocked: false, art: '/images/badges/badge_trophy_gold.png', badgeNum: '' },
  ],

  // 单位（kg/lb），驱动「单位·主题」行展示
  unitWeight: 'kg',
};
