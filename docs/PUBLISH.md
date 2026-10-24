# 发布与源码分享

## 先区分两种包

- `source`：代码、工具、文档及四个学习样片的模板源码包。保留 `LICENSE`、`CONTENT-LICENSE.md` 和 `NOTICE.md`。
- `pack`：用户自己的壁纸运行包。默认进行示例内容检查；`--demo` 仅用于自己的本地宿主预览，不能拿来对外发布。

作者提供四个样片用于本模板的学习预览，不授权使用者把这些素材随自己的作品再发布。MIT 只覆盖代码和相应开发文档，不替代素材授权。

## 制作自己的发布包

1. 用 `init` 设置独立 `id`、标题与作者；按自己的作品修改品牌、角色称呼和描述。首次发布前完成，后续更新保持同一个作品 ID。
2. 替换四套视频、封面、定格图、两个背景图、各套对白及共享对白；也可以删除不需要的示例套装。使用你有权发布的内容。
3. 核对所有 `look.json` 的 `sample:false`。项目确实不含示例内容后，将 `content/project.json` 中 `sample` 设为 false。单改标记不能替代素材替换，工具还会检查登记的文件和句子指纹。
4. 核对 WE 的内容分级及其他宿主属性：模板在 `src/hosts/wallpaper-engine.json`，不包含原作者工坊 ID。按实际内容选择分级，不借模板替你判断。
5. 按 `TESTING.md` 检查，并在目标壁纸软件中自己预览。确认封面、声音、缩放与循环符合预期。

```powershell
python -X utf8 tools/project.py check --media
python -X utf8 tools/project.py pack --host wallpaper-engine --name my-wallpaper-we-v1
python -X utf8 tools/project.py pack --host lively --name my-wallpaper-lively-v1
```

每个 ZIP 都在根目录直接放入口与宿主元数据，不多套一层目录。旁边的 manifest 记录文件清单及 SHA256。已有同名包不会覆盖；更新时使用新的包名。

WE：解压新包，在 Wallpaper Engine 编辑器中以 `index.html` 创建新的网页壁纸；核对标题、封面和属性后由你手动发布。新作品由宿主分配新的工坊身份，不能复制别人的 `workshopid`。更新自己已有作品时使用自己的宿主项目与工坊身份；本工具不替你上传，也不覆盖宿主现用目录。

Lively：在“添加壁纸”中选 ZIP，元数据入口是 `LivelyInfo.json`。只提供内容包，不包含 Lively 软件、安装器或用户配置。

运行包保留代码 MIT 声明。你的素材应另行说明自己的授权规则；模板的素材说明仅针对模板示例，不替你给新素材作授权保证。

## 分享模板源码

本模板建议使用 GitHub 仓库名 `frac-interactive-wallpaper`，展示标题为「FRAC_桌面互动壁纸 · 开源 DIY 模板」。壁纸在宿主中的名称由 `content/project.json` 的 `title` 控制，当前为「FRAC_桌面互动壁纸」。这些名称不代表已创建远程仓库。

```powershell
python -X utf8 tools/project.py source
```

生成 `dist/purple-diy-source.zip`。工具仅收录明确的源码入口、开发文档、工具和配置引用的素材；不会收录 `.git`、`.history`、`.qa`、`node_modules`、预览、导出包或未引用的原视频。仍应自己检查新增的源码、文档中是否含私人信息。

本模板不携带原工程的 Git 历史或远程地址。创建自己的公开仓库时，从这个独立目录开始，检查 `.gitignore`，确保视频是实际文件而非本机硬链接或缺失的大文件指针，再提交。以后如果素材增多、仓库过大，可以另做素材下载方案；首版四段样片不需要依赖外部盘符。

公开远程仓库、推送和上传均是另外的主动操作。本模板的构建、打包命令不会执行这些动作。
