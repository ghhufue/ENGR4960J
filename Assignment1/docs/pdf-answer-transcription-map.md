# testfor496.pdf → 后端数据库 誊写映射与缺口记录

- 来源文件：`d:\Downloads\testfor496.pdf`（Home Assignment 1，Challenger 事故十步案例分析，Group 7）
- 目标项目：后端 SQLite 项目 `default`（`data/workbench.sqlite`）
- 写入方式：`POST /api/projects/default/replace`，使用管理员成员令牌（`data/sync-members.json` 中 `member-1`）
- 写入结果：revision 53 → **54**，新增/更新记录 43 条，无冲突；写入前先做 `parseBackup` + `validateState` 自检
- 后续补充：三条自我反思答案由小组提供（中文原话），转写为英文版后于 revision 57 → **58** 写入 `reflections[0..2]`（153 / 202 / 154 words），PDF 中该节无答案
- 复核时线上版本：revision 56（另有一次由 `group-7` 令牌提交的焦点字段变更，见文末「并发写入提示」）

匹配等级说明：

| 等级 | 含义 |
| --- | --- |
| 高 | PDF 中该问题有对应答案，且内容逐字（或语义完全一致）写入同一问题字段 |
| 中 | PDF 有对应内容，但需要归纳、跨节拼接，或该值由我依据原文推断后填入 |
| 未填写 | PDF 该处仍是模板占位文字（如 `Issue 1, Title;`、`Element 1, Description`），或 PDF 根本没有该字段的答案，因此留空 |

---

## 1. 元信息（页面「概览」）

| PDF 出处 | PDF 内容 | 数据库字段 | 页面字段 | 匹配 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 封面 | 案例名（Challenger 事故） | `meta.title` | 案例名称 | 高 | 沿用写入前的已有值 `Space Shuttle Challenger disaster`，未改写 |
| 封面 | `Group 7: [Name 1], Yuanhao Tong, ...` | `meta.group` | 小组编号 | 高 | 写入 `Group 7` |
| 封面 | `Date:2026/10/19` | `meta.date` | 报告日期 | 高 | 写入 `2026/10/19` |
| Case introduction 段 | 整段案例介绍（约 90 words） | `meta.introduction` | 案例介绍（不超过 100 words） | 高 | 逐字写入；仅把 `couldn't` 改为 `could not`（避免撇号与 JSON 转义混淆），语义不变 |
| AI statement 段 | `[AI statement (if AI was used within the workflow ...)]` | `meta.aiStatement` | AI 使用声明 | 未填写 | PDF 仍为模板提示文字，非答案，保持留空 |
| Step 6 尾部 | `Rationale for exclusion`（脚注清单完整性） | `meta.principlesComplete` | 原则清单完整性确认 | 未填写 | 保持 `false`：PDF 只录入了 1 条原则，未确认清单完整 |

---

## 2. 成员与贡献（页面「概览 › 成员与贡献」）

| PDF 出处 | PDF 内容 | 数据库字段 | 页面字段 | 匹配 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 贡献表 | `Yuanhao Tong: Vibe code the html website` | `records.MEM-001.data.title` / `.contribution` | 成员姓名 / 本人的具体贡献 | 高 | MEM-001 原为空壳记录，本次填入第一位成员 |
| 贡献表 | `Sylviana Burhan: Preparation for step 1-5, finding out an important source.` | `records.MEM-002.data.*` | 同上 | 高 | 新建 |
| 贡献表 | `Yujie Wan: Writing why are each step important, first draft of step 1-5, finding out and exploring one journal source.` | `records.MEM-003.data.*` | 同上 | 高 | 新建（贡献描述中的 "why are each step important" 保留 PDF 原措辞） |
| 贡献表 | `[Name 1]`、`[Name 3]` | — | — | 未填写 | PDF 是占位符，无姓名与贡献，未创建记录（因此页面只显示 3 名成员，而非 5 名） |

---

## 3. 资料与文献（页面「资料与文献」）

| PDF 出处 | PDF 内容 | 数据库字段 | 页面字段 | 匹配 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 正文引用 `(Rogers et al., 1986)` + References 第 1 条 | 挑战者号总统调查委员会报告 | `records.SRC-002.data.title/author/year/publication/url/apa` | 资料或文献标题 / 作者或机构 / 年份 / 出版或发布信息 / 链接 / APA 7 引用文本 | 高 | 新建；`category=科学文献`、`documentType=技术或调查报告`、`intended=是`、`cited=待核对` 为我的归类判断（属"中"性质的人工判断，PDF 未标注） |
| References 第 2 条 | Vaughan (1990) 期刊文章 | `records.SRC-001.data.apa` | APA 7 引用文本 | 高 | SRC-001 原本已有该文献（标题/作者/年份/链接），本次补写 APA 文本；因 PDF 抽取中 DOI 被截断（`.../10.2307/23`），**未写入** `doi` 字段 |
| 正文 Step 3.2 / 3.3 引用位置 | 两项来源被正文引用 | `records.SRC-002.data.citationLocation` | 正文引用位置 | 中 | 由正文 `(Rogers et al., 1986)` 出现位置归纳填写 |
| References 第 3、4 条（序号 3./4. 为空） | 无 | — | — | 未填写 | PDF 只给了 2 条参考文献，课程要求 ≥10 条，页面「报告与提交材料」检查会提示不足 |

---

## 4. 步骤 1 · 识别伦理问题

### 4.1 伦理问题（`issues`）

| PDF 出处 | PDF 内容 | 记录 ID | 数据库字段 | 页面字段 | 匹配 |
| --- | --- | --- | --- | --- | --- |
| 1.1 Issue 1 | 是否应在航天飞机进入"常规运营"后裁撤并重组安全人员 | `ISS-002` | `.data.category`=`公司相关`、`.data.title`、`.data.description` | 问题分类 / 问题标题 / 具体行为与伦理问题 | 高 |
| 1.1 Issue 2 | Marshall 与 Kennedy 的安全办公室是否应向其监督对象汇报 | `ISS-003` | 同上 | 同上 | 高 |
| 1.1 Issue 3 | Level II 是否应批准 1983 年停止 Level III 上报飞行安全问题的变更 | `ISS-004` | 同上 | 同上 | 高 |
| 1.1 Issue 4 | Marshall 是否应把发射限制告知 Level I / Level II | `ISS-005` | 同上 | 同上 | 高 |
| 1.1 Issue 5 | NASA 是否应被允许自行监管大部分安全工作 | `ISS-006` | 同上 | 同上 | 高（**本案例选定的分析焦点**） |
| 1.2 Issue 6 | 是否应有人负责对 O 型圈数据做趋势分析 | `ISS-007` | 同上 | 同上 | 高 |
| 1.2 Issue 7 | 工程师是否应纠正 Criticality 1R 与 Criticality 1 的记录错误 | `ISS-008` | 同上 | 同上 | 高 |
| — | 原有记录（非 PDF 来源）：`Engineer, Career and Safety.` | `ISS-001` | — | — | 保留（写入前已存在，本次未改动） |

| 未填写字段 | 原因 |
| --- | --- |
| `issues.*.data.directions`（讨论方向多选） | PDF 只有问题标题与描述，未给出方向标注 |
| `issues.*.data.sources`（相关来源） | PDF 未逐条给出引用 |
| `ISS-002.data.stakeholders`、`ISS-006.data.stakeholders` | 由内容对应推断：前者→`STK-003`（安全岗位人员）、后者→`STK-004`（国会）。其余问题未填，属"中"等级推断 |

### 4.2 利益相关者及影响（`stakeholders`）

PDF 1.2 之后「Who or what is being affected, and how?」的 6 条 → `STK-001` ~ `STK-006` 的 `.data.title` + `.data.impact`，逐条对应，**匹配：高**。

| PDF 条目 | 记录 ID | 页面字段：群体名称 / 这个群体受到的具体影响 |
| --- | --- | --- |
| 1. The seven crew members, who bore the harm. | `STK-001` | 高 |
| 2. Managers who made decisions such as Jesse Moore ... bear some blame. | `STK-002` | 高 |
| 3. NASA staff in safety roles, failing to report well enough ... | `STK-003` | 高 |
| 4. Congress who relied on NASA's safety claims and funded the project. | `STK-004` | 高 |
| 5. Future crews of space shuttles who became more anxious ... | `STK-005` | 高 |
| 6. Trust from the society reduced. | `STK-006` | 高（原文即如此，第 6 项不是"群体"而是"社会信任"，按原文保留） |

未填写：`impacts`（影响方向多选）、`horizon`（影响时间范围）、`issues`（相关问题）、`sources` — PDF 均未提供。

---

## 5. 步骤 2 · 缩小分析焦点

| PDF 出处 | PDF 内容 | 数据库字段 | 页面字段 | 匹配 |
| --- | --- | --- | --- | --- |
| 第 2 节 | `We decided to narrow the focus to Issue #5 ...` | `focusId` = `ISS-006` | 选定焦点（指向 Issue 5） | 高 |
| 第 2 节 | `This issue is one of the most important direct cause of the event because ...` | `focusAnalyses.ISS-006.causality` = `直接`；`.causeReason` = 整段理由 | 与事件的因果关系 / 因果关系的依据 | 高 |
| 第 2 节 `The severity of the consequences` | `Loss of seven lives and the vehicle.` | `focusAnalyses.ISS-006.severity` | 具体后果与严重程度 | 高 |
| 第 2 节 `The scope of the consequences` | `The failure spans several NASA centers (Headquarters, Johnson, Marshall, Kennedy) and contractors.` | `.scope` | 影响范围与规模 | 高 |
| 第 2 节 `Long-term and Short-term consequences` | `In the short term, the project was forced to stop for 32 months ...` | `.shortConsequence` | 短期具体后果或不适用原因 | 高（把一个 `Description` 拆成短期/长期两句分别归位） |
| 同上 | `On the long term, the loss of trust in NASA's safety claims ... will be required.` | `.longConsequence` | 长期具体后果或不适用原因 | 高（同上） |
| 第 2 节开头整段 | 「先筛选重要/有因果/有趣的问题再深入分析」 | — | — | 未写入（属章节说明文字，不对应任何页面字段） |

未填写：`.consequenceTypes`、`.shortTypes`、`.longTypes`（后果类型多选）、`.otherReasons` / `.otherExplanation`（其他选择理由）、`.stakeholders`（受影响群体）、`.evidence`（支持事实或假设）— PDF 未按选项标注，也未逐条指向记录。

---

## 6. 步骤 3 · 整理事实与缺口

### 6.1 步骤字段（`stepData.3`）

| PDF 出处 | PDF 内容 | 数据库字段 | 匹配 |
| --- | --- | --- | --- |
| 3.1 `Date: 1986/1/28` | 案例日期 | `stepData.3.dateStatus`=`已知`、`.date`=`1986/1/28` | 高 |
| 3.1 `Location: Cape Canaveral, Florida` | 案例地点 | `stepData.3.location` | 高 |
| 3.1–3.4 | 四类事实都有实质内容 | `stepData.3.category0..3`=`有相关事实`（一般/物质与技术/个人相关/组织相关） | 高 |
| — | — | `stepData.3.dateExplanation`、`.categoryNotes`（未发现事实时的检查范围与理由） | 未填写（不适用：日期已知且四类均有事实） |

### 6.2 事实记录（`facts`，共 13 条）

| PDF 出处 | 记录 ID | 数据库字段 | 匹配 | 说明 |
| --- | --- | --- | --- | --- |
| 3.1 一般事实 | `FCT-001` | `.data.category`=`一般`、`.title`、`.statement` | 中 | 内容与 `stepData.3` 的日期/地点重复；因页面校验要求"一般事实需有对应记录"而建 |
| 3.2 物质与技术事实（整段） | `FCT-002` | `.data.category`=`物质与技术`、`.title`（归纳）、`.statement`（逐字） | 高（内容）/ 中（标题为归纳；一条记录合并了趋势、Kennedy 多项变更、51-B 数值、Criticality 1/1R 四个事实点） | `.data.sources`=`SRC-002`（PDF 原文含 `(Rogers et al., 1986)`，高）；`.data.issues`=`ISS-007, ISS-008` 为内容对应推断（中） |
| 3.3 第 1 条（Arnold Aldrich） | `FCT-003` | 个人相关 / `.title`（归纳）/ `.statement`（逐字） | 高（内容） | — |
| 3.3 第 2 条（Raines / Jackson / Lunney） | `FCT-004` | 同上 | 高（内容） | `.data.issues`=`ISS-004`（推断，中） |
| 3.3 第 3 条（Jesse Moore 被误导） | `FCT-005` | 同上 | 高（内容） | — |
| 3.3 第 4 条（Wiley Bunn 引言） | `FCT-006` | 同上 | 高（内容） | `.data.sources`=`SRC-002`（原文含 `(Rogers et al., 1986)`，高） |
| 3.3 第 5 条（1/27 电话会议无安全代表） | `FCT-007` | 同上 | 高（内容） | — |
| 3.4 第 1–6 条（组织相关事实） | `FCT-008` ~ `FCT-013` | 组织相关 / `.title`（归纳）/ `.statement`（逐字） | 高（内容）/ 中（标题为归纳） | `.data.issues`：`FCT-009`→`ISS-003`、`FCT-010`→`ISS-004`、`FCT-013`→`ISS-006`（推断，中） |

未填写：全部事实的 `.data.verification`（保留页面默认值 `未核查`——PDF 未声明核查状态）、`.data.dispute`、未列出的 `.data.issues` 与 `.data.sources`。

### 6.3 缺失事实（`gaps`）

| PDF 出处 | PDF 内容 | 记录 ID | 数据库字段 | 匹配 |
| --- | --- | --- | --- | --- |
| 3.5 第 1 条 | `Why was the launch constraint not reported upward?` | `GAP-001` | `.data.title` | 高 |
| 3.5 第 2 条 | `Why did regulators not push harder?` | `GAP-002` | `.data.title` | 高 |
| 3.5 第 3 条 | `Was this issue caused deliberately?` | `GAP-003` | `.data.title` | 高 |

未填写：`.data.directions`（缺口方向）、`.data.description`（具体缺什么、为什么重要）、`.data.progress`（保留默认 `待调查`）、`.data.owners`、`.data.sources`。

---

## 7. 步骤 4 · 提出合理假设（`assumptions`）

| PDF 出处 | 数据库字段 | 匹配 | 说明 |
| --- | --- | --- | --- |
| Question 1：`Why was the launch constraint not reported upward?` | `ASM-001.data.question` | 高 | |
| `Reasonable assumption 1: Marshall treated it as an internal matter.` | `ASM-001.data.statement` | 高 | |
| `Description (reason for making an assumption):` 该条说明 | `ASM-001.data.reason` | 高 | 逐字 |
| Question 2 / Reasonable assumption 2 / 说明 | `ASM-002.data.question/.statement/.reason` | 高 | 说明中含 `(Vaughan, 1990)` → `.data.sources`=`SRC-001`（高） |
| Question 3 / Reasonable assumption 3（`No.`）/ 说明 | `ASM-003.data.question/.statement/.reason` | 高 | `statement` 就是 PDF 的 `No.`，忠实保留 |
| 三条 `Reasonable assumption N` | `.data.title` | 中 | PDF 只给编号标签，标题由我按假设陈述归纳（如 `Launch constraint was treated as an internal matter`） |
| 三条缺口问题 | `.data.gaps`=`GAP-001/002/003` | 高 | PDF 的三问与三条缺失事实一一对应 |
| 后续分析使用这些假设 | `.data.status`=`暂时采用` | 中 | 推断：PDF 第 4/6 节表明三条假设被用于后续分析；页面默认值为 `待核查` |

未填写：`.data.basisTypes`（依据类型）、`.data.replacement`、`.data.opposite`（若假设不成立会怎样改变判断）、`.data.evidence`。

---

## 8. 步骤 5 · 澄清关键定义（`terms`）

| PDF 出处 | 术语 | 记录 ID | 数据库字段 | 匹配 |
| --- | --- | --- | --- | --- |
| Term 1 | Quality Escape | `TRM-001` | `.data.title` / `.definition` / `.clarification` / `.relevance` | 高（三问逐字对应） |
| Term 2 | Independence | `TRM-002` | 同上 | 高 |
| Term 3 | Autonomy | `TRM-003` | 同上 | 高 |

未填写：`.data.directions`（澄清方向多选）、`.data.alternate`（不同理解与采用理由）、`.data.related`（出现位置关联）、`.data.sources`。

---

## 9. 步骤 6 · 应用伦理原则

| PDF 出处 | 数据库字段 | 匹配 | 说明 |
| --- | --- | --- | --- |
| `Principle: Public safety comes first.` | `PRN-001.data.title` | 高 | |
| `The safety program existed to catch hazards before crews flew.` | `PRN-001.data.original` | 高 | 作为"课程原则原文" |
| 模板句 `Describe why you think it is applicable to the case :`（未填） | `PRN-001.data.applicability`=`待讨论` | 中/待补 | 无适用理由可誊写，故标为待讨论；`.data.applicableReason/.excludedReason` 均留空 |
| `Principle 2, 3, n, ...`、`Rationale for exclusion`、`Conflicts Between Principles`（举例 `Principle 6 (honesty) and business interests`） | — | 未填写 | PDF 中这些仍是模板占位/示例，未创建 `principles` 与 `conflicts` 记录 |
| — | `stepData.6.conflictStatus`、`.noConflictReason` | 未填写 | PDF 冲突段落无实际判断 |

未填写：`PRN-001.data.number`（课程编号）、`.location`（出处或页码）、`.issues`、`.evidence`、`.sources`；`conflicts` 记录 0 条。

---

## 10. 步骤 7–10 与反思：PDF 中仍是模板占位，全部未填写

| 页面位置 | PDF 状态 | 数据库 | 结果 |
| --- | --- | --- | --- |
| 步骤 7 · 复核分析过程 | 正文说"发现了若干必需要素"，但随后只有 `Element 1, Description` / `Element 2, Description` 模板行 | `reviews` 记录 0 条；`stepData.7.topic0..4`、`.scopeReason` 为空 | 未填写（"发现遗漏"这一结论无法落到具体要素上，故未推断填表） |
| 步骤 8 · 形成解决方案 | `Issue 1, Title; Short-term solution –` / `Long-term solution –` 模板行 | `solutions` 仅保留原有空记录 `SOL-001`（只有默认状态 `候选`） | 未填写 |
| 步骤 9 · 检查现实约束 | 四类约束下均为 `Practical constrain 1; Name ...` 模板行 | `constraints` 记录 0 条；`stepData.9.category0..3` 为空 | 未填写 |
| 步骤 10 · 预防未来伦理问题 | `Issue 1; Description; Engineering Solution + Governmental/Legal solution + ...` 模板行 | `future` 记录 0 条 | 未填写 |
| 第 11 节 · 自我反思（3 问） | 三问均只有 `Answer (150 words):` | `reflections[0..2]` | 不适用（PDF 未给答案）。小组自行提供中文答案后，已转写为英文版写入（153 / 202 / 154 words）：①AI 与人的分工；②与 AI 的有效对话模式及与人对话的差异；③未核查就接受的后端接口/同步机制/数据库代码 |
| 开发迭代记录 | PDF 只提到 `Yuanhao Tong: Vibe code the html website` | `iterations` 记录 0 条 | 未填写（页面提示"尚未登记开发迭代"） |

另外，第 3、4、5、6、7、9、10 节开头的「方法说明」段落（如"The first step of case analysis is to figure out..."）属于章节说明文字，不对应任何页面字段，均未写入。

---

## 11. 未填写字段汇总（按页面区块）

| 页面区块 | 未填写的字段 |
| --- | --- |
| 概览 › 报告与提交材料 | 案例名称（沿用旧值，未改写）、AI 使用声明、原则清单完整性确认 |
| 概览 › 成员与贡献 | PDF 中的 `[Name 1]`、`[Name 3]` 两位占位成员未创建 |
| 资料与文献 | 参考文献仅 2 条（要求 ≥10）；`SRC-001.data.doi`（PDF 中 DOI 被截断）；两条来源的 `cited` 均为 `待核对` |
| 步骤 1 | 所有问题的「讨论方向」「相关来源」；除 `ISS-002`/`ISS-006` 外的问题「相关利益相关者」；所有利益相关者的「影响方向」「影响时间范围」「相关问题」「相关来源」 |
| 步骤 2 | 后果类型、短期后果方向、长期后果方向、其他选择理由、其他理由说明、受影响群体、支持事实或假设 |
| 步骤 3 | 步骤级：未知或争议说明、未发现事实时的检查范围与理由；事实：核查状态（保留默认 `未核查`）、争议内容、部分相关问题与来源；缺口：缺口方向、具体缺什么、调查进展（保留默认 `待调查`）、调查负责人、相关来源 |
| 步骤 4 | 依据类型、否定或替代的新证据、若假设不成立会怎样改变判断、支持事实或假设 |
| 步骤 5 | 澄清方向、不同理解与采用理由、出现位置、相关来源 |
| 步骤 6 | 课程编号、出处或页码、适用理由、对应伦理问题、证据、来源；是否发现冲突；`conflicts` 记录 |
| 步骤 7 | 五个复核方向、复核范围与依据、遗漏发现与行动记录 |
| 步骤 8 | 全部方案字段（PDF 无内容） |
| 步骤 9 | 四类约束检查、未发现约束的检查范围与理由、约束记录 |
| 步骤 10 | 全部未来情景与预防措施字段（PDF 无内容） |
| 反思 | 已填写（v58 写入，非 PDF 答案，由小组提供） |

---

## 12. 我做的判断（需要你们复核）

1. **`category` 归类**：步骤 1 的问题分类直接用 PDF 的 Company-Related / Engineers-Related 分组（高匹配）；文献与事实的归类（如把总统调查委员会报告标为"科学文献"、"拟用于报告=是"）属人工判断。
2. **`statement` / 数值忠实**：PDF 原文的语法问题（如 `didn't thought of`、`was not object enough`、`secutity`）按原文保留，未替你们修正。
3. **`meta.introduction` 一处改写**：`couldn't` → `could not`。
4. **归纳型标题**：事实记录、假设记录的 `title` 在原 PDF 中没有独立标题行，是我根据陈述归纳的（表格中已标"中"）。
5. **推断型关联与状态**：`issues`↔`facts`↔`stakeholders` 的部分关联、假设 `status=暂时采用`、`principles.applicability=待讨论` 均为推断或留空处理，未替你们给出 PDF 没有的判断。
6. **保留原有数据**：`ISS-001`（工程师职业与安全）、`SOL-001`（空方案）、`MEM-001`（原空记录被复用为 Yuanhao Tong）都保留，未删除。

## 13. 并发写入提示（重要）

写入后 2 分钟内，后端历史出现两次由 `group-7` 令牌提交的提交（v55、v56），内容只有 `focusId` 在两个值之间来回切换：

- v55：`ISS-006` → `ISS-003`
- v56：`ISS-003` → `ISS-006`（当前焦点仍是我写入的 `ISS-006`）

这说明当时有另一个已连接页面在提交本地草稿。**建议在继续编辑前先刷新页面（或点「立即同步」），让本地草稿对齐到最新版本**，否则本地旧草稿的提交可能覆盖本次誊写的部分字段。当前无待裁定冲突（0 条）。
