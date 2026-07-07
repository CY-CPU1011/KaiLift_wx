// ListRow（design §5 / §6.5）。像素设置行：左小图标 + 标题 + 右值 + 像素箭头，整行可点。
// iconSrc：真切图路径（优先）；icon：兜底中文占位文字。dot：右上角红点提醒。
Component({
  properties: {
    iconSrc: { type: String, value: '' },  // 真切图路径（优先）
    icon: { type: String, value: '' },     // 占位中文文字（兜底）
    title: { type: String, value: '' },
    value: { type: String, value: '' },
    dot: { type: Boolean, value: false },
  },
  methods: {
    onTap() {
      this.triggerEvent('tap');
    },
  },
});
