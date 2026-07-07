// 纯函数格式化工具（design §8）
const { KG_TO_LB } = require('./constants');

// 容量/大数字：52100 -> "52.1k"，140 -> "140"
function formatVolume(n) {
  const v = Number(n) || 0;
  if (v >= 100000) return (v / 1000).toFixed(0) + 'k';
  if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
  return String(Math.round(v));
}

// 千分位
function withCommas(n) {
  const v = Math.round(Number(n) || 0);
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// kg -> 展示数值（按单位），返回 { value, unit }
function displayWeight(weightKg, unit = 'kg') {
  if (weightKg === null || weightKg === undefined) return { value: '', unit };
  const v = unit === 'lb' ? Number(weightKg) * KG_TO_LB : Number(weightKg);
  const rounded = Math.round(v * 10) / 10;
  return { value: Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1), unit };
}

// 秒 -> mm:ss
function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  const pad = (x) => (x < 10 ? '0' + x : '' + x);
  return pad(m) + ':' + pad(ss);
}

// 时段问候
function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 6) return '凌晨好';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// Date / ISO -> "6月11日"
function formatMonthDay(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

// -> "周四 · 6月11日"
function formatDateHeader(d = new Date()) {
  const date = d instanceof Date ? d : new Date(d);
  return `${WEEK_CN[date.getDay()]} · ${formatMonthDay(date)}`;
}

// 相对天：今天/昨天/前天/具体日期
function relativeDay(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  const today = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(date)) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff === 2) return '前天';
  return formatMonthDay(date);
}

exports.formatVolume = formatVolume;
exports.withCommas = withCommas;
exports.displayWeight = displayWeight;
exports.formatDuration = formatDuration;
exports.greeting = greeting;
exports.formatMonthDay = formatMonthDay;
exports.formatDateHeader = formatDateHeader;
exports.relativeDay = relativeDay;
exports.WEEK_CN = WEEK_CN;
