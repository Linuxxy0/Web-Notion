# GitNovelBox 在 Vercel 上的完整部署指南

> 适用对象：第一次部署前端项目的用户。  
> 本文按 **准备代码 → 上传 GitHub → 导入 Vercel → 首次部署 → 打开站点 → 连接 GitHub 私有仓库 → 开始使用** 的顺序来写。

---

## 1. 先弄清楚三件事

这个项目由三部分组成：

1. **GitHub 仓库**：存放你的项目源码，以及你要管理的 TXT 文件
2. **Vercel**：把前端网页发布出来
3. **浏览器页面**：直接调用 GitHub API 读取、上传、同步和预览文件

一句话理解：

> **Vercel 发布网页，GitHub 存文件，浏览器负责管理。**

---

## 2. 部署前你需要准备什么

请先准备：

- 一个 GitHub 账号
- 一个 Vercel 账号
- 当前项目代码文件夹
- 一个用于存 TXT 文件的 GitHub 仓库（推荐私有仓库）
- 一枚 GitHub Fine-grained Personal Access Token

---

## 3. 先整理项目文件夹

在上传代码之前，请确认你准备的是“项目源码”，而不是乱七八糟的临时文件夹。

推荐上传这些：

```text
src/
docs/
.github/
index.html
package.json
package-lock.json
vite.config.js
vercel.json
README.md
.gitignore
.env.example
```

不建议上传：

- `node_modules/`
- 本地缓存文件
- 系统生成的无关文件

---

## 4. 第一步：在 GitHub 创建项目仓库

### 做法

1. 打开 GitHub
2. 点击右上角 **New repository**
3. 仓库名建议填写：`gitnovelbox-static`
4. 建议选择：
   - **Private**：如果你只是自用
   - **Public**：如果你想公开项目代码
5. 点击 **Create repository**

创建完成后，会进入一个空仓库页面。

---

## 5. 第二步：把项目代码上传到 GitHub

### 方式 A：网页上传（适合小白）

1. 进入你刚创建的仓库首页
2. 点击 **Add file**
3. 选择 **Upload files**
4. 把项目文件拖进页面
5. 等待上传完成
6. 填写提交说明，例如：`init project`
7. 点击 **Commit changes**

### 你会看到什么

上传成功后，仓库首页会出现这些文件和文件夹：

```text
.github/
docs/
src/
README.md
package.json
vite.config.js
vercel.json
```

### 常见提醒

- 不要上传 `node_modules`
- 如果你用浏览器上传，分批上传更稳
- 如果你上传失败，通常是文件太多或太大

---

## 6. 第三步：检查仓库根目录是否正确

仓库根目录最好至少包含：

```text
src/
docs/
.github/workflows/
index.html
package.json
vite.config.js
vercel.json
README.md
```

如果这些都在根目录，就说明结构基本没问题。

---

## 7. 第四步：导入到 Vercel

### 做法

1. 打开 Vercel
2. 登录
3. 点击 **Add New → Project**
4. 选择 GitHub 作为代码来源
5. 找到刚刚创建的仓库
6. 点击 **Import**

Vercel 一般会自动识别这是一个 **Vite** 项目。

---

## 8. 第五步：检查 Vercel 构建配置

导入后，检查以下配置：

- **Framework Preset**：Vite
- **Build Command**：`npm run build`
- **Output Directory**：`dist`
- **Install Command**：默认即可

如果界面里已经自动填好了，通常直接用就行。

---

## 9. 第六步：点击 Deploy

1. 点击 **Deploy**
2. 等待 Vercel 构建
3. 构建成功后，Vercel 会给你一个网址，例如：

```text
https://gitnovelbox-static.vercel.app
```

到这里，网页已经上线。

---

## 10. 第七步：第一次打开网站后要做什么

打开刚生成的网址，你会看到一个深色网盘风格界面，大致分成四块：

```text
顶部：项目标题和状态
左侧：仓库配置 + 目录树 + 统计
中间：搜索 / 排序 / 面包屑 / 文件列表或卡片
右侧：属性 / 预览 / 日志
```

这时网页已经能打开，但还没连接你的 TXT 仓库。

---

## 11. 第八步：创建 GitHub Token

### 推荐类型

推荐使用 **Fine-grained Personal Access Token**。

### 推荐权限

只给目标仓库最小权限：

- **Repository access**：只选目标仓库
- **Contents**：Read and write
- **Metadata**：Read

创建后，把 Token 复制出来。

---

## 12. 第九步：在网页中填写仓库配置

回到 GitNovelBox 页面，在左侧配置区填写：

- **GitHub Token**
- **Owner**
- **Repo**
- **Branch**：一般填 `main`
- **Repo Prefix**：推荐填 `books/`
- **文件大小上限**：先用默认值即可

然后点击：

- **测试连接**
- **加载远端树**

如果连接成功，说明网页已经能直接读取你的 GitHub 仓库。

---

## 13. 第十步：开始使用网盘功能

### A. 浏览 GitHub 仓库内容

连接成功后，你可以看到：

- 左侧目录树
- 中间文件列表或卡片视图
- 面包屑导航
- 右侧属性和预览
- 统计面板

### B. 从网页上传本地 TXT 到 GitHub

1. 点击 **选择本地目录**
2. 选择你本地小说目录
3. 页面会递归扫描 `.txt`
4. 中间列表会显示状态：
   - 已同步
   - 待上传
   - 待更新
   - 仅远端
5. 点击：
   - **单文件同步**
   - 或 **一键同步**

同步成功后：

- GitHub 仓库里会出现这些文件
- 网页里也会马上显示远端结果

### C. 直接在 GitHub 上传文件后网页也能看到

如果你在 GitHub 仓库网页里手动上传了文件：

1. 回到 GitNovelBox
2. 点击 **加载远端树**
3. 新文件会在网页中显示

---

## 14. 第十一步：后续更新怎么自动上线

只要你的 GitHub 仓库已经和 Vercel 关联：

1. 你把项目新代码推到 GitHub
2. Vercel 会自动触发新构建
3. 构建成功后，线上页面自动更新

也就是说，后面更新项目通常只需要：

```text
改代码 → 上传 GitHub → 等 Vercel 自动重新部署
```

---

## 15. 部署完成后的推荐使用习惯

推荐你这样分工：

- **项目源码仓库**：放 GitNovelBox 项目代码
- **文件数据仓库**：专门放 TXT 内容

也可以用同一个仓库，但从长期维护看，分开更清晰。

如果你只想简单使用，也可以：

- 一个仓库放代码
- 另一个私有仓库存 TXT
- 网页通过 Token 去连接 TXT 仓库

---

## 16. 最常见问题

### 1）Vercel 页面能打开，但文件看不到

通常是：

- Token 没填对
- Owner / Repo / Branch 填错
- Token 没授权目标仓库
- Prefix 不正确

### 2）网页能看，不能上传

通常是：

- Token 只有读权限，没有写权限
- 仓库分支受保护
- 文件超出限制

### 3）本地目录选不了

通常是：

- 浏览器不支持目录选择器全部能力
- 建议优先使用 Chrome / Edge

### 4）上传成功但目录结构不对

通常是：

- `Repo Prefix` 配置不符合预期
- 本地目录层级与你想映射的结构不一致

---

## 17. 最简版流程回顾

你只需要记住这一套：

```text
1. 新建 GitHub 仓库
2. 上传项目代码
3. 在 Vercel 导入仓库
4. Deploy
5. 打开网址
6. 填 GitHub Token / Owner / Repo / Branch / Prefix
7. 选择本地目录
8. 一键同步
```

---

## 18. 结论

GitNovelBox 在 Vercel 上的部署，本质上就是：

- **GitHub 放代码**
- **Vercel 发布页面**
- **GitHub 私库放 TXT**
- **浏览器作为操作界面**

你不需要服务器，也不需要数据库，就能得到一个：

> **可浏览、可搜索、可预览、可同步的 GitHub TXT 网盘**
