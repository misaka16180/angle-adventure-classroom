# 开发与维护说明

本文档给维护者、负责打包的教师和希望改题目的开发者使用。仓库的公开入口是 [misaka16180/angle-adventure-classroom](https://github.com/misaka16180/angle-adventure-classroom)，在线预览为 [GitHub Pages](https://misaka16180.github.io/angle-adventure-classroom/)。

## 目录约定

```text
.
├─ app/                         # 当前运行源码与第三方资源
│  ├─ index.html                # 应用壳
│  ├─ app.js                    # 页面切换、餐厅任务、共答题
│  ├─ engine.js                 # 机器人路线编译、模拟、验收
│  ├─ angle-lab.js              # 角度实验室、量角器和触屏数字盘
│  ├─ blockly-adapter.js        # Blockly 触控工作区与工具栏
│  ├─ duel.js / duel-model.js   # 双人赛 UI 与无 DOM 状态模型
│  ├─ style.css / blocks.css / duel.css
│  └─ THIRD-PARTY-NOTICES.txt   # Blockly 等第三方声明
├─ scripts/
│  └─ build.py                  # 把 app 内资源内嵌为单文件并生成 dist
├─ tests/                       # Node 标准库回归测试
├─ docs/
│  ├─ images/                   # README、指南使用的当前版本截图
│  ├─ 使用说明.md
│  ├─ TEACHER_GUIDE.md
│  └─ DEVELOPMENT.md
├─ dist/                        # 构建产物（由脚本生成）
│  ├─ 角度探险家.html            # 可直接打开的离线单文件
│  └─ 角度探险家-离线课堂.zip    # 发布附件
└─ index.html                   # GitHub Pages 在线入口（由构建生成）
```

公开仓库只保留可运行的 `app/`、测试和文档；不要把 `debug*.cjs`、临时截图和一次性验证脚本放入公开源码目录。

## 本地开发

需要 Node.js 18+ 和 Python 3。进入仓库根目录后：

```bash
npm test                 # 运行内置的模型与回放回归测试
python scripts/build.py  # 生成根 index.html 与 dist 离线文件
```

公开仓库不捆绑 Playwright 浏览器依赖；触控拖拽、窄屏和双人赛请按教师指南手动验收，或在维护者自己的 Playwright 环境中运行 UI 脚本。

开发时可直接打开 `app/index.html`，但它依赖同目录的 Blockly 和本地脚本；修改后用 `python scripts/build.py` 验证最终单文件，而不要只检查开发目录。

## 架构要点

### 页面壳与活动切换

`app/index.html` 提供顶部导航、主容器、教师指南对话框、全屏按钮和页脚。`app.js` 根据 `data-view` 在 `lab`、`restaurant`、`quiz` 三个活动间切换，并在切换时清理计时器、动画和 Blockly 实例。所有核心内容通过本地 `<script>` 和样式加载，离线包不需要 CDN。

### 角度实验室

`angle-lab.js` 维护角度值、基准边方向、量角器显隐、答案显隐和边长演示状态。拖动活动边时用 SVG 坐标变换计算角度，触屏事件使用 pointer capture，数字输入通过自制 `<dialog>` 数字盘完成。修改这里时要同时验证 1°、90°、180°、左右读数和 `prefers-reduced-motion` 下的显示。

### 机器人模型

`app/engine.js` 是无 DOM 的确定性模型，也是 Node 测试的主要对象。模型定义：

- 起点 `{x:0,y:0,heading:0}`，heading 0° 表示向右；地图范围 x=0…6、y=0…3。
- 餐桌位置：①(3,0)、②(6,0)、③(6,3)、④(3,3)、⑤(0,3)。
- `compile()` 检查积木类型、数值范围、循环开始/结束配对、空循环、嵌套深度和 128 条展开上限。
- `simulate()` 逐格生成 frame，按规定顺序送餐；结束必须回到取餐口且 heading 恢复 0°。
- `toPython()` 生成帮助理解流程的 Python 代码；不是可独立控制真实机器人的驱动程序。

任何关卡或边界规则变化，先更新 `engine.js` 的纯函数测试，再更新教师指南和截图；不要在 `app.js` 中复制一份地图规则。

### Blockly 积木

`blockly-adapter.js` 负责 Blockly 工作区、触控工具栏、数字盘和程序序列转换。自定义重复积木使用真实 C 形语句槽，输出成 `repeat` 节点，再由 `engine.compile()` 配对和展开。拖动循环、拖出内部动作、嵌套循环和连接到“程序开始”后的主链是关键回归场景。

`app/blocks.css` 只负责积木区与餐厅大屏布局；在 900 px 以下不应假设双人赛的左右栏仍可见。调整工具栏时保持按钮的可触控尺寸，不要把“更多”菜单中的教师示例、Python、清空和从头验证移除。

### 双人挑战

`duel-model.js` 不依赖浏览器计时器，调用方传入单调时间。它负责题目/选项打乱、双方准备、倒计时、暂停、独立题目时限、答题、超时 0 分、完成门槛、结果和讲评数据。`duel.js` 负责 DOM、音效、结果小窗口、庆祝层、答案讲评和窄屏提示。

必须保持这些交互契约：

1. 双方都准备后才开赛；双方题序和选项分别打乱。
2. 每题只接受第一次选择；答题后立即公示正确答案，约 1.2 秒后自动切题。
3. 任何一方未完成时，不显示比赛结果，也不显示答案解析。
4. 双方完成后先显示结果；教师点击“查看答案解析”才打开总结。
5. 绿色只表示答对，红色表示答错或超时；颜色不能按左右同学固定。
6. `max-width:899px` 显示窄屏说明；900 px 只是双人并排最低门槛，不改变其他活动的可用性。

## 题目维护

全班题目目前在 `app.js` 的 `questions` 数组中，字段包括 `topic`、`timeLimitSeconds`、`q`、`options`、`answer`、`art` 和 `explain`。修改题目时：

- `answer` 必须是从 0 开始的选项下标；
- `art()` 返回自包含 SVG，补充可读的 `aria-label`；
- 时间限制应按阅读量和绘图复杂度设置在 15—35 秒，并在教师文档同步；
- 每题都写可被课堂朗读的解析，不把答案只藏在颜色中；
- 在全班共答和双人赛中各走一遍，确认选项随机后 `answer` 仍指向正确文字。

## 截图更新流程

公开文档中的截图必须来自当前构建产物，不要继续使用旧的 `outputs/*.png` 或调试失败图。建议流程：

1. 运行 `python scripts/build.py`，用本地静态服务器打开根 `index.html`。
2. 使用 Playwright 或浏览器截图在 1920×1080 全屏抓取以下状态：餐厅、实验室、数字盘、循环、续跑、比赛准备、逐题反馈、结果、讲评、窄屏、Python、全班共答。
3. 文件名固定为 `docs/images/01-restaurant.png` 至 `12-class-quiz.png`，可另存 `overview.jpg` 作为项目总览图。
4. 每次改 UI 后至少重拍受影响的全部图片；检查图中不能出现旧文案、旧配色、失败测试遮罩、浏览器个人信息或学生姓名。
5. 在 README 和教师指南中同时检查图片链接、中文说明和“点击放大”行为。

截图不应通过压缩到看不清字来减小仓库体积；大图可以保持 PNG，必要时在图集之外再提供适度优化后的 `overview.jpg`。

## 构建与发布

`python scripts/build.py` 应完成以下事情：

1. 读取 `app/index.html` 及其本地 CSS、JavaScript、Blockly 资源；
2. 生成根目录 `index.html` 供 GitHub Pages 使用；
3. 生成 `dist/角度探险家.html`；
4. 生成 `dist/角度探险家-离线课堂.zip`，包含单文件、`教师使用指南.md`、`使用说明.md` 和 `THIRD-PARTY-NOTICES.txt`；
5. 校验输出中没有指向本地 `work/`、临时端口或外部 CDN 的脚本地址。

发布前依次执行：

```bash
npm test
python scripts/build.py
node tests/offline-check.cjs
```

然后从 `dist/角度探险家.html` 实际打开一次，检查导航、全屏、角度拖动、积木拖拽、双人赛和窄屏提示。不要把未通过的测试截图当成文档图片。

### GitHub Pages

Pages 使用根目录生成的 `index.html`。推送默认分支后，在仓库 Settings → Pages 选择 GitHub Actions 或 `Deploy from a branch` 的根目录。部署后检查：

- 页面 URL 能加载 Blockly、中文界面和全部活动；
- 浏览器开发者工具没有 404、混合内容或外部字体阻塞；
- 双人赛题目显示、窄屏提示和本地存储正常；
- 教师文档中的图片使用相对路径且能在仓库页面放大。

### Release

推荐用 `v1.0.0` 作为第一次公开发布，附件包括：

- `dist/角度探险家-离线课堂.zip`；
- 可选的 `dist/角度探险家.html`；
- 当前 `README.md` 和教师指南的链接说明。

Release 页面可使用 [releases/latest](https://github.com/misaka16180/angle-adventure-classroom/releases/latest) 作为下载入口。版本号更新时，把截图和文档一起检查，不要让 README 宣传新功能而离线包仍是旧构建。

## 质量检查清单

- [ ] `npm test` 通过，尤其是 engine 的循环配对、边界、送餐顺序和恢复朝向。
- [ ] 在目标一体机上手动验收触控拖动、数字盘、Blockly 循环、双人计时、自动切题、结果/讲评门槛和 861 px 窄屏。
- [ ] 1280×800、1366×768、1920×1080、3840×2160 至少各打开一次；1920×1080 是推荐课堂基准。
- [ ] 双人赛 900 px 以下有明确提示，900 px 以上能恢复左右栏。
- [ ] 答对绿色、答错/超时红色在左右两侧一致；双方都错时均为红色。
- [ ] 所有公开截图来自当前构建，文件名和 README 链接一致。
- [ ] ZIP 能在无网络环境中打开，教师指南和第三方声明仍在包内。
- [ ] 不在公开日志、截图、Issues 中暴露学生姓名、成绩或本机路径。
