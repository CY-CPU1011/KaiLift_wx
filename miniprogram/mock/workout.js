// mock/workout.js —— 训练页离线兜底数据（结构同 service/api.js 返回）
// 后端未起 / 取数失败时用它渲染，保证页面不空白、可点。

// 一个「进行中」的 session detail（含 workoutExercises 与各自 sets）
const activeSessionDetail = {
  id: 'mock-session-1',
  name: null,
  status: 'active',
  startedAt: new Date(Date.now() - 6 * 60 * 1000 - 45 * 1000).toISOString(), // 06:45 前开始
  finishedAt: null,
  currentWorkoutExerciseId: 'mock-we-1',
  totalSets: 12,
  totalExercises: 3,
  totalVolumeKg: 7010,
  workoutExercises: [
    {
      id: 'mock-we-1',
      exerciseId: 'ex-squat',
      displayName: '杠铃深蹲',
      sortOrder: 0,
      sets: [
        { id: 'set-1', setOrder: 0, loadType: 'weighted', weightKg: 60, reps: 12, setType: 'warmup', rpe: null, note: null, isPersonalRecord: false },
        { id: 'set-2', setOrder: 1, loadType: 'weighted', weightKg: 100, reps: 5, setType: 'working', rpe: null, note: null, isPersonalRecord: false },
        { id: 'set-3', setOrder: 2, loadType: 'weighted', weightKg: 100, reps: 5, setType: 'working', rpe: null, note: null, isPersonalRecord: false },
        { id: 'set-4', setOrder: 3, loadType: 'weighted', weightKg: 100, reps: 4, setType: 'working', rpe: null, note: null, isPersonalRecord: false },
      ],
    },
    {
      id: 'mock-we-2',
      exerciseId: 'ex-row',
      displayName: '坐姿划船',
      sortOrder: 1,
      sets: [
        { id: 'set-5', setOrder: 0, loadType: 'weighted', weightKg: 60, reps: 10, setType: 'working', rpe: null, note: null, isPersonalRecord: false },
        { id: 'set-6', setOrder: 1, loadType: 'weighted', weightKg: 60, reps: 10, setType: 'working', rpe: null, note: null, isPersonalRecord: false },
        { id: 'set-7', setOrder: 2, loadType: 'weighted', weightKg: 65, reps: 8, setType: 'working', rpe: null, note: null, isPersonalRecord: false },
      ],
    },
    {
      id: 'mock-we-3',
      exerciseId: 'ex-bench',
      displayName: '平板卧推',
      sortOrder: 2,
      sets: [
        { id: 'set-8', setOrder: 0, loadType: 'weighted', weightKg: 80, reps: 8, setType: 'working', rpe: null, note: null, isPersonalRecord: false },
        { id: 'set-9', setOrder: 1, loadType: 'weighted', weightKg: 80, reps: 7, setType: 'working', rpe: null, note: null, isPersonalRecord: false },
        { id: 'set-10', setOrder: 2, loadType: 'weighted', weightKg: 80, reps: 6, setType: 'working', rpe: null, note: null, isPersonalRecord: false },
      ],
    },
  ],
};

// 动作选择器兜底动作库
const exercises = [
  { id: 'ex-squat', name: '杠铃深蹲', aliases: ['深蹲'], bodyPart: '腿', equipment: 'barbell', isSystem: true },
  { id: 'ex-bench', name: '平板卧推', aliases: ['卧推'], bodyPart: '胸', equipment: 'barbell', isSystem: true },
  { id: 'ex-deadlift', name: '硬拉', aliases: [], bodyPart: '背', equipment: 'barbell', isSystem: true },
  { id: 'ex-row', name: '坐姿划船', aliases: ['划船'], bodyPart: '背', equipment: 'cable', isSystem: true },
  { id: 'ex-ohp', name: '站姿推举', aliases: ['推举'], bodyPart: '肩', equipment: 'barbell', isSystem: true },
  { id: 'ex-pullup', name: '引体向上', aliases: ['引体'], bodyPart: '背', equipment: 'bodyweight', isSystem: true },
  { id: 'ex-curl', name: '哑铃弯举', aliases: ['弯举'], bodyPart: '手臂', equipment: 'dumbbell', isSystem: true },
];

module.exports = { activeSessionDetail, exercises };
