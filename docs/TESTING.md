# 检查与常见问题

## 检查顺序

```powershell
python -X utf8 tools/project.py doctor
python -X utf8 tools/project.py check
python -X utf8 tools/project.py check --media
python -X utf8 tools/project.py build --host both
python -X utf8 -m unittest discover -s tests -p "test_*.py" -v
```

`check` 检查 ID、默认款、分组、重复编号、路径、时间范围、素材存在和对白配对。`check --media` 进一步用 ffprobe 读取实际帧数、分辨率、编码、时长和帧率；它不扫描黑帧，也不能判断动作是否适合循环。

Python 测试复制项目到 `.qa` 下的中文／空格临时目录，生成自有测试视频，验证新增、替换、对白、画质、删除、打包与源码重新解压构建。不会修改你的 content。媒体工作流需要 FFmpeg 和 `requirements-media.txt` 中的 Pillow；缺少依赖时显示 skipped，不要把 skipped 当通过。

浏览器测试：

```powershell
npm ci --ignore-scripts
npm run test:browser
```

读取当前配置，使用独立 Chrome 配置直接打开本地 HTML；实际解码视频，检查入场定格、动态循环、切衣橱仅浏览、排序、精简布局，以及两个适配页面的暂停通知。日志与截图在 `.qa/browser-<时间>`。此检查不是原生 WE/Lively 桌面验收，不测真实听音或所有设备的顺滑度。

手工最终检查：在目标软件导入后播放每类素材，测试手动暂停后系统恢复、锁屏回来、桌面点击、音量和自己的屏幕比例。更换解码器或宿主版本后重新确认。

## 常见问题

**打开 HTML 是黑屏或缺封面**：先运行 build，打开 preview 下完整目录中的 index.html，不能只复制单个 HTML。运行 check 查看缺失路径。仓库中的四个 WebM 是实际文件，拉取后如果缺失应恢复对应素材，不要生成空文件绕过校验。

**视频有画面但无声音**：检查源视频是否有音轨、页面音量与静音状态；浏览器首次播放可能需要主动点击。网页运行状态与实际宿主听音要分别确认。

**循环每次又从入场开始**：确认 kind 为 companion，loopStart/loopEnd 真实有效，当前模式是动态陪伴。单套循环会完整重播视频，是另一个模式。

**循环点不自然**：工具只能验证时间范围。检查起点与终点的姿势、视线、光线和动作衔接；不要靠增加对白延时掩盖视频问题。

**改 JSON 没变化**：重新 build，关闭旧预览再打开；不要直接编辑 preview。名字改了但设置仍保留是正常现象，作品 ID 才决定存储身份。

**删一套后收藏错位**：正常流程按 catalogIds 重映射；勿删保存映射或复用旧 ID/hostValue。不要用清空全部设置作为默认修复方案。

**画质按钮不是 4K**：original 指基础视频，按钮显示实际基础分辨率；本模板样片就是 1080P。自行增加真实高分辨率文件后才会有相应画质。

**ffmpeg/ffprobe 找不到**：安装 FFmpeg 后添加其 bin 目录到 PATH，重开终端。构建已有样片仍可运行，新增／替换与媒体检查需要这些工具。

**Chrome 启动失败**：检查 Node 版本与 npm ci 是否成功；设置 PURPLE_CHROME 指向 Chrome。在受限运行环境中可能需要允许启动隔离测试进程；不要把个人浏览器配置路径拿来测试。

**需要 HTTP 检查**：运行 `node tools/serve.cjs`，它只监听本机随机端口，并输出实际地址，支持视频 Range。可通过 `PURPLE_HOST=lively` 选择另一个构建目录。不要用缺少 Range 的简易服务器判断定格是否正常；结束后 Ctrl+C 关闭。

**发布命令拒绝样片**：按 CONTENT-LICENSE.md 替换受限内容。不要修改样片指纹或用 demo 包绕过。纯学习预览可使用 pack --demo。

**误操作想恢复**：查看 `.history/<时间>/content` 中的备份。先比较要恢复的 look 文件夹、wardrobes.json 和 project.json；恢复完整相关配置后重新 check/build，勿用旧备份覆盖其他较新修改。
