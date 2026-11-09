# Assignment 2 · Responsibility Workbench

用于分析 ENGR4960J 的远程机器人手术案例。网页预置教师题设、待查材料和候选行动，组员可以编辑记录、引用证据并填写三种模型及责任缺口的结论。

## 本地运行

在 `Assignment2` 目录使用 Node.js 24 运行以下命令。

```powershell
npm run dev
```

打开 [本地工作台](http://127.0.0.1:5174)。草稿保存在当前浏览器。使用 **Export → Download JSON** 保存可导入的项目，使用 **Download Markdown** 导出分析。不同浏览器和打开方式可以通过 JSON 迁移草稿。

## 离线演示

```powershell
npm run build
```

双击 `dist/index.html` 即可离线使用。课程阅读的外部链接需要网络。

案例见 [case.txt](docs/case.txt)，设计见 [实现计划](docs/implementation-plan.md)。
