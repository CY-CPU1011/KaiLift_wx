// TrendChart（design §5.14）★ 趋势折线图。
// echarts/ec-canvas 包未就位 → 降级为纯 view 折线（点 + 旋转线段连线 + 末点高亮），保证不报错。
// TODO(design): 接 echarts（components/ec-canvas + line 图表，smooth + areaStyle 渐变）。
const CHART_H = 320;   // 绘图区高度(rpx)
const PAD_TOP = 30;    // 顶部留白(rpx)
const PAD_BOT = 30;    // 底部留白(rpx)

Component({
  properties: {
    points: { type: Array, value: [] },        // [number]
    xLabels: { type: Array, value: [] },        // [string]
    unit: { type: String, value: '' },
    deltaText: { type: String, value: '' },
  },
  data: {
    chartH: CHART_H,
    nodes: [],       // [{xPct, yPct, last}]
    segments: [],    // [{leftPct, topPct, widthPct, angle}]
    hasData: false,
  },
  observers: {
    points(points) {
      this.layout(points);
    },
  },
  lifetimes: {
    attached() { this.layout(this.data.points); },
  },
  methods: {
    layout(points) {
      const pts = (points || []).map(Number).filter((n) => !isNaN(n));
      if (pts.length < 1) {
        this.setData({ nodes: [], segments: [], hasData: false });
        return;
      }
      const max = Math.max.apply(null, pts);
      const min = Math.min.apply(null, pts);
      const range = max - min || 1;
      const innerTopPct = (PAD_TOP / CHART_H) * 100;
      const innerBotPct = (PAD_BOT / CHART_H) * 100;
      const usablePct = 100 - innerTopPct - innerBotPct;

      const n = pts.length;
      const nodes = pts.map((v, i) => {
        const xPct = n === 1 ? 50 : (i / (n - 1)) * 100;
        const norm = (v - min) / range;            // 0..1，越大越高
        const yPct = innerTopPct + (1 - norm) * usablePct;  // top% (0 在顶部)
        return { xPct, yPct, last: i === n - 1 };
      });

      // 相邻节点连线段（用绝对定位 + rotate 近似折线；按百分比近似，longest 视觉够用）
      const segments = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i];
        const b = nodes[i + 1];
        const dx = b.xPct - a.xPct;
        const dy = b.yPct - a.yPct;
        const widthPct = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        segments.push({
          leftPct: a.xPct,
          topPct: a.yPct,
          widthPct,
          angle,
        });
      }

      this.setData({ nodes, segments, hasData: true });
    },
  },
});
