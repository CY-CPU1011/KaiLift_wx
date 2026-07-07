// VoiceButton（design §5 / §6.2#6 / §6.3-6）★ 核心组件。
// variant：
//   home    —— 全宽主绿方块按钮「按住说话」，bindtap 触发（首页入口，跳训练页）。
//   workout —— 全宽主绿方块按钮，按住录音（训练页底部，像素感与 home 变体统一）。
// status（workout）：idle（待录）/ recording（正在听…可取消）/ processing（识别中）。
// 事件：bindtap（home 点击）、bindstart/bindstop（workout 录音起止）。
Component({
  properties: {
    status: { type: String, value: 'idle' },    // idle | recording | processing
    label: { type: String, value: '' },          // home 按钮文案（默认「按住说话」）
    hint: { type: String, value: '' },           // home 按钮下方提示（可空）
    bubble: { type: String, value: '' },         // workout 按钮文案/状态提示
    variant: { type: String, value: 'home' },    // home | workout
  },
  methods: {
    onTap() {
      this.triggerEvent('tap');
    },
    onStart() {
      if (this.data.status === 'processing') return;
      this.triggerEvent('start');
    },
    onStop() {
      if (this.data.status === 'processing') return;
      this.triggerEvent('stop');
    },
  },
});
