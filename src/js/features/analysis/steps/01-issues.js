import { text, area, one, many, refs, sources, impacts } from '../fields.js';
export const step = { number: 1, title: '识别伦理问题', english: 'Identifying Ethical Issues', goal: '明确有哪些伦理问题，以及谁受到怎样的影响。', prompt: '区分技术现象与伦理问题：描述行为、责任、义务或价值冲突。不要只记录设备出了什么故障。', sections: [
  { type: 'issues', title: '伦理问题', singular: '伦理问题', filterOrigin: 1, fields: [one('category', '问题分类', ['公司相关', '工程师相关', '其他']), text('title', '问题标题'), many('directions', '讨论方向', ['安全风险', '信息披露', '专业责任', '决策权限', '利益冲突', '其他']), area('description', '具体行为与伦理问题'), refs('stakeholders', '相关利益相关者', ['stakeholders']), sources()] },
  { type: 'stakeholders', title: '利益相关者及影响', singular: '利益相关者', hint: '至少 3 类不同群体，每类都要说明具体影响。', fields: [text('title', '群体名称', true, { suggestions: ['员工', '管理人员', '供应商', '客户或用户', '参与人员或乘员', '政府监管者', '当地社区'] }), many('impacts', '影响方向', impacts), area('impact', '这个群体受到的具体影响'), one('horizon', '影响时间范围', ['短期', '长期', '两者都有', '尚不确定'], false), refs('issues', '相关问题', ['issues']), sources()] }
] };
