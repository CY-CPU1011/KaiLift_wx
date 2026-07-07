// 本地语音文本解析器（端上轻量回退版四 intent，PRD §4.4）。
// 正式语音链路接入 CloudBase 前，用于文本联调和确认卡兜底。
// 解析不确定时返回 needsConfirmation=true，交由确认卡兜底（绝不补造数字）。

// 中文数字 -> 阿拉伯数字
const CN_NUM = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

function cnToNum(str) {
  if (str == null) return null;
  if (/^\d+(\.\d+)?$/.test(str)) return Number(str);
  let s = String(str).trim();
  // 处理「十/二十/二十五/一百/一百零五/八十」
  if (/^[零一二两三四五六七八九十百]+$/.test(s)) {
    let total = 0;
    let section = 0;
    let i = 0;
    let lastUnit = 1;
    // 简化算法，覆盖 0-999
    const chars = s.split('');
    let num = 0;
    for (let c of chars) {
      if (c === '百') { section += (num === 0 ? 1 : num) * 100; num = 0; }
      else if (c === '十') { section += (num === 0 ? 1 : num) * 10; num = 0; }
      else if (c === '零') { num = 0; }
      else if (CN_NUM[c] !== undefined) { num = CN_NUM[c]; }
    }
    total = section + num;
    return total;
  }
  return null;
}

// 把一段文本里出现的所有「数字」抽出（中文或阿拉伯），按出现顺序
function extractNumbers(text) {
  const re = /(\d+(?:\.\d+)?|[零一二两三四五六七八九十百]+)/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const n = cnToNum(m[1]);
    if (n !== null && !isNaN(n)) out.push({ value: n, index: m.index, raw: m[1] });
  }
  return out;
}

// 单位换算到 kg
function toKg(value, unitToken) {
  if (unitToken === '磅' || /lb/i.test(unitToken || '')) return Math.round(value * 0.4536 * 10) / 10;
  if (unitToken === '斤') return Math.round(value * 0.5 * 10) / 10;
  return value; // 公斤/kg/默认
}

// 自重动作关键词
const BODYWEIGHT_KEYWORDS = ['引体', '俯卧撑', '卷腹', '平板支撑', '深蹲跳', '波比', '仰卧起坐', '双杠臂屈伸'];

// 组类型关键词
const SET_TYPE_KEYWORDS = [
  { kw: ['热身'], type: 'warmup' },
  { kw: ['力竭', '到力竭', '做到力竭'], type: 'failure' },
  { kw: ['递减', '递减组'], type: 'drop' },
  { kw: ['退让'], type: 'backoff' },
];

// 修改意图
const MODIFY_KEYWORDS = ['记错', '改成', '应该是', '其实是', '不对', '弄错', '搞错'];

// 切换动作意图
const SWITCH_KEYWORDS = ['下一个', '换', '接下来做', '现在做', '开始做', '先做', '今天做', '今天先做'];

const WEIGHT_UNIT_RE = /(公斤|千克|kg|磅|lb|斤)/i;
const REPS_UNIT_RE = /(个|次|下|reps?)/i;

function detectSetType(text) {
  for (const item of SET_TYPE_KEYWORDS) {
    if (item.kw.some((k) => text.includes(k))) return item.type;
  }
  return 'working';
}

function isBodyweight(name, text) {
  const target = (name || '') + text;
  return BODYWEIGHT_KEYWORDS.some((k) => target.includes(k));
}

// 从文本里猜动作名：取数字/单位/动词之前的中文动作短语
function guessExerciseName(text) {
  // 去掉切换/修改前缀词
  let t = text;
  // 先去掉序数/指示短语，避免「下一个」里的「个」「一」被误当 reps
  t = t.replace(/(下一个|下一组|这一个|那一个|上一个|第[一二三四五六七八九十\d]+个?)/g, ' ');
  SWITCH_KEYWORDS.forEach((k) => { t = t.replace(k, ''); });
  // 动作名通常在第一个数字之前
  const numMatch = t.search(/(\d|[一二两三四五六七八九十百])/);
  let head = numMatch >= 0 ? t.slice(0, numMatch) : t;
  // 去掉常见连接词、时间词与动词（不动作名本身）
  head = head.replace(/(我|刚刚|刚才|这个|那个|做了一组|做了|了一组|一组|然后|今天|先做|先|这是|分别|大概|差不多|然后|了|做|的|是)/g, '').trim();
  // 去标点
  head = head.replace(/[，,。.、！!？?\s]/g, '');
  return head || null;
}

// 去掉序数/指示短语后的「干净文本」，用于数字抽取
function cleanForNumbers(text) {
  return (text || '').replace(/(下一个|下一组|这一个|那一个|上一个|第[一二三四五六七八九十\d]+个?)/g, ' ');
}

/**
 * 解析识别文本
 * @param {string} text ASR 文本
 * @param {string|null} currentExerciseName 当前动作上下文（可空）
 * @returns {{
 *   intent: 'record_sets'|'set_current_exercise'|'modify_last_set'|'unknown',
 *   exerciseName: string|null,
 *   sets: Array<{loadType,weightKg,reps,setType,rpe,note}>,
 *   changes: object|null,
 *   needsConfirmation: boolean,
 *   confirmationReason: string|null,
 *   rawText: string,
 *   confidence: number
 * }}
 */
function parse(text, currentExerciseName = null) {
  const raw = (text || '').trim();
  const base = {
    intent: 'unknown', exerciseName: null, sets: [], changes: null,
    needsConfirmation: true, confirmationReason: 'not_recognized',
    rawText: raw, confidence: 0,
  };
  if (!raw) return base;

  // 1) 修改最近一组 —— 一律确认
  if (MODIFY_KEYWORDS.some((k) => raw.includes(k))) {
    const nums = extractNumbers(raw);
    const changes = {};
    // 若提到重量单位，取最近的数字为新重量
    if (WEIGHT_UNIT_RE.test(raw) && nums.length) {
      const unit = (raw.match(WEIGHT_UNIT_RE) || [])[1];
      changes.weightKg = toKg(nums[nums.length - 1].value, unit);
    } else if (REPS_UNIT_RE.test(raw) && nums.length) {
      changes.reps = nums[nums.length - 1].value;
    } else if (nums.length) {
      changes.weightKg = nums[nums.length - 1].value;
    }
    return Object.assign({}, base, {
      intent: 'modify_last_set', changes,
      needsConfirmation: true, confirmationReason: 'modify_history', confidence: 0.6,
    });
  }

  // 干净文本（去掉「下一个/第N个」等，避免误抽 reps）
  const clean = cleanForNumbers(raw);
  const hasWeightUnit = WEIGHT_UNIT_RE.test(clean);
  const hasSwitch = SWITCH_KEYWORDS.some((k) => raw.includes(k));

  // 提取重量：紧邻重量单位的数字
  let weightKg = null;
  const wm = clean.match(/(\d+(?:\.\d+)?|[零一二两三四五六七八九十百]+)\s*(公斤|千克|kg|磅|lb|斤)/i);
  if (wm) weightKg = toKg(cnToNum(wm[1]), wm[2]);

  // 提取 reps：
  // a) 批量同单位「分别5、5、4个」「5和5和4次」——数字串以分隔符相连、末尾带 reps 单位
  // b) 重复单位「8个7个6个」——逐个数字+单位
  const repsList = [];
  const runRe = /((?:\d+|[零一二两三四五六七八九十]+)(?:\s*[、，,和]\s*(?:\d+|[零一二两三四五六七八九十]+))+)\s*(?:个|次|下)/;
  const runM = clean.match(runRe);
  if (runM) {
    runM[1].split(/[、，,和]/).forEach((s) => {
      const v = cnToNum(s.trim());
      if (v !== null && v >= 1) repsList.push(Math.round(v));
    });
  } else {
    const rre = /(\d+(?:\.\d+)?|[零一二两三四五六七八九十百]+)\s*(个|次|下)/g;
    let rm;
    while ((rm = rre.exec(clean)) !== null) {
      const v = cnToNum(rm[1]);
      if (v !== null && v >= 1) repsList.push(Math.round(v));
    }
  }

  // "三组" / "3组"：组数提示
  let setCount = null;
  const groupMatch = clean.match(/(\d+|[一二两三四五六七八九十]+)\s*组/);
  if (groupMatch) setCount = cnToNum(groupMatch[1]);

  // 动作名：优先猜测；猜测过弱时回落到当前动作上下文
  let exerciseName = guessExerciseName(raw);
  if (currentExerciseName && (!exerciseName || exerciseName.length < 2 || currentExerciseName.includes(exerciseName))) {
    exerciseName = currentExerciseName;
  }
  if (!exerciseName) exerciseName = currentExerciseName;
  const bodyweight = isBodyweight(exerciseName, raw);
  const setType = detectSetType(raw);

  // 没有任何 reps 也没有重量 -> 切换动作 或 未知
  if (repsList.length === 0 && weightKg === null) {
    const switchName = guessExerciseName(raw);
    if (hasSwitch && switchName) {
      return Object.assign({}, base, {
        intent: 'set_current_exercise', exerciseName: switchName,
        needsConfirmation: false, confirmationReason: null, confidence: 0.85,
      });
    }
    return base; // unknown（如「今天天气真好」）
  }

  // 组装 sets
  const loadType = bodyweight ? 'bodyweight' : (weightKg !== null ? 'weighted' : 'unknown');
  let sets = [];
  if (repsList.length > 1) {
    // 批量：多组同重量，reps 各异
    sets = repsList.map((r) => ({
      loadType, weightKg: bodyweight ? null : weightKg, reps: r, setType, rpe: null, note: null,
    }));
  } else if (repsList.length === 1) {
    const count = setCount && setCount > 1 ? setCount : 1;
    for (let i = 0; i < count; i++) {
      sets.push({ loadType, weightKg: bodyweight ? null : weightKg, reps: repsList[0], setType, rpe: null, note: null });
    }
  } else {
    // 有重量没 reps -> 结构不全，进确认
    sets = [{ loadType, weightKg: bodyweight ? null : weightKg, reps: null, setType, rpe: null, note: null }];
  }

  // 智能确认判定（PRD §3.5）：结构完整 + 有动作上下文 才自动保存
  const structureComplete = sets.every((s) => s.reps && (s.weightKg != null || s.loadType === 'bodyweight'));
  const hasExercise = !!exerciseName;
  let confidence = 0.9;
  let needsConfirmation = false;
  let reason = null;
  if (!hasExercise) { needsConfirmation = true; reason = 'no_exercise_context'; confidence = 0.4; }
  else if (!structureComplete) { needsConfirmation = true; reason = 'incomplete_set'; confidence = 0.5; }

  return {
    intent: 'record_sets',
    exerciseName,
    sets,
    changes: null,
    needsConfirmation,
    confirmationReason: reason,
    rawText: raw,
    confidence,
  };
}

exports.parse = parse;
exports.cnToNum = cnToNum;
exports.extractNumbers = extractNumbers;
exports.toKg = toKg;
