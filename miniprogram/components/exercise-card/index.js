// ExerciseCard（design §6.3-5）。像素方块卡：器材图标 + 动作名 +「组×次@重量」+ 右上状态徽标。
// badge：'done'（绿勾=完成）/ 'todo'（蓝钟=待做·进行中，默认）。
// equipmentSlug → equipment/* 图标（§4.4：统一用器材图标，缺省回退杠铃）。
const EQUIP_IMG = {
  barbell: '/images/ui/equipment/ui_equipment_barbell.png',
  dumbbell: '/images/ui/equipment/ui_equipment_dumbbell.png',
  bench: '/images/ui/equipment/ui_equipment_bench.png',
};
const DEFAULT_EQUIP = EQUIP_IMG.barbell;

Component({
  properties: {
    name: { type: String, value: '' },
    sets: { type: null, value: '' },
    reps: { type: null, value: '' },
    weight: { type: null, value: '' },
    tone: { type: String, value: 'green' },
    status: { type: String, value: '' },        // 'draft'/'active'=进行中 → 蓝钟；'done'/'' → 由 status 映射
    equipmentSlug: { type: String, value: '' },  // barbell | dumbbell | bench
  },
  data: {
    equipImg: DEFAULT_EQUIP,
    badge: 'todo',
  },
  observers: {
    equipmentSlug(slug) {
      this.setData({ equipImg: EQUIP_IMG[slug] || DEFAULT_EQUIP });
    },
    status(s) {
      // 'done' → 绿勾；其余（draft/active/进行中）→ 蓝钟待做
      this.setData({ badge: s === 'done' ? 'done' : 'todo' });
    },
  },
  methods: {
    onTap() { this.triggerEvent('tap'); },
    onEdit() {
      // 阻止冒泡到整卡 tap
      this.triggerEvent('edit');
    },
  },
});
