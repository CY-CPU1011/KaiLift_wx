// Timer（design §5.16）。巨型 mm:ss + ●训练中 + 内联「N组·M动作·总量Wkg」。
// 仅做展示：秒数由页面（页面级 setInterval）传入，组件内只格式化。
Component({
  properties: {
    seconds: { type: Number, value: 0 },
    sets: { type: null, value: 0 },
    exercises: { type: null, value: 0 },
    volume: { type: null, value: 0 },
  },
  data: {
    timeText: '00:00',
  },
  observers: {
    seconds(s) {
      const total = Math.max(0, Math.floor(Number(s) || 0));
      const mm = Math.floor(total / 60);
      const ss = total % 60;
      const pad = (n) => (n < 10 ? '0' + n : '' + n);
      this.setData({ timeText: pad(mm) + ':' + pad(ss) });
    },
  },
});
