// SegmentedControl（design §5 / §6.4）。像素分段：每段独立方块，选中绿底白字+描边。
Component({
  properties: {
    options: { type: Array, value: [] },   // [{label, value}]
    value: { type: String, value: '' },
  },
  methods: {
    onTap(e) {
      const value = e.currentTarget.dataset.value;
      if (value === this.data.value) return;
      this.triggerEvent('change', { value });
    },
  },
});
