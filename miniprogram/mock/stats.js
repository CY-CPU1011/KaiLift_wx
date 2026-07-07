// Mock 数据 —— 结构同 service 返回（Session.list / PR.list / Session.detail）。
// 后端未起或取数失败时，pages/stats 与 pages/session-detail 用本文件兜底渲染。
// 字段名严格对齐 api.json：SessionSummary / PersonalRecord / SessionDetail。

// 生成最近一年内若干训练日的 SessionSummary。日期落在当前年内，便于热力图渲染。
function buildSessions() {
  const now = new Date();
  const y = now.getFullYear();
  // [月(0-11), 日, 总容量kg, 动作数, 组数]
  const seed = [
    [now.getMonth(), now.getDate(), 4320, 5, 18],
    [now.getMonth(), Math.max(1, now.getDate() - 1), 3680, 4, 15],
    [now.getMonth(), Math.max(1, now.getDate() - 3), 5210, 6, 22],
    [now.getMonth(), Math.max(1, now.getDate() - 5), 2870, 3, 12],
    [now.getMonth(), Math.max(1, now.getDate() - 8), 6120, 7, 26],
    [Math.max(0, now.getMonth() - 1), 24, 3950, 4, 16],
    [Math.max(0, now.getMonth() - 1), 18, 4760, 5, 19],
    [Math.max(0, now.getMonth() - 1), 11, 5400, 6, 23],
    [Math.max(0, now.getMonth() - 1), 4, 2310, 3, 10],
    [Math.max(0, now.getMonth() - 2), 27, 4980, 5, 20],
    [Math.max(0, now.getMonth() - 2), 20, 3120, 4, 13],
    [Math.max(0, now.getMonth() - 2), 13, 5630, 6, 24],
    [Math.max(0, now.getMonth() - 2), 6, 4070, 5, 17],
    [Math.max(0, now.getMonth() - 3), 22, 3540, 4, 14],
    [Math.max(0, now.getMonth() - 3), 9, 4890, 5, 21],
  ];
  return seed.map(([mo, day, vol, ex, sets], i) => {
    const started = new Date(y, mo, day, 19, 0, 0);
    const finished = new Date(y, mo, day, 20, 5, 0);
    return {
      id: 'mock-session-' + (i + 1),
      name: i % 3 === 0 ? '推日训练' : i % 3 === 1 ? '拉日训练' : '腿日训练',
      status: 'completed',
      startedAt: started.toISOString(),
      finishedAt: finished.toISOString(),
      currentWorkoutExerciseId: null,
      totalSets: sets,
      totalExercises: ex,
      totalVolumeKg: vol,
    };
  });
}

const SESSIONS = buildSessions();

// PR.list 返回 { items: PersonalRecord[] }
const PRS = [
  { id: 'pr-1', exerciseId: 'ex-bench', exerciseName: '平板卧推', recordType: 'max_weight', value: 140, weightKg: 140, reps: 1, achievedAt: '2026-05-12T11:00:00.000Z' },
  { id: 'pr-2', exerciseId: 'ex-row', exerciseName: '坐姿划船', recordType: 'max_weight', value: 95, weightKg: 95, reps: 3, achievedAt: '2026-05-02T11:00:00.000Z' },
  { id: 'pr-3', exerciseId: 'ex-squat', exerciseName: '深蹲', recordType: 'max_weight', value: 180, weightKg: 180, reps: 1, achievedAt: '2026-04-20T11:00:00.000Z' },
  { id: 'pr-4', exerciseId: 'ex-press', exerciseName: '坐姿推举', recordType: 'max_weight', value: 60, weightKg: 60, reps: 5, achievedAt: '2026-04-08T11:00:00.000Z' },
  { id: 'pr-5', exerciseId: 'ex-curl', exerciseName: '杠铃弯举', recordType: 'max_weight', value: 45, weightKg: 45, reps: 6, achievedAt: '2026-03-30T11:00:00.000Z' },
  { id: 'pr-6', exerciseId: 'ex-deadlift', exerciseName: '硬拉', recordType: 'max_weight', value: 200, weightKg: 200, reps: 1, achievedAt: '2026-03-15T11:00:00.000Z' },
];

// Session.detail 返回 { session: SessionDetail }（含 workoutExercises）
const SESSION_DETAILS = {
  'mock-session-1': {
    id: 'mock-session-1',
    name: '推日训练',
    status: 'completed',
    startedAt: SESSIONS[0].startedAt,
    finishedAt: SESSIONS[0].finishedAt,
    currentWorkoutExerciseId: null,
    totalSets: 18,
    totalExercises: 5,
    totalVolumeKg: 4320,
    workoutExercises: [
      {
        id: 'we-1', exerciseId: 'ex-bench', displayName: '平板卧推', sortOrder: 0,
        sets: [
          { id: 's-1', setOrder: 1, loadType: 'weighted', weightKg: 60, reps: 12, setType: 'warmup', rpe: null, note: null, isPersonalRecord: false },
          { id: 's-2', setOrder: 2, loadType: 'weighted', weightKg: 100, reps: 8, setType: 'working', rpe: 8, note: null, isPersonalRecord: false },
          { id: 's-3', setOrder: 3, loadType: 'weighted', weightKg: 120, reps: 5, setType: 'working', rpe: 9, note: null, isPersonalRecord: true },
        ],
      },
      {
        id: 'we-2', exerciseId: 'ex-incline', displayName: '上斜卧推', sortOrder: 1,
        sets: [
          { id: 's-4', setOrder: 1, loadType: 'weighted', weightKg: 70, reps: 10, setType: 'working', rpe: 7, note: null, isPersonalRecord: false },
          { id: 's-5', setOrder: 2, loadType: 'weighted', weightKg: 80, reps: 8, setType: 'working', rpe: 8, note: null, isPersonalRecord: false },
        ],
      },
      {
        id: 'we-3', exerciseId: 'ex-fly', displayName: '蝴蝶机夹胸', sortOrder: 2,
        sets: [
          { id: 's-6', setOrder: 1, loadType: 'weighted', weightKg: 40, reps: 15, setType: 'working', rpe: 7, note: null, isPersonalRecord: false },
          { id: 's-7', setOrder: 2, loadType: 'weighted', weightKg: 45, reps: 12, setType: 'drop', rpe: 9, note: null, isPersonalRecord: false },
        ],
      },
    ],
  },
};

// 模拟 Session.list 分页返回
function list(params) {
  const items = SESSIONS.slice();
  return Promise.resolve({
    items,
    total: items.length,
    page: (params && params.page) || 1,
    pageSize: (params && params.pageSize) || 100,
  });
}

// 模拟 PR.list
function prList() {
  return Promise.resolve({ items: PRS.slice() });
}

// 模拟 Session.detail
function detail(id) {
  const session = SESSION_DETAILS[id] || SESSION_DETAILS['mock-session-1'];
  return Promise.resolve({ session: Object.assign({}, session, { id }) });
}

module.exports = {
  SESSIONS,
  PRS,
  SESSION_DETAILS,
  list,
  prList,
  detail,
};
