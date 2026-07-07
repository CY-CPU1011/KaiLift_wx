// 动作库视图模型 —— 纯函数（design §8，便于 Node 回归测试）。
// 列表卡片字段 / 详情 meta / 「我的数据」(PR + 历史) 的取数后整形都收敛在这里，
// 页面只负责调接口 + setData。容空：自定义动作字段可能为空、数组为 []；新用户无 PR/历史。
// ⚠ 全程禁数组解构/展开（WeChat babel arrayWithHoles 坑），用索引 / for / Object.assign / concat。
const format = require('./format');
const {
  PR_TYPE_LABELS,
  SET_TYPES,
  EXERCISE_PART_DISPLAY,
  EXERCISE_PART_QUERY,
} = require('./constants');

// 部位「展示名 → 后端取值」：仅手臂不同（手臂→臂），用于发请求 / 过滤 mock。
function toQueryPart(part) {
  return part === EXERCISE_PART_DISPLAY ? EXERCISE_PART_QUERY : part;
}

// 部位「后端取值 → 展示名」：仅手臂不同（臂→手臂），用于卡片/详情展示。
function toDisplayPart(part) {
  return part === EXERCISE_PART_QUERY ? EXERCISE_PART_DISPLAY : part;
}

// 列表二级筛选：从当前部位返回的动作里动态去重出 muscle 选项（'全部' 置顶）。
// 取值表只是一期快照，不写死——二期扩库自动跟随数据。
function deriveMuscleOptions(items) {
  const seen = {};
  const out = ['全部'];
  const list = items || [];
  for (let i = 0; i < list.length; i++) {
    const muscles = (list[i] && list[i].primaryMuscles) || [];
    for (let j = 0; j < muscles.length; j++) {
      const m = muscles[j];
      if (m && !seen[m]) {
        seen[m] = true;
        out.push(m);
      }
    }
  }
  return out;
}

// 名称模糊 + 部位筛选（mock 兜底用；真实接口由后端按 search/bodyPart 完成）。
function filterBySearchAndPart(items, keyword, part) {
  let list = (items || []).slice();
  const kw = (keyword || '').trim();
  if (kw) {
    list = list.filter((x) => String(x.name || '').indexOf(kw) >= 0);
  }
  if (part && part !== '全部') {
    const q = toQueryPart(part); // mock 数据 bodyPart 用后端取值（臂），先把展示名换回去再比对
    list = list.filter((x) => x.bodyPart === q);
  }
  return list;
}

// 二级 muscle 客户端过滤（命中 primaryMuscles）。
function filterByMuscle(items, muscle) {
  const list = items || [];
  if (!muscle || muscle === '全部') return list.slice();
  return list.filter((x) => {
    const muscles = (x && x.primaryMuscles) || [];
    return muscles.indexOf(muscle) >= 0;
  });
}

// 列表项 → 卡片视图模型（主肌群拼成一行，自定义动作打标）。
function buildCardList(items) {
  const list = items || [];
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const x = list[i] || {};
    const name = x.name || '';
    const partDisplay = toDisplayPart(x.bodyPart || '');
    out.push({
      id: x.id,
      name,
      bodyPart: partDisplay,
      level: x.level || '',
      musclesText: ((x.primaryMuscles || []).join(' · ')),
      isCustom: x.isSystem === false,
      // 缩略占位标签：v1 不上图，用部位字（自定义无部位时退化为名称首字）撑满小方块。
      thumb: partDisplay || (name ? name.charAt(0) : '动'),
    });
  }
  return out;
}

// 详情 meta 行（仅保留有值的字段，自定义动作空字段直接不展示）。
function buildDetailVM(exercise) {
  const ex = exercise || {};
  const metas = [];
  const pushArr = (label, arr) => {
    const a = arr || [];
    if (a.length) metas.push({ label, value: a.join(' · ') });
  };
  const pushStr = (label, v) => {
    if (v) metas.push({ label, value: v });
  };
  pushArr('主要肌群', ex.primaryMuscles);
  pushArr('次要肌群', ex.secondaryMuscles);
  pushStr('难度', ex.level);
  pushStr('器械', ex.equipment);
  pushStr('分类', ex.category);
  pushStr('机制', ex.mechanic);
  pushStr('发力', ex.force);
  const instructions = ex.instructions || [];
  return {
    id: ex.id,
    name: ex.name || '',
    bodyPart: toDisplayPart(ex.bodyPart || ''),
    isCustom: ex.isSystem === false,
    metas,
    instructions,
    hasInstructions: instructions.length > 0,
    // 纯自定义动作（无任何 meta 且无要领）给一句提示，避免页面留白。
    isBare: metas.length === 0 && instructions.length === 0,
  };
}

// 单组「重量 × 次数」文案：自重 / weightKg=null → 「自重 × N」，不显示 0kg/null。
function loadText(set, unit) {
  const s = set || {};
  const reps = s.reps === null || s.reps === undefined ? '' : s.reps;
  const isBodyweight = s.loadType === 'bodyweight' || s.weightKg === null || s.weightKg === undefined;
  if (isBodyweight) {
    return reps === '' ? '自重' : '自重 × ' + reps;
  }
  const w = format.displayWeight(s.weightKg, unit);
  return w.value + w.unit + ' × ' + reps;
}

// 「我的数据」：PR（中文标签三类）+ 历史（后端已按 session 倒序，逐次渲染，不重做分组）。
function buildMyDataVM(history, unit) {
  const h = history || {};
  const u = unit || 'kg';

  // PR 卡：value 按类型呈现（重量/1RM 带单位；容量为数值），sub 复用单组文案。
  const records = [];
  const recs = h.records || [];
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i] || {};
    const isBodyweight = r.weightKg === null || r.weightKg === undefined;
    let valueText;
    if (r.recordType === 'max_volume_set') {
      valueText = format.withCommas(r.value);
    } else if (isBodyweight) {
      // 自重动作的「最大重量」无意义，退化为展示达成的次数。
      valueText = r.reps ? r.reps + ' 次' : '自重';
    } else {
      const w = format.displayWeight(r.value, u);
      valueText = w.value + w.unit;
    }
    records.push({
      key: r.recordType + '_' + i,
      label: PR_TYPE_LABELS[r.recordType] || r.recordType,
      valueText,
      subText: loadText(r, u),
      dateText: format.formatMonthDay(r.achievedAt),
    });
  }

  // 历史：每次训练一项，自带 date；各组列 重量×次数 + 组类型 + PR 星。
  const sessions = [];
  const hist = h.history || [];
  for (let i = 0; i < hist.length; i++) {
    const sess = hist[i] || {};
    const setVMs = [];
    const sets = sess.sets || [];
    for (let j = 0; j < sets.length; j++) {
      const st = sets[j] || {};
      setVMs.push({
        key: st.id || (i + '_' + j),
        text: loadText(st, u),
        typeLabel: (st.setType && st.setType !== 'working') ? (SET_TYPES[st.setType] || '') : '',
        isPR: !!st.isPersonalRecord,
      });
    }
    sessions.push({
      key: sess.sessionId || ('sess_' + i),
      dateText: format.relativeDay(sess.date),
      sets: setVMs,
    });
  }

  return {
    records,
    hasRecords: records.length > 0,
    sessions,
    hasHistory: sessions.length > 0,
  };
}

exports.toQueryPart = toQueryPart;
exports.toDisplayPart = toDisplayPart;
exports.deriveMuscleOptions = deriveMuscleOptions;
exports.filterBySearchAndPart = filterBySearchAndPart;
exports.filterByMuscle = filterByMuscle;
exports.buildCardList = buildCardList;
exports.buildDetailVM = buildDetailVM;
exports.buildMyDataVM = buildMyDataVM;
exports.loadText = loadText;
