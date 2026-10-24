# 视频 DIY

需要安装 FFmpeg，并让 `ffmpeg -version`、`ffprobe -version` 在终端可用。原片可放在仓库外，命令只读取它；不要把大原片提交进 Git。命令中含空格或中文的路径用引号。

首次加工另执行 `python -m pip install -r requirements-media.txt`。截图沿用显式 YUV→RGB、sRGB JPEG 的方法，减少推荐定格与实际视频的色彩差异。当前接入面向 SDR BT.709 视频；缺少色彩标签时按 BT.709、limited range 处理，源信息会显示在计划中。HDR／其他色域请先制作正确的 SDR 原片，再接入；工具不静默尝试 HDR 映射。

## 新增

先决定播放类型与时间点。`entry` 用于入场后定格；`departure` 必须真的有离场尾段；`companion` 必须有适合重复播放的片段。默认计划只探测视频、不转码不写入：

```powershell
python -X utf8 tools/project.py add --id my-first-look --name "新穿搭" --wardrobe classic --kind entry --source "原视频.mp4" --freeze 10.5
```

确认后在相同命令末尾加 `--apply`。工具生成 `content/looks/my-first-look`，自动分配 `hostValue`、加入衣橱、生成视频与图片。新款默认 `enabled:false` 暂无对白；按对白指南补齐后启用。

动态陪伴示例：

```powershell
python -X utf8 tools/project.py add --id my-idle-look --name "安静陪伴" --wardrobe sit --kind companion --source "动态原片.mp4" --loop-start 8 --apply
```

入场从 0 秒开始，之后循环 8 秒至片尾。片尾之外还留有不想循环的动作时加 `--loop-end 18.5`。时间必须处于实际视频范围，适不适合衔接仍需观看；工具不会替你猜循环点。

## 替换现有一套

```powershell
python -X utf8 tools/project.py replace --id classic-sample --source "自己的入场.mp4" --name "我的新名字" --freeze 9.5 --apply
python -X utf8 tools/project.py replace --id sit-companion --source "自己的陪伴.mp4" --loop-start 7.5 --apply
```

替换保持原 ID、宿主编号和同类型的对白，不自动宣称旧对白适合新服装。必须重新指定时间点，不能无意沿用旧视频参数。若改变类型，通过 `--kind` 明确指定，旧对白会停用，重新填好再启用。

替换会重新生成封面与定格，清除旧附加画质引用；用同一段新原片重新生成需要的档位。旧文件及配置保存在 `.history/<时间>`，原 MP4 不动。

## 封面与画质

默认在定格／循环起点截取图片。附加参数：`--cover-time 8.3` 选择截图时间，`--cover-x 0.65 --cover-y 0.5` 调整 3:4 封面的裁剪位置（范围 0–1）。完整定格图不裁成人物封面比例。修改推荐定格时间后，要同步重新生成定格图；否则启动静帧与播放停止位置会不同。

基础视频默认限制在 1920×1080 内，保持比例，60 FPS；可用 `--height 1440` 或 `--height 2160` 制作更高分辨率基础视频。不会只改扩展名伪装成 WebM。VP9/Opus 加工保留源音轨，无音轨的视频仍可使用。

从同一原片增加一个档位：

```powershell
python -X utf8 tools/project.py quality --id my-first-look --source "原视频.mp4" --height 1440 --apply
```

工具检查总时长与帧率。不要拿另一段长度相似的视频充当画质档位；自动检查无法保证画面内容一致。低分辨率源即使放大也不会增加真实细节。

## 排序、移动、移除

在 `content/wardrobes.json` 调整 `looks` 数组即可改变默认顺序，运行界面仍可正序／倒序。别改 ID 或 `hostValue` 来排序。

跨衣橱移动时，同步修改该套 `look.json` 的 `wardrobe` 与两个衣橱的 `looks`；如果移走默认款，给原衣橱选一个新的 `defaultLook`。每套恰好出现一次。

```powershell
python -X utf8 tools/project.py remove --id sit-sample
python -X utf8 tools/project.py remove --id sit-sample --apply
```

移除会保留 `.history` 备份，并更新默认款。移除衣橱最后一套会同时移除该空衣橱；不能删除整个作品最后一套。已有用户收藏中已移除的 ID 会丢弃，其他收藏保留。不要重新分配退役编号。

## 背景与验收

跨衣橱的过渡使用 `wardrobes.json` 中的 `background`。发布自己的作品时，两个示例空场景背景也需换成自己的 JPG/PNG，并填写仓库内相对路径。可多组共用同一张自有背景。

完成后：

```powershell
python -X utf8 tools/project.py check --media
python -X utf8 tools/project.py build --host both
```

打开预览，检查入场、停止位置、封面、实际循环接缝、声音和切换。如果修改工具或播放器，再执行自动测试。不要仅凭工具成功就声称接缝自然或桌面零卡顿。
