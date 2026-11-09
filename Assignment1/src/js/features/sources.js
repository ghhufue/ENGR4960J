import { text, area, one } from './analysis/fields.js';
export const sourceSection = { type: 'sources', title: '资料与文献', singular: '来源', fields: [text('title', '资料或文献标题'), one('category', '来源用途类别', ['课程材料', '案例背景', '科学文献', '其他资料']), one('documentType', '文献类型', ['期刊文章', '专著或书章', '会议论文', '技术或调查报告', '其他'], false), text('author', '作者或机构', false), text('year', '年份', false), text('publication', '出版或发布信息', false), text('url', '链接（http / https）', false), text('doi', 'DOI', false), text('location', '页码或章节', false), area('excerpt', '相关摘录与说明', false), area('apa', 'APA 7 引用文本（人工核对）', false), one('verification', '来源核查状态', ['未核查', '已核查', '存在争议']), area('dispute', '争议说明', true, { when: { key: 'verification', values: ['存在争议'] } }), one('intended', '拟用于报告', ['是', '否', '待决定']), one('cited', '报告正文引用检查', ['已在正文引用', '尚未引用', '待核对']), text('citationLocation', '正文引用位置', false)] };
export function scientificSources(store) {
  const seen = new Set();
  return store.records('sources').filter(record => {
    const data = record.data;
    if (data.category !== '科学文献' || data.intended !== '是' || !data.title?.trim()) return false;
    const key = (data.doi || `${data.title}|${data.author || ''}|${data.year || ''}`).toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').replace(/\s+/g, '');
    if (seen.has(key)) return false; seen.add(key); return true;
  });
}
