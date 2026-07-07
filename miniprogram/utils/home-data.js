const format = require('./format');

function buildEmptyWeek(now) {
  const todayDow = (now.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, index) => ({
    done: false,
    isToday: index === todayDow,
  }));
}

// 由后端聚合接口 GET /api/v1/stats/home 的 data 构造首页视图模型，
// 输出形状：{ monthDays, week:{days[{done,isToday}],completed,total}, lastWorkout, overview }，
// 供首页页面与组件直接消费。⚠ 禁数组解构/展开（babel 坑），用索引/for 循环。
function buildHomeViewModelFromStats(data, now = new Date()) {
  const d = data || {};
  const week = d.week || {};
  const rawDays = week.days || [];
  let completed = 0;
  const days = [];
  for (let i = 0; i < rawDays.length; i++) {
    const item = rawDays[i] || {};
    const done = !!item.trained;
    if (done) completed += 1;
    days.push({ done, isToday: !!item.isToday });
  }
  const last = d.lastWorkout;
  const totalDurationMin = Number(week.totalDurationMin) || 0;
  return {
    monthDays: Number(d.monthTrainedDays) || 0,
    week: {
      days: days.length ? days : buildEmptyWeek(now),
      completed,
      total: 7,
    },
    lastWorkout: last ? {
      id: last.sessionId || '',
      title: last.title || '训练',
      relativeDay: format.relativeDay(last.date),
      meta:
        `${Number(last.exerciseCount) || 0} 动作 · ${Number(last.setCount) || 0} 组 · ` +
        `${format.withCommas(last.totalVolumeKg || 0)} kg`,
      empty: false,
    } : {
      id: '',
      title: '',
      relativeDay: '',
      meta: '还没有记录，说一句开始吧',
      empty: true,
    },
    overview: {
      count: Number(week.sessionCount) || 0,
      volume: Number(week.totalVolumeKg) || 0,
      durationHours: Math.round((totalDurationMin / 60) * 10) / 10,
    },
  };
}

exports.buildHomeViewModelFromStats = buildHomeViewModelFromStats;
