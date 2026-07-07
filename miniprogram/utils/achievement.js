// 成就 / 段位 / 等级（EXP）视图模型（对接《成就墙-段位等级-前端对接.md》）。
// 后端单轨：训练 → EXP → Lv(1–100) → 段位(8 档奖牌)；成就墙(5 类 23 枚)独立、纯收集。
// 本模块只做「后端 data → 页面可直接 setData 的视图模型」纯映射：进度不让页面算公式，
// icon 统一在此解析。⚠ 全程禁数组解构/展开（WeChat babel arrayWithHoles 坑），用索引/for 循环。

// 后端 icon 为占位相对路径（如 badges/ranks/bronze.png）；本地资源根 /images/。
const IMG_ROOT = '/images/';

// 段位展示：后端仍负责 8 档等级区间，前端按固定顺序覆盖为新版名称与本地图标。
const RANK_DISPLAY_BY_KEY = {
  iron: { name: '初启', icon: 'chuqi.png' },
  bronze: { name: '自律', icon: 'zilv.png' },
  silver: { name: '强健', icon: 'qiangjian.png' },
  gold: { name: '精进', icon: 'jingjin.png' },
  platinum: { name: '突破', icon: 'tupo.png' },
  diamond: { name: '淬炼', icon: 'cuilian.png' },
  grandmaster: { name: '登峰', icon: 'dengfeng.png' },
  legend: { name: '传奇', icon: 'chuanqi.png' },
};
const RANK_FALLBACK = '/images/badges/badge_medal_bronze_flame.png';

// 成就徽章真图已就位：/images/badges/<slug>.png，slug = 成就 key 把下划线换成连字符
// （与后端 catalog 的 icon(slug) 命名一致，如 pr_5→pr-5、body_parts_6→body-parts-6）。
// 未知 key（后端新增但本地未放图）兜底到类占位切图。
const ART_BY_CATEGORY = {
  milestone: '/images/badges/badge_medal_bronze_flame.png',
  streak: '/images/badges/badge_medal_gold_flame.png',
  pr: '/images/badges/badge_pr_squat.png',
  explore: '/images/badges/badge_shield_gold_green.png',
  fun: '/images/badges/badge_trophy_gold.png',
};
const ART_FALLBACK = '/images/badges/badge_trophy_gold.png';

// 段位奖牌图：优先按 key 取真图，未知 key 兜底。
function resolveRankIcon(tier) {
  const key = tier && tier.key;
  if (key && RANK_DISPLAY_BY_KEY[key]) return IMG_ROOT + 'badges/ranks/' + RANK_DISPLAY_BY_KEY[key].icon;
  return RANK_FALLBACK;
}

function resolveRankName(tier) {
  const key = tier && tier.key;
  if (key && RANK_DISPLAY_BY_KEY[key]) return RANK_DISPLAY_BY_KEY[key].name;
  return (tier && tier.name) || '';
}

// 成就徽章图（解锁态用；未解锁由组件统一显示灰盾，不取这里）。
function resolveAchievementArt(itemKey, categoryKey) {
  if (itemKey) return '/images/badges/' + itemKey.replace(/_/g, '-') + '.png';
  if (categoryKey && ART_BY_CATEGORY[categoryKey]) return ART_BY_CATEGORY[categoryKey];
  return ART_FALLBACK;
}

// 本级进度百分比（0–100）。满级 100；跨度异常时返回 0，绝不让页面算公式。
function levelPercent(level) {
  const l = level || {};
  if (l.isMax) return 100;
  const span = Number(l.levelSpanExp) || 0;
  if (span <= 0) return 0;
  const into = Number(l.expIntoLevel) || 0;
  return Math.max(0, Math.min(100, Math.round((into / span) * 100)));
}

// 资料卡等级块。沿用「我的」页既有形状 { lv, exp, expMax, percent }，加 isMax。
function buildLevelCard(level) {
  const l = level || {};
  return {
    lv: Number(l.level) || 0,
    exp: Number(l.expIntoLevel) || 0,
    expMax: Number(l.levelSpanExp) || 0,
    percent: levelPercent(l),
    isMax: !!l.isMax,
  };
}

// 资料卡段位块（奖牌 + 文案）。满段时 next 为 null。
function buildRankCard(rank) {
  const r = rank || {};
  const tier = r.tier || {};
  const next = r.next;
  const isMaxRank = !next;
  return {
    key: tier.key || '',
    name: resolveRankName(tier),
    color: tier.color || '',
    icon: resolveRankIcon(tier),
    isMaxRank,
    // 距下一段位文案；满段隐藏（空串）。
    nextText: isMaxRank
      ? ''
      : '距' + resolveRankName(next) + '还差' + (Number(r.levelsToNext) || 0) + '级',
  };
}

// 段位阶梯（后端新增 data.ladder，完整 8 档静态表）→ 弹窗可消费的视图模型：
// 解析每档奖牌图、按 minLevel 拼解锁文案、并标注「当前所在档」（与 rank.tier.key 比对）。
// ⚠ 8 档断点/颜色/图标是后端单一真相源，前端不写死，按 ladder 动态渲染。
function buildLadder(ladder, currentTierKey) {
  const src = ladder || [];
  const curKey = currentTierKey || '';
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const t = src[i] || {};
    const key = t.key || '';
    const minLevel = Number(t.minLevel) || 0;
    out.push({
      key,
      name: resolveRankName(t),
      minLevel,
      color: t.color || '',
      icon: resolveRankIcon(t),
      isCurrent: !!key && key === curKey,
      condText: 'Lv.' + minLevel + ' 解锁',
    });
  }
  return out;
}

// 未解锁且阈值>1 时的进度提示（如 3/5、3470/8000）；其余返回空串。
function progressText(item) {
  const it = item || {};
  if (it.unlocked) return '';
  const threshold = Number(it.threshold) || 0;
  if (threshold <= 1) return '';
  const current = Math.max(0, Math.round(Number(it.current) || 0));
  return current + '/' + Math.round(threshold);
}

// 单枚成就 → 徽章组件可消费的形状。
function buildBadge(item, categoryKey) {
  const it = item || {};
  return {
    key: it.key || '',
    title: it.title || '',
    desc: it.desc || '',
    unlocked: !!it.unlocked,
    art: resolveAchievementArt(it.key, categoryKey),
    badgeNum: '',
    progressText: progressText(it),
    unlockedAt: it.unlockedAt || null,
  };
}

// 5 类分组 → 视图模型（保持后端给定顺序：milestone→streak→pr→explore→fun）。
function buildCategories(categories) {
  const src = categories || [];
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const cat = src[i] || {};
    const rawItems = cat.items || [];
    const items = [];
    for (let j = 0; j < rawItems.length; j++) {
      items.push(buildBadge(rawItems[j], cat.key));
    }
    out.push({ key: cat.key || '', label: cat.label || '', items });
  }
  return out;
}

// 成就墙页视图模型：资料卡 + 5 类 23 枚 + 计数。
function buildAchievementsViewModel(data) {
  const d = data || {};
  const r = d.rank || {};
  const tier = r.tier || {};
  return {
    exp: Number(d.exp) || 0,
    level: buildLevelCard(d.level),
    rank: buildRankCard(d.rank),
    ladder: buildLadder(d.ladder, tier.key),
    unlockedCount: Number(d.unlockedCount) || 0,
    totalCount: Number(d.totalCount) || 0,
    categories: buildCategories(d.categories),
  };
}

// 「我的」页精简预览：资料卡 + 计数 + 前若干枚（已解锁优先，再补未解锁）。
function buildProfilePreview(data, previewCount) {
  const d = data || {};
  const cap = Number(previewCount) || 6;
  const cats = buildCategories(d.categories);
  const unlocked = [];
  const locked = [];
  for (let i = 0; i < cats.length; i++) {
    const items = cats[i].items;
    for (let j = 0; j < items.length; j++) {
      const b = items[j];
      if (b.unlocked) unlocked.push(b);
      else locked.push(b);
    }
  }
  const preview = [];
  for (let i = 0; i < unlocked.length && preview.length < cap; i++) preview.push(unlocked[i]);
  for (let i = 0; i < locked.length && preview.length < cap; i++) preview.push(locked[i]);
  const r = d.rank || {};
  const tier = r.tier || {};
  return {
    level: buildLevelCard(d.level),
    rank: buildRankCard(d.rank),
    ladder: buildLadder(d.ladder, tier.key),
    unlockedCount: Number(d.unlockedCount) || 0,
    totalCount: Number(d.totalCount) || 0,
    previewBadges: preview,
  };
}

// 训练完成结算（Session.finish 返回的 achievement 字段）→ 庆祝动画视图模型。
// 仅首次完赛返回；无该字段（再次完成/取消/改名）时返回 null，调用方据此不放动画。
function buildFinishReward(achievement) {
  if (!achievement) return null;
  const a = achievement;
  const level = a.level || {};
  const rank = a.rank || {};
  const breakdown = a.trickleBreakdown || {};
  const rawUnlocked = a.unlocked || [];
  const unlocked = [];
  for (let i = 0; i < rawUnlocked.length; i++) {
    const u = rawUnlocked[i] || {};
    unlocked.push({
      key: u.key || '',
      title: u.title || '',
      category: u.category || '',
      art: resolveAchievementArt(u.key, u.category),
    });
  }
  return {
    expGained: Number(a.expGained) || 0,
    breakdown: {
      base: Number(breakdown.base) || 0,
      volume: Number(breakdown.volume) || 0,
      pr: Number(breakdown.pr) || 0,
    },
    // 升级：本次结算前/后等级 + 升级后进度条目标值（动画从 0 滚到 afterPercent）。
    isLevelUp: !!level.isLevelUp,
    levelBefore: Number(level.before) || 0,
    levelAfter: Number(level.level) || 0,
    afterPercent: levelPercent(level),
    levelCard: buildLevelCard(level),
    // 升段：奖牌从 beforeKey 换成当前 tier。
    isPromotion: !!rank.isPromotion,
    rankBeforeIcon: resolveRankIcon({ key: rank.beforeKey }),
    rank: buildRankCard(rank),
    // 本次新解锁成就（可能为空）。
    unlocked,
  };
}

exports.resolveRankIcon = resolveRankIcon;
exports.resolveAchievementArt = resolveAchievementArt;
exports.levelPercent = levelPercent;
exports.buildLevelCard = buildLevelCard;
exports.buildRankCard = buildRankCard;
exports.buildLadder = buildLadder;
exports.progressText = progressText;
exports.buildBadge = buildBadge;
exports.buildCategories = buildCategories;
exports.buildAchievementsViewModel = buildAchievementsViewModel;
exports.buildProfilePreview = buildProfilePreview;
exports.buildFinishReward = buildFinishReward;
