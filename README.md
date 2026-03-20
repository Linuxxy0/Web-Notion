# GitNovelBox

一个 **无需自建服务器** 的 TXT 小说 / 轻量文本资料 **GitHub 私有仓库可视化网盘**。

- 纯前端静态站点，可直接部署到 **Vercel** 或 **GitHub Pages**
- 使用浏览器目录选择器读取本地 TXT 文件
- 直接调用 **GitHub REST API** 访问私有仓库
- 支持目录树浏览、搜索、排序、属性面板、TXT 预览、手动同步、远端下载、流量统计
- 已包含：**右键菜单、面包屑导航、列表 / 卡片双视图**

> 适用场景：个人小说 TXT 备份、自用多设备同步、轻量文本管理。

---

## 文档导航

- [项目介绍](./docs/PROJECT_INTRODUCTION.md)
- [Vercel 完整部署指南](./docs/VERCEL_DEPLOY_FULL.md)
- [小白版一键部署图文说明](./docs/BEGINNER_ONE_CLICK_DEPLOY_GUIDE.md)
- [项目功能清单 / 路线图](./docs/FEATURES_AND_ROADMAP.md)
- [当前未实现功能清单](./CURRENT_MISSING_FEATURES.md)

---

## 已实现能力

### 1. GitHub 仓库连接
- GitHub Token / Owner / Repo / Branch / Prefix 配置
- 仓库连通性校验
- 远端仓库树加载

### 2. 本地 TXT 扫描
- 选择本地目录
- 递归扫描 `.txt`
- 本地 / 远端合并视图
- 状态识别：已同步 / 待上传 / 待更新 / 仅远端

### 3. 网盘式可视化界面
- 左侧目录树
- 面包屑导航
- 文件列表视图
- 文件卡片视图
- 文件 / 文件夹右键菜单
- 文件 / 文件夹属性面板

### 4. 文件操作
- 单文件同步
- 一键同步
- 远端下载
- 远端创建文件夹
- 远端重命名文件夹
- 部分远端删除

### 5. 浏览与阅读
- TXT 文件预览
- 常见文本编码兼容
- 搜索、目录过滤、状态筛选、排序
- 文件大小统计、体积分布、Top 5、运行日志

---

## 技术栈

- Vue 3
- Vite
- 原生 Fetch 调用 GitHub REST API
- LocalStorage 保存配置、日志、统计
- File System Access API / `webkitdirectory` 作为本地目录输入

---

## 本地启动

```bash
npm install
npm run dev
```

构建：

```bash
npm run build
```

预览构建产物：

```bash
npm run preview
```

---

## 推荐 Token 权限

推荐使用 **Fine-grained Personal Access Token**，只授予目标仓库最小权限：

- Repository access：仅选择目标仓库
- Contents：Read and write
- Metadata：Read

---

## 页面中需要填写的配置

- **GitHub Token**
- **Owner**：仓库所属用户名或组织名
- **Repo**：仓库名
- **Branch**：默认 `main`
- **Repo Prefix**：上传前缀，例如 `books/`
- **文件大小上限**：默认 5 MB

示例目录映射：

本地：

```text
玄幻/斗破苍穹.txt
科幻/三体.txt
```

远端（Prefix = `books/`）：

```text
books/玄幻/斗破苍穹.txt
books/科幻/三体.txt
```

---

## 部署

### Vercel

1. 将本项目推到 GitHub
2. 在 Vercel 中导入该仓库
3. 框架选择 Vite（通常会自动识别）
4. 构建命令：`npm run build`
5. 输出目录：`dist`

### GitHub Pages

本仓库内置 `.github/workflows/deploy-pages.yml`：

1. 推送到 GitHub 仓库
2. 在仓库 Settings → Pages 中启用 **GitHub Actions** 作为部署来源
3. 推送 `main` 分支后，Actions 会自动构建并发布

---

## 目录结构

```text
gitnovelbox-static/
├─ .github/workflows/deploy-pages.yml
├─ docs/
│  ├─ PROJECT_INTRODUCTION.md
│  ├─ VERCEL_DEPLOY_FULL.md
│  ├─ BEGINNER_ONE_CLICK_DEPLOY_GUIDE.md
│  └─ FEATURES_AND_ROADMAP.md
├─ src/
│  ├─ components/
│  ├─ lib/
│  ├─ store/
│  ├─ App.vue
│  ├─ main.js
│  └─ styles.css
├─ dist/
├─ CURRENT_MISSING_FEATURES.md
├─ .env.example
├─ .gitignore
├─ index.html
├─ package.json
├─ package-lock.json
├─ vercel.json
└─ vite.config.js
```

---

## 使用提示

- 默认建议使用 **私有仓库**
- 本工具适合 TXT 文本，不适合作为无限容量网盘
- 上传受版权限制的内容需自行承担合规责任
- 浏览器静态网页不会在关闭页面后后台持续同步
