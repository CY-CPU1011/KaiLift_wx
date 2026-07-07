// 跨页面数据工具：保持纯函数，便于 Node 回归测试。

function unwrapSessionDetail(payload) {
  if (payload && payload.session) return payload.session;
  return payload || null;
}

async function listAllPages(fetchPage, params = {}, pageSize = 100) {
  const items = [];
  let page = 1;
  let total = null;

  while (true) {
    const data = await fetchPage(Object.assign({}, params, { page, pageSize }));
    const batch = (data && data.items) || [];
    for (let i = 0; i < batch.length; i++) items.push(batch[i]);
    if (total === null && data && Number.isFinite(Number(data.total))) {
      total = Number(data.total);
    }
    if (batch.length < pageSize || (total !== null && items.length >= total)) break;
    page += 1;
  }

  return total === null ? items : items.slice(0, total);
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const source = items || [];
  const output = new Array(source.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, source.length || 1));

  async function worker() {
    while (cursor < source.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await mapper(source[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));
  return output;
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

// POST /sessions 响应是否表示「恢复了已有进行中训练」
// 兼容后端单 active 约束的两种回包形态：顶层 resumed 或 session.resumed。
function isResumedStart(data) {
  if (!data) return false;
  if (data.resumed) return true;
  return !!(data.session && data.session.resumed);
}

function countDistinctExercises(details) {
  const keys = new Set();
  (details || []).forEach((detail) => {
    ((detail && detail.workoutExercises) || []).forEach((exercise) => {
      const id = exercise.exerciseId;
      const name = String(exercise.displayName || '').trim().toLowerCase();
      if (id) keys.add('id:' + id);
      else if (name) keys.add('name:' + name);
    });
  });
  return keys.size;
}

exports.unwrapSessionDetail = unwrapSessionDetail;
exports.listAllPages = listAllPages;
exports.mapWithConcurrency = mapWithConcurrency;
exports.findLatestSet = findLatestSet;
exports.setInputFromRaw = setInputFromRaw;
exports.isResumedStart = isResumedStart;
exports.countDistinctExercises = countDistinctExercises;
