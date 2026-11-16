# 新标签页性能与图标更新

## 行为

- 桌面排序和文件夹预览通过 `translate` 过渡位置；拖拽提示使用 `transform`，待办进度使用 `scaleX`。尺寸直接更新到最终布局。
- 设置、图标编辑器、备忘录编辑器、待办弹窗、备份页和图片处理模块使用静态导入。构建保留原有依赖分包，所有分包均为静态依赖。
- 桌面仅挂载当前页的网站，并在跨页拖拽时保留来源。小组件保留实例，翻页不会丢失未提交的待办草稿。
- 连续修改采用 250 ms 合并保存，持续输入达到 1 秒时触发写入；同一页面的写入串行执行。页面隐藏、离开或卸载时立即提交队列；失败后保留最新快照供重试。
- 静态大图标缩小到 256×256 以内，大壁纸按屏幕像素尺寸缩小，保持宽高比。GIF、APNG、动画 WebP、AVIF、SVG 保留原文件；壁纸亮度持久化缓存。
- 悬停阴影绘制在独立伪元素上，通过透明度渐显。位置动画遵循系统和应用的减少动态效果设置。
- 图标选择器提供 200 个精选 Lucide 图标，每页挂载 48 个选项，全部通过显式导入同步渲染。全量库版本保存的 `lucide:` ID 读取时映射到精选 ID，未保留的图标回退为通用地球图标。
- 文字图标的 `iconTextColor` 与背景色分别保存；旧数据缺少该字段时仍使用白色。云端备份服务需同步更新共享校验模型，以接受新 Lucide ID 和文本颜色。

## 指导依据

使用 Modern Web Guidance 的 `performance` 和 `motion` 指南；可通过 `pnpm dlx modern-web-guidance@latest retrieve "performance,motion"` 查阅原文。

- `performance`："DO configure bundler asset chunking"；构建保留原有依赖分包，运行时使用静态导入。
- `performance`："DO debounce or throttle rapid event listeners"；界面即时更新，持久化合并执行。
- `performance`："Serve tailored resolutions based on screen density and viewport width"；用于上传图片的显示尺寸处理。
- `motion`："Prefer to animate `opacity` and `transform`"；用于排序、进度和阴影效果，避免持续插值布局属性。

## 自动化验证

- 前端 25 个测试文件、153 项测试通过。
- 服务端 API 与备份相关的 2 个测试文件、16 项测试通过。
- 前后端 TypeScript 检查、ESLint、Vite 生产构建和 Manifest V3 扩展包校验通过。
- 生产构建共 7 个 JavaScript 文件（含后台服务），动态导入数量为 0。
- 新增覆盖：80 个网站分页挂载与跨页键盘拖拽、200 个精选图标同步渲染、精选图标搜索与保存、全量库 ID 迁移、文本颜色的新增编辑与备份恢复、连续编辑合并保存、慢写入和失败重试、离开页面保护、图片缩放比例和壁纸亮度缓存。
