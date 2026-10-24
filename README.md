# PURPLE · 壁纸 DIY 模板

三个衣橱、四段 1080P 样片，保留入场定格、动态陪伴、顺序／随机轮播、收藏、自选定格、经典／精简布局。可导出 Wallpaper Engine 网页项目与 Lively 导入 ZIP，运行时完全离线。

**代码采用 MIT；附带的视频、图片和示例对白仅供个人学习、本地预览。发布自己的作品前必须替换这些内容。** 见 [代码许可](LICENSE) 与 [示例内容说明](CONTENT-LICENSE.md)。

## 第一次使用

下载或克隆本仓库后，保留完整 `content` 文件夹。四个样片直接包含在源码中，无需另找网盘，也没有 Git LFS 指针。需要 Python 3.11+；只构建已有样片无需 Node.js 或 FFmpeg。

在项目根目录打开终端：

```powershell
python -X utf8 tools/project.py doctor
python -X utf8 tools/project.py build --host both
```

直接打开 `preview/wallpaper-engine/index.html` 即可预览。`preview/lively/index.html` 是 Lively 适配版本。浏览器可能要求第一次手动点击才能播放声音，这不代表音轨缺失。

需要在宿主内试用示例时：

```powershell
python -X utf8 tools/project.py pack --host wallpaper-engine --demo
python -X utf8 tools/project.py pack --host lively --demo
```

包在 `dist`。WE 包解压后选择里面的 `index.html` 创建网页壁纸；Lively 直接添加 ZIP。**两个 demo 包均只供本地预览，不可作为自己的作品发布。** 同名包不会被覆盖，再导出时加 `--name my-demo-v2`。

## 样片

| 稳定 ID / 文件夹 | 名称 | 衣橱 | 类型与关键时间 |
| --- | --- | --- | --- |
| `classic-sample` | 薄纱晚风 | 咫尺偏爱 | 入场，11.23 秒定格 |
| `sit-sample` | 簪花小令 | 片刻倾心 | 入场与离场，6.8 秒定格 |
| `sit-companion` | 靛蓝晚风 | 片刻倾心 | 动态陪伴，8 秒起循环 |
| `recline-sample` | 紫暮长靴 | 慵懒依偎 | 入场，11.7 秒定格 |

四套各一段基础视频，均为 1920×1080 / 60 FPS。动态样片保留 10 条持续对白；其他类别只保留少量完整示例。封面、定格图和两个场景背景另外提供。

## 开始自己的作品

先创建独立作品身份。第一次命令展示计划，确认内容后加 `--apply` 执行：

```powershell
python -X utf8 tools/project.py init --id my-companion --title "我的桌面陪伴" --author "我的名字"
python -X utf8 tools/project.py init --id my-companion --title "我的桌面陪伴" --author "我的名字" --apply
```

继续按 [视频指南](docs/MEDIA.md) 换入自己有权使用的素材，按 [对白指南](docs/DIALOGUE.md) 修改文字。作品名字、品牌、角色称呼和默认设置统一在 `content/project.json`。衣橱名称、顺序和背景在 `content/wardrobes.json`。

## 交给本地 AI

把仓库文件夹交给支持读取本地文件的 AI，直接发送：

> 请先阅读 README.md、AGENTS.md 和与任务相关的 docs 文档。我要在这个模板上制作自己的壁纸。先说明现有四套素材、配置入口和当前检查结果，再按我提供的视频与对白修改。保留播放器的播放与暂停逻辑；需要我确定定格点、循环点或离场类型时列出缺失信息。完成修改后构建并执行相关检查，给我本地预览入口和验证结果。未经要求不要上传、创建远程仓库或改动其他项目。

具体任务提示词见 [AI 接手示例](docs/AI_TASKS.md)。角色创作资料见 [角色设定模板](docs/PERSONA.md)。

## 查阅入口

- [配置与架构](docs/ARCHITECTURE.md)：每个文件负责什么，稳定 ID 与保存机制。
- [视频 DIY](docs/MEDIA.md)：新增、替换、离场、循环、封面与画质。
- [对白 DIY](docs/DIALOGUE.md)：成对接话、持续陪伴、亲昵和共享回应。
- [检查与常见问题](docs/TESTING.md)：自动检查、浏览器和桌面宿主验收边界。
- [发布自己的作品](docs/PUBLISH.md)：素材替换检查、WE/Lively 导出、源码公开。
- [版本验证记录](docs/VERIFICATION.md)：本版本实际完成的验证与限制。

## 开发环境

视频新增／替换需要 FFmpeg（`ffmpeg` 和 `ffprobe` 在 PATH），并执行 `python -m pip install -r requirements-media.txt` 安装截图处理依赖 Pillow。已有样片的构建无需安装它。所有工具使用参数数组调用，不运行输入文件里的指令，原视频只读；修改前的文件保存在 `.history`。

浏览器自动检查另外需要 Node.js 22.12+ 和本机 Chrome：

```powershell
npm ci --ignore-scripts
npm test
npm run test:browser
```

`puppeteer-core` 不下载浏览器；Chrome 不在标准位置时，用环境变量 `PURPLE_CHROME` 指向可执行文件。检查使用独立配置，不读取或清除个人浏览器偏好。

运行壁纸不需要这些开发工具。不要把 `node_modules`、`.history`、`.qa` 或原始大视频一起塞进壁纸包。
