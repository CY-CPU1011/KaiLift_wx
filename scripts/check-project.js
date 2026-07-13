const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const miniprogramRoot = path.join(projectRoot, 'miniprogram');
const maxMiniprogramBytes = 2 * 1024 * 1024;
const issues = [];

function walk(dir) {
  const files = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push.apply(files, walk(target));
    else files.push(target);
  });
  return files;
}

function report(filePath, message) {
  issues.push(path.relative(projectRoot, filePath) + ': ' + message);
}

function parseJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    report(filePath, 'JSON 无法解析：' + error.message);
    return null;
  }
}

function validateJavaScript(filePath) {
  try {
    new vm.Script(fs.readFileSync(filePath, 'utf8'), { filename: filePath });
  } catch (error) {
    report(filePath, 'JavaScript 语法错误：' + error.message);
  }
}

function validatePageFiles(appConfig) {
  (appConfig.pages || []).forEach((pagePath) => {
    ['.js', '.json', '.wxml', '.wxss'].forEach((extension) => {
      const filePath = path.join(miniprogramRoot, pagePath + extension);
      if (!fs.existsSync(filePath)) report(filePath, 'app.json 注册页面缺少文件');
    });
  });
}

function resolveComponentPath(configPath, componentPath) {
  if (componentPath.charAt(0) === '/') {
    return path.join(miniprogramRoot, componentPath.slice(1));
  }
  return path.resolve(path.dirname(configPath), componentPath);
}

function validateComponents(configPath, config) {
  const components = (config && config.usingComponents) || {};
  Object.keys(components).forEach((name) => {
    const componentPath = components[name];
    if (!componentPath || componentPath.indexOf('://') >= 0) return;
    const target = resolveComponentPath(configPath, componentPath);
    ['.js', '.json', '.wxml', '.wxss'].forEach((extension) => {
      const filePath = target + extension;
      if (!fs.existsSync(filePath)) report(configPath, '组件 ' + name + ' 缺少 ' + filePath);
    });
  });
}

const files = walk(miniprogramRoot);
let totalBytes = 0;
files.forEach((filePath) => {
  totalBytes += fs.statSync(filePath).size;
  if (filePath.endsWith('.js')) validateJavaScript(filePath);
  if (filePath.endsWith('.json')) {
    const config = parseJson(filePath);
    if (config) validateComponents(filePath, config);
  }
});

const appConfigPath = path.join(miniprogramRoot, 'app.json');
const appConfig = parseJson(appConfigPath);
if (appConfig) validatePageFiles(appConfig);

const projectConfigPath = path.join(projectRoot, 'project.config.json');
const projectConfig = parseJson(projectConfigPath);
if (projectConfig) {
  if (projectConfig.miniprogramRoot !== 'miniprogram/') {
    report(projectConfigPath, 'miniprogramRoot 必须保持为 miniprogram/');
  }
  if (projectConfig.cloudfunctionRoot || projectConfig.cloudfunctionTemplateRoot) {
    report(projectConfigPath, '单一 REST 架构不应配置云函数发布目录');
  }
}

if (totalBytes > maxMiniprogramBytes) {
  report(miniprogramRoot, '原始主包体积超过 2 MiB 预算：' + totalBytes + ' bytes');
}

if (issues.length) {
  console.error(issues.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    '项目静态检查通过：' + files.length + ' 个文件，主包原始体积 ' + totalBytes + ' / ' + maxMiniprogramBytes + ' bytes'
  );
}
