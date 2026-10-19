![neko-status-plugin](https://socialify.git.ci/erzaozi/neko-status-plugin/image?description=1&font=Raleway&forks=1&issues=1&language=1&name=1&owner=1&pattern=Circuit%20Board&pulls=1&stargazers=1&theme=Auto)

<img decoding="async" align=right src="resources/readme/girl.png" width="35%">

# NEKO-STATUS-PLUGIN 🍙

- 一个适用于 [Yunzai 系列机器人框架](https://github.com/yhArcadia/Yunzai-Bot-plugins-index) 的系统状态查询插件喵~

- 有着更加精简，美观和超超超超超可爱的 UI 和的风格，并且你可以自定义头图喵~

- **使用中遇到问题请加 QQ 群咨询：[707331865](https://qm.qq.com/q/TXTIS9KhO2)**

> [!TIP]
> 在看到 [Koishi](https://koishi.js.org/) 和 [Nonebot](https://nonebot.dev/) 类似风格的插件后，身为猫猫控我与 [CikeyQi](https://github.com/CikeyQi) 立马喜欢上了如此精美的设计，于是决定将这个插件移植到 Yunzai 上，并重新修改创作了模板加上了自定义头图，人家有的咱们也可以有喵~

## 性能优化（0.0.5 fast）

原版 `#状态` 慢，主要卡在四件事：`systeminformation` 的 CPU / 网速各空等约 1 秒、每次下载随机头图、`si.graphics()` 探测 GPU、以及 PNG 整页截图。

本加速版在不改面板样式的前提下做了这些事：

| 瓶颈 | 原版 | 加速版 |
| --- | --- | --- |
| CPU / 网速 | 每次采样等待 ~1000ms | 后台每秒采样，请求直接读缓存 |
| 内存 / 磁盘 / 系统 | `systeminformation` 全量探测 | `/proc`、`os`、`fs.statfs` 即时读取 |
| GPU | 每次 `si.graphics()`，核显常被超时或虚拟显卡挡住 | Win32_VideoController / lspci / sysfs，过滤远程和虚拟显卡，成功缓存 10 分钟 |
| 头图 | 每次下载 `t.mwm.moe` 再转 base64 | stale-while-revalidate，失败走本地兜底 |
| 头像 | 截图时再走 QQ 头像 CDN | 预先转 data URI，截图 0 外网 |
| 截图 | PNG | JPEG quality 90（可改回 png） |
| 自定义命令 | 超时 5s | 默认 1.5s，空列表直接跳过 |
| 配置 | 每次读 YAML | mtime 缓存 |

机器人日志会出现：

```
[Neko状态] 采集 XXms / 截图 XXms / 合计 XXms
```

采集阶段在预热后通常是几十毫秒。截图时间仍取决于 Puppeteer 机器性能，但 JPEG + 无外网资源会明显缩短。

> 覆盖安装后请重启 Yunzai。不要用原仓库的 `#猫猫状态更新`，那会把加速补丁覆盖掉。

新增配置（锅巴可改）：`headimg_cache_ttl`、`screenshot_type`、`screenshot_quality`、`custom_timeout`。

## 安装插件

把本加速版解压到 `plugins/neko-status-plugin`（覆盖原目录），然后：

```
pnpm install --filter=neko-status-plugin
```

原版安装方式：

```
git clone https://github.com/erzaozi/neko-status-plugin.git ./plugins/neko-status-plugin
```

> [!NOTE]
> 如果你的网络环境较差，无法连接到 Github，可以使用 [GitHub Proxy](https://mirror.ghproxy.com/) 提供的文件代理加速下载服务
>
> ```
> git clone https://mirror.ghproxy.com/https://github.com/erzaozi/neko-status-plugin.git ./plugins/neko-status-plugin
> ```

## 插件配置

> [!WARNING]
> 非常不建议手动修改配置文件，本插件已兼容 [Guoba-plugin](https://github.com/guoba-yunzai/guoba-plugin) ，请使用锅巴插件对配置项进行修改

## 功能列表

安装好后，请使用 `#状态` 或 `/status` 命令触发状态面板

- [x] CPU 占用
- [x] 内存占用
- [x] 网络上下行速率
- [x] 磁盘占用
- [x] 系统信息
- [x] GPU 型号
- [x] 插件数量
- [x] 适配器信息
- [x] 收发消息数量
- [x] 好友 & 群数量
- [x] 运行时间
- [x] [自定义展示](https://github.com/erzaozi/neko-status-plugin?tab=readme-ov-file#%E8%87%AA%E5%AE%9A%E4%B9%89%E5%B1%95%E7%A4%BA)

## 效果图

<img src="https://github.com/erzaozi/neko-status-plugin/assets/61369914/b606dc41-5c7c-4199-b3da-04d96be27370" height="500" alt="renderings"/>
<img src="https://github.com/erzaozi/neko-status-plugin/assets/61369914/cf0b837e-70fb-47e8-9805-5b1ed44f751c" height="500" alt="renderings"/>

## 自定义展示

如果你想自定义展示一些想看的内容，比如近期服务器负载情况，或服务器的 IP 地址等，可以按照以下步骤操作：

1. 在锅巴的本插件配置面板中，展开 `自定义内容` 配置项，点击 `新增` 按钮
   
2. 填写 `名称` 和 `命令`，`名称` 可以随意填写，`命令` 的填写可以参考以下是两个经典的例子：

   <details>
   <summary>展示服务器公网IP</summary>
   <br>

   要查看服务器的 IP 地址，可以使用 `hostname` 命令，该命令将返回所有网络接口的 IP 地址，以空格分隔：

   ```
   144.93.144.203 5DBD:1EE5:0D88:B35F:FB27:7218:1047:8408 F5B5:7345:111D:4E03:759F:FAAD:D2C0:B95F
   ```

   我们希望仅提取第一个 IP 地址。可以使用以下命令：

   **命令：**
   ```bash
   hostname -I | awk '{print $1}'
   ```

   **命令解析：**
   1. `hostname -I`：获取所有网络接口的 IP 地址，以空格分隔
   2. `awk '{print $1}'`：提取输出中的第一个 IP 地址

   </details>

   <details>
   <summary>展示服务器负载</summary>
   <br>

   使用 `uptime` 命令可以查看服务器的负载情况。该命令返回的内容类似于以下文本：

   ```
   16:31:32 up 5 days, 22:52, 4 users, load average: 0.02, 0.01, 0.00
   ```

   这样展示的内容较多，我们希望仅提取负载值，并将其转换为百分比形式。因此，可以使用以下命令：

   **命令：**
   ```bash
   uptime | awk -F'[:,]' '{printf "%.2f%% %.2f%% %.2f%%\n", ($8 * 100) / nproc, ($9 * 100) / nproc, ($10 * 100) / nproc}' nproc=$(nproc)
   ```

   **命令解析：**
   1. `uptime`：获取系统当前的负载信息
   2. `awk -F'[:,]'`：使用 `:` 和 `,` 作为输入分隔符进行解析
   3. `printf`：格式化输出三个负载值（$8, $9, $10），相对于 CPU 核心数（通过 `nproc` 获取），并以百分比形式显示
   4. `nproc=$(nproc)`：获取当前可用的 CPU 核心数

   </details>


3. 填写好 `名称` 和 `命令` 后，点击 `确定` 按钮，即可完成自定义内容的配置

4. 如果想展示的内容无法通过一条命令获取，也可以自行编辑一个脚本文件，比如 `.bat` 或者 `.sh`，并使用命令调用它

> [!NOTE]
> 此功能依赖于 `exec` 命令，几乎可以实现所有信息的展示，包括调用已安装的软件或请求网络 API 接口。不过，由于它直接执行终端命令，请务必避免使用高风险命令，例如 `rm -rf /` 等。
>
> 在调用命令之前，建议在 Shell 或 Cmd 环境中进行测试，以确保输出符合预期。许多命令的输出可能较为详细，因此请尽量对输出进行处理，以确保美观。例如，上述例子中使用了 `awk` 进行格式化。

## 常见问题

1. 显示`The Emperor's New XXX` 是什么意思？
   - 获取不到你的设备信息
   - GPU 若一直是 New GPU：确认不是只插了远程桌面。插件会忽略 Microsoft Remote Display Adapter、Virtual Display Adapter、Hyper-V / RDP / VMware / Virtio 等虚拟显卡，只显示 Intel / NVIDIA / AMD 物理卡。核显（UHD / Iris / Arc）现在会走 Windows CIM 或 Linux lspci，不再只等 nvidia-smi。

## 支持与贡献 😽

如果你喜欢这个项目，请不妨点个 Star🌟，这是对开发者最大的动力， 当然，你可以对我 [爱发电](https://afdian.net/a/sumoqi) 赞助，呜咪~❤️

有意见或者建议也欢迎提交 [Issues](https://github.com/erzaozi/neko-status-plugin/issues) 和 [Pull requests](https://github.com/erzaozi/neko-status-plugin/pulls)。

## 相关项目 😻

- [Kabuda-czh/koishi-plugin-status-pro](https://github.com/Kabuda-czh/koishi-plugin-status-pro)
- [KomoriDev/nonebot-plugin-kawaii-status](https://github.com/KomoriDev/nonebot-plugin-kawaii-status)：NoneBot2 服务器状态查看插件 / View server status for NoneBot2

## 许可证

本项目使用 [GNU AGPLv3](https://choosealicense.com/licenses/agpl-3.0/) 作为开源许可证。加速版保留原作者版权，仅在采集 / 截图路径上做性能修改。
