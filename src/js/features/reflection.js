import { text, area, many, refs } from './analysis/fields.js';
export const REFLECTIONS = [
  'AI 如何参与决定最终产物的形态？',
  '与 AI 设计程序时，哪些对话模式特别有用？与和人类对话有何不同？',
  '找出一处在代码或文案中未经核查就接受的 AI 生成内容：它是什么？'
];
export const memberSection = { type: 'members', title: '成员与贡献', singular: '成员', fields: [text('title', '成员姓名'), area('contribution', '本人的具体贡献', false)] };
export const iterationSection = { type: 'iterations', title: '开发迭代记录', singular: '迭代记录', fields: [text('title', '迭代主题'), text('date', '日期', false), refs('members', '参与成员', ['members']), text('tool', 'AI 工具', false), many('directions', '活动方向', ['需求讨论', '界面设计', '编码', '试用检查', '修正', '文案调整', '其他']), area('purpose', '提示目的与对话方式'), area('problem', '试用中发现的问题', false), area('result', '修改结果与设计取舍'), area('unchecked', '未经核查接受的代码或文案、位置与后续核查', false), area('screenshots', '实际交互截图文件名与说明（仅索引）', false)] };
