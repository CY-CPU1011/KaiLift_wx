// StatCard（design §5 / §6.2#5）。像素方块卡：顶部小图标 + signature 大数字 + 单位 + 标签。
// 图标三选一：iconSrc（真切图，优先）> iconShape（CSS 形状，目前支持 'clock'）> icon（img-ph 占位文字）。
// tone：green|amber|blue|pink|purple，控制浅底与强调色。
Component({
  properties: {
    iconSrc: { type: String, value: '' },   // 真切图路径（优先）
    iconShape: { type: String, value: '' }, // 'clock' 等 CSS 形状（补切图缺口）
    icon: { type: String, value: '' },      // img-ph 占位中文文字（兜底）
    value: { type: String, value: '' },
    unit: { type: String, value: '' },
    label: { type: String, value: '' },
    tone: { type: String, value: 'green' },
    progress: { type: null, value: null },  // 0-1 | null
    watermark: { type: Boolean, value: false }, // 右下低透明度水印（stats 概览卡变体）
  },
  data: {
    percent: 0,
    hasProgress: false,
  },
  observers: {
    progress(p) {
      const has = p !== null && p !== undefined && p !== '';
      const num = has ? Math.max(0, Math.min(1, Number(p))) : 0;
      this.setData({ hasProgress: has, percent: Math.round(num * 100) });
    },
  },
});
