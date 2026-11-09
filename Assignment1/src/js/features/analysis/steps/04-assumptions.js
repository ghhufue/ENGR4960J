import { text, area, one, many, refs, evidence, sources } from '../fields.js';
export const step = { number: 4, title: '提出合理假设', english: 'Reasonable Assumptions', goal: '围绕信息缺口提出暂时推断，并保留推理依据。', prompt: '假设应基于可用事实、专业经验或逻辑推断。如果相反假设成立，判断会如何改变？', sections: [
  { type: 'assumptions', title: '合理假设', singular: '假设', fields: [text('title', '假设标题'), refs('gaps', '对应信息缺口', ['gaps'], true), area('question', '为缺口提出的问题'), area('statement', '合理假设陈述'), many('basisTypes', '依据类型', ['已有事实', '专业经验', '逻辑推断', '其他']), area('reason', '为什么这个假设合理'), evidence(), sources(), one('status', '假设状态', ['暂时采用', '待核查', '已被证据否定', '已由事实替代']), refs('replacement', '否定或替代的新证据', ['facts'], true, { when: { key: 'status', values: ['已被证据否定', '已由事实替代'] } }), area('opposite', '若假设不成立，会怎样改变判断？', false)] }
] };
