import { textCount } from '../core/utils.js';

const fields = {
  issues: ['description'], stakeholders: ['impact'], focus: ['causeReason'],
  facts: ['statement'], gaps: ['description'], assumptions: ['statement'],
  terms: ['clarification'], principles: ['applicableReason', 'excludedReason', 'pendingReason'],
  conflicts: ['resolution'], review: ['scopeReason'], reviews: ['description'],
  solutions: ['short', 'long', 'reason'], constraints: ['description'], future: ['scenario']
};
function context(store, target) {
  if (target === 'focus') return { type: 'focus', data: store.focusData() };
  if (target === 'step:7') return { type: 'review', data: store.state.stepData[7] || {} };
  const record = store.get(target);
  return record && !record.archived ? record : { type: '', data: {} };
}
export function supportsReflection(store, target, key) {
  return fields[context(store, target).type]?.includes(key) || false;
}
export function reflectionQuestions(store, target, key) {
  if (!supportsReflection(store, target, key)) return [];
  const { type, data } = context(store, target), value = String(data[key] || '').trim(), questions = [];
  const add = (condition, question) => questions.push({ condition, question });
  const linked = (field, types) => (data[field] || []).filter(id => { const record = store.get(id); return record && !record.archived && (!types || types.includes(record.type)); });
  const general = {
    issues: '这里涉及谁的行为、责任或价值冲突？怎样区分技术故障与伦理问题？',
    stakeholders: '这个群体具体受到什么影响？直接影响与间接影响是否不同？',
    focus: '为什么优先分析这个问题？如果选另一个问题，会遗漏或突出什么？',
    facts: '哪些内容有可核查的来源？哪些属于推断或事后解释？',
    gaps: '缺少这项信息会影响哪个判断？可以通过什么途径补充？',
    assumptions: '这个假设依据什么？如果相反假设成立，判断会怎样改变？',
    terms: '不同角色会怎样理解这个词？你们选择的含义适用于什么范围？',
    principles: '这个原则与案例中的具体行为有什么关系？适用或排除的依据是什么？',
    conflicts: '如果另一位组员给出相反的优先顺序，他可能依据什么？',
    review: '回看前面的记录，哪些依据、解释或受影响群体还值得重新检查？',
    reviews: '这个发现需要修改哪些记录？怎样确认后续行动已经完成？',
    solutions: '谁负责采取什么行动？怎样判断行动有效，又可能产生什么代价？',
    constraints: '这个限制怎样影响实际选择？是否存在缓解办法或替代方案？',
    future: '什么变化会触发这个新问题？它与历史问题有什么区别？'
  };
  if (!value && type !== 'review') return [{ condition: '这段内容尚未填写。', question: general[type] }];
  if (type === 'issues') {
    const groups = new Set(store.records('stakeholders').map(record => record.data.title?.replace(/\s/g, '').toLowerCase()).filter(Boolean));
    if (groups.size < 3) add('当前登记的不同群体少于三类。', '除了直接参与者，是否还有公众、监管者、环境或未来使用者受到影响？');
    if (!linked('stakeholders', ['stakeholders']).length) add('这条问题尚未关联有效的利益相关者记录。', '这个问题影响了哪些已登记群体？是否需要建立关联或补充群体？');
    if (/安全|风险|\b(?:safety|risks?)\b/iu.test(value)) add('文字中出现了安全或风险相关词。', '谁承担风险，谁获得收益？作出决定的人是否掌握并披露了风险信息？');
    if (!linked('sources', ['sources']).length) add('这条记录尚未关联有效来源。', '哪些陈述需要来源支持？是否应将未确认的部分记录为事实缺口或假设？');
  }
  if (type === 'stakeholders') {
    if (!/间接|公众|环境|未来|社区|\b(?:indirect|public|environment|future|communities|community)\b/iu.test(value)) add('未匹配到间接影响的提示词。', '是否还存在间接、长期或案例中没有点名的受影响者？请结合实际内容判断。');
    if (!linked('issues', ['issues']).length) add('这个群体尚未关联有效的伦理问题。', '这项影响对应哪个伦理问题？需要补充问题还是建立关联？');
  }
  if (type === 'focus') {
    if (data.causality === '尚不确定') add('因果关系被标为尚不确定。', '还需要什么证据，才能区分直接原因、间接原因和同时发生的现象？');
    if (!linked('evidence', ['facts', 'assumptions']).length) add('焦点分析尚未关联支持事实或假设。', '因果判断依赖哪些事实或假设？如果依据改变，焦点选择会改变吗？');
  }
  if (type === 'facts') {
    if (!linked('sources', ['sources']).length) add('这条记录尚未关联有效来源。', '能否找到原始资料或交叉核对？在此之前应如何标注核查状态？');
    if (data.verification !== '已核查') add('这条事实尚未标为已核查。', '需要核对哪些具体内容？有争议时，应怎样区分各方说法？');
  }
  if (type === 'gaps') {
    if (!linked('owners', ['members']).length) add('这个缺口尚未关联调查负责人。', '谁可以寻找这项信息？若最终无法获得，应怎样说明不确定性？');
    add('正在反思一项信息缺口。', '哪个结论依赖这项缺失信息？是否需要建立明确标注的合理假设？');
  }
  if (type === 'assumptions') {
    if (!linked('gaps', ['gaps']).length) add('这个假设尚未关联有效的信息缺口。', '它具体填补哪个缺口？这是有必要的推断，还是可以直接核查的事实？');
    if (!String(data.opposite || '').trim()) add('尚未填写假设不成立时的影响。', '如果这个假设不成立，哪些判断或方案需要重新考虑？');
    if (!linked('evidence', ['facts', 'assumptions']).length && !linked('sources', ['sources']).length) add('这个假设尚未关联依据记录或来源。', '依据来自已知事实、专业经验还是逻辑推断？怎样让其他组员核对？');
  }
  if (type === 'terms' && !String(data.alternate || '').trim()) add('尚未填写不同理解与采用理由。', '换成管理者、工程师或公众的视角，这个词还会表达同一种意思吗？');
  if (type === 'principles') {
    if (!linked('issues', ['issues']).length) add('这个原则尚未关联有效的伦理问题。', '它适用于哪个具体问题？支持适用或排除的理由是否针对这个案例？');
    if (data.applicability === '不纳入') add('这个原则被标为不纳入。', '不纳入是因为确实不相关，还是因为与其他利益冲突？两者应如何区分？');
  }
  if (type === 'conflicts') {
    if (linked('principles', ['principles']).length + (String(data.otherInterest || '').trim() ? 1 : 0) < 2) add('已关联的原则与其他利益对象不足两个。', '冲突的双方分别是什么？是否需要补充原则或明确其他利益诉求？');
    if (data.approach === '优先满足某项原则') add('处理方向选择了优先满足某项原则。', '为什么这个原则在此情境下优先？什么情况会使优先顺序改变？');
  }
  if (type === 'review') {
    if (store.records('gaps').length && !store.records('assumptions').length && !String(store.state.stepData[4]?.noAssumptionsReason || '').trim()) add('已有信息缺口，但尚无假设或无需假设的说明。', '这些缺口需要暂时假设、继续调查，还是说明为何不会影响判断？');
    if (store.records('facts').some(record => record.data.verification !== '已核查')) add('事实记录中仍有未核查或有争议的内容。', '哪些后续判断依赖这些记录？是否需要保留其他解释或推迟确认？');
    if (store.records('reviews').some(record => ['待处理', '处理中'].includes(record.data.status))) add('复核发现中仍有未完成的行动。', '哪些记录需要修订？怎样确认这些发现已经得到处理？');
  }
  if (type === 'reviews' && !linked('related').length) add('这项发现尚未关联需要修订的记录。', '它改变了前面哪项分析？是否需要登记新问题、事实或缺口？');
  if (type === 'solutions') {
    if (!linked('issues', ['issues']).length) add('这个方案尚未关联有效的伦理问题。', '它具体解决哪个问题？是否同时回应了复核中新发现的问题？');
    if (key === 'short' && !String(data.long || '').trim()) add('尚未填写长期改进。', '临时措施之后，怎样减少同类问题再次发生？');
    if (key === 'long' && !String(data.short || '').trim()) add('尚未填写短期行动。', '长期改进生效前，当前风险应由谁采取什么行动控制？');
    if (key === 'reason') add('正在反思方案的选择理由。', '反对这个方案的最强理由是什么？哪些事实或假设改变后，你会改变选择？');
    if (!linked('owners', ['stakeholders']).length) add('这个方案尚未关联责任主体。', '谁有权限、资源和责任落实这些行动？');
  }
  if (type === 'constraints') {
    if (data.scope !== '案例整体' && !linked('solutions', ['solutions']).length) add('这个约束尚未关联受影响方案。', '它具体限制哪个方案？需要调整行动、时间安排还是责任分工？');
    if (!String(data.adjustment || '').trim()) add('尚未填写影响与应对调整。', '这是无法改变的限制，还是可以协调或缓解的条件？');
  }
  if (type === 'future') {
    if (!String(data.difference || '').trim()) add('尚未填写与此前问题的区别。', '这个情景新增了什么技术、参与者或制度条件？为何不是历史问题的简单重述？');
    if (!String(data.engineering || '').trim() || !String(data.governance || '').trim()) add('工程措施或政府与法律措施尚未填写。', '技术设计和制度安排可以怎样配合，减少这个情景发生的可能性或损害？');
  }
  const count = textCount(value);
  if (count.chinese + count.words * 2 < 24) add('这段内容较简短；长度本身不代表质量。', '是否需要补充具体对象、行为、理由或依据，让其他组员能够核对？');
  add('可进一步自查。', general[type]);
  return questions.slice(0, 3);
}
