// Heatmap（design §6.4）★ 原生 view 网格自绘的「贡献图」：
// 周列 × 周一~周日行，月份 1–12 顶标，5 档绿色像素格（无训练=浅灰）。
// 像素风：格子方角描边、整年日历对齐。不用 canvas。bindcelltap。
// 入参：year（必，渲染整年日历）+ levelMap（date→level 0..4 映射）。
//      也兼容 cells（[{date, level, isToday}]，优先）。
const HEATMAP_LEVELS = 5;       // 0..4
const WEEKDAY_OFFSET_RPX = 40;   // 左侧周几标签列 + 间距
const WEEK_COL_STEP_RPX = 36;    // 单周列宽 28rpx + 右间距 8rpx
const CELL_SIZE_RPX = 28;
// 左标只显示 一/三/五/日（GitHub 风格隔行显示，行序为周一→周日）
const WEEKDAY_LABELS = ['一', '', '三', '', '五', '', '日'];
const MONTH_CN = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function dateKey(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

Component({
  properties: {
    year: { type: Number, value: 0 },
    levelMap: { type: Object, value: null }, // { 'YYYY-MM-DD': level }
    cells: { type: Array, value: [] },        // [{date, level, isToday}]（可选，优先）
  },
  data: {
    weeks: [],                 // [[cell,...7], ...] 按周分列（行序 周一..周日）
    months: [],                // 顶部月份标签 [{key,label}]
    scrollLeft: 0,             // 当前年份默认滚到当前月份附近
    weekdayLabels: WEEKDAY_LABELS,
    // 图例：按单日训练时长分档（10分钟→半小时→1小时→1.5小时以上）
    legend: [
      { level: 0, text: '无训练' },
      { level: 1, text: '10分钟' },
      { level: 2, text: '30分钟' },
      { level: 3, text: '1小时' },
      { level: 4, text: '1.5小时+' },
    ],
  },
  observers: {
    'cells, levelMap, year': function () {
      this.build();
    },
  },
  lifetimes: {
    attached() { this.build(); },
  },
  methods: {
    build() {
      // 1) 优先用显式 cells（保持向后兼容）
      const explicit = this.data.cells;
      if (explicit && explicit.length) {
        this.buildFromList(explicit.map((c) => ({
          date: c.date || '',
          level: this.clampLevel(c.level),
          isToday: !!c.isToday,
        })));
        return;
      }
      // 2) 默认：按 year 渲染整年日历，levelMap 映射填等级
      const year = Number(this.data.year) || new Date().getFullYear();
      const map = (this.data.levelMap && typeof this.data.levelMap === 'object')
        ? this.data.levelMap
        : {};
      const todayKey = dateKey(new Date());

      // 网格从「含 1 月 1 日的那一周的周一」开始，到「含 12 月 31 日的那一周的周日」结束
      const first = new Date(year, 0, 1);
      const last = new Date(year, 11, 31);
      // JS getDay(): 周日=0 → 转成周一=0..周日=6
      const mondayIndex = (first.getDay() + 6) % 7;
      const gridStart = new Date(year, 0, 1 - mondayIndex);
      const lastMondayIndex = (last.getDay() + 6) % 7;
      const gridEnd = new Date(year, 11, 31 + (6 - lastMondayIndex));

      const list = [];
      for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
        const inYear = d.getFullYear() === year;
        const key = dateKey(d);
        list.push({
          date: inYear ? key : '',                 // 越界（上一年末/下一年初）留空、不可点
          level: inYear ? this.clampLevel(map[key]) : 0,
          isToday: inYear && key === todayKey,
          blank: !inYear,
        });
      }
      this.buildFromList(list);
    },

    // 把扁平的 [{date,level,isToday,blank}] 切成周列 + 计算月份顶标
    buildFromList(list) {
      if (!list.length) {
        this.setData({ weeks: [], months: [] });
        return;
      }
      const weeks = [];
      for (let i = 0; i < list.length; i += 7) {
        weeks.push(list.slice(i, i + 7));
      }
      // 月份标签：某周的周一所在月份与上一周不同 → 在该列打月份标
      const months = [];
      let lastMonth = -1;
      weeks.forEach((col, idx) => {
        // 取该列首个有日期的格子判定月份
        const anchor = col.find((c) => c.date);
        let label = '';
        if (anchor && anchor.date) {
          const mo = Number(anchor.date.slice(5, 7));
          if (mo !== lastMonth) {
            label = MONTH_CN[mo - 1] || (mo + '月');
            lastMonth = mo;
          }
        }
        months.push({ key: idx, label });
      });
      this.setData({ weeks, months }, () => this.scrollToCurrentMonth(months));
    },

    currentMonthColumn(months) {
      const now = new Date();
      const year = Number(this.data.year) || now.getFullYear();
      if (year !== now.getFullYear()) return 0;
      const label = MONTH_CN[now.getMonth()];
      for (let i = 0; i < months.length; i++) {
        if (months[i] && months[i].label === label) return i;
      }
      return 0;
    },

    scrollToCurrentMonth(months) {
      const targetCol = this.currentMonthColumn(months || []);
      if (!targetCol) {
        this.setData({ scrollLeft: 0 });
        return;
      }
      const query = this.createSelectorQuery();
      query.select('.hm__scroll').boundingClientRect((rect) => {
        let windowWidth = 375;
        try {
          const info = wx.getWindowInfo();
          windowWidth = (info && info.windowWidth) || windowWidth;
        } catch (e) {}
        const rpxPerPx = 750 / windowWidth;
        const viewportRpx = rect && rect.width ? rect.width * rpxPerPx : windowWidth * rpxPerPx;
        const targetCenterRpx = WEEKDAY_OFFSET_RPX + targetCol * WEEK_COL_STEP_RPX + CELL_SIZE_RPX / 2;
        const scrollLeftRpx = Math.max(0, targetCenterRpx - viewportRpx / 2);
        this.setData({ scrollLeft: Math.round(scrollLeftRpx / rpxPerPx) });
      }).exec();
    },

    clampLevel(lv) {
      const n = Math.round(Number(lv) || 0);
      return Math.max(0, Math.min(HEATMAP_LEVELS - 1, n));
    },

    onCellTap(e) {
      const { date, level } = e.currentTarget.dataset;
      if (!date) return;
      this.triggerEvent('celltap', { date, level: Number(level) || 0 });
    },
  },
});
