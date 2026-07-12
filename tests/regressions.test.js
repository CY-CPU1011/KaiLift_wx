const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const {
  unwrapSessionDetail,
  findLatestSet,
  isResumedStart,
  setInputFromRaw,
  groupParsedSetsForUndo,
} = require('../miniprogram/utils/data');
const { buildHomeViewModelFromStats } = require('../miniprogram/utils/home-data');
const {
  buildShareViewModel,
  buildDurationText,
  buildDateText,
} = require('../miniprogram/utils/share-canvas');
const achievement = require('../miniprogram/utils/achievement');

function readJpegDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }

  throw new Error(`Unable to read JPEG dimensions: ${filePath}`);
}

function readPngRgba(filePath) {
  const buffer = fs.readFileSync(filePath);
  assert.equal(buffer.toString('hex', 0, 8), '89504e470d0a1a0a');
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === 'IHDR') {
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      bitDepth = buffer[dataStart + 8];
      colorType = buffer[dataStart + 9];
    } else if (type === 'IDAT') {
      idat.push(buffer.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }

  assert.equal(bitDepth, 8, `${filePath} should use 8-bit PNG channels`);
  assert.ok(colorType === 2 || colorType === 6, `${filePath} should be RGB or RGBA PNG`);

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rgba = Buffer.alloc(width * height * 4);
  let rawOffset = 0;
  let prev = Buffer.alloc(stride);

  function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }

  for (let y = 0; y < height; y++) {
    const filter = raw[rawOffset++];
    const line = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? line[x - channels] : 0;
      const up = prev[x] || 0;
      const upLeft = x >= channels ? prev[x - channels] : 0;
      const value = raw[rawOffset++];
      if (filter === 0) line[x] = value;
      else if (filter === 1) line[x] = (value + left) & 255;
      else if (filter === 2) line[x] = (value + up) & 255;
      else if (filter === 3) line[x] = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) line[x] = (value + paeth(left, up, upLeft)) & 255;
      else throw new Error(`Unsupported PNG filter ${filter}`);
    }
    for (let x = 0; x < width; x++) {
      const src = x * channels;
      const dst = (y * width + x) * 4;
      rgba[dst] = line[src];
      rgba[dst + 1] = line[src + 1];
      rgba[dst + 2] = line[src + 2];
      rgba[dst + 3] = channels === 4 ? line[src + 3] : 255;
    }
    prev = line;
  }
  return { width, height, rgba };
}

function alphaAt(png, x, y) {
  return png.rgba[(y * png.width + x) * 4 + 3];
}

test('unwrapSessionDetail returns the nested session object', () => {
  const session = { id: 'session-1', workoutExercises: [] };
  assert.equal(unwrapSessionDetail({ session }), session);
});

test('Session.detail exposes SessionDetail instead of the response envelope', async () => {
  const session = { id: 'session-1', workoutExercises: [] };
  let requestedCall = null;
  // 请求层已从 wx.cloud.callContainer 迁到 wx.request（打自管服务器），mock 随之对齐。
  global.wx = {
    getStorageSync: () => 'test-token',
    getDeviceInfo: () => ({ platform: 'devtools' }),
    request: (options) => {
      requestedCall = options;
      options.success({
        statusCode: 200,
        data: { ok: true, data: { session } },
      });
    },
  };
  delete require.cache[require.resolve('../miniprogram/utils/constants')];
  delete require.cache[require.resolve('../miniprogram/utils/request')];
  delete require.cache[require.resolve('../miniprogram/service/api')];
  const { Session } = require('../miniprogram/service/api');
  assert.deepEqual(await Session.detail('session-1'), session);
  assert.match(requestedCall.url, /\/api\/v1\/sessions\/session-1$/);
  assert.equal(requestedCall.method, 'GET');
  assert.equal(requestedCall.header.Authorization, 'Bearer test-token');
});

test('data utilities avoid array spread that requires Babel runtime helpers', () => {
  const source = fs.readFileSync(
    require.resolve('../miniprogram/utils/data'),
    'utf8'
  );
  assert.doesNotMatch(source, /items\.push\(\.\.\./);
});

test('voice undo data keeps sets grouped under their original exercises', () => {
  const groups = groupParsedSetsForUndo([
    { exercise_name: '深蹲', load_type: 'weighted', weight_kg: 100, reps: 5, set_type: 'working' },
    { exercise_name: '深蹲', load_type: 'weighted', weight_kg: 100, reps: 4, set_type: 'working' },
    { exercise_name: '卧推', load_type: 'weighted', weight_kg: 80, reps: 8, set_type: 'working' },
  ], '默认动作');

  assert.equal(groups.length, 2);
  assert.equal(groups[0].exerciseName, '深蹲');
  assert.deepEqual(groups[0].sets.map((set) => set.reps), [5, 4]);
  assert.equal(groups[1].exerciseName, '卧推');
  assert.equal(groups[1].sets[0].weightKg, 80);
});

test('findLatestSet prefers the last created server set id', () => {
  const cards = [
    { name: '深蹲', setList: [{ id: 'set-1' }, { id: 'set-3' }] },
    { name: '卧推', setList: [{ id: 'set-2' }] },
  ];
  assert.equal(findLatestSet(cards, '卧推', 'set-3').id, 'set-3');
});

test('findLatestSet falls back to the current exercise last set', () => {
  const cards = [
    { name: '深蹲', setList: [{ id: 'set-1' }, { id: 'set-3' }] },
    { name: '卧推', setList: [{ id: 'set-2' }] },
  ];
  assert.equal(findLatestSet(cards, '深蹲', null).id, 'set-3');
});

test('buildHomeViewModelFromStats maps the /stats/home payload into the home view model', () => {
  const now = new Date('2026-06-19T12:00:00+08:00');
  const data = {
    week: {
      sessionCount: 3,
      totalVolumeKg: 9200,
      totalDurationMin: 150,
      days: [
        { date: '2026-06-15', trained: true, isToday: false },
        { date: '2026-06-16', trained: false, isToday: false },
        { date: '2026-06-17', trained: true, isToday: false },
        { date: '2026-06-18', trained: true, isToday: false },
        { date: '2026-06-19', trained: false, isToday: true },
        { date: '2026-06-20', trained: false, isToday: false },
        { date: '2026-06-21', trained: false, isToday: false },
      ],
    },
    lastWorkout: {
      sessionId: 'sess-9', title: '推日', date: '2026-06-18',
      durationMin: 60, exerciseCount: 4, setCount: 12, totalVolumeKg: 5400,
    },
    monthTrainedDays: 7,
  };

  const vm = buildHomeViewModelFromStats(data, now);
  assert.equal(vm.monthDays, 7);
  assert.equal(vm.week.days.length, 7);
  assert.equal(vm.week.completed, 3);
  assert.equal(vm.week.days[4].isToday, true);
  assert.equal(vm.overview.count, 3);
  assert.equal(vm.overview.volume, 9200);
  assert.equal(vm.overview.durationHours, 2.5); // 150 分钟
  assert.equal(vm.lastWorkout.id, 'sess-9');
  assert.equal(vm.lastWorkout.empty, false);
  assert.equal(vm.lastWorkout.meta, '4 动作 · 12 组 · 5,400 kg');

  // 空响应：补 7 天空轨迹、零概览、最近训练空态
  const empty = buildHomeViewModelFromStats({}, now);
  assert.equal(empty.monthDays, 0);
  assert.equal(empty.week.days.length, 7);
  assert.equal(empty.overview.count, 0);
  assert.equal(empty.lastWorkout.empty, true);
});

test('isResumedStart detects backend single-active resume in either response shape', () => {
  assert.equal(isResumedStart(null), false);
  assert.equal(isResumedStart({ session: { id: 's1' } }), false);
  assert.equal(isResumedStart({ resumed: true, session: { id: 's1' } }), true);
  assert.equal(isResumedStart({ session: { id: 's1', resumed: true } }), true);
});

test('workout announces resume vs new start and guards repeat tab toasts', () => {
  const source = fs.readFileSync(
    require.resolve('../miniprogram/pages/workout/workout.js'),
    'utf8'
  );
  // 开始训练按 resumed 区分文案
  assert.match(
    source,
    /isResumedStart\(data\)\s*\?\s*'已恢复进行中的训练'\s*:\s*'新训练已开始'/
  );
  // 自动恢复仅在首次载入时提示，避免来回切 tab 重复弹
  assert.match(source, /const hadSession = !!this\.data\.session;/);
  assert.match(source, /if \(!hadSession\) \{[\s\S]*?已恢复进行中的训练/);
});

test('undo delete prefers the restore endpoint with a re-add fallback', () => {
  const apiSource = fs.readFileSync(
    require.resolve('../miniprogram/service/api.js'),
    'utf8'
  );
  assert.match(apiSource, /restore:\s*\(setId\)\s*=>/);
  assert.match(apiSource, /\/api\/v1\/sets\/\$\{setId\}\/restore/);

  const source = fs.readFileSync(
    require.resolve('../miniprogram/pages/workout/workout.js'),
    'utf8'
  );
  assert.match(source, /SETS_RESTORE_READY && ids\.length/);
  assert.match(source, /Set\.restore\(ids\[i\]\)/);
  assert.match(source, /restoredCount > 0 \|\| !e \|\| e\.code !== 'http_404'/);
  assert.match(source, /await this\._reAddUndoGroups\(undo, inputs\)/);
  assert.match(source, /undo\.setGroups && undo\.setGroups\.length/);
});

test('setInputFromRaw normalizes a WorkoutSet raw into write-ready SetInput', () => {
  assert.deepEqual(setInputFromRaw({ weightKg: 80, reps: 5, loadType: 'weighted', setType: 'working' }), {
    loadType: 'weighted',
    weightKg: 80,
    reps: 5,
    setType: 'working',
    rpe: null,
    note: null,
  });
  // 自重组：weightKg 缺省归一为 null；类型缺省回退
  assert.deepEqual(setInputFromRaw({ reps: 12 }), {
    loadType: 'weighted',
    weightKg: null,
    reps: 12,
    setType: 'working',
    rpe: null,
    note: null,
  });
});

test('exercise-level ops call the single WorkoutExercise endpoints (not multi-set composition)', () => {
  const wxml = fs.readFileSync(
    require.resolve('../miniprogram/pages/workout/workout.wxml'),
    'utf8'
  );
  // 动作卡主体可点 → onCardTap（原本是空绑定）
  assert.match(wxml, /<exercise-card[\s\S]*?bindtap="onCardTap"[\s\S]*?><\/exercise-card>/);

  const exerciseCardTemplate = fs.readFileSync(
    require.resolve('../miniprogram/components/exercise-card/index.wxml'),
    'utf8'
  );
  // 组件内部拦截原生 tap 后只发送一次自定义 tap，避免页面 ActionSheet 重复打开。
  assert.match(exerciseCardTemplate, /<view class="ec px-box" catchtap="onTap"/);
  assert.doesNotMatch(exerciseCardTemplate, /<view class="ec px-box" bindtap="onTap"/);

  const apiSource = fs.readFileSync(
    require.resolve('../miniprogram/service/api.js'),
    'utf8'
  );
  // 三个动作级封装，路径对齐 openapi
  assert.match(apiSource, /deleteExercise:[\s\S]*?\/api\/v1\/sessions\/\$\{sessionId\}\/exercises\/\$\{weId\}/);
  assert.match(apiSource, /restoreExercise:[\s\S]*?\/exercises\/\$\{weId\}\/restore/);
  assert.match(apiSource, /replaceExercise:[\s\S]*?\/exercises\/\$\{weId\}`,\s*\{ exerciseName \}/);

  const source = fs.readFileSync(
    require.resolve('../miniprogram/pages/workout/workout.js'),
    'utf8'
  );
  assert.match(source, /onCardTap\(e\)/);
  assert.match(source, /itemList:\s*\['换动作', '删除整个动作'\]/);
  // 删除整个动作 = 单次 DELETE；撤销 = 单次 restore
  assert.match(source, /await Session\.deleteExercise\(sessionId, card\.id\)/);
  assert.match(source, /await Session\.restoreExercise\(undo\.sessionId, undo\.workoutExerciseId\)/);
  // 换动作 = 单次 PATCH（组 id 不变）
  assert.match(source, /await Session\.replaceExercise\(this\.data\.session\.id, card\.id, name\)/);
  // 动作级删除不再前端逐组组合
  assert.doesNotMatch(source, /mapWithConcurrency\(ids, 3, \(id\) => Set\.remove/);
});

test('page backgrounds use aspectFit so the full scenery remains visible', () => {
  const backgroundPages = [
    'pages/exercise-picker/exercise-picker.wxml',
    'pages/home/home.wxml',
    'pages/profile/profile.wxml',
    'pages/session-detail/session-detail.wxml',
    'pages/stats/stats.wxml',
    'pages/workout/workout.wxml',
  ];

  backgroundPages.forEach((relativePath) => {
    const source = fs.readFileSync(
      require.resolve(`../miniprogram/${relativePath}`),
      'utf8'
    );
    assert.match(
      source,
      /<image class="[^"]*\bapp-bg\b[^"]*"[^>]+mode="aspectFit"/,
      `${relativePath} should display the complete background image`
    );
  });
});

test('tab pages lift the background above the fixed tab bar', () => {
  const tabPages = [
    'pages/home/home.wxml',
    'pages/profile/profile.wxml',
    'pages/stats/stats.wxml',
    'pages/workout/workout.wxml',
  ];
  const nonTabPages = [
    'pages/exercise-picker/exercise-picker.wxml',
    'pages/session-detail/session-detail.wxml',
  ];
  const appStyles = fs.readFileSync(
    require.resolve('../miniprogram/app.wxss'),
    'utf8'
  );

  tabPages.forEach((relativePath) => {
    const source = fs.readFileSync(
      require.resolve(`../miniprogram/${relativePath}`),
      'utf8'
    );
    assert.match(source, /class="app-bg app-bg--tab"/);
  });

  nonTabPages.forEach((relativePath) => {
    const source = fs.readFileSync(
      require.resolve(`../miniprogram/${relativePath}`),
      'utf8'
    );
    assert.doesNotMatch(source, /app-bg--tab/);
  });

  assert.match(
    appStyles,
    /\.app-bg--tab\s*\{[^}]*top:\s*auto[^}]*bottom:\s*calc\(100rpx \+ env\(safe-area-inset-bottom\)\)/s
  );
});

test('scene background includes an extended sky and matching page fallback color', () => {
  const backgroundPath = require.resolve(
    '../miniprogram/images/bg/background.jpg'
  );
  const dimensions = readJpegDimensions(backgroundPath);
  const tokens = fs.readFileSync(
    require.resolve('../miniprogram/styles/tokens.wxss'),
    'utf8'
  );
  const appStyles = fs.readFileSync(
    require.resolve('../miniprogram/app.wxss'),
    'utf8'
  );

  assert.ok(
    dimensions.height / dimensions.width >= 2.17,
    `background should have an extended portrait canvas, got ${dimensions.width}x${dimensions.height}`
  );
  assert.match(tokens, /--bg-scene:\s*#EEEFF1/i);
  assert.match(appStyles, /page\s*\{[^}]*background:\s*var\(--bg-scene\)/s);
});

test('home greeting places the enlarged date row below the capsule without an add button', () => {
  const template = fs.readFileSync(
    require.resolve('../miniprogram/components/page-header/index.wxml'),
    'utf8'
  );
  const styles = fs.readFileSync(
    require.resolve('../miniprogram/components/page-header/index.wxss'),
    'utf8'
  );
  const homeTemplate = fs.readFileSync(
    require.resolve('../miniprogram/pages/home/home.wxml'),
    'utf8'
  );
  const calendarIcon = require.resolve(
    '../miniprogram/images/ui/icons/ui_icon_calendar_header.png'
  );

  assert.match(template, /ph__bar--greeting/);
  assert.match(
    template,
    /<text class="ph__hello">\{\{name\}\}<\/text>\s*<view class="ph__date-row">/
  );
  assert.match(
    template,
    /<image class="ph__cal" src="\/images\/ui\/icons\/ui_icon_calendar_header\.png" mode="aspectFit"><\/image>\s*<text class="ph__date">\{\{dateText\}\}<\/text>/
  );
  assert.doesNotMatch(template, /ph__cal-top|ph__cal-body/);
  assert.doesNotMatch(template, /ph__add|actionAdd|bindtap="onAdd"/);
  assert.doesNotMatch(homeTemplate, /actionAdd/);
  assert.doesNotMatch(
    homeTemplate,
    /<page-header[\s\S]*?bindaction[\s\S]*?<\/page-header>/
  );
  assert.match(styles, /\.ph__bar\s*\{[^}]*padding:\s*var\(--sp-2\) var\(--sp-4\)/s);
  assert.match(styles, /\.ph__greeting\s*\{[^}]*flex-direction:\s*row/s);
  assert.match(styles, /\.ph__greeting\s*\{[^}]*align-items:\s*flex-end/s);
  assert.match(styles, /\.ph__greeting\s*\{[^}]*justify-content:\s*space-between/s);
  assert.match(styles, /\.ph__greeting\s*\{[^}]*min-height:\s*110rpx/s);
  assert.match(styles, /\.ph__greeting\s*\{[^}]*width:\s*100%/s);
  assert.match(styles, /\.ph__bar--greeting\s*\{[^}]*padding-top:\s*var\(--sp-5\)/s);
  assert.doesNotMatch(styles, /\.ph__date-row\s*\{[^}]*align-self:/s);
  assert.doesNotMatch(styles, /\.ph__date-row\s*\{[^}]*margin-top:/s);
  assert.match(styles, /\.ph__cal\s*\{[^}]*width:\s*40rpx[^}]*height:\s*40rpx/s);
  assert.doesNotMatch(styles, /\.ph__add/);
  assert.ok(fs.statSync(calendarIcon).size > 0);
});

test('review flow opens home first and defers profile authorization until user action', () => {
  const appJson = JSON.parse(fs.readFileSync(
    require.resolve('../miniprogram/app.json'),
    'utf8'
  ));
  const homeSource = fs.readFileSync(
    require.resolve('../miniprogram/pages/home/home.js'),
    'utf8'
  );
  const loginSource = fs.readFileSync(
    require.resolve('../miniprogram/pages/login/login.js'),
    'utf8'
  );
  const loginTemplate = fs.readFileSync(
    require.resolve('../miniprogram/pages/login/login.wxml'),
    'utf8'
  );
  const tabBarSource = fs.readFileSync(
    require.resolve('../miniprogram/custom-tab-bar/index.js'),
    'utf8'
  );
  const workoutSource = fs.readFileSync(
    require.resolve('../miniprogram/pages/workout/workout.js'),
    'utf8'
  );
  const statsSource = fs.readFileSync(
    require.resolve('../miniprogram/pages/stats/stats.js'),
    'utf8'
  );
  const profileSource = fs.readFileSync(
    require.resolve('../miniprogram/pages/profile/profile.js'),
    'utf8'
  );

  assert.equal(appJson.pages[0], 'pages/home/home');
  assert.doesNotMatch(homeSource, /reLaunch\(\{\s*url:\s*['"]\/pages\/login\/login['"]/);
  assert.doesNotMatch(workoutSource, /reLaunch\(\{\s*url:\s*['"]\/pages\/login\/login['"]/);
  assert.doesNotMatch(statsSource, /reLaunch\(\{\s*url:\s*['"]\/pages\/login\/login['"]/);
  assert.doesNotMatch(profileSource, /reLaunch\(\{\s*url:\s*['"]\/pages\/login\/login['"]/);
  assert.doesNotMatch(loginTemplate, /getPhoneNumber|chooseAvatar|type="nickname"/);
  assert.doesNotMatch(loginSource, /showProfile|onChooseAvatar|onNicknameChange|onCompleteProfile/);
  assert.doesNotMatch(tabBarSource, /\/pages\/login\/login\?redirect=/);
  assert.match(profileSource, /async onLogin\(\)/);
});

test('all miniprogram pages register share and copy-link behavior', () => {
  const appJson = JSON.parse(fs.readFileSync(require.resolve('../miniprogram/app.json'), 'utf8'));
  const helperPath = path.join(__dirname, '../miniprogram/utils/share-page.js');

  assert.ok(fs.existsSync(helperPath), 'share-page helper should exist');

  const { withSharePage, buildSharePath, buildCopyQuery } = require(helperPath);
  const page = withSharePage({
    data: { sessionId: 'sess-1' },
    onLoad(query) {
      this.loadedQuery = query;
    },
  }, {
    title: '训练分享图',
    path: '/pages/share-card/share-card',
    queryKeys: ['id'],
    copyQueryKeys: ['id'],
  });
  const ctx = { data: { sessionId: 'sess-1' } };

  page.onLoad.call(ctx, { id: 'sess-1' });
  assert.equal(buildSharePath('/pages/share-card/share-card', { id: 'sess-1' }), '/pages/share-card/share-card?id=sess-1');
  assert.equal(buildCopyQuery({ id: 'sess-1' }), 'id=sess-1');
  assert.deepEqual(ctx.loadedQuery, { id: 'sess-1' });
  assert.deepEqual(page.onShareAppMessage.call(ctx), {
    title: '训练分享图',
    path: '/pages/share-card/share-card?id=sess-1',
  });
  assert.deepEqual(page.onShareTimeline.call(ctx), {
    title: '训练分享图',
    query: 'id=sess-1',
  });
  assert.equal(typeof page.onLoad, 'function');
  assert.equal(typeof page.onShow, 'function');
  assert.equal(typeof page.onHide, 'function');
  assert.equal(typeof page.onUnload, 'function');

  appJson.pages.forEach((pagePath) => {
    const source = fs.readFileSync(require.resolve(`../miniprogram/${pagePath}.js`), 'utf8');
    assert.match(source, /require\(['"]\.\.\/\.\.\/utils\/share-page['"]\)/, `${pagePath} should import share-page`);
    assert.match(source, /Page\(\s*withSharePage\(/, `${pagePath} should wrap Page options with withSharePage`);
  });
});

test('week tracker completed days always use the black pixel border', () => {
  const styles = fs.readFileSync(
    require.resolve('../miniprogram/components/week-tracker/index.wxss'),
    'utf8'
  );
  const todayRuleIndex = styles.indexOf('.wt__cell--today');
  const doneRuleIndex = styles.indexOf('.wt__cell--done');

  assert.ok(todayRuleIndex >= 0);
  assert.ok(doneRuleIndex > todayRuleIndex);
  assert.match(
    styles,
    /\.wt__cell--done\s*\{[^}]*background:\s*var\(--c-primary\)[^}]*border-color:\s*var\(--c-ink\)/s
  );
});

test('heatmap passes training levels through an explicit levelMap property', () => {
  const pageTemplate = fs.readFileSync(
    require.resolve('../miniprogram/pages/stats/stats.wxml'),
    'utf8'
  );
  const componentTemplate = fs.readFileSync(
    require.resolve('../miniprogram/components/heatmap/index.wxml'),
    'utf8'
  );
  const componentSource = fs.readFileSync(
    require.resolve('../miniprogram/components/heatmap/index.js'),
    'utf8'
  );

  assert.match(pageTemplate, /<heatmap[^>]*level-map="\{\{heatmapData\}\}"/);
  assert.match(componentSource, /levelMap:\s*\{\s*type:\s*Object/);
  assert.match(componentSource, /this\.data\.levelMap/);
  assert.doesNotMatch(componentSource, /^\s*data:\s*\{\s*type:\s*Object/m);
  assert.match(componentTemplate, /scroll-left="\{\{scrollLeft\}\}"/);
  assert.match(componentSource, /currentMonthColumn\(months\)/);
  assert.match(componentSource, /scrollToCurrentMonth\(months\)/);
  assert.match(componentSource, /WEEK_COL_STEP_RPX/);
});

test('stat cards fill the stretched overview row height', () => {
  const styles = fs.readFileSync(
    require.resolve('../miniprogram/components/stat-card/index.wxss'),
    'utf8'
  );

  assert.match(
    styles,
    /\.sc\s*\{[^}]*height:\s*100%/s,
    'the card root should fill the equal-height custom component host'
  );
  assert.match(
    styles,
    /\.sc__icon-img\s*\{[^}]*display:\s*block/s,
    'image icons should not add inline baseline space'
  );
});

test('month-days banner follows the reference layout with framed hero, divider, progress and CTA', () => {
  const template = fs.readFileSync(
    require.resolve('../miniprogram/components/streak-banner/index.wxml'),
    'utf8'
  );
  const styles = fs.readFileSync(
    require.resolve('../miniprogram/components/streak-banner/index.wxss'),
    'utf8'
  );

  assert.match(template, /class="sb__hero-frame"/);
  assert.match(template, /class="sb__divider"/);
  assert.match(template, /class="sb__progress"/);
  assert.match(template, /class="sb__cta"[^>]*bindtap="onAction"/);
  assert.match(template, /ui_icon_arrow_right\.png/);
  assert.match(template, />本月打卡战绩<\/text>/);
  assert.match(template, />已坚持训练<\/text>/);
  assert.match(template, />下一关，出发！<\/text>/);
  assert.match(styles, /\.sb__banner\s*\{[^}]*min-height:\s*260rpx/s);
  assert.match(styles, /\.sb__hero-frame\s*\{[^}]*width:\s*210rpx/s);
  assert.match(styles, /\.sb__hero-frame\s*\{[^}]*border:\s*4rpx solid/s);
  assert.match(styles, /\.sb__content\s*\{[^}]*flex:\s*1/s);
  assert.match(styles, /\.sb__header\s*\{[^}]*justify-content:\s*center/s);
  assert.match(styles, /\.sb__divider\s*\{[^}]*border-top:\s*4rpx dashed/s);
  assert.match(styles, /\.sb__progress\s*\{[^}]*justify-content:\s*center/s);
  assert.match(styles, /\.sb__cta\s*\{[^}]*justify-content:\s*center/s);
  assert.match(styles, /\.sb__cta\s*\{[^}]*position:\s*relative/s);
  assert.match(styles, /\.sb__cta-arrow\s*\{[^}]*position:\s*absolute/s);
  assert.match(styles, /\.sb__cta\s*\{[^}]*box-shadow:\s*4rpx 6rpx/s);
});

test('production API disables direct openid login even in DevTools', () => {
  global.wx = {
    getDeviceInfo: () => ({ platform: 'devtools' }),
    getSystemInfoSync: () => ({ platform: 'devtools' }),
  };
  delete require.cache[require.resolve('../miniprogram/utils/constants')];
  const constants = require('../miniprogram/utils/constants');
  assert.equal(constants.DEV_LOGIN, false);
  assert.equal(constants.DEV_OPENID, '');
  assert.equal(constants.SHARE_QR_ENV, 'release');
  assert.equal(constants.isLocalDevelopmentApi('http://127.0.0.1:20020'), true);
  assert.equal(constants.isLocalDevelopmentApi('http://192.168.1.7:20020'), true);
  assert.equal(constants.isLocalDevelopmentApi('https://kailift.chenyi.uno'), false);

  global.wx = {
    getDeviceInfo: () => ({ platform: 'ios' }),
    getSystemInfoSync: () => ({ platform: 'ios' }),
  };
  delete require.cache[require.resolve('../miniprogram/utils/constants')];
  assert.equal(require('../miniprogram/utils/constants').DEV_LOGIN, false);
});

test('login request never retries the same one-time wx code', () => {
  const source = fs.readFileSync(
    require.resolve('../miniprogram/utils/request.js'),
    'utf8'
  );
  assert.match(source, /const idempotent = method === 'GET';/);
  assert.doesNotMatch(source, /isLoginPath/);
  assert.match(source, /sc === 503 && idempotent && within\(\)/);
});

test('profile overview uses the lifetime aggregate instead of per-session details', () => {
  const source = fs.readFileSync(
    require.resolve('../miniprogram/pages/profile/profile.js'),
    'utf8'
  );
  assert.match(source, /const \{ Achievement, Stats \} = require/);
  assert.match(source, /await Stats\.lifetime\(\)/);
  assert.doesNotMatch(source, /Session\.detail|mapWithConcurrency|listAllPages/);
});

test('modify-last-set confirmation sends the exact displayed target set id', () => {
  const workoutSource = fs.readFileSync(
    require.resolve('../miniprogram/pages/workout/workout.js'),
    'utf8'
  );
  const apiSource = fs.readFileSync(
    require.resolve('../miniprogram/service/api.js'),
    'utf8'
  );
  assert.match(workoutSource, /modifyTargetSetId: last\.id/);
  assert.match(
    workoutSource,
    /targetSetId: d\.confirmIntent === 'modify_last_set' \? d\.modifyTargetSetId : undefined/
  );
  assert.match(apiSource, /targetSetId\?/);
});

test('obsolete local voice parser and confidence constant are removed', () => {
  assert.equal(
    fs.existsSync(path.join(__dirname, '../miniprogram/utils/voice-parser.js')),
    false
  );
  const constantsSource = fs.readFileSync(
    require.resolve('../miniprogram/utils/constants.js'),
    'utf8'
  );
  assert.doesNotMatch(constantsSource, /AUTO_SAVE_CONFIDENCE/);
});

test('CloudBase container config points at the deployed kailift service', () => {
  global.wx = {
    getDeviceInfo: () => ({ platform: 'devtools' }),
    getSystemInfoSync: () => ({ platform: 'devtools' }),
  };
  delete require.cache[require.resolve('../miniprogram/utils/constants')];
  const constants = require('../miniprogram/utils/constants');
  assert.equal(constants.CLOUD_ENV, 'prod-d2gk135v6be9ec84f');
  assert.equal(constants.CLOUD_SERVICE, 'kailift');
});

/* ========== 第 7 轮：训练后反馈与分享图（PRD §3.6/§3.7） ========== */

// 一次「深蹲(最佳组 100×5=500) + 卧推(最佳组 80×8=640) + 引体(自重×12)」的训练，
// 已完成、用时 75 分钟。
function sampleShareSession() {
  return {
    id: 'sess-1',
    status: 'completed',
    startedAt: '2026-06-19T10:00:00+08:00',
    finishedAt: '2026-06-19T11:15:00+08:00',
    totalExercises: 3,
    totalSets: 6,
    totalVolumeKg: 3140,
    workoutExercises: [
      {
        id: 'we-1', displayName: '深蹲',
        sets: [
          { id: 's1', reps: 5, weightKg: 100, loadType: 'weighted', setType: 'working' },
          { id: 's2', reps: 8, weightKg: 60, loadType: 'weighted', setType: 'warmup' },
        ],
      },
      {
        id: 'we-2', displayName: '卧推',
        sets: [
          { id: 's3', reps: 8, weightKg: 80, loadType: 'weighted', setType: 'working' },
        ],
      },
      {
        id: 'we-3', displayName: '引体向上',
        sets: [
          { id: 's4', reps: 12, weightKg: null, loadType: 'bodyweight', setType: 'working' },
        ],
      },
    ],
  };
}

test('buildShareViewModel returns a fixed share payload shape with ordered stats', () => {
  const vm = buildShareViewModel({
    session: sampleShareSession(),
    prs: [],
    monthDays: 6,
    unit: 'kg',
  });
  assert.equal(vm.brand, '开练 KaiLift');
  assert.equal(vm.headline, '今日训练完成');
  assert.equal(vm.slogan, 'Say the set. Keep the log.');
  assert.equal(vm.dateText, '2026年6月19日');
  assert.equal(vm.durationText, '1 小时 15 分');
  // 四项核心数据，顺序固定：时长/动作/组数/容量
  assert.deepEqual(vm.stats.map((s) => s.label), ['时长', '动作', '组数', '容量']);
  assert.equal(vm.stats[1].value, 3);
  assert.equal(vm.stats[2].value, 6);
});

test('buildShareViewModel ranks main exercises by best-set volume and formats best set', () => {
  const vm = buildShareViewModel({
    session: sampleShareSession(),
    prs: [],
    monthDays: 0,
    unit: 'kg',
  });
  // 卧推最佳组容量 640 > 深蹲 500 > 引体(自重计 0)
  assert.deepEqual(vm.mainExercises.map((e) => e.name), ['卧推', '深蹲', '引体向上']);
  assert.equal(vm.mainExercises[0].bestSetText, '80kg × 8');
  assert.equal(vm.mainExercises[1].bestSetText, '100kg × 5');
  // 自重动作不报错、不写重量
  assert.equal(vm.mainExercises[2].bestSetText, '自重 × 12');
});

test('buildShareViewModel caps main exercises at five', () => {
  const wes = [];
  for (let i = 0; i < 7; i++) {
    wes.push({
      id: 'we-' + i, displayName: '动作' + i,
      sets: [{ id: 's-' + i, reps: 5, weightKg: 50 + i, loadType: 'weighted', setType: 'working' }],
    });
  }
  const vm = buildShareViewModel({ session: { workoutExercises: wes }, unit: 'kg' });
  assert.equal(vm.mainExercises.length, 5);
  // 重量最大者排首位
  assert.equal(vm.mainExercises[0].name, '动作6');
});

test('buildShareViewModel incentive shows the month-trained day count', () => {
  const some = buildShareViewModel({
    session: sampleShareSession(),
    monthDays: 7,
    unit: 'kg',
  });
  assert.equal(some.incentive, '本月已训练 7 天');

  // 缺省 / 无数据时归零，不报错
  const zero = buildShareViewModel({
    session: sampleShareSession(),
    unit: 'kg',
  });
  assert.equal(zero.incentive, '本月已训练 0 天');
});

test('buildDurationText handles minutes, hours and invalid spans', () => {
  assert.equal(buildDurationText('2026-06-19T10:00:00Z', '2026-06-19T10:45:00Z'), '45 分钟');
  assert.equal(buildDurationText('2026-06-19T10:00:00Z', '2026-06-19T12:00:00Z'), '2 小时');
  assert.equal(buildDurationText('2026-06-19T10:00:00Z', '2026-06-19T11:30:00Z'), '1 小时 30 分');
  assert.equal(buildDurationText(null, '2026-06-19T11:00:00Z'), '—');
  assert.equal(buildDurationText('2026-06-19T11:00:00Z', '2026-06-19T10:00:00Z'), '—');
});

test('buildDateText formats as YYYY年M月D日 and is safe on invalid input', () => {
  assert.equal(buildDateText('2026-06-19T10:00:00+08:00'), '2026年6月19日');
  assert.equal(buildDateText('not-a-date'), '');
});

test('share-canvas avoids array spread that requires Babel runtime helpers', () => {
  const source = fs.readFileSync(
    require.resolve('../miniprogram/utils/share-canvas'),
    'utf8'
  );
  assert.doesNotMatch(source, /\.\.\.[a-zA-Z_$]/);
  assert.doesNotMatch(source, /const\s*\[/);
});

test('share-card poster left-aligns the date above the QR code bottom', () => {
  const source = fs.readFileSync(
    require.resolve('../miniprogram/pages/share-card/share-card.js'),
    'utf8'
  );
  assert.match(source, /const LY_BRAND_TOP = 40;/);
  assert.match(source, /const LY_BRAND_BOX_H = 72;/);
  assert.match(source, /const LY_BRAND_TEXT_BASELINE = 49;/);
  assert.match(source, /const LY_HEADLINE_BASELINE = 168;/);
  assert.match(source, /const BRAND_FONT_SIZE = 34;/);
  assert.match(source, /const BRAND_PAD_X = 28;/);
  assert.match(source, /const FOOTER_TITLE_OFFSET_Y = 32;/);
  assert.match(source, /const FOOTER_SLOGAN_OFFSET_Y = 68;/);
  assert.match(source, /const FOOTER_DATE_BOTTOM_GAP = 12;/);
  assert.match(source, /const DATE_FONT_SIZE = 20;/);
  assert.match(source, /ctx\.fillText\('扫码一起开练', textX, codeY \+ FOOTER_TITLE_OFFSET_Y\);/);
  assert.match(source, /ctx\.fillText\(vm\.slogan, textX, codeY \+ FOOTER_SLOGAN_OFFSET_Y\);/);
  assert.match(source, /ctx\.fillText\(vm\.dateText, textX, codeY \+ codeSize - FOOTER_DATE_BOTTOM_GAP\);/);
});

test('share-card page is registered and finish dialog routes to share/summary', () => {
  const appJson = JSON.parse(fs.readFileSync(
    require.resolve('../miniprogram/app.json'),
    'utf8'
  ));
  assert.ok(appJson.pages.indexOf('pages/share-card/share-card') >= 0);

  const workout = fs.readFileSync(
    require.resolve('../miniprogram/pages/workout/workout.js'),
    'utf8'
  );
  // §3.6 完成并生成分享图 → 分享图页；完成训练 → 总结页（复用详情页）
  assert.match(workout, /onFinishToShare/);
  assert.match(workout, /\/pages\/share-card\/share-card\?id=/);
  assert.match(workout, /onFinishToSummary/);
});

const sampleAchievements = {
  exp: 16550,
  level: {
    level: 18, exp: 16550, levelStartExp: 15300, levelSpanExp: 1800,
    expIntoLevel: 1250, isMax: false,
  },
  rank: {
    tier: { key: 'bronze', name: '青铜', minLevel: 10, color: '#B87333', icon: 'badges/ranks/bronze.png' },
    next: { key: 'silver', name: '白银', minLevel: 20, color: '#9AA7B4', icon: 'badges/ranks/silver.png' },
    levelsToNext: 2,
  },
  unlockedCount: 7,
  totalCount: 23,
  categories: [
    {
      key: 'milestone', label: '里程碑', items: [
        { key: 'first_workout', title: '首次开练', desc: '完成第一次训练', icon: 'badges/first-workout.png', threshold: 1, current: 18, unlocked: true, unlockedAt: '2026-05-01T10:00:00.000Z' },
      ],
    },
    {
      key: 'pr', label: '破纪录', items: [
        { key: 'pr_5', title: '破壁者', desc: '累计破纪录5次', icon: 'badges/pr-5.png', threshold: 5, current: 3, unlocked: false, unlockedAt: null },
      ],
    },
    {
      key: 'fun', label: '趣味', items: [
        { key: 'volume_burst', title: '容量爆表', desc: '单次≥8000kg', icon: 'badges/volume-burst.png', threshold: 8000, current: 3470.6, unlocked: false, unlockedAt: null },
      ],
    },
  ],
};

test('levelPercent uses expIntoLevel/levelSpanExp and saturates at max level', () => {
  assert.equal(achievement.levelPercent({ expIntoLevel: 1250, levelSpanExp: 1800, isMax: false }), 69);
  assert.equal(achievement.levelPercent({ isMax: true }), 100);
  // 满级 levelSpanExp=0 不能除零
  assert.equal(achievement.levelPercent({ expIntoLevel: 0, levelSpanExp: 0, isMax: false }), 0);
});

test('rank display maps backend tiers to the new ordered badge names and local assets', () => {
  const ladder = [
    { key: 'iron', name: '生铁', minLevel: 1, color: '#66717A' },
    { key: 'bronze', name: '青铜', minLevel: 10, color: '#B87333' },
    { key: 'silver', name: '白银', minLevel: 20, color: '#9AA7B4' },
    { key: 'gold', name: '黄金', minLevel: 30, color: '#D6A11D' },
    { key: 'platinum', name: '铂金', minLevel: 45, color: '#74C7C8' },
    { key: 'diamond', name: '钻石', minLevel: 60, color: '#5B8DEF' },
    { key: 'grandmaster', name: '宗师', minLevel: 75, color: '#9B5DE5' },
    { key: 'legend', name: '传奇', minLevel: 90, color: '#F15BB5' },
  ];
  const vm = achievement.buildLadder(ladder, 'gold');

  assert.deepEqual(vm.map((r) => r.name), ['初启', '自律', '强健', '精进', '突破', '淬炼', '登峰', '传奇']);
  assert.deepEqual(vm.map((r) => r.icon), [
    '/images/badges/ranks/chuqi.png',
    '/images/badges/ranks/zilv.png',
    '/images/badges/ranks/qiangjian.png',
    '/images/badges/ranks/jingjin.png',
    '/images/badges/ranks/tupo.png',
    '/images/badges/ranks/cuilian.png',
    '/images/badges/ranks/dengfeng.png',
    '/images/badges/ranks/chuanqi.png',
  ]);
  assert.equal(vm[3].isCurrent, true);
  assert.equal(achievement.buildRankCard(sampleAchievements.rank).name, '自律');
  assert.equal(achievement.buildRankCard(sampleAchievements.rank).nextText, '距强健还差2级');
  assert.equal(achievement.resolveRankIcon({ key: 'legend' }), '/images/badges/ranks/chuanqi.png');
  // 未知段位兜底到现有切图，不返回不存在的真图路径
  assert.equal(achievement.resolveRankIcon({ key: 'mythic' }), '/images/badges/badge_medal_bronze_flame.png');
});

test('rank badge assets have transparent outer backgrounds', () => {
  const files = [
    'chuqi.png',
    'zilv.png',
    'qiangjian.png',
    'jingjin.png',
    'tupo.png',
    'cuilian.png',
    'dengfeng.png',
    'chuanqi.png',
  ];
  files.forEach((file) => {
    const png = readPngRgba(path.join(__dirname, '..', 'miniprogram', 'images', 'badges', 'ranks', file));
    assert.equal(png.width, 220);
    assert.equal(png.height, 220);
    assert.equal(alphaAt(png, 0, 0), 0, `${file} top-left should be transparent`);
    assert.equal(alphaAt(png, png.width - 1, 0), 0, `${file} top-right should be transparent`);
    assert.equal(alphaAt(png, 0, png.height - 1), 0, `${file} bottom-left should be transparent`);
    assert.equal(alphaAt(png, png.width - 1, png.height - 1), 0, `${file} bottom-right should be transparent`);
  });
});

test('rank cards render the new badge art without overlaying level numbers', () => {
  const profileTemplate = fs.readFileSync(
    require.resolve('../miniprogram/pages/profile/profile.wxml'),
    'utf8'
  );
  const achievementsTemplate = fs.readFileSync(
    require.resolve('../miniprogram/pages/achievements/achievements.wxml'),
    'utf8'
  );

  assert.doesNotMatch(profileTemplate, /pc__trophy-num/);
  assert.doesNotMatch(achievementsTemplate, /ac-card__medal-num/);
});

test('progressText shows current/threshold only for locked multi-step achievements', () => {
  // 已解锁不显示进度
  assert.equal(achievement.progressText({ unlocked: true, threshold: 5, current: 5 }), '');
  // 一次性成就(threshold<=1)只锁定态，不显示进度
  assert.equal(achievement.progressText({ unlocked: false, threshold: 1, current: 0 }), '');
  // 多步成就显示进度，浮点 current 取整
  assert.equal(achievement.progressText({ unlocked: false, threshold: 5, current: 3 }), '3/5');
  assert.equal(achievement.progressText({ unlocked: false, threshold: 8000, current: 3470.6 }), '3471/8000');
});

test('buildRankCard exposes next-rank text and hides it at max rank', () => {
  const card = achievement.buildRankCard(sampleAchievements.rank);
  assert.equal(card.icon, '/images/badges/ranks/zilv.png');
  assert.equal(card.isMaxRank, false);
  assert.equal(card.nextText, '距强健还差2级');
  const maxCard = achievement.buildRankCard({ tier: { key: 'legend', name: '传奇' }, next: null, levelsToNext: 0 });
  assert.equal(maxCard.isMaxRank, true);
  assert.equal(maxCard.nextText, '');
});

test('buildAchievementsViewModel keeps backend category order and resolved per-badge fields', () => {
  const vm = achievement.buildAchievementsViewModel(sampleAchievements);
  assert.equal(vm.level.lv, 18);
  assert.equal(vm.level.percent, 69);
  assert.equal(vm.unlockedCount, 7);
  assert.equal(vm.totalCount, 23);
  // 顺序即后端给定顺序
  assert.deepEqual(vm.categories.map((c) => c.key), ['milestone', 'pr', 'fun']);
  // 未解锁多步成就带进度文案
  assert.equal(vm.categories[1].items[0].progressText, '3/5');
  assert.equal(vm.categories[2].items[0].progressText, '3471/8000');
  // 解锁成就不带进度
  assert.equal(vm.categories[0].items[0].unlocked, true);
  assert.equal(vm.categories[0].items[0].progressText, '');
});

test('buildProfilePreview caps badges and surfaces unlocked ones first', () => {
  const preview = achievement.buildProfilePreview(sampleAchievements, 2);
  assert.equal(preview.previewBadges.length, 2);
  // 已解锁优先排前
  assert.equal(preview.previewBadges[0].key, 'first_workout');
  assert.equal(preview.unlockedCount, 7);
  assert.equal(preview.totalCount, 23);
});

test('buildFinishReward returns null without an achievement field and normalizes when present', () => {
  // 非首次完赛(无 achievement)：不放动画
  assert.equal(achievement.buildFinishReward(undefined), null);
  assert.equal(achievement.buildFinishReward(null), null);

  const reward = achievement.buildFinishReward({
    expGained: 740,
    trickleBreakdown: { base: 300, volume: 440, pr: 0 },
    level: { level: 18, levelStartExp: 15300, levelSpanExp: 1800, expIntoLevel: 1250, isMax: false, before: 17, isLevelUp: true },
    rank: { tier: { key: 'bronze', name: '青铜' }, next: { key: 'silver', name: '白银' }, levelsToNext: 2, beforeKey: 'bronze', isPromotion: false },
    unlocked: [{ key: 'streak_4', title: '一月坚持', icon: 'badges/streak-4.png', category: 'streak' }],
  });
  assert.equal(reward.expGained, 740);
  assert.equal(reward.isLevelUp, true);
  assert.equal(reward.levelBefore, 17);
  assert.equal(reward.levelAfter, 18);
  assert.equal(reward.afterPercent, 69);
  assert.equal(reward.isPromotion, false);
  assert.equal(reward.unlocked.length, 1);
  // 解锁成就 art 已解析为本地占位切图（真图未到）
  assert.match(reward.unlocked[0].art, /\/images\/badges\//);
});
