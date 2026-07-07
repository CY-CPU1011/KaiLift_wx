// 数据页（design §6.4）—— TAB 页，三子视图：热力图 / PR 墙 / 趋势图。
// 自定义导航栏；进入需登录；失败显示错误态，不注入示例数据。
// 取数：后端聚合接口 /stats/heatmap、/stats/day、/stats/trend + /personal-records，
// 不再客户端全量拉 session 自聚合（口径与首页 /stats/home 统一，北京时区）。
// ⚠ 微信 babel 坑：禁数组解构/展开，一律索引访问 / .apply / for 循环。
const { PR, Stats } = require('../../service/api');
const { BODY_PARTS, PART_TONE } = require('../../utils/constants');
const { formatVolume, formatMonthDay } = require('../../utils/format');
const { withSharePage } = require('../../utils/share-page');

const SUBVIEWS = [
  { label: '热力图', value: 'heatmap' },
  { label: 'PR 墙', value: 'pr' },
  { label: '趋势图', value: 'trend' },
];

const RANGE_OPTIONS = [
  { label: '周', value: 'week' },
  { label: '月', value: 'month' },
];

const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// 部位关键词推断（PR 没有 bodyPart 字段时按动作名猜）
const PART_KEYWORDS = {
  胸: ['卧推', '夹胸', '飞鸟', '蝴蝶'],
  背: ['划船', '引体', '硬拉', '下拉', '背'],
  腿: ['深蹲', '腿', '弓步', '臀', '蹲'],
  肩: ['推举', '肩', '飞鸟侧平举', '侧平举'],
  手臂: ['弯举', '臂屈伸', '二头', '三头'],
  核心: ['卷腹', '平板', '核心', '腹'],
};

function inferPart(name) {
  const n = name || '';
  for (const part of Object.keys(PART_KEYWORDS)) {
    if (PART_KEYWORDS[part].some((kw) => n.indexOf(kw) >= 0)) return part;
  }
  return '胸';
}

// 器材图标路径（design §4.4：动作明细统一用 equipment/* 器材图标，避免缺图）。
const EQUIP = {
  barbell: '/images/ui/equipment/ui_equipment_barbell.png',
  dumbbell: '/images/ui/equipment/ui_equipment_dumbbell.png',
  bench: '/images/ui/equipment/ui_equipment_bench.png',
};
// 后端 equipmentSlug → 图标（仅这三类有切图，其余按动作名关键词兜底）。
const EQUIP_BY_SLUG = {
  barbell: EQUIP.barbell,
  dumbbell: EQUIP.dumbbell,
  bench: EQUIP.bench,
};
function equipmentSrc(name) {
  const n = name || '';
  if (n.indexOf('卧推') >= 0 || n.indexOf('夹胸') >= 0 || n.indexOf('蝴蝶') >= 0 || n.indexOf('飞鸟') >= 0) return EQUIP.bench;
  if (n.indexOf('哑铃') >= 0 || n.indexOf('弯举') >= 0 || n.indexOf('侧平举') >= 0) return EQUIP.dumbbell;
  // 深蹲/硬拉/划船/推举/默认 → 杠铃
  return EQUIP.barbell;
}
function equipmentSrcFromSlug(slug, name) {
  if (slug && EQUIP_BY_SLUG[slug]) return EQUIP_BY_SLUG[slug];
  return equipmentSrc(name);
}

// PR 专属徽章（仅深蹲/卧推/硬拉有切图，design §4.2）。
const PR_BADGE = [
  { kws: ['深蹲', '蹲'], src: '/images/badges/badge_pr_squat.png' },
  { kws: ['卧推'], src: '/images/badges/badge_pr_bench_press.png' },
  { kws: ['硬拉'], src: '/images/badges/badge_pr_deadlift.png' },
];
function prBadgeSrc(name) {
  const n = name || '';
  for (const b of PR_BADGE) {
    if (b.kws.some((kw) => n.indexOf(kw) >= 0)) return b.src;
  }
  return '';
}

// 取本地日期 yyyy-mm-dd（用于"今天"判断；国内设备即北京日，与后端口径一致）
function localDateKey(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const m = dt.getMonth() + 1;
  const day = dt.getDate();
  return dt.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
}

// 年份列表：后端 availableYears 并入当前年，升序去重（保证当前年始终可选）。
function buildYears(availableYears, currentYear) {
  const set = {};
  (availableYears || []).forEach((y) => { set[Number(y)] = true; });
  set[currentYear] = true;
  const arr = Object.keys(set).map(Number);
  arr.sort((a, b) => a - b);
  return arr;
}

// 当日某动作行的副标题：N 组（有重量再带"最重 X kg"）。
function buildDaySummary(item) {
  const setCount = Number(item.setCount) || 0;
  let s = setCount + ' 组';
  const top = Number(item.topWeightKg);
  if (item.topWeightKg !== null && item.topWeightKg !== undefined && top > 0) {
    s += ' · 最重 ' + Math.round(top) + ' kg';
  }
  return s;
}

Page(withSharePage({
  data: {
    statusBarHeight: 20,
    isGuest: true,
    loading: true,
    error: false,

    subviews: SUBVIEWS,
    subview: 'heatmap',

    rangeOptions: RANGE_OPTIONS,

    // 热力图
    years: [],
    year: new Date().getFullYear(),
    yearIndex: 0,
    heatmapData: {},          // date -> level 0-4
    dayDetail: null,          // { dateText, weekText, volumeText, items[] }

    // PR 墙
    bodyParts: BODY_PARTS,
    activePart: '全部',
    prAll: [],
    prList: [],

    // 趋势图
    trendRange: 'week',
    trendPoints: [],
    trendXLabels: [],
    trendDeltaText: '',
    overview: { avg: '', peak: '', delta: '' },
    distribution: [],

    hasSessions: false,
    hasPr: false,
  },

  onLoad() {
    const app = getApp();
    const isGuest = !(app && app.isLoggedIn());
    const sys = app && app.globalData && app.globalData.systemInfo;
    if (sys && sys.statusBarHeight) this.setData({ statusBarHeight: sys.statusBarHeight });

    const thisYear = new Date().getFullYear();
    this.setData({ isGuest, years: [thisYear], year: thisYear, yearIndex: 0 });

    this._heatLatestDate = '';
    if (isGuest) {
      this.applyGuestStats();
      return;
    }
    this.loadStats();
  },

  onShow() {
    const app = getApp();
    const isGuest = !(app && app.isLoggedIn());
    this.setData({ isGuest });
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    if (isGuest) {
      this.applyGuestStats();
      return;
    }
    if (!this._loaded) this.loadStats();
  },

  // 初次取数：热力图(当前年) + PR + 趋势(当前粒度) 并行；成功后再取默认当日明细。
  async loadStats() {
    const app = getApp();
    if (app && !app.isLoggedIn()) {
      this.applyGuestStats();
      return;
    }
    this.setData({ loading: true, error: false });
    try {
      const results = await Promise.all([
        Stats.heatmap({ year: this.data.year }),
        PR.list(),
        Stats.trend({ granularity: this.data.trendRange }),
      ]);
      this.applyHeatmap(results[0]);
      this.buildPr((results[1] && results[1].items) || []);
      this.applyTrend(results[2]);
      await this.loadDefaultDay();
    } catch (e) {
      this.setData({
        loading: false,
        error: true,
        heatmapData: {},
        dayDetail: null,
        prAll: [],
        prList: [],
        trendPoints: [],
        distribution: [],
        hasSessions: false,
        hasPr: false,
      });
      wx.showToast({ title: (e && e.message) || '训练数据加载失败', icon: 'none' });
      return;
    }
    this._loaded = true;
    this.setData({ loading: false });
  },

  applyGuestStats() {
    const thisYear = new Date().getFullYear();
    this._loaded = false;
    this._heatLatestDate = '';
    this.setData({
      loading: false,
      error: false,
      years: [thisYear],
      year: this.data.year || thisYear,
      yearIndex: 0,
      heatmapData: {},
      dayDetail: null,
      prAll: [],
      prList: [],
      trendPoints: [],
      trendXLabels: [],
      trendDeltaText: '',
      overview: { avg: '0', peak: '0', delta: '—' },
      distribution: [],
      hasSessions: false,
      hasPr: false,
    });
  },

  /* ---------------- 子视图切换 ---------------- */
  onSubviewChange(e) {
    this.setData({ subview: e.detail.value });
  },

  /* ---------------- 热力图 ---------------- */
  // 应用 /stats/heatmap：每天 volumeKg → 0-4 档；availableYears → 年份切换。
  applyHeatmap(data) {
    const days = (data && data.days) || [];
    const map = {};
    let latest = '';
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      if (!d || !d.date) continue;
      // days[] 里都是有训练的北京日：色深按单日训练时长分档，至少点亮最浅一档
      // （后端未返回 durationMin 时为 0 档，仍兜底为 1；durationMin=0 的训练日同理）
      map[d.date] = Math.max(1, this.durationToLevel(d.durationMin));
      if (d.date > latest) latest = d.date;
    }
    const years = buildYears(data && data.availableYears, new Date().getFullYear());
    let yearIndex = years.indexOf(this.data.year);
    if (yearIndex < 0) yearIndex = years.indexOf(new Date().getFullYear());
    if (yearIndex < 0) yearIndex = 0;
    this._heatLatestDate = latest;
    this.setData({
      heatmapData: map,
      years,
      yearIndex,
      hasSessions: (data && data.availableYears && data.availableYears.length > 0) || false,
    });
  },

  // 拉某年热力图（年份切换时调用，失败不致命）。
  async loadHeatmap(year) {
    if (this.data.isGuest) {
      this.setData({ heatmapData: {}, dayDetail: null, hasSessions: false });
      return;
    }
    try {
      const data = await Stats.heatmap({ year });
      this.applyHeatmap(data);
      await this.loadDefaultDay();
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '热力图加载失败', icon: 'none' });
    }
  },

  // 单日训练时长(分钟) -> 0-4 级：10分钟内→1，半小时→2，1小时→3，1.5小时以上→4
  durationToLevel(durationMin) {
    const m = Number(durationMin) || 0;
    if (m <= 0) return 0;
    if (m < 30) return 1;
    if (m < 60) return 2;
    if (m < 90) return 3;
    return 4;
  },

  onYearPrev() {
    const year = this.data.year - 1;
    this.setData({ year }, () => this.loadHeatmap(year));
  },

  onYearNext() {
    const year = this.data.year + 1;
    this.setData({ year }, () => this.loadHeatmap(year));
  },

  // 热力图格子点击 → 拉当日明细
  onCellTap(e) {
    const date = e.detail && e.detail.date;
    if (!date) return;
    this.loadDay(date);
  },

  // 默认当日明细：本年含今天则取今天，否则取该年最近有训练的一天。
  async loadDefaultDay() {
    const todayKey = localDateKey(new Date());
    let target = '';
    if (this.data.heatmapData[todayKey]) target = todayKey;
    else if (this._heatLatestDate) target = this._heatLatestDate;
    if (target) await this.loadDay(target);
    else this.setData({ dayDetail: null });
  },

  // 拉 /stats/day 并组装当日明细卡（按动作聚合，design §6.4）。
  async loadDay(date) {
    if (this.data.isGuest) {
      this.setData({ dayDetail: null });
      return;
    }
    try {
      const data = await Stats.day({ date });
      this.applyDayDetail(date, data);
    } catch (e) {
      this.setData({ dayDetail: null });
      wx.showToast({ title: (e && e.message) || '当日明细加载失败', icon: 'none' });
    }
  },

  applyDayDetail(date, data) {
    const rows = (data && data.items) || [];
    const items = [];
    for (let i = 0; i < rows.length; i++) {
      const it = rows[i];
      if (!it) continue;
      items.push({
        id: it.sessionId,
        name: it.exerciseName || '动作',
        summary: buildDaySummary(it),
        volumeText: formatVolume(it.volumeKg),
        equipmentSrc: equipmentSrcFromSlug(it.equipmentSlug, it.exerciseName),
      });
    }
    if (!items.length) {
      this.setData({ dayDetail: null });
      return;
    }
    const d = new Date(date + 'T00:00:00');
    this.setData({
      dayDetail: {
        dateText: formatMonthDay(d),
        weekText: WEEK_CN[d.getDay()],
        volumeText: formatVolume((data && data.totalVolumeKg) || 0),
        items,
      },
    });
  },

  /* ---------------- PR 墙 ---------------- */
  buildPr(prs) {
    const items = (prs || []).map((p) => {
      const part = inferPart(p.exerciseName);
      const d = new Date(p.achievedAt);
      return {
        id: p.id,
        name: p.exerciseName || '动作',
        value: Math.round(Number(p.value) || 0),
        unit: 'kg',
        date: formatMonthDay(d) + ' 创建',
        part,
        tone: PART_TONE[part] || 'pink',
        equipmentSrc: equipmentSrc(p.exerciseName),
        badgeSrc: prBadgeSrc(p.exerciseName),
        isTop: false,
      };
    });
    let maxIdx = -1;
    let maxVal = -1;
    items.forEach((it, i) => {
      if (it.value > maxVal) { maxVal = it.value; maxIdx = i; }
    });
    if (maxIdx >= 0) items[maxIdx].isTop = true;

    this.setData({ prAll: items, hasPr: items.length > 0 }, () => this.filterPr());
  },

  onPartSelect(e) {
    this.setData({ activePart: e.detail.value }, () => this.filterPr());
  },

  filterPr() {
    const part = this.data.activePart;
    const all = this.data.prAll;
    const list = part === '全部' ? all : all.filter((p) => p.part === part);
    this.setData({ prList: list });
  },

  /* ---------------- 趋势图 ---------------- */
  onRangeChange(e) {
    this.setData({ trendRange: e.detail.value }, () => this.loadTrend());
  },

  async loadTrend() {
    if (this.data.isGuest) {
      this.applyTrend(null);
      return;
    }
    try {
      const data = await Stats.trend({ granularity: this.data.trendRange });
      this.applyTrend(data);
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '趋势加载失败', icon: 'none' });
    }
  },

  // 应用 /stats/trend：points(时间升序) → 折线 + 概览（环比在小数组上本地算）。
  applyTrend(data) {
    const range = this.data.trendRange;
    const pts = (data && data.points) || [];
    const points = [];
    const xLabels = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i] || {};
      points.push(Math.round(Number(p.volumeKg) || 0));
      xLabels.push(p.label || '');
    }
    if (!points.length) {
      this.setData({
        trendPoints: [], trendXLabels: [], trendDeltaText: '',
        overview: { avg: '0', peak: '0', delta: '—' },
        distribution: [],
      });
      return;
    }

    const nonZero = points.filter((p) => p > 0);
    const avg = nonZero.length ? Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length) : 0;
    const peak = points.length ? Math.max.apply(null, points) : 0;
    const last = points[points.length - 1] || 0;
    const prev = points[points.length - 2] || 0;
    let deltaPct = 0;
    if (prev > 0) deltaPct = Math.round(((last - prev) / prev) * 100);
    const arrow = deltaPct >= 0 ? '↑' : '↓';
    const sign = deltaPct >= 0 ? '+' : '';
    const cmp = range === 'week' ? '较上周' : '较上月';
    const deltaText = prev > 0 ? (arrow + ' ' + cmp + ' ' + sign + deltaPct + '%') : '';

    this.setData({
      trendPoints: points,
      trendXLabels: xLabels,
      trendDeltaText: deltaText,
      overview: {
        avg: formatVolume(avg),
        peak: formatVolume(peak),
        delta: prev > 0 ? (sign + deltaPct + '%') : '—',
      },
      distribution: [],
    });
  },

  // 进入某次训练详情
  goSessionDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/session-detail/session-detail?id=' + id });
  },
}, {
  title: '我的训练数据',
  path: '/pages/stats/stats',
}));
