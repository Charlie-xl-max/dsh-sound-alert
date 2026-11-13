# DeepSeek Harness 提示音插件

一个小型 DeepSeek Harness（DSH）Web UI 插件，在智能体需要你时播放提示音：

- **等待你的操作** — 当会话开始等待你的输入（工具批准、
  `ask_user_question` 提问或计划审查）时，播放柔和的上行纯五度双音钟声
  （C5 → G5）。
- **回合结束** — 当运行中的回合停止时，播放下行双音提示。

![铃铛、声波和绿色对勾](docs/preview.svg)

所有声音均在播放时通过 Web Audio API 实时合成：插件不包含音频文件、
不发起网络请求，也没有依赖或构建步骤。

## 安装

整个文件夹就是完整插件；安装过程不会修改 DSH 本身。

**从本地文件夹安装**

1. 将 `sound-alert` 文件夹放在固定位置（如需解压发布包，请保留文件夹本身）。
2. 在 DSH 中打开 **Plugins**，选择 **Add plugin**，然后选择该文件夹。
3. 确保插件条目已启用，然后重新加载 Web 页面（`Ctrl+R`）。

**通过 Git 克隆安装**

```sh
git clone https://github.com/Charlie-xl-max/dsh-sound-alert.git
```

然后按照上述三个步骤，安装克隆得到的文件夹。

也可以通过 `.tgz` 压缩包 URL 安装同一插件，或使用 `plugin_manager` 工具
从本地路径安装（使用 `install_bundle` 和文件夹的绝对路径）。

环境要求：DSH 版本的 Web UI 必须提供 Client `uiSession` 服务。
标准 Web 应用已包含此服务。

## 工作原理

插件订阅 `ctx.uiSession.sessionStatus`，这是随附的 Session UI 插件根据
Host 的 `api-session/status` 事件维护的聚合状态映射。每个发布的状态都包含
`running` 和 `pendingInteraction`；当其中任一状态发生以下变化时，插件会
播放提示音：

- `pendingInteraction` 从无到有时 → 等待提示音
- `running` 从 `true` 变为 `false` 时 → 完成提示音

如果回合停止运行是因为正在等待你的操作，则只按“等待”处理，而不会按
“完成”处理，因此仅播放等待提示音。同一类提示音的播放间隔不会小于
`throttleMs`。

## 自定义设置

[`client.js`](client.js) 顶部的 `SETTINGS` 代码块包含可调参数：

| 参数 | 含义 |
| --- | --- |
| `pending` | 启用等待提示音 |
| `done` | 启用完成提示音 |
| `volume` | `0`..`3` 音量倍率，默认为 `1.8` |
| `throttleMs` | 同一类提示音之间的最小间隔 |

音符模式定义在紧随其后的 `PATTERNS` 表中：`[频率 Hz, 偏移 s, 时长 s,
峰值, 音色]`，其中 `音色` 可为 `bell`、`sine` 或 `triangle`。
修改后请重新加载页面（`Ctrl+R`）。

其他插件也可以通过插件暴露的 Client 服务触发提示音：
`ctx.soundAlert.play('pending')` 或 `play('done')`。

## 使用限制

- 仅在 DSH Web 页面打开时响铃；页面关闭后不会播放。
- 系统静音或浏览器标签页静音时，插件保持无声。
- 浏览器可能让音频上下文保持暂停状态，直到页面收到点击或按键；插件会在
  首次交互时解锁，之后的提示音即可正常播放。

## 许可证

MIT — 详见 [LICENSE](LICENSE)。
