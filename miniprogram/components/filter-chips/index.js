// FilterChips（design §5.4）。横向可滚动单选部位筛选。
// 选中：品牌绿实心 + 反白；未选中：浅灰底 + 次文字。
Component({
  properties: {
    items: { type: Array, value: [] },   // [string]
    active: { type: String, value: '' },
  },
  methods: {
    onSelect(e) {
      const value = e.currentTarget.dataset.value;
      if (value === this.data.active) return;
      this.triggerEvent('select', { value });
    },
  },
});
