// 临时的本地 mock AI 服务，仅用于验证 AI 面试流程，验证完成后删除
import http from 'node:http';

const questions = [
  { question: '你在示例项目中遇到过哪些技术难点？你是怎么推进解决的？', category: '项目深挖', intent: '考察复杂项目的问题定位与跨团队推进能力' },
  { question: '请介绍示例项目的架构设计和主要技术取舍。', category: '技术原理', intent: '考察架构理解深度' },
  { question: '你如何衡量性能优化的收益？请结合虚构示例说明。', category: '技术原理', intent: '考察性能优化的量化能力' },
];

let questionCursor = 0;

function reply(kind) {
  if (kind === 'test') return '连接成功';
  if (kind === 'questions') {
    return JSON.stringify(Array.from({ length: 3 }, () => {
      const q = questions[questionCursor % questions.length];
      questionCursor += 1;
      return q;
    }));
  }
  if (kind === 'summary') {
    return '```json\n' + JSON.stringify({
      score: 82,
      conclusion: '整体表现良好，项目深度足够，建议进入下一轮技术面。',
      strengths: ['复杂项目主导经验清晰', '性能优化有量化结果'],
      improvements: ['底层原理阐述可以更体系化'],
      actions: ['复盘项目架构的实现细节', '准备一次完整的性能优化方法论讲述'],
    }) + '\n```';
  }
  return JSON.stringify({
    score: 78,
    summary: '回答结构完整，讲清了背景和方案，但缺少关键指标的量化对比。',
    strengths: ['主动推进跨团队协作', '方案描述有层次'],
    improvements: ['补充优化前后的具体数据', '说明方案的可复用范围'],
    reference: '按「背景 → 约束 → 方案选型 → 落地难点 → 量化结果 → 沉淀复用」六段来组织回答。',
    followUp: '如果关键资源加载失败，你的降级策略是什么？',
  });
}

function detectKind(text) {
  if (text.includes('请只回复两个字')) return 'test';
  if (text.includes('请基于本场模拟面试的完整问答记录')) return 'summary';
  if (text.includes('作为面试官设计')) return 'questions';
  return 'evaluate';
}

http.createServer((req, res) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const payload = JSON.parse(body || '{}');
    const userText = (payload.messages || []).map(m => m.content).join('\n');
    const content = reply(detectKind(userText));
    res.writeHead(200, headers);
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }));
  });
}).listen(8787, () => console.log('mock ai on http://localhost:8787/v1'));
