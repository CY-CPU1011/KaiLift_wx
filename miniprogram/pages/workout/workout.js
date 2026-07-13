// pages/workout/workout.js —— 训练核心页（开始/语音记录/手动记录/编辑/结束）
const { Session, Set, Voice } = require('../../service/api');
const { displayWeight } = require('../../utils/format');
const { SET_TYPES, LOAD_TYPES, RECORDER_OPTIONS, SETS_RESTORE_READY } = require('../../utils/constants');
const {
  findLatestSet,
  isResumedStart,
  setInputFromRaw,
  normalizeReps,
  groupParsedSetsForUndo,
} = require('../../utils/data');
const { buildFinishReward } = require('../../utils/achievement');
const { withSharePage } = require('../../utils/share-page');

// tone 循环：绿/蓝/粉（design §5.7）
const TONE_CYCLE = ['green', 'blue', 'pink'];

// 训练空闲自动结束阈值（正式与后端 session-lifecycle 常量对齐：30/45 提醒，60 自动结束）。
// 仅 App 前台、计时器在跑时有效；切后台/锁屏会挂起 JS 定时器，离开 App 期间由后端兜底。
// ⚠️ 联调开关：true 时用秒级阈值（90/120/150 秒），便于几分钟内跑完整条流程、且不至于在挑动作时就触发。
//    上线前务必置 false（恢复 30/45/60 分钟，与后端对齐）。仅影响前端提醒/自动结束的触发节奏。
const IDLE_DEBUG = false;
const IDLE_REMIND_1 = IDLE_DEBUG ? 90 * 1000 : 30 * 60 * 1000;
const IDLE_REMIND_2 = IDLE_DEBUG ? 120 * 1000 : 45 * 60 * 1000;
const IDLE_AUTO_END = IDLE_DEBUG ? 150 * 1000 : 60 * 60 * 1000;
// 提醒二 → 自动结束的剩余时长，供「将在约 X 后自动结束」文案用（≥1分钟显示分钟，否则显示秒）。
const IDLE_REMAIN_MS = IDLE_AUTO_END - IDLE_REMIND_2;
const IDLE_REMAIN_TEXT = IDLE_REMAIN_MS >= 60 * 1000
  ? Math.round(IDLE_REMAIN_MS / 60000) + ' 分钟'
  : Math.round(IDLE_REMAIN_MS / 1000) + ' 秒';

// 取第一个「有定义」的值（语音解析结果兼容 snake_case / camelCase）
function pick(...vals) {
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] !== undefined && vals[i] !== null) return vals[i];
  }
  return null;
}

// 动作名 → 器材图标 slug（design §4.4：统一用 equipment/*，缺省回退杠铃）
function equipmentSlugOf(name) {
  const n = String(name || '');
  if (/哑铃|弯举|dumbbell/i.test(n)) return 'dumbbell';
  if (/卧推|bench|推胸/i.test(n)) return 'bench';
  if (/杠铃|深蹲|硬拉|划船|推举|barbell/i.test(n)) return 'barbell';
  return 'barbell';
}

// setType / loadType 选择器选项（picker 用 index）
const SET_TYPE_KEYS = ['warmup', 'working', 'drop', 'failure', 'backoff'];
const SET_TYPE_LABELS = SET_TYPE_KEYS.map((k) => SET_TYPES[k]);
const LOAD_TYPE_KEYS = ['weighted', 'bodyweight', 'assisted', 'duration'];
const LOAD_TYPE_LABELS = LOAD_TYPE_KEYS.map((k) => LOAD_TYPES[k]);

// 录音管理器与回调宿主：onStop/onError 只注册一次，事件路由到「当前训练页实例」。
let recorderManager = null;
let recorderOwner = null;

function ensureRecorder() {
  if (recorderManager) return recorderManager;
  recorderManager = wx.getRecorderManager();
  recorderManager.onStop((res) => {
    if (recorderOwner) recorderOwner._onRecordStop(res);
  });
  recorderManager.onError((err) => {
    if (recorderOwner) recorderOwner._onRecordError(err);
  });
  return recorderManager;
}

// 上报给 ASR 的音频格式：从录音临时文件扩展名推导，录出来是啥就报啥。
// 真机个别机型可能不履行 RECORDER_OPTIONS.format（mp3）而回退 aac，按扩展名上报可避免
// 「声明格式 ≠ 真实字节」导致的 ASR audio data empty（腾讯 ASR 支持 mp3/m4a/aac/wav 等）；
// 取不到扩展名时按录音配置兜底。
function voiceFormatOf(filePath) {
  const m = /\.([a-z0-9]+)$/i.exec(filePath || '');
  return m ? m[1].toLowerCase() : RECORDER_OPTIONS.format;
}

Page(withSharePage({
  data: {
    // 登录用户单位（默认 kg）
    unit: 'kg',
    isGuest: true,
    statusBarHeight: 20,

    // 页面态：'empty'（未开始） | 'loading' | 'training'
    phase: 'loading',
    errorMessage: '',

    session: null,        // SessionDetail
    cards: [],            // 给 ExerciseCard 的视图模型
    currentExerciseName: null, // 当前动作上下文（前端）

    // Timer 展示
    seconds: 0,
    totalSets: 0,
    totalExercises: 0,
    totalVolume: 0,

    // 语音
    voiceStatus: 'idle',  // idle | recording | processing
    voiceBubble: '按住说话',

    // 确认卡
    showConfirm: false,
    confirmTitle: '',
    confirmReason: '',
    confirmIntent: '',     // record_sets | modify_last_set | set_current_exercise | unknown
    confirmSets: [],       // [{loadTypeIndex, weightInput, reps, setTypeIndex}]
    confirmExerciseName: '',
    confirmChanges: null,
    modifyTargetSetId: null,
    // 语音确认卡的 voiceEntryId（来自 /voice needs_confirmation）。
    // 非空 → 确认/放弃走 /voice-entries/{id}/confirm。
    confirmVoiceEntryId: null,
    setTypeLabels: SET_TYPE_LABELS,
    loadTypeLabels: LOAD_TYPE_LABELS,

    // ASR 文本录入（无 ASR 端点，降级为文本确认 —— TODO: 接入 ASR）
    showAsrInput: false,
    asrText: '',

    // 手动加组表单
    showManual: false,
    manualExerciseName: '',
    manualRows: [],        // [{weightInput, reps, setTypeIndex, loadTypeIndex}]

    // 编辑单组
    showEditSet: false,
    editSet: null,         // {id, weightInput, reps, setTypeIndex, loadTypeIndex}

    // 结束训练完成弹窗
    showFinish: false,
    finishSummary: { exercises: 0, sets: 0, volume: 0 },

    // 空闲提醒浮层（自定义，区别于系统 showModal：可被自动结束用 setData 主动关闭，不卡不残留）
    showIdleRemind: false,
    idleRemindTitle: '',
    idleRemindContent: '',

    // 完赛庆祝覆盖层（仅首次完赛；buildFinishReward 返回 null 则不放动画）
    showReward: false,
    finishReward: null,

    submitting: false,

    // 撤销
    undoVisible: false,
    undoData: null,
    lastRecordedSetId: null,
  },

  // 阻止冒泡（弹层内点击不关闭）
  noop() {},

  onLoad() {
    const app = getApp();
    const sys = app && app.globalData && app.globalData.systemInfo;
    if (sys && sys.statusBarHeight) this.setData({ statusBarHeight: sys.statusBarHeight });
    const user = app && app.globalData && app.globalData.userInfo;
    if (user && user.unitWeight) this.setData({ unit: user.unitWeight });
    this._timer = null;
    this._recording = false;
    // 注册录音回调（云就绪时录音 → onStop 走云解析；未就绪时降级文本输入）
    try { ensureRecorder(); } catch (e) {}
  },

  onShow() {
    const app = getApp();
    const isGuest = !(app && app.isLoggedIn());
    this.setData({ isGuest });
    // 自定义 tabBar 选中态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    if (isGuest) {
      this._clearTimer();
      this._stopRecording();
      this.setData({
        phase: 'empty',
        session: null,
        cards: [],
        currentExerciseName: null,
        totalSets: 0,
        totalExercises: 0,
        totalVolume: 0,
        seconds: 0,
        errorMessage: '',
      });
      return;
    }
    // 从动作选择器返回带回的动作名 + 目标（manual/replace）。target 取 storage（选择器写）
    // 或本实例发起时记下的意图，双保险——不依赖 showManual 显隐时序、也不怕选择器未重编译。
    const picked = wx.getStorageSync('kl_picked_exercise');
    if (picked) {
      const pickedTarget = wx.getStorageSync('kl_picked_target') || this._pickTargetIntent || '';
      this._pickTargetIntent = null;
      wx.removeStorageSync('kl_picked_exercise');
      wx.removeStorageSync('kl_picked_target');
      this._applyPickedExercise(picked, pickedTarget);
    }
    // 录音事件路由到本实例（tab 页通常单例，切回时重新认领）
    recorderOwner = this;
    this._loadActive();
  },

  onHide() {
    this._clearTimer();
    this._stopRecording();
    this._closeIdleRemind(); // 切走时收起提醒浮层，回来用服务端末组重新判定
    if (recorderOwner === this) recorderOwner = null;
  },

  onUnload() {
    this._clearTimer();
    this._stopRecording();
    if (recorderOwner === this) recorderOwner = null;
  },

  /* ---------------- 数据加载 ---------------- */

  async _loadActive() {
    const hadSession = !!this.data.session;
    this.setData({ phase: 'loading', errorMessage: '' });
    try {
      const summary = await Session.active();
      if (!summary) {
        this._clearTimer();
        this.setData({ phase: 'empty', session: null, cards: [] });
        return;
      }
      const detail = await Session.detail(summary.id);
      this._applySession(detail);
      // F3 兜底：切后台/锁屏时定时器被挂起，回前台用服务端末组重算空闲。若已 ≥60min
      //（正常这种已被后端惰性关掉、active() 返回 null，此处覆盖极少数漏网），直接自动结束。
      // ⚠ 用户正交互时（如从选择器挑完动作返回、手动表单开着）不能在此结掉，否则正在加的组保存不了。
      if (!this._idleBusy() && Date.now() - this._lastActivityMs >= IDLE_AUTO_END) {
        this._autoFinish();
        return;
      }
      // 仅在「首次进入/重新载入」时提示恢复，避免来回切 tab 重复弹
      if (!hadSession) {
        wx.showToast({ title: '已恢复进行中的训练', icon: 'none' });
      }
    } catch (e) {
      this._clearTimer();
      this.setData({
        phase: 'error',
        session: null,
        cards: [],
        errorMessage: (e && e.message) || '训练数据加载失败',
      });
    }
  },

  async _refresh() {
    if (!this.data.session) return;
    try {
      const detail = await Session.detail(this.data.session.id);
      this._applySession(detail);
    } catch (e) {
      wx.showToast({ title: '刷新失败', icon: 'none' });
    }
  },

  _applySession(detail) {
    const cards = this._buildCards(detail);
    // 当前动作名：优先后端 currentWorkoutExerciseId 对应的动作
    let currentName = this.data.currentExerciseName;
    if (detail.currentWorkoutExerciseId && detail.workoutExercises) {
      const cur = detail.workoutExercises.find((w) => w.id === detail.currentWorkoutExerciseId);
      if (cur) currentName = cur.displayName;
    }
    if (!currentName && cards.length) currentName = cards[cards.length - 1].name;

    // 空闲钟基准 = 末组 createdAt（无组用 startedAt）。来自服务端，切 tab 重载也稳定，不会误重置。
    // ⚠ 避免数组解构/展开（WeChat babel arrayWithHoles 坑），用索引循环求最大值。
    let lastMs = new Date(detail.startedAt).getTime();
    const wesForIdle = detail.workoutExercises || [];
    for (let i = 0; i < wesForIdle.length; i++) {
      const ss = wesForIdle[i].sets || [];
      for (let j = 0; j < ss.length; j++) {
        const t = new Date(ss[j].createdAt).getTime();
        if (!isNaN(t) && t > lastMs) lastMs = t;
      }
    }
    this._lastActivityMs = lastMs;
    this._idleStage = 0; // 0=未提醒 1=已弹30 2=已弹45

    const totals = this._calcTotals(detail);
    this.setData({
      phase: 'training',
      errorMessage: '',
      session: detail,
      cards,
      currentExerciseName: currentName,
      totalSets: totals.sets,
      totalExercises: totals.exercises,
      totalVolume: totals.volume,
    });
    this._startTimer(detail.startedAt);
  },

  _buildCards(detail) {
    const wes = (detail && detail.workoutExercises) || [];
    const unit = this.data.unit;
    // 当前动作 id（蓝钟·进行中）：优先后端上下文，否则最后一个动作
    const curWeId = (detail && detail.currentWorkoutExerciseId)
      || (wes.length ? wes[wes.length - 1].id : null);
    const isActive = detail.status === 'active';
    return wes.map((we, idx) => {
      const sets = we.sets || [];
      // 取最常见/最近重量作为卡片主重量展示
      const last = sets.length ? sets[sets.length - 1] : null;
      const dw = last ? displayWeight(last.weightKg, unit) : { value: '', unit };
      const reps = last ? last.reps : 0;
      const isCurrent = isActive && we.id === curWeId;
      return {
        id: we.id,
        name: we.displayName,
        sets: sets.length,
        reps,
        weight: dw.value === '' ? '自重' : dw.value + dw.unit,
        tone: TONE_CYCLE[idx % TONE_CYCLE.length],
        // 状态徽标：当前动作（进行中）→ 蓝钟(todo)，其余 → 绿勾(done)
        status: isCurrent ? 'todo' : 'done',
        equipmentSlug: equipmentSlugOf(we.displayName),
        // 明细（点开编辑用）。行首状态点：当前动作的最后一组=蓝(current)，其余=绿(done)
        setList: sets.map((s, si) => {
          const w = displayWeight(s.weightKg, unit);
          const isCurGroup = isCurrent && si === sets.length - 1;
          return {
            id: s.id,
            setOrder: s.setOrder,
            label: (w.value === '' ? '自重' : w.value + w.unit) + ' × ' + s.reps + ' 次',
            typeLabel: SET_TYPES[s.setType] || s.setType,
            stateDot: isCurGroup ? 'current' : 'done',
            raw: s,
          };
        }),
      };
    });
  },

  _calcTotals(detail) {
    const wes = (detail && detail.workoutExercises) || [];
    let sets = 0;
    let volume = 0;
    wes.forEach((we) => {
      (we.sets || []).forEach((s) => {
        sets += 1;
        if (s.weightKg && s.reps) volume += s.weightKg * s.reps;
      });
    });
    return { exercises: wes.length, sets, volume: Math.round(volume) };
  },

  /* ---------------- 计时器 ---------------- */

  _startTimer(startedAt) {
    this._clearTimer();
    const startMs = new Date(startedAt).getTime();
    const tick = () => {
      const sec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      this.setData({ seconds: sec });
      // 空闲判定：仅训练态且空闲钟就绪时。
      if (this.data.phase !== 'training' || !this._lastActivityMs) return;
      // 用户正在填表/挑动作/换动作：完全暂停。否则会弹提醒盖住表单、甚至自动结束把正在编辑的
      // session 结掉，导致「无法保存」。（提醒浮层本身不算 busy，见下：到点仍要能自动结束。）
      if (this._idleBusy()) return;
      const idle = Date.now() - this._lastActivityMs;
      // 自动结束到点就结。提醒是可被 setData 关闭的自定义浮层，_autoFinish 会一并关掉 —— 不卡也不残留。
      if (idle >= IDLE_AUTO_END) { this._autoFinish(); return; }
      // 两档提醒：到二档时即便一档浮层还开着也升级为二档（同一浮层就地换文案，告知即将自动结束）。
      // _idleStage 保证每档只弹一次，不会重复刷。
      if (idle >= IDLE_REMIND_2 && this._idleStage < 2) { this._idleStage = 2; this._idleRemind(2); }
      else if (idle >= IDLE_REMIND_1 && this._idleStage < 1) { this._idleStage = 1; this._idleRemind(1); }
    };
    tick();
    this._timer = setInterval(tick, 1000);
  },

  _clearTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  // 成功加组后空闲钟归零（即时复位；随后 _refresh→_applySession 会再以服务端末组校准）。
  _resetIdle() {
    this._lastActivityMs = Date.now();
    this._idleStage = 0;
  },

  // 用户是否正在交互：任一编辑弹层/表单开着、或在「换动作」选择流程中。这些状态下不弹提醒、
  // 不自动结束（人在、正操作，结掉会丢正在编辑的内容）。空闲提醒浮层不计入——它开着时仍允许到点自动结束。
  _idleBusy() {
    const d = this.data;
    return d.showManual || d.showConfirm || d.showEditSet || d.showFinish
      || d.showReward || d.showAsrInput || !!this._pendingReplaceCardId;
  },

  // 30/45 空闲提醒（自定义浮层）。文案不写死「再过 X 分钟」倒计时（会变假话），用不依赖时间的措辞。
  _idleRemind(stage) {
    this.setData({
      showIdleRemind: true,
      idleRemindTitle: stage === 1 ? '还在练吗？' : '即将自动结束',
      idleRemindContent: stage === 1
        ? '有一会儿没记录新动作了，还在练就点「继续训练」。'
        : '若仍无新记录，将在约 ' + IDLE_REMAIN_TEXT + ' 后自动结束并保存本次训练。',
    });
  },

  // 关闭提醒浮层（继续 / 结束 / 自动结束都经此收尾，避免残留）。
  _closeIdleRemind() {
    if (this.data.showIdleRemind) this.setData({ showIdleRemind: false });
  },

  // 「继续训练」：关浮层、不续命（下一档到点再提醒，到 150s 自动结束）。
  onIdleContinue() {
    this._closeIdleRemind();
  },

  // 「结束训练」：走手动结束（照常弹奖励）。
  onIdleEnd() {
    this._closeIdleRemind();
    this._finishSession();
  },

  // 60 空闲自动结束：PATCH auto:true（奖励转待领，不当场弹），回到可开新训练态。
  // _autoFinishing 防重入：避免 finish 失败后经 _loadActive→F3 兜底再次触发的死循环。
  async _autoFinish() {
    if (this._autoFinishing) return;
    this._autoFinishing = true;
    this._clearTimer();
    this._closeIdleRemind(); // 关掉可能正开着的空闲提醒浮层，避免结束后残留
    const id = this.data.session && this.data.session.id;
    if (!id) { this._autoFinishing = false; return; }
    try {
      await Session.finish(id, true);
      wx.showToast({ title: '久未记录，已自动结束并保存', icon: 'none' });
      await this._loadActive(); // 刷新为 empty 态；奖励等下次进 App 由首页 F4 补放
    } catch (e) {
      // 失败不当场重试（以免循环），下次进 App / 开练时由后端兜底或本流程再判
    } finally {
      this._autoFinishing = false;
    }
  },

  /* ---------------- 开始训练 ---------------- */

  _requireLogin() {
    const app = getApp();
    if (app && app.isLoggedIn()) return true;
    wx.showToast({ title: '请先到我的页登录', icon: 'none' });
    return false;
  },

  async onStartTraining() {
    if (!this._requireLogin()) return;
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    wx.showLoading({ title: '开始中…' });
    try {
      const data = await Session.start(null);
      const detail = await Session.detail(data.session.id);
      this._applySession(detail);
      wx.hideLoading();
      // 兼容后端「单 active」约束：已有进行中训练时后端回现有 session 并带 resumed
      wx.showToast({
        title: isResumedStart(data) ? '已恢复进行中的训练' : '新训练已开始',
        icon: 'none',
      });
    } catch (e) {
      wx.hideLoading();
      this.setData({ phase: 'empty' });
      wx.showToast({ title: (e && e.message) || '开始训练失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  /* ---------------- 语音流程（全部走 REST 后端）----------------
   * 录音 → wx.uploadFile 直传 POST /sessions/{id}/voice → 按 status
   *   (auto_saved / needs_confirmation→confirm / unknown) 处理；失败按 §3.10 改手动。
   * 录不到音（模拟器/无麦克风）→ 文本输入框 → POST /voice(rawText)。
   */

  onVoiceStart() {
    recorderOwner = this;
    this.setData({ voiceStatus: 'recording', voiceBubble: '正在听…可取消' });
    try {
      ensureRecorder().start(RECORDER_OPTIONS);
      this._recording = true;
    } catch (e) {
      this._recording = false;
      // 录音不可用也不阻塞：直接进文本录入
      this._degradeToText();
    }
  },

  onVoiceStop() {
    this.setData({ voiceStatus: 'processing', voiceBubble: '识别中…' });
    let stopped = false;
    try {
      if (this._recording) { ensureRecorder().stop(); stopped = true; }
    } catch (e) {}
    this._recording = false;
    // 录到音：等待 _onRecordStop 拿到临时文件 → 上传解析；
    // 兜底超时（模拟器/无录音回调）→ 降级文本输入，走 rawText
    if (stopped) {
      if (this._voiceTimeout) clearTimeout(this._voiceTimeout);
      this._voiceTimeout = setTimeout(() => {
        this._voiceTimeout = null;
        this._resetVoice();
        this._degradeToText();
      }, 6000);
      return;
    }
    // 否则降级到文本输入
    this._degradeToText();
  },

  _stopRecording() {
    if (this._voiceTimeout) { clearTimeout(this._voiceTimeout); this._voiceTimeout = null; }
    if (!this._recording) return;
    try { ensureRecorder().stop(); } catch (e) {}
    this._recording = false;
  },

  // 录音结束回调：拿到临时文件 → 上传后端解析；没录到音 → 文本输入
  _onRecordStop(res) {
    if (this._voiceTimeout) { clearTimeout(this._voiceTimeout); this._voiceTimeout = null; }
    const fp = res && res.tempFilePath;
    if (!fp) {
      this._resetVoice();
      this._degradeToText();
      return;
    }
    this._parseVoiceAudio(fp);
  },

  _onRecordError() {
    if (this._voiceTimeout) { clearTimeout(this._voiceTimeout); this._voiceTimeout = null; }
    this._recording = false;
    this._resetVoice();
    this._degradeToText();
  },

  // 语音链路：音频 multipart 直传 POST /sessions/{id}/voice → 按 status 分流
  async _parseVoiceAudio(tempFilePath) {
    const d = this.data;
    if (!d.session) { this._resetVoice(); return; }
    wx.showLoading({ title: '识别中…' });
    try {
      const res = await Voice.parseAudio(d.session.id, tempFilePath, {
        voiceFormat: voiceFormatOf(tempFilePath),
      });
      wx.hideLoading();
      this._resetVoice();
      await this._handleVoiceResult(res);
    } catch (e) {
      wx.hideLoading();
      this._resetVoice();
      this._voiceFailToManual(e); // §3.10 改用手动
    }
  },

  // 处理 /voice 返回（status: auto_saved / needs_confirmation / unknown）
  async _handleVoiceResult(res) {
    const status = res && res.status;
    const sessionId = this.data.session && this.data.session.id;

    if (status === 'auto_saved') {
      const ids = (res && res.createdSetIds) || [];
      if (ids.length) this.setData({ lastRecordedSetId: ids[ids.length - 1] });
      if (res.currentExerciseName) this.setData({ currentExerciseName: res.currentExerciseName });
      await this._refresh();
      this._resetIdle();
      wx.showToast({ title: '已记录 ' + ids.length + ' 组', icon: 'success' });
      // 撤销：优先软删恢复（按 id），未就绪回退重新加组（按 parsed 还原 SetInput）
      const setGroups = groupParsedSetsForUndo(
        (res.parsed && res.parsed.sets) || [],
        res.currentExerciseName || this.data.currentExerciseName
      );
      const setInputs = [];
      for (let i = 0; i < setGroups.length; i++) {
        for (let j = 0; j < setGroups[i].sets.length; j++) {
          setInputs.push(setGroups[i].sets[j]);
        }
      }
      this._showUndo({
        sessionId,
        setIds: ids,
        exerciseName: res.currentExerciseName || this.data.currentExerciseName,
        setInputs,
        setGroups,
        text: '已记录 ' + ids.length + ' 组',
      });
      return;
    }

    if (status === 'needs_confirmation') {
      this._openVoiceConfirm(res);
      return;
    }

    // unknown
    wx.showModal({
      title: '没太听清',
      content: '没能识别为训练内容，是否改用手动加组？',
      confirmText: '手动加组',
      success: (r) => { if (r.confirm) this.openManual(); },
    });
  },

  // needs_confirmation 渲染确认卡（记录 voiceEntryId，确认/放弃走 /voice-entries/{id}/confirm）
  _openVoiceConfirm(res) {
    const unit = this.data.unit;
    const parsed = (res && res.parsed) || {};
    const intent = res.intent || parsed.intent || 'record_sets';
    const reasonMap = {
      // 后端契约（语音解析接口.md §1）枚举
      not_recognized: '没能识别为训练内容',
      incomplete_fields: '部分字段不全，请补充确认',
      low_confidence: '识别置信度较低，请确认',
      modify_history: '修改历史记录需确认',
      // 兼容本地解析器/历史命名
      no_exercise_context: '未识别到动作，请补充动作名',
      incomplete_set: '部分字段不全，请补充确认',
      ambiguous_number: '数字有歧义，请确认',
      multiple_candidates: '动作匹配到多个，请确认',
    };
    const reason = reasonMap[res.confirmationReason] || res.confirmationReason || '请确认解析结果';

    if (intent === 'modify_last_set') {
      const last = this._lastSet();
      if (!last) {
        wx.showToast({ title: '没有可修改的组', icon: 'none' });
        return;
      }
      const changes = parsed.changes || {};
      const merged = Object.assign({}, last.raw, {
        weightKg: pick(changes.weight_kg, changes.weightKg, last.raw.weightKg),
        reps: pick(changes.reps, last.raw.reps),
      });
      const dw = displayWeight(merged.weightKg, unit);
      this.setData({
        showConfirm: true,
        confirmVoiceEntryId: res.voiceEntryId || null,
        confirmIntent: 'modify_last_set',
        confirmTitle: '修改最近一组',
        confirmReason: reason,
        modifyTargetSetId: last.id,
        confirmExerciseName: res.currentExerciseName || this.data.currentExerciseName || '',
        confirmSets: [{
          loadTypeIndex: Math.max(0, LOAD_TYPE_KEYS.indexOf(merged.loadType || 'weighted')),
          weightInput: dw.value,
          reps: merged.reps || 1,
          setTypeIndex: Math.max(0, SET_TYPE_KEYS.indexOf(merged.setType || 'working')),
        }],
      });
      return;
    }

    // record_sets needs_confirmation
    const rawSets = parsed.sets || res.sets || [];
    const confirmSets = rawSets.map((s) => {
      const loadType = s.load_type || s.loadType || 'weighted';
      const weightKg = pick(s.weight_kg, s.weightKg);
      const setType = s.set_type || s.setType || 'working';
      const dw = displayWeight(weightKg, unit);
      return {
        loadTypeIndex: Math.max(0, LOAD_TYPE_KEYS.indexOf(loadType)),
        weightInput: dw.value,
        reps: s.reps || 1,
        setTypeIndex: Math.max(0, SET_TYPE_KEYS.indexOf(setType)),
      };
    });
    this.setData({
      showConfirm: true,
      confirmVoiceEntryId: res.voiceEntryId || null,
      confirmIntent: 'record_sets',
      confirmTitle: '确认这些训练组',
      confirmReason: reason,
      modifyTargetSetId: null,
      confirmExerciseName: res.currentExerciseName
        || parsed.current_exercise || parsed.currentExercise
        || this.data.currentExerciseName || '',
      confirmSets: confirmSets.length
        ? confirmSets
        : [{ loadTypeIndex: 0, weightInput: '', reps: 1, setTypeIndex: 1 }],
    });
  },

  _resetVoice() {
    this.setData({ voiceStatus: 'idle', voiceBubble: '按住说话' });
  },

  // 语音失败统一入口（§3.10 改用手动）
  _voiceFailToManual(err) {
    const msg = (err && err.message) || '语音处理失败';
    wx.showModal({
      title: '语音没记上',
      content: msg + '，是否改用手动加组？',
      confirmText: '手动加组',
      success: (r) => { if (r.confirm) this.openManual(); },
    });
  },

  // 文本输入框代替 ASR（录不到音 / 想打字）：内容走 POST /voice(rawText)
  _degradeToText() {
    this.setData({
      voiceStatus: 'idle',
      voiceBubble: '按住说话',
      showAsrInput: true,
      asrText: '',
    });
  },

  onAsrInput(e) {
    this.setData({ asrText: e.detail.value });
  },

  onAsrCancel() {
    this.setData({ showAsrInput: false, asrText: '' });
  },

  // 文本确认：rawText 走 POST /sessions/{id}/voice（跳过 ASR）
  async onAsrConfirm() {
    const text = (this.data.asrText || '').trim();
    this.setData({ showAsrInput: false });
    if (!text) {
      wx.showToast({ title: '没太听清，请重说或手动', icon: 'none' });
      return;
    }
    const d = this.data;
    if (!d.session) return;
    wx.showLoading({ title: '识别中…' });
    try {
      const res = await Voice.parseText(d.session.id, text);
      wx.hideLoading();
      await this._handleVoiceResult(res);
    } catch (e) {
      wx.hideLoading();
      this._voiceFailToManual(e);
    }
  },

  /* ---------------- 确认卡 ---------------- */

  onConfirmExerciseName(e) {
    this.setData({ confirmExerciseName: e.detail.value });
  },
  onConfirmWeight(e) {
    const i = e.currentTarget.dataset.index;
    this.setData({ [`confirmSets[${i}].weightInput`]: e.detail.value });
  },
  onConfirmReps(e) {
    const i = e.currentTarget.dataset.index;
    this.setData({ [`confirmSets[${i}].reps`]: e.detail.value });
  },
  onConfirmSetType(e) {
    const i = e.currentTarget.dataset.index;
    this.setData({ [`confirmSets[${i}].setTypeIndex`]: Number(e.detail.value) });
  },
  onConfirmLoadType(e) {
    const i = e.currentTarget.dataset.index;
    this.setData({ [`confirmSets[${i}].loadTypeIndex`]: Number(e.detail.value) });
  },
  onConfirmDiscard() {
    const id = this.data.confirmVoiceEntryId;
    this.setData({ showConfirm: false, confirmSets: [], confirmVoiceEntryId: null });
    // 确认卡放弃：以 voiceEntryId 通知后端 reject（幂等，失败不打扰用户）
    if (id) {
      Voice.confirm(id, { action: 'reject' }).catch(() => {});
    }
  },

  async onConfirmSave() {
    const d = this.data;
    // 语音确认卡：确认走 /voice-entries/{id}/confirm（含 modify_last_set，后端按 voiceEntryId 处理）
    if (d.confirmVoiceEntryId) {
      await this._voiceConfirmSave();
      return;
    }
    if (d.confirmIntent === 'modify_last_set') {
      const row = d.confirmSets[0];
      const body = this._rowToSetInput(row);
      if (!this._validateSetInputs([body])) return;
      await this._updateSet(d.modifyTargetSetId, body);
      this.setData({ showConfirm: false });
      return;
    }
    // record_sets
    const name = (d.confirmExerciseName || '').trim() || d.currentExerciseName;
    if (!name) {
      wx.showToast({ title: '请填写动作名', icon: 'none' });
      return;
    }
    const sets = d.confirmSets.map((r) => this._rowToSetInput(r));
    if (!this._validateSetInputs(sets)) return;
    this.setData({ showConfirm: false });
    await this._addSets(name, sets);
  },

  // 语音确认卡「确认保存」：把（可编辑后的）组与动作名回传 /voice-entries/{id}/confirm 写库
  async _voiceConfirmSave() {
    const d = this.data;
    const voiceEntryId = d.confirmVoiceEntryId;
    const editedExerciseName = (d.confirmExerciseName || '').trim() || d.currentExerciseName || undefined;
    // confirm 的 editedSets 用 ParsedSet（snake_case），区别于手动加组 /sets 的 SetInput（camelCase）
    const editedSets = d.confirmSets.map((r) => this._rowToParsedSet(r, editedExerciseName));
    if (!this._validateSetInputs(editedSets)) return;
    this.setData({ showConfirm: false });
    wx.showLoading({ title: '保存中…' });
    try {
      const res = await Voice.confirm(voiceEntryId, {
        action: 'confirm',
        editedSets,
        editedExerciseName,
        targetSetId: d.confirmIntent === 'modify_last_set' ? d.modifyTargetSetId : undefined,
      });
      wx.hideLoading();
      if (res && res.currentExerciseName) this.setData({ currentExerciseName: res.currentExerciseName });
      const ids = (res && res.createdSetIds) || [];
      if (ids.length) this.setData({ lastRecordedSetId: ids[ids.length - 1] });
      await this._refresh();
      this._resetIdle();
      wx.showToast({ title: '已确认', icon: 'success' });
    } catch (e) {
      wx.hideLoading();
      this._voiceFailToManual(e); // §3.10 改用手动
    } finally {
      this.setData({ confirmVoiceEntryId: null });
    }
  },

  _rowToSetInput(row) {
    const loadType = LOAD_TYPE_KEYS[row.loadTypeIndex] || 'weighted';
    let weightKg = null;
    if (loadType !== 'bodyweight') {
      const v = parseFloat(row.weightInput);
      if (!isNaN(v)) {
        // 展示单位 -> kg
        weightKg = this.data.unit === 'lb' ? Math.round((v / 2.2046) * 10) / 10 : v;
      }
    }
    return {
      loadType,
      weightKg,
      reps: normalizeReps(row.reps),
      setType: SET_TYPE_KEYS[row.setTypeIndex] || 'working',
      rpe: null,
      note: null,
    };
  },

  _validateSetInputs(sets) {
    const invalid = (sets || []).some((s) => !s || !Number.isInteger(s.reps) || s.reps < 1 || s.reps > 1000);
    if (!invalid) return true;
    wx.showToast({ title: '次数需为 1–1000 的整数', icon: 'none' });
    return false;
  },

  // 确认卡行 → ParsedSet（snake_case，confirm.editedSets 用）
  _rowToParsedSet(row, exerciseName) {
    const si = this._rowToSetInput(row);
    return {
      exercise_name: exerciseName || undefined,
      load_type: si.loadType,
      weight_kg: si.weightKg,
      reps: si.reps,
      set_type: si.setType,
      rpe: si.rpe,
      note: si.note,
      confidence: 1,
    };
  },

  /* ---------------- 写库：加组 / 改组 / 删组 ---------------- */

  _lastSet() {
    return findLatestSet(
      this.data.cards,
      this.data.currentExerciseName,
      this.data.lastRecordedSetId
    );
  },

  // 写库通道：统一走 REST POST /sessions/{id}/sets。-> { createdSetIds, currentExerciseName }
  _writeSets(sessionId, exerciseName, sets) {
    return Set.addToSession(sessionId, exerciseName, sets);
  },

  async _addSets(exerciseName, sets) {
    const d = this.data;
    if (!d.session) return;
    wx.showLoading({ title: '记录中…' });
    try {
      const result = await this._writeSets(d.session.id, exerciseName, sets);
      const ids = (result && result.createdSetIds) || [];
      if (ids.length) {
        this.setData({ lastRecordedSetId: ids[ids.length - 1] });
      }
      await this._refresh();
      this._resetIdle();
      this.setData({ currentExerciseName: exerciseName });
      wx.hideLoading();
      wx.showToast({ title: '已记录 ' + sets.length + ' 组', icon: 'success' });
    } catch (e) {
      wx.hideLoading();
      // 失败 -> 提示并改用手动（保留已填数据预置到手动表单）
      this._failToManual(exerciseName, sets, e);
    }
  },

  async _updateSet(setId, body) {
    wx.showLoading({ title: '保存中…' });
    try {
      await Set.update(setId, body);
      await this._refresh();
      wx.hideLoading();
      wx.showToast({ title: '已更新', icon: 'success' });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  async _removeSet(setId, undoData) {
    wx.showLoading({ title: '删除中…' });
    try {
      await Set.remove(setId);
      await this._refresh();
      wx.hideLoading();
      // 撤销 toast（5s 内可恢复）
      this._showUndo(undoData);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  _showUndo(undoData) {
    if (this._undoTimer) clearTimeout(this._undoTimer);
    this.setData({ undoVisible: true, undoData });
    this._undoTimer = setTimeout(() => {
      this.setData({ undoVisible: false, undoData: null });
    }, 5000);
  },

  async onUndoDelete() {
    const undo = this.data.undoData;
    this.setData({ undoVisible: false, undoData: null });
    if (this._undoTimer) clearTimeout(this._undoTimer);
    if (!undo) return;
    // 动作级删除：走动作恢复端点（只复活这次删除带走的组）
    if (undo.workoutExerciseId) {
      wx.showLoading({ title: '恢复中…' });
      try {
        await Session.restoreExercise(undo.sessionId, undo.workoutExerciseId);
        await this._refresh();
        wx.hideLoading();
        wx.showToast({ title: '已恢复', icon: 'success' });
      } catch (e) {
        wx.hideLoading();
        wx.showToast({ title: '恢复失败：' + ((e && e.message) || '请重试'), icon: 'none' });
      }
      return;
    }
    const ids = undo.setIds || [];
    const inputs = undo.setInputs || [];
    // 组级删除：优先走 restore 端点（软删恢复，保留原组序/PR）；未就绪或失败时回退为重新加组
    if (SETS_RESTORE_READY && ids.length) {
      wx.showLoading({ title: '恢复中…' });
      let restoredCount = 0;
      try {
        // 顺序恢复才能判断是否已有部分成功；部分成功或网络错误时绝不重新加组，避免重复数据。
        for (let i = 0; i < ids.length; i++) {
          await Set.restore(ids[i]);
          restoredCount += 1;
        }
        await this._refresh();
        wx.hideLoading();
        wx.showToast({ title: '已恢复', icon: 'success' });
        return;
      } catch (e) {
        wx.hideLoading();
        // 只有第一条即返回无信封 404（旧后端没有 restore 路由）才走重新加组。
        // 业务 404、超时或已有部分恢复都保留原状态并提示，避免不确定写入后再造一份。
        if (restoredCount > 0 || !e || e.code !== 'http_404') {
          await this._refresh();
          wx.showToast({ title: '恢复失败，请重试', icon: 'none' });
          return;
        }
      }
    }
    await this._reAddUndoGroups(undo, inputs);
  },

  async _reAddUndoGroups(undo, legacyInputs) {
    const groups = (undo.setGroups && undo.setGroups.length)
      ? undo.setGroups
      : (legacyInputs.length ? [{ exerciseName: undo.exerciseName, sets: legacyInputs }] : []);
    const sessionId = undo.sessionId || (this.data.session && this.data.session.id);
    if (!sessionId || !groups.length) return;

    wx.showLoading({ title: '恢复中…' });
    const createdIds = [];
    try {
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const result = await this._writeSets(sessionId, group.exerciseName, group.sets);
        const ids = (result && result.createdSetIds) || [];
        for (let j = 0; j < ids.length; j++) createdIds.push(ids[j]);
      }
      const lastGroup = groups[groups.length - 1];
      const nextData = { currentExerciseName: lastGroup.exerciseName };
      if (createdIds.length) nextData.lastRecordedSetId = createdIds[createdIds.length - 1];
      this.setData(nextData);
      await this._refresh();
      wx.hideLoading();
      wx.showToast({ title: '已恢复', icon: 'success' });
    } catch (e) {
      await this._refresh();
      wx.hideLoading();
      wx.showToast({ title: '恢复失败，请重试', icon: 'none' });
    }
  },

  _failToManual(exerciseName, sets, err) {
    const msg = (err && err.message) || '网络异常';
    wx.showModal({
      title: '记录失败',
      content: msg + '，是否改用手动加组（已保留输入）？',
      confirmText: '改用手动',
      success: (r) => {
        if (r.confirm) {
          const unit = this.data.unit;
          const rows = sets.map((s) => {
            const dw = displayWeight(s.weightKg, unit);
            return {
              weightInput: dw.value,
              reps: s.reps || 1,
              setTypeIndex: Math.max(0, SET_TYPE_KEYS.indexOf(s.setType || 'working')),
              loadTypeIndex: Math.max(0, LOAD_TYPE_KEYS.indexOf(s.loadType || 'weighted')),
            };
          });
          this.setData({
            showManual: true,
            manualExerciseName: exerciseName || this.data.currentExerciseName || '',
            manualRows: rows.length ? rows : [this._emptyManualRow()],
          });
        }
      },
    });
  },

  /* ---------------- 手动加组 ---------------- */

  _emptyManualRow() {
    return { weightInput: '', reps: 8, setTypeIndex: 1, loadTypeIndex: 0 };
  },

  openManual() {
    this.setData({
      showManual: true,
      manualExerciseName: this.data.currentExerciseName || '',
      manualRows: [this._emptyManualRow()],
    });
  },

  onManualClose() {
    this.setData({ showManual: false });
  },

  onManualPickExercise() {
    // 记下跳转意图作为兜底（选择器也会把 target 写回 storage，双保险、互不依赖页面状态/编译时序）
    this._pickTargetIntent = 'manual';
    wx.navigateTo({ url: '/pages/exercise-picker/exercise-picker?target=manual' });
  },

  onManualExerciseInput(e) {
    this.setData({ manualExerciseName: e.detail.value });
  },

  onManualWeight(e) {
    const i = e.currentTarget.dataset.index;
    this.setData({ [`manualRows[${i}].weightInput`]: e.detail.value });
  },
  onManualReps(e) {
    const i = e.currentTarget.dataset.index;
    this.setData({ [`manualRows[${i}].reps`]: e.detail.value });
  },
  onManualSetType(e) {
    const i = e.currentTarget.dataset.index;
    this.setData({ [`manualRows[${i}].setTypeIndex`]: Number(e.detail.value) });
  },
  onManualLoadType(e) {
    const i = e.currentTarget.dataset.index;
    this.setData({ [`manualRows[${i}].loadTypeIndex`]: Number(e.detail.value) });
  },
  onManualAddRow() {
    const rows = this.data.manualRows.slice();
    rows.push(this._emptyManualRow());
    this.setData({ manualRows: rows });
  },
  onManualDelRow(e) {
    const i = e.currentTarget.dataset.index;
    const rows = this.data.manualRows.slice();
    if (rows.length <= 1) return;
    rows.splice(i, 1);
    this.setData({ manualRows: rows });
  },

  async onManualSave() {
    const d = this.data;
    const name = (d.manualExerciseName || '').trim();
    if (!name) {
      wx.showToast({ title: '请选择/填写动作', icon: 'none' });
      return;
    }
    const sets = d.manualRows.map((r) => this._rowToSetInput(r));
    if (!this._validateSetInputs(sets)) return;
    this.setData({ showManual: false });
    await this._addSets(name, sets);
  },

  _applyPickedExercise(name, target) {
    // 优先按选择器带回的 target 路由（不依赖弹层显隐时序，避免回填漂移到「设为当前动作」）。
    if (target === 'manual') {
      this._pendingReplaceCardId = null;
      // 强制打开手动表单并回填（即便返回时 showManual 因时序被判 false，也能稳定回填）
      this.setData({ showManual: true, manualExerciseName: name });
      return;
    }
    if (target === 'replace') {
      const cardId = this._pendingReplaceCardId;
      this._pendingReplaceCardId = null;
      const card = cardId && this.data.cards.find((c) => c.id === cardId);
      if (card) this._replaceExercise(card, name);
      else this.setData({ currentExerciseName: name }); // 卡已不在则退化为设当前动作
      return;
    }
    // 兼容无 target（旧路径）：按当前打开的弹层回填
    if (this.data.showManual) {
      this._pendingReplaceCardId = null;
      this.setData({ manualExerciseName: name });
      return;
    }
    if (this.data.showConfirm) {
      this._pendingReplaceCardId = null;
      this.setData({ confirmExerciseName: name });
      return;
    }
    if (this._pendingReplaceCardId) {
      const cardId = this._pendingReplaceCardId;
      this._pendingReplaceCardId = null;
      const card = this.data.cards.find((c) => c.id === cardId);
      if (card) this._replaceExercise(card, name);
      return;
    }
    // 否则设为当前动作
    this.setData({ currentExerciseName: name });
    wx.showToast({ title: '当前动作：' + name, icon: 'none' });
  },

  /* ---------------- 编辑/删除单组 ---------------- */

  onCardEdit(e) {
    // ExerciseCard bindedit / 或点 set 行
    const cardId = e.currentTarget.dataset.cardId || (e.detail && e.detail.id);
    const card = this.data.cards.find((c) => c.id === cardId);
    if (card) this.setData({ currentExerciseName: card.name });
    // 展开该卡最后一组进编辑（简化：编辑最近一组）
    if (card && card.setList && card.setList.length) {
      this._openEditSet(card.setList[card.setList.length - 1]);
    }
  },

  /* ---------------- 动作级操作（换动作 / 删除整个动作） ---------------- */
  // 点动作卡主体 → 动作级菜单（徽标=编辑最近一组、组明细行=单组编辑/删除，职责区分）
  onCardTap(e) {
    const cardId = e.currentTarget.dataset.cardId || (e.detail && e.detail.id);
    const card = this.data.cards.find((c) => c.id === cardId);
    if (!card) return;
    wx.showActionSheet({
      itemList: ['换动作', '删除整个动作'],
      success: (r) => {
        if (r.tapIndex === 0) this._startReplaceExercise(card);
        else if (r.tapIndex === 1) this._confirmDeleteExercise(card);
      },
    });
  },

  // 换动作：去动作选择器挑新动作，返回后由 _applyPickedExercise 触发 _replaceExercise
  _startReplaceExercise(card) {
    this._pendingReplaceCardId = card.id;
    this._pickTargetIntent = 'replace';
    wx.navigateTo({ url: '/pages/exercise-picker/exercise-picker?target=replace' });
  },

  // 换动作 = 单次 PATCH 重新指向新动作（组 id 不变，后端原地改 + 重算 PR）
  async _replaceExercise(card, newName) {
    const name = (newName || '').trim();
    if (!name) return;
    if (name === card.name) {
      wx.showToast({ title: '与原动作相同', icon: 'none' });
      return;
    }
    if (!this.data.session) return;
    wx.showLoading({ title: '换动作中…' });
    try {
      await Session.replaceExercise(this.data.session.id, card.id, name);
      await this._refresh();
      this.setData({ currentExerciseName: name });
      wx.hideLoading();
      wx.showToast({ title: '已换为 ' + name, icon: 'success' });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '换动作失败：' + ((e && e.message) || '请重试'), icon: 'none' });
      await this._refresh();
    }
  },

  _confirmDeleteExercise(card) {
    const count = (card.setList || []).length;
    wx.showModal({
      title: '删除整个动作',
      content: '将删除「' + card.name + '」的全部 ' + count + ' 组，删除后可撤销。',
      confirmText: '删除',
      confirmColor: '#E8618C',
      success: (r) => { if (r.confirm) this._deleteExercise(card); },
    });
  },

  // 删除整个动作 = 单次 DELETE（软删该动作及其全部组）；撤销走动作恢复端点
  async _deleteExercise(card) {
    if (!this.data.session) return;
    const sessionId = this.data.session.id;
    wx.showLoading({ title: '删除中…' });
    try {
      await Session.deleteExercise(sessionId, card.id);
      await this._refresh();
      wx.hideLoading();
      this._showUndo({ sessionId, workoutExerciseId: card.id, text: '已删除该动作' });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '删除失败：' + ((e && e.message) || '请重试'), icon: 'none' });
      await this._refresh();
    }
  },

  onSetTap(e) {
    const cardIndex = e.currentTarget.dataset.cardIndex;
    const setIndex = e.currentTarget.dataset.setIndex;
    const card = this.data.cards[cardIndex];
    if (!card) return;
    const item = card.setList[setIndex];
    if (!item) return;
    wx.showActionSheet({
      itemList: ['编辑', '删除'],
      success: (r) => {
        if (r.tapIndex === 0) this._openEditSet(item);
        else if (r.tapIndex === 1) {
          const undo = {
            setIds: [item.id],
            exerciseName: card.name,
            setInputs: [this._rowToSetInputFromRaw(item.raw)],
            text: '已删除一组',
          };
          this._removeSet(item.id, undo);
        }
      },
    });
  },

  _rowToSetInputFromRaw(raw) {
    return setInputFromRaw(raw);
  },

  _openEditSet(item) {
    const raw = item.raw;
    const dw = displayWeight(raw.weightKg, this.data.unit);
    this.setData({
      showEditSet: true,
      editSet: {
        id: item.id,
        weightInput: dw.value,
        reps: raw.reps,
        setTypeIndex: Math.max(0, SET_TYPE_KEYS.indexOf(raw.setType || 'working')),
        loadTypeIndex: Math.max(0, LOAD_TYPE_KEYS.indexOf(raw.loadType || 'weighted')),
      },
    });
  },

  onEditWeight(e) { this.setData({ 'editSet.weightInput': e.detail.value }); },
  onEditReps(e) { this.setData({ 'editSet.reps': e.detail.value }); },
  onEditSetType(e) { this.setData({ 'editSet.setTypeIndex': Number(e.detail.value) }); },
  onEditLoadType(e) { this.setData({ 'editSet.loadTypeIndex': Number(e.detail.value) }); },
  onEditClose() { this.setData({ showEditSet: false, editSet: null }); },

  async onEditSave() {
    const es = this.data.editSet;
    if (!es) return;
    const body = this._rowToSetInput(es);
    if (!this._validateSetInputs([body])) return;
    this.setData({ showEditSet: false });
    await this._updateSet(es.id, body);
  },

  async onEditDelete() {
    const es = this.data.editSet;
    if (!es) return;
    this.setData({ showEditSet: false });
    // 找回原 card 名用于撤销
    let undo = null;
    this.data.cards.forEach((c) => {
      (c.setList || []).forEach((s) => {
        if (s.id === es.id) undo = { setIds: [s.id], exerciseName: c.name, setInputs: [this._rowToSetInputFromRaw(s.raw)], text: '已删除一组' };
      });
    });
    await this._removeSet(es.id, undo);
  },

  /* ---------------- 结束训练 ---------------- */

  onTapFinish() {
    if (!this.data.session) return;
    const totals = this._calcTotals(this.data.session);
    this.setData({
      showFinish: true,
      finishSummary: totals,
    });
  },

  onFinishCancel() {
    this.setData({ showFinish: false });
  },

  // 结束训练公共逻辑：finish → 收尾置空态 → 回调 then(sessionId)
  // 注意：收尾会清空 this.data.session，故先把 sessionId 存到局部变量。
  // 首次完赛后端会带 achievement：先播庆祝覆盖层，用户点「继续」(close)后再跳转；
  // 非首次（reward 为 null）保持原行为，直接跳转。
  async _finishSession(then) {
    const d = this.data;
    if (!d.session) return;
    if (d.submitting) return;
    const sessionId = d.session.id;
    this.setData({ submitting: true });
    wx.showLoading({ title: '结束中…' });
    try {
      const res = await Session.finish(sessionId);
      wx.hideLoading();
      this._clearTimer();
      // 首次完赛视图模型；非首次为 null。收尾会置空 session，故 reward 单独存 data。
      const reward = buildFinishReward(res && res.achievement);
      // 跳转闭包延后到动画关闭时执行（reward 为 null 时立即执行）
      this._afterReward = function (page) {
        if (typeof then === 'function') then(sessionId);
      };
      this.setData({ showFinish: false, phase: 'empty', session: null, cards: [], submitting: false });
      if (reward) {
        // 先存 reward 再开覆盖层，避免置空把动画数据弄丢；跳转放到 close 回调
        this.setData({ finishReward: reward, showReward: true });
      } else {
        this._runAfterReward();
      }
    } catch (e) {
      wx.hideLoading();
      this.setData({ submitting: false });
      wx.showToast({ title: '结束失败，请重试', icon: 'none' });
    }
  },

  // 覆盖层「继续」(close 事件)：关闭覆盖层并执行延后的跳转
  onRewardClose() {
    this.setData({ showReward: false });
    this._runAfterReward();
  },

  // 执行一次延后的跳转闭包（执行后清空，避免重复触发）
  _runAfterReward() {
    const fn = this._afterReward;
    this._afterReward = null;
    if (typeof fn === 'function') fn(this);
  },

  // 完成并生成分享图：结束后跳转分享图页（A 路新建，路由参数 id=sessionId）
  onFinishToShare() {
    this._finishSession((sessionId) => {
      wx.navigateTo({ url: '/pages/share-card/share-card?id=' + sessionId });
    });
  },

  // 完成训练：结束后进训练总结页（复用详情页作为总结页）
  onFinishToSummary() {
    this._finishSession((sessionId) => {
      wx.navigateTo({ url: '/pages/session-detail/session-detail?id=' + sessionId });
    });
  },

}, {
  title: '开练记录训练',
  path: '/pages/workout/workout',
}));
