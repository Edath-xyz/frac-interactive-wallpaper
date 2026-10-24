# 对白 DIY

每套只改 `content/looks/<id>/dialogue.json`；全局操作回应在 `content/shared-dialogue.json`。直接用 UTF-8 JSON 编辑，或让 AI 按下面格式生成一个文件，再用导入命令校验。Markdown 可以作为创作稿，运行时以 JSON 为准，不让解析器猜测随意排版的段落。

## 基本格式

```json
{
  "enabled": true,
  "entries": [
    {"id": "entry-1", "enter": "今天想早点来见你。", "held": "现在坐下来，就不着急走了。"}
  ],
  "restored": [{"id": "restored-1", "text": "我还在这里，慢慢来。"}],
  "random": [{"id": "random-1", "text": "今天就穿这一套陪你。"}],
  "affectionScenes": [{"enter": "让我靠近一点。", "held": "这样就很好。"}]
}
```

以上是结构示意，不要求照抄。所有启用的普通款至少一组成对入场接话、一条 restored、一条 random。`affectionScenes` 可为空数组。

| 字段 | 触发场景 |
| --- | --- |
| `entries[].enter` | 点击穿搭开始入场 |
| 同一条 `held` | 到定格点／动态循环起点后接上；必须能接住 enter |
| `restored` | 恢复当前穿搭等适用入口 |
| `random` | 随机选中这套时的回应 |
| `affectionScenes` | 普通款累计相应入口次数后，替代一次普通入场接话 |

动态款另外需要以下两个数组：

```json
{
  "continuous": [{"id": "continuous-1", "text": "你忙你的，我在这儿陪一会儿。", "topic": "company"}],
  "affection": [{"id": "affection-1", "text": "现在这样靠近你，我很喜欢。"}]
}
```

这是要加进完整对象的两个字段；`restored`、`random` 和 `entries` 仍然需要。持续陪伴初始样片为 10 条，数量可以自行调整。`topic` 可选，用于减少连续近似话题。

## 计时与亲昵

默认每 30 秒轮换动态对白，在 `project.dialogueIntervalSeconds` 修改（5–3600 秒）。只有实际可见的持续对白才累计亲昵次数，默认 5 条后在下次轮换使用一条 affection，随后重新计数；阈值在 `project.affectionAfter`。没有额外时间冷却。

普通款的低频亲昵按对应入口累计 4 次。暂停、后台、面板、主动沉浸会影响对白时钟；自动收起时可以静默更新持续句，但不消耗亲昵机会。不要通过缩短视频或另加定时器来修改对白频率。

## 增删与导入

每条 ID 在本套内唯一。修改句子内容可保留 ID；新增句子用新 ID；删除直接移除整条记录。不要把某套句子按卡片位置映射到另一套。入场与 held 放在同一个对象中，避免两个数组长度对不上。

```powershell
python -X utf8 tools/project.py dialogue --id sit-companion --file "新对白.json"
python -X utf8 tools/project.py dialogue --id sit-companion --file "新对白.json" --apply
python -X utf8 tools/project.py check
python -X utf8 tools/project.py build
```

导入器只替换指定穿搭的对白，写入前校验并备份，不改视频或其他穿搭。也可直接编辑原文件后运行检查。

暂时不需要对白时把文件设为 `{"enabled":false}`。这会清理该套显示的旧句子并停用其对白，不会静音视频本身。

共享操作回应包括收藏、取消收藏、重播、暂停、继续、选帧、保存、取消、恢复定格、唤醒。保留 `shared-dialogue.json` 中这些键；某项不想回应时可用空数组。`fixed` 是切换播放方式等短句。发布前同样需要替换其中的示例原文。

编写时参考 `PERSONA.md`，围绕“今天以这个状态来陪用户”的具体情境，保留自然互动感。角色、关系和措辞由创作者决定，代码不强制使用示例人物。
