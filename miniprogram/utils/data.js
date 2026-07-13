// 跨页面数据工具：保持纯函数，便于 Node 回归测试。

function unwrapSessionDetail(payload) {
  if (payload && payload.session) return payload.session;
  return payload || null;
}

function findLatestSet(cards, currentExerciseName, lastRecordedSetId) {
  const list = cards || [];
  if (lastRecordedSetId) {
    for (const card of list) {
      const found = (card.setList || []).find((item) => item.id === lastRecordedSetId);
      if (found) return found;
    }
  }

  if (currentExerciseName) {
    const current = list.find((card) => card.name === currentExerciseName);
    if (current && current.setList && current.setList.length) {
      return current.setList[current.setList.length - 1];
    }
  }

  for (let i = list.length - 1; i >= 0; i--) {
    const setList = list[i].setList || [];
    if (setList.length) return setList[setList.length - 1];
  }
  return null;
}

// 单组 raw（来自 SessionDetail 的 WorkoutSet）→ SetInput（写库入参）。
// 供「重新加组/换动作/撤销」统一构造，避免各处重复。
function setInputFromRaw(raw) {
  const r = raw || {};
  return {
    loadType: r.loadType || 'weighted',
    weightKg: r.weightKg === undefined ? null : r.weightKg,
    reps: r.reps,
    setType: r.setType || 'working',
    rpe: r.rpe || null,
    note: r.note || null,
  };
}

// 次数输入只接受 API 契约允许的 1–1000 整数；无效值保留为 null，交页面阻止提交。
function normalizeReps(value) {
  const reps = Number(value);
  if (!Number.isInteger(reps) || reps < 1 || reps > 1000) return null;
  return reps;
}

// 语音解析的 ParsedSet(snake_case) 按原动作连续分组，供撤销无法 restore 时逐动作重新加组。
function groupParsedSetsForUndo(parsedSets, fallbackExerciseName) {
  const groups = [];
  const source = parsedSets || [];
  for (let i = 0; i < source.length; i++) {
    const raw = source[i] || {};
    const exerciseName = String(
      raw.exercise_name || raw.exerciseName || fallbackExerciseName || ''
    ).trim();
    const input = {
      loadType: raw.load_type || raw.loadType || 'weighted',
      weightKg: raw.weight_kg !== undefined ? raw.weight_kg
        : (raw.weightKg !== undefined ? raw.weightKg : null),
      reps: raw.reps,
      setType: raw.set_type || raw.setType || 'working',
      rpe: raw.rpe == null ? null : raw.rpe,
      note: raw.note == null ? null : raw.note,
    };
    const last = groups[groups.length - 1];
    if (last && last.exerciseName === exerciseName) last.sets.push(input);
    else groups.push({ exerciseName, sets: [input] });
  }
  return groups;
}

// POST /sessions 响应是否表示「恢复了已有进行中训练」
// 兼容后端单 active 约束的两种回包形态：顶层 resumed 或 session.resumed。
function isResumedStart(data) {
  if (!data) return false;
  if (data.resumed) return true;
  return !!(data.session && data.session.resumed);
}

exports.unwrapSessionDetail = unwrapSessionDetail;
exports.findLatestSet = findLatestSet;
exports.setInputFromRaw = setInputFromRaw;
exports.normalizeReps = normalizeReps;
exports.groupParsedSetsForUndo = groupParsedSetsForUndo;
exports.isResumedStart = isResumedStart;
