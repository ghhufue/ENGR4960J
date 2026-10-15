# 字段级协作后端：运行与协议

实现状态：已接入现有前端，采用 Node.js 24+ 内置 SQLite，无第三方应用依赖。原项目级乐观锁提案保留在 `backend-sync-design.md`；普通编辑已改为本文的字段快照协议。

## 本机运行

```powershell
npm run server
```

打开 http://127.0.0.1:5173，点击顶部“连接协作”，项目编号使用 `default`，本机开发令牌留空，点击“连接项目”。这个命令同时提供页面与 API；不要同时在相同端口运行 `npm run dev`。

数据库默认在 `data/workbench.sqlite`，重启继续读取原文件。`npm run dev` 仍只提供离线前端；最终单文件也继续支持离线使用。本地页面默认使用同源 API；GitHub Pages 页面使用配置的公网 API。

连接前的离线项目仍保存在原 localStorage 键中。连接后如需迁移已有项目，先从离线模式导出 JSON，再用管理成员身份连接并从备份导入；导入前会下载当前团队内容。断开连接可返回原来的离线项目。

协作登录表单会在此浏览器的 localStorage 中记住最后输入的项目编号和令牌，并按 API 来源隔离。下次打开“连接协作”会默认填充，修改后更新保存；“断开连接”保留填充偏好，“清除记住的登录”移除偏好。刷新时仍通过 sessionStorage 恢复当前连接；关闭浏览器再打开时，可使用填好的信息点击“连接项目”。清除网站数据也会移除记住的信息。

## 给组员开放访问

先生成每人独立的访问令牌，首个成员为管理员：

```powershell
npm run sync:members -- 管理员 组员A 组员B
$env:SYNC_MEMBERS_FILE = 'data/sync-members.json'
$env:HOST = '0.0.0.0'
npm run server
```

本地打开 `data/sync-members.json`，分别向对应组员提供自己的令牌。配置已被 Git 忽略；生成命令不覆盖已有文件，也不把令牌打印到日志。成员 ID、名称、权限和令牌均由服务端配置确定，不接受提交时自报身份。

如需共享组员口令，可在对应成员对象中额外设置 `accessCode`（6 至 128 位字母、数字、下划线或连字符），保存后重启后端。网页“成员访问令牌”框同时接受该成员的 `token` 和 `accessCode`，两者映射到同一身份和权限；共享口令下的修改按同一成员记录。仅在私有成员配置中保存实际口令。不同成员的登录凭据不能重复；未配置 `accessCode` 时不会开放额外入口。

成员访问 `http://主持机局域网IP:5173`，点击“连接协作”并输入自己的令牌。主持机需开机、网络设备间可达、端口允许访问。跨网络部署使用有持久化磁盘的单个主机与 HTTPS；数据库目录不通过静态服务暴露。

可用环境变量：`HOST`（默认 `127.0.0.1`）、`PORT`（默认 `5173`）、`SYNC_DATA_DIR`（默认 `data`）、`SYNC_MEMBERS_FILE`（成员配置路径）、`SYNC_ALLOWED_ORIGINS`（逗号分隔的完整来源，如 `https://ghhufue.github.io`，不包含项目路径）。无成员配置时仅允许回环地址的本机开发访问，不能匿名开放到局域网。

## GitHub Pages 与 Sakura FRP

首次生成成员配置，然后启动正式后端：

```powershell
npm run sync:members
npm run server:public
```

已有 `data/sync-members.json` 时跳过生成步骤，该文件不会被覆盖。公网启动模式要求至少一个成员，默认监听 `127.0.0.1:5173`，数据库仍为 `data/workbench.sqlite`；保持该进程和 Sakura FRP 运行。电脑重启后需重新启动。

Sakura 使用 HTTPS 隧道绑定 `api.jixrclub.com`，本地目标为 `127.0.0.1:5173`，开启自动 HTTPS 并加载此域名的受信任证书。GitHub Pages 上点击“连接协作”，项目编号为 `default`，填写私有配置中分配给该成员的令牌。新建服务器不会自动导入各浏览器已有的离线内容；管理员可先导出 JSON 备份，再连接服务器并导入。

`src/js/core/sync-config.js` 为 `ghhufue.github.io` 指定 `https://api.jixrclub.com`；其他页面继续使用同源 API。后端仅允许明确配置的来源，响应携带 Authorization/JSON 的 OPTIONS 预检，CORS 不替代身份验证。更换 Pages 来源或后端域名时，同时更新此配置和 `SYNC_ALLOWED_ORIGINS`。推送 `main` 后由现有 GitHub Actions 发布 `src/`，不上传后端、令牌或数据库。

## 实际同步规则

- 首次编辑保存字段快照；连续输入更新待提交的新值，不改变首次快照。输入控件取得焦点时也保留显示内容对应的快照，防止后台更新后使用错误基线。
- 停止输入约 900 ms 后提交；一个客户端同一时刻只有一笔写请求。可见页面约 2.5 秒检查更新，后台标签页约 10 秒；回到前台立即检查。
- 后端当前值等于快照时，用新值替换；后端已等于新值时当作重复内容处理。
- 当前值与快照不同且与新值也不同，保存为待裁定冲突，保留基线、服务器当时值、新值、提交者和时间。团队当前内容不被覆盖；同批其他有效字段仍可保存。
- 业务字段里的文字数组取稳定去重并集：先保留后端顺序，再追加本次提交的新项。**取消勾选、提交空数组不会删除原有项。** 去掉团队已有项需要有意导入调整后的项目；普通数组保存不支持删除。这是用户指定合并规则的结果。
- `records` 是结构性的记录集合，由服务器分配编号；`reflections` 是三个固定位置的回答，逐位置按文字字段检查，不将不同题目合成一个数组。
- 缺失字段与空文字不同；数组按值去重，文字、布尔值按结构比较。主题、语言、个人路由不提交。
- 编辑已被他人删除的记录仍保存为冲突；管理员可保留删除结果。如需采用编辑内容，先从历史恢复该记录。

客户端本地保留工作副本、未提交字段及未知结果的在途请求。换设备加载的是已提交内容；原设备尚未联网的草稿仍在原设备。刷新可恢复当前标签页的同步缓存；失败响应使用原 `requestId` 重试，避免重复创建记录或重复写日志。关闭标签页前应同步或导出；新标签页不会自动接管另一个标签页未提交的草稿。

“已保存本地”和“已同步”是两个独立状态。网络失败保留草稿；服务器拒绝无效字段批次时显示“提交被拒绝”，可在协作面板导出并放弃失败批次，然后重新编辑。无法确认结果的请求不可直接断开，以免丢失重试所需信息。

## 人工裁定与历史

点击顶部同步按钮进入“小组协作”：查看修改前快照、后端当前内容和提交的新内容。管理员可以“保留后端内容”或“采用提交内容”，普通成员只能查看。裁定也带当前字段快照；如果裁定期间字段又变化，后端拒绝过期决定，页面加载最新数据后可重试。

“修改历史”显示最近 30 次提交的成员、时间、字段变化和冲突事件。可导出某个版本；管理员可把历史快照恢复为新版本。恢复保留历史和已发出的编号计数，并要求重新复核。API 支持分页查看更多历史。

普通字段编辑无需项目级版本匹配。**整份导入、重置和历史恢复**仍要求 `baseRevision` 匹配，因为这些操作有意替换整个项目；仅管理员有权执行。

## API

所有项目 API 使用 `Authorization: Bearer 成员令牌`；本机无配置开发模式除外。当前提供一个 `default` 项目。

| 方法与路径 | 内容 |
| --- | --- |
| `GET /api/health` | 服务状态，不含项目数据 |
| `GET /api/projects/default` | 当前状态、事件 revision、待裁定冲突、当前成员身份 |
| `GET /api/projects/default?ifRevision=12` | 无变化返回 204；事件 revision 包含冲突提交与裁定 |
| `POST /api/projects/default/changes` | 字段操作批次 |
| `POST /api/projects/default/records` | 服务器分配编号并新增记录 |
| `GET /api/projects/default/conflicts` | 当前所有待裁定冲突 |
| `POST /api/projects/default/conflicts/:id/resolve` | 管理员裁定 |
| `GET /api/projects/default/history?before=20&limit=30` | 分页历史，limit 最大 100 |
| `GET /api/projects/default/revisions/:revision` | 历史快照 |
| `POST /api/projects/default/replace` | 管理员导入、重置或恢复 |

字段保存示例：

```json
{
  "requestId": "a-unique-request-id-001",
  "operations": [
    {
      "kind": "set",
      "path": ["meta", "group"],
      "base": { "exists": true, "value": "原小组编号" },
      "next": { "exists": true, "value": "新的小组编号" }
    }
  ]
}
```

缺失快照写为 `{ "exists": false }`，不能同时带 value。常用路径是 `['records', 'FCT-001', 'data', 'description']`、`['notes', '3']`、`['stepData', '7', '字段名']`、`['focusAnalyses', 'ISS-001', 'causeReason']`、`['reflections', '0']`、`['focusId']`。仅接受已配置业务字段，拒绝原型路径、元数据篡改及无效字段类型。

删除记录使用 `kind: 'delete'`、`path: ['records', id]`、完整原记录 base、`next: { exists: false }`，并在后端检查引用。复核操作额外携带 `reviewState` 依据快照，服务器验证内容并重新生成规范指纹。

人工裁定请求包含 `requestId`、`choice`（`current`、`proposed` 或 `custom`）和 `expected` 当前字段快照；`custom` 额外传 `value` 快照。前端提供前两个选项，API 也支持裁定时填写自定义内容。

写入响应为 `{ projectId, revision, state, conflicts, results }`，`results` 中冲突操作的状态为 `pending`。冲突已可靠入队时 HTTP 返回 200；它不代表提议已经成为团队当前内容。无效请求返回 400/422，认证或权限失败返回 401/403，裁定或整份替换的快照过期返回 409。

相同 `requestId` 必须以相同成员身份、相同请求体重试；不得改变其中的新值或顺序。当前状态、完整历史、冲突记录、幂等结果均在同一 SQLite 事务内保存；事务提交完成后才返回成功。

## 备份与测试

```powershell
npm run sync:backup
npm run check
npm test
npm run test:sync-browser
```

备份命令使用 SQLite 在线备份接口，可在服务运行时执行，输出到 `data/backups/`；不要在 WAL 模式下只复制主数据库文件。备份需要另存一份到独立位置。恢复时停止服务，将完整备份放到一个新的 `SYNC_DATA_DIR` 中并命名为 `workbench.sqlite`，再启动。

自动测试涵盖 HTTP、字段并发、数组去重、人工裁定竞争、身份、事务回滚、请求幂等、记录版本与引用保护、SQLite 重启加载、保存期间的新输入、失去响应后的草稿恢复。双浏览器检查需要本机 Chrome 或 Edge，也可通过 `BROWSER_EXECUTABLE` 指定 Chromium；测试使用独立临时资料与数据库，不读取日常浏览器账号，也不修改正式数据库。

Node.js 24.x 的 `node:sqlite` 会提示实验功能警告。本项目已将驱动限制在服务端存储模块内；前端没有数据库依赖。
