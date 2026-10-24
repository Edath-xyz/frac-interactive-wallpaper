# 配置与维护边界

`content → 校验与编译 → preview/<host> → 白名单打包 → dist`。

| 位置 | 责任 |
| --- | --- |
| `content/project.json` | 作品 ID、标题、作者、品牌、角色称呼、默认穿搭与画质、音量、对白间隔 |
| `content/wardrobes.json` | 1–3 个衣橱的名字、默认款、相对背景路径和显示顺序；每四套自动分页 |
| `content/looks/<id>/look.json` | 视频类型、时间参数、文件名、所属衣橱、稳定宿主编号 |
| 同目录 `dialogue.json` | 这套的成对入场接话、回到播放、随机、持续／亲昵对白 |
| `content/shared-dialogue.json` | 三个衣橱共用的操作回应；不含其他穿搭正文 |
| `content/sample-manifest.json` | 原始示例内容的文件与文字指纹；用于提醒替换，不随个人作品修改 |
| `src/player` | 原有双视频播放、离场、循环、选句、界面与暂停逻辑 |
| `src/hosts` | WE 属性通知、Lively 暂停通知和 WE 属性模板 |
| `src/index.html`、CSS | 页面结构与既有外观；`{{...}}` 由构建替换 |
| `tools/model.py` | 配置约束、路径边界、对白配对和运行数据生成 |
| `tools/build.py` | 编译代码与配置，只复制明确引用的素材 |
| `tools/media.py`、`project.py` | 素材加工、备份、命令入口与打包 |

## 身份与排序

`look.id` 必须等于文件夹名，使用小写字母、数字、连字符，以字母开头。改名称时不改 ID；确实换成另一套全新内容时新增 ID。`hostValue` 是 WE 的持久编号；新增工具自动分配，移除后不会复用。

运行时可以用数组索引处理视频，但保存文件携带完整 `catalogIds`。载入时按 ID 重映射当前穿搭、收藏、自选定格和衣橱记忆，因此增删、排序不会串套。对白按穿搭 ID 与句子 ID 维护抽取历史。

作品存储键由 `project.id + 宿主` 生成，包括布局、字号和对白历史。新作品用新 ID；同一作品更新保持 ID。不继承原作者作品的存储键或工坊编号。

`project.author` 用于宿主的作品作者信息；模板界面不叠加作者或 B 站水印。代码版权声明保留在许可文件中。

## look.json 参数

- `kind`：`entry` 入场定格；`departure` 入场定格并有可继续播放的离场尾段；`companion` 入场后循环。
- `freeze`、`duration`、`loopStart`、`loopEnd` 均为秒。`loopEnd` 不含下一帧，通常取片尾；动态定格点与循环起点一致。
- `fps`、`width`、`height` 来自处理后视频，勿填写原 MP4 的信息。接入工具统一输出 60 FPS VP9 WebM；基本构建不会再次转码。
- `transition` 只用于离场：`lead` 提前准备时间、`fade` 淡入时间，默认 0.5 / 0.4 秒。
- `video`、`cover`、`still`、`dialogue` 都是本穿搭目录内相对路径，不能使用绝对路径或 `..`。
- `qualities` 可选：例如 `{"1440p":"1440p.webm"}`。基础视频始终存在；UI 按实际基础分辨率显示，未提供的档位不能点击。
- `sample` 是来源提醒，初始样片为 true。接入自有视频会设为 false，但这不自动改变旧对白的使用范围。

`project.defaultQuality` 使用 `original`、`1440p` 或 `1080p`。`original` 代表本套基础文件，不固定表示 4K；四套初始样片基础文件就是 1080P。

## 播放边界

两路视频与取消令牌继续由播放器维护。不要把系统暂停、网页隐藏与用户主动暂停合并。切衣橱仅浏览，点封面才换场景。自动切换依据正在播放的衣橱，不能误用正在浏览的衣橱。

`build` 不启动应用，不联网，不发布；`pack` 每次重建并按文件清单导出，不把 `.generated.json` 或开发资料塞入壁纸 ZIP。`source` 才导出包含文档、工具及示例内容的源码 ZIP。
