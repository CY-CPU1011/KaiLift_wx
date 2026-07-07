// ProgressBar（design §5 / §2.2）。通用像素分段填充条：外描边 + 绿色实心填充 + 等分刻度。
// 通用属性：percent(0-100) / color(覆盖填充色) / showLabel / segments(刻度格数)。
// 数据页计划进度、我的页 EXP 占位等共用，不写死成 EXP 专用。
Component({
  properties: {
    percent: { type: Number, value: 0 },     // 0-100
    color: { type: String, value: '' },       // 传入色（如 var(--c-blue)），空则品牌绿
    showLabel: { type: Boolean, value: true },
    segments: { type: Number, value: 10 },     // 像素刻度格数（视觉），默认 10 格
  },
  data: {
    clamped: 0,
    tickList: [],
  },
  observers: {
    percent(p) {
      const n = Math.max(0, Math.min(100, Number(p) || 0));
      this.setData({ clamped: n });
    },
    segments(s) {
      const n = Math.max(1, Math.min(40, Math.round(Number(s) || 10)));
      this.setData({ tickList: Array.from({ length: n }, (_, i) => i) });
    },
  },
  lifetimes: {
    attached() {
      const n = Math.max(1, Math.min(40, Math.round(Number(this.data.segments) || 10)));
      this.setData({ tickList: Array.from({ length: n }, (_, i) => i) });
    },
  },
});
