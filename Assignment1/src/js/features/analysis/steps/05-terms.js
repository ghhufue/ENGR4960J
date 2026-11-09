import { text, area, many, refs, sources } from '../fields.js';
export const step = { number: 5, title: '澄清关键定义', english: 'Undertaking Definitional Clarification', goal: '明确关键术语的含义、范围及与案例的关系。', prompt: '同一个词是否会被不同角色理解成不同意思？不要用术语名称替代定义。', sections: [
  { type: 'terms', title: '术语清单', singular: '术语', hint: '至少 3 个术语，每个都需定义、澄清和案例相关性。', fields: [text('title', '术语名称', true, { suggestions: ['工程风险', '专业责任', '可接受风险', '安全裕度', '知情同意'] }), area('definition', '定义'), many('directions', '澄清方向', ['含义歧义', '适用范围', '近义概念', '角色差异', '文化语境', '其他']), area('clarification', '具体澄清'), area('relevance', '与案例的相关性'), area('alternate', '不同理解与采用理由', false), refs('related', '出现位置', ['issues', 'facts', 'assumptions']), sources()] }
] };
