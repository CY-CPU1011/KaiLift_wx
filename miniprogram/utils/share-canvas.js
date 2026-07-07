// 分享图视图模型构造 —— 纯函数（不依赖 wx，便于 Node 单测）。
// 由 share-card 页面取数（Session.detail / PR.list / 本月训练天数）后调用，
// 产出固定形状的视图模型，供页面预览渲染与 canvas 合成统一消费。
//
// ⚠️ 微信 babel 坑：本文件虽是纯 Node 可 require 的工具，但仍统一遵循项目约定——
// 不使用数组解构 / 数组展开，一律用索引访问 / .slice() / .concat() 替代（与页面 js 一致）。
const format = require('./format');

// kg -> 展示数值字符串（按单位），仅取 value（不含单位文本）。
function weightValueText(weightKg, unit) {
  const dw = format.displayWeight(weightKg, unit);
  return dw.value;
}

// 单组容量（kg）：仅在有 weightKg 且 reps 时计入；否则 0。
function setVolumeKg(set) {
  if (!set) return 0;
  const w = set.weightKg;
  const reps = Number(set.reps) || 0;
  if (w === null || w === undefined) return 0;
  return (Number(w) || 0) * reps;
}

// 是否为负重组（有 weightKg）。
function isWeightedSet(set) {
  return set && set.weightKg !== null && set.weightKg !== undefined;
}

// 时长文案：finishedAt - startedAt。
//   <60min  -> 'N 分钟'
//   >=60min -> 'H 小时 M 分'
//   无效     -> '—'
function buildDurationText(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return '—';
  const totalMin = Math.floor((end - start) / 60000);
  if (totalMin < 1) return '不到 1 分钟';
  if (totalMin < 60) return totalMin + ' 分钟';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? (h + ' 小时 ' + m + ' 分') : (h + ' 小时');
}

// 日期文案：'2026年6月19日'（YYYY年M月D日）。
function buildDateText(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

// 单个动作的「最佳组」：取 weightKg*reps 最大者；全自重则取 reps 最大者。
// 返回 { bestVolume, bestSetText } —— bestVolume 用于动作间排序。
function buildBestSet(workoutExercise, unit) {
  const sets = (workoutExercise && workoutExercise.sets) || [];
  let best = null;       // 最佳组对象
  let bestVol = -1;      // 最佳组容量（kg），全自重时为 0
  let bestReps = -1;     // 全自重时的最大次数
  let anyWeighted = false;

  for (let i = 0; i < sets.length; i++) {
    const s = sets[i];
    if (!s) continue;
    const reps = Number(s.reps) || 0;
    if (isWeightedSet(s)) {
      anyWeighted = true;
      const vol = setVolumeKg(s);
      if (vol > bestVol) {
        bestVol = vol;
        best = s;
      }
    } else if (!anyWeighted) {
      // 还没遇到负重组时，按 reps 选最佳自重组
      if (reps > bestReps) {
        bestReps = reps;
        best = s;
      }
    }
  }

  if (!best) return null;

  let bestSetText;
  if (isWeightedSet(best)) {
    const reps = Number(best.reps) || 0;
    bestSetText = weightValueText(best.weightKg, unit) + unit + ' × ' + reps;
  } else {
    const reps = Number(best.reps) || 0;
    bestSetText = '自重 × ' + reps;
  }

  return {
    bestVolume: anyWeighted ? bestVol : 0,
    bestSetText,
  };
}

// 主要动作列表：最多 5 条，按各自「最佳组容量」降序。
function buildMainExercises(session, unit) {
  const wes = (session && session.workoutExercises) || [];
  const rows = [];
  for (let i = 0; i < wes.length; i++) {
    const we = wes[i];
    if (!we) continue;
    const best = buildBestSet(we, unit);
    if (!best) continue;
    rows.push({
      name: we.displayName || '动作',
      bestSetText: best.bestSetText,
      _vol: best.bestVolume,
    });
  }
  rows.sort((a, b) => b._vol - a._vol);
  const top = rows.slice(0, 5);
  // 去掉内部排序字段，返回稳定形状
  const out = [];
  for (let j = 0; j < top.length; j++) {
    out.push({ name: top[j].name, bestSetText: top[j].bestSetText });
  }
  return out;
}

// 激励文案：本月已训练天数（取代原 21 天计划进度）。
function buildIncentive(monthDays) {
  const days = Number(monthDays) || 0;
  return '本月已训练 ' + days + ' 天';
}

// 构造分享图视图模型（字段名/顺序固定，会被单测断言）。
function buildShareViewModel(input) {
  const data = input || {};
  const session = data.session || {};
  const monthDays = Number(data.monthDays) || 0;
  const unit = data.unit || 'kg';
  const now = data.now instanceof Date ? data.now : new Date();

  const dateBase = session.startedAt ? new Date(session.startedAt) : now;
  const dateText = buildDateText(dateBase);
  const durationText = buildDurationText(session.startedAt, session.finishedAt);

  const totalExercises = Number(session.totalExercises) || 0;
  const totalSets = Number(session.totalSets) || 0;
  const volumeText = format.formatVolume(session.totalVolumeKg || 0);

  const stats = [
    { label: '时长', value: durationText, unit: '' },
    { label: '动作', value: totalExercises, unit: '个' },
    { label: '组数', value: totalSets, unit: '组' },
    { label: '容量', value: volumeText, unit: unit },
  ];

  return {
    brand: '开练 KaiLift',
    headline: '今日训练完成',
    dateText,
    durationText,
    stats,
    mainExercises: buildMainExercises(session, unit),
    incentive: buildIncentive(monthDays),
    slogan: 'Say the set. Keep the log.',
  };
}

exports.buildShareViewModel = buildShareViewModel;
exports.buildDurationText = buildDurationText;
exports.buildDateText = buildDateText;
