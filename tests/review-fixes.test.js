const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');

function loadPageOptions(relativePath, stubs) {
  const filePath = path.join(projectRoot, relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  let pageOptions = null;
  const sandbox = {
    require(id) {
      if (Object.prototype.hasOwnProperty.call(stubs, id)) return stubs[id];
      throw new Error(`Unexpected require in ${relativePath}: ${id}`);
    },
    Page(options) { pageOptions = options; },
    getApp: stubs.__getApp || (() => ({ globalData: {}, isLoggedIn: () => true })),
    wx: stubs.__wx || {},
    setTimeout,
    clearTimeout,
    console,
  };
  vm.runInNewContext(source, sandbox, { filename: filePath });
  return pageOptions;
}

function createPage(pageOptions, data) {
  const page = Object.assign({}, pageOptions);
  page.data = Object.assign({}, pageOptions.data, data || {});
  page.setData = function (patch, callback) {
    Object.keys(patch).forEach((key) => {
      this.data[key] = patch[key];
    });
    if (callback) callback();
  };
  return page;
}

test('exercise picker converts 手臂 to the backend body part value', async () => {
  const calls = { list: null, create: null };
  const Exercise = {
    list: async (params) => { calls.list = params; return { items: [] }; },
    create: async (body) => { calls.create = body; return { exercise: { id: 'custom-1' } }; },
  };
  const exVM = require('../miniprogram/utils/exercise');
  const pageOptions = loadPageOptions('miniprogram/pages/exercise-picker/exercise-picker.js', {
    '../../service/api': { Exercise },
    '../../utils/constants': { BODY_PARTS: ['全部', '手臂'] },
    '../../utils/exercise': exVM,
    '../../mock/workout': { exercises: [] },
    '../../utils/share-page': { withSharePage: (options) => options },
    __wx: {
      showLoading() {},
      hideLoading() {},
    },
  });
  const page = createPage(pageOptions, {
    activePart: '手臂',
    keyword: '绳索弯举',
  });
  page._returnName = () => {};

  await page._load();
  await page.onCreate();

  assert.equal(calls.list.bodyPart, '臂');
  assert.equal(calls.create.bodyPart, '臂');
});

test('exercise picker mock fallback accepts either arm body part spelling', async () => {
  const exVM = require('../miniprogram/utils/exercise');
  const pageOptions = loadPageOptions('miniprogram/pages/exercise-picker/exercise-picker.js', {
    '../../service/api': { Exercise: { list: async () => { throw new Error('offline'); } } },
    '../../utils/constants': { BODY_PARTS: ['全部', '手臂'] },
    '../../utils/exercise': exVM,
    '../../mock/workout': {
      exercises: [
        { id: 'arm-1', name: '杠铃弯举', bodyPart: '臂' },
        { id: 'chest-1', name: '卧推', bodyPart: '胸' },
      ],
    },
    '../../utils/share-page': { withSharePage: (options) => options },
  });
  const page = createPage(pageOptions, { activePart: '手臂', keyword: '' });

  await page._load();

  assert.equal(page.data.items.length, 1);
  assert.equal(page.data.items[0].id, 'arm-1');
  assert.equal(page.data.usingMock, true);
});

test('normalizeReps rejects values that must not be silently saved as one rep', () => {
  const { normalizeReps } = require('../miniprogram/utils/data');

  assert.equal(normalizeReps('8'), 8);
  assert.equal(normalizeReps(1000), 1000);
  assert.equal(normalizeReps(''), null);
  assert.equal(normalizeReps('abc'), null);
  assert.equal(normalizeReps(0), null);
  assert.equal(normalizeReps(-1), null);
  assert.equal(normalizeReps(1.5), null);
  assert.equal(normalizeReps(1001), null);
});

test('all workout save paths validate normalized reps before writing', () => {
  const source = fs.readFileSync(
    path.join(projectRoot, 'miniprogram/pages/workout/workout.js'),
    'utf8'
  );

  assert.match(source, /reps: normalizeReps\(row\.reps\)/);
  assert.match(source, /if \(!this\._validateSetInputs\(\[body\]\)\) return;/);
  assert.match(source, /if \(!this\._validateSetInputs\(sets\)\) return;/);
  assert.match(source, /if \(!this\._validateSetInputs\(editedSets\)\) return;/);
  assert.doesNotMatch(source, /parseInt\(row\.reps, 10\) \|\| 1/);
});

test('stats page starts its first data load only once across onLoad and onShow', () => {
  const pageOptions = loadPageOptions('miniprogram/pages/stats/stats.js', {
    '../../service/api': { PR: {}, Stats: {} },
    '../../utils/constants': { BODY_PARTS: [], PART_TONE: {} },
    '../../utils/format': { formatVolume: String, formatMonthDay: String },
    '../../utils/auth': { getUser: () => ({ unitWeight: 'kg' }) },
    '../../utils/share-page': { withSharePage: (options) => options },
  });
  const page = createPage(pageOptions);
  let loadCount = 0;
  page.loadStats = () => { loadCount += 1; };

  page.onLoad();
  page.onShow();

  assert.equal(loadCount, 1);
});

test('stats page converts PR, day detail and trend volumes to lb', () => {
  const format = require('../miniprogram/utils/format');
  const pageOptions = loadPageOptions('miniprogram/pages/stats/stats.js', {
    '../../service/api': { PR: {}, Stats: {} },
    '../../utils/constants': { BODY_PARTS: [], PART_TONE: {} },
    '../../utils/format': format,
    '../../utils/auth': { getUser: () => ({ unitWeight: 'lb' }) },
    '../../utils/share-page': { withSharePage: (options) => options },
  });
  const page = createPage(pageOptions, { unit: 'lb', trendRange: 'week' });

  page.buildPr([{ id: 'pr-1', exerciseName: '卧推', value: 100, achievedAt: '2026-07-13' }]);
  page.applyDayDetail('2026-07-13', {
    totalVolumeKg: 1000,
    items: [{
      sessionId: 'session-1',
      exerciseName: '卧推',
      setCount: 3,
      topWeightKg: 50,
      volumeKg: 100,
    }],
  });
  page.applyTrend({ points: [{ volumeKg: 100, label: '上周' }, { volumeKg: 200, label: '本周' }] });

  assert.equal(page.data.prList[0].value, '220.5');
  assert.equal(page.data.prList[0].unit, 'lb');
  assert.match(page.data.dayDetail.items[0].summary, /110\.2 lb/);
  assert.equal(page.data.dayDetail.volumeText, '2.2k');
  assert.deepEqual(Array.from(page.data.trendPoints), [221, 441]);
});

test('stats page templates bind every displayed weight unit dynamically', () => {
  const source = fs.readFileSync(
    path.join(projectRoot, 'miniprogram/pages/stats/stats.wxml'),
    'utf8'
  );

  assert.doesNotMatch(source, />kg</);
  assert.doesNotMatch(source, /unit="kg"/);
  assert.equal((source.match(/\{\{unit\}\}/g) || []).length, 5);
});

test('project verification and CI run tests plus static package checks', () => {
  const packageJson = JSON.parse(fs.readFileSync(
    path.join(projectRoot, 'package.json'),
    'utf8'
  ));
  const checkSource = fs.readFileSync(
    path.join(projectRoot, 'scripts/check-project.js'),
    'utf8'
  );
  const ciSource = fs.readFileSync(
    path.join(projectRoot, '.github/workflows/ci.yml'),
    'utf8'
  );

  assert.equal(packageJson.scripts.check, 'node scripts/check-project.js');
  assert.equal(packageJson.scripts.verify, 'npm run check && npm test');
  assert.match(checkSource, /2 \* 1024 \* 1024/);
  assert.match(checkSource, /validateJavaScript/);
  assert.match(checkSource, /validateComponents/);
  assert.match(ciSource, /npm run verify/);
});

test('release config uses a stable base library without deprecated system info APIs', () => {
  const projectConfig = JSON.parse(fs.readFileSync(
    path.join(projectRoot, 'project.config.json'),
    'utf8'
  ));
  const sourceFiles = [
    'miniprogram/app.js',
    'miniprogram/utils/constants.js',
    'miniprogram/components/heatmap/index.js',
    'miniprogram/pages/share-card/share-card.js',
  ];
  const source = sourceFiles.map((file) => fs.readFileSync(
    path.join(projectRoot, file),
    'utf8'
  )).join('\n');

  assert.equal(projectConfig.libVersion, '3.15.2');
  assert.doesNotMatch(source, /getSystemInfo(?:Sync)?/);
});

test('filter chips avoid unsupported component scrollbar selectors', () => {
  const source = fs.readFileSync(
    path.join(projectRoot, 'miniprogram/components/filter-chips/index.wxss'),
    'utf8'
  );

  assert.doesNotMatch(source, /::-webkit-scrollbar/);
});
