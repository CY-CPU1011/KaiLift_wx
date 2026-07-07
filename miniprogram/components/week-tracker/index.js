// WeekTracker（design §5 / §6.2#3）。区块标题 + 一行 7 个像素方块。
// 已完成=绿底白勾 + 黑色描边；今日未完成=琥珀描边；未完成=白底描边。
const WEEK_CN = ['一', '二', '三', '四', '五', '六', '日'];
Component({
  properties: {
    days: { type: Array, value: [] },     // [{done, isToday}]
    completed: { type: Number, value: 0 },
    total: { type: Number, value: 7 },
  },
  data: {
    weekCn: WEEK_CN,
  },
});
