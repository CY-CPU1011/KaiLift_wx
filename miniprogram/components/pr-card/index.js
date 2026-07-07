// PRCard（design §6.4 / §4.6）。像素方块卡：左竖条(部位色) + 动作名 + tone 大数字 + 单位 + 日期。
// 右上可叠 PR 徽章（badgeSrc，images/badges/badge_pr_*）；右下器材图标（equipmentSrc，images/ui/equipment/*）。
// tone 按部位映射竖条/数字色：pink|blue|green|amber|purple。
Component({
  properties: {
    name: { type: String, value: '' },
    value: { type: null, value: '' },
    unit: { type: String, value: 'kg' },
    date: { type: String, value: '' },
    tone: { type: String, value: 'pink' },
    isTop: { type: Boolean, value: false },
    badgeSrc: { type: String, value: '' },        // PR 专属徽章（可空）
    equipmentSrc: { type: String, value: '' },    // 器材图标（可空）
  },
  methods: {
    onTap() { this.triggerEvent('tap'); },
  },
});
