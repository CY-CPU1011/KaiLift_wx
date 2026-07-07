// 图片资源根地址集中配置（design §7.3），方便切本地/远程 CDN。
// 占位阶段所有 3D 素材走 components/img-ph 占位，不依赖真实文件。
module.exports = {
  // 真图就位后改成 CDN 根，并把约定路径填到各组件 src
  ASSET_ROOT: '/assets',
  characters: '/assets/characters',
  icons3d: '/assets/icons-3d',
  equipment: '/assets/equipment',
  badges: '/assets/badges',
  tabbar: '/assets/tabbar',
};
