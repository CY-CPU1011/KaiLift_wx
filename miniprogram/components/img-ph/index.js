// 通用占位组件（design §4.6）
// 真图存在则显示真图；未就位时显示「灰底圆角 + 居中 label」，不依赖任何 PNG。
//
// 占位阶段开关：真实 3D 素材尚未放入 assets/ 前，统一只渲染占位，
// 避免 <image> 去加载不存在的本地资源而报 500/timeout。素材就位后改为 true。
const ASSETS_READY = false;

Component({
  properties: {
    src: { type: String, value: '' },     // 约定真图路径（可空）
    w: { type: Number, value: 120 },       // rpx
    h: { type: Number, value: 120 },       // rpx
    label: { type: String, value: '图' },
    round: { type: String, value: '24rpx' },
    mode: { type: String, value: 'aspectFit' },
  },
  data: { failed: false, ready: ASSETS_READY },
  methods: {
    onError() { this.setData({ failed: true }); },
  },
});
