// AI 面试官：基于 OpenAI 兼容的 /chat/completions 接口，用户自行配置服务地址、Key 和模型

export const aiProviders = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-v4-flash',
    models: [
      { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash（推荐）' },
      { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
    ],
  },
  {
    id: 'kimi',
    label: 'Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'kimi-k3',
    models: [
      { value: 'kimi-k3', label: 'Kimi K3（推荐）' },
      { value: 'kimi-k2.7-code', label: 'Kimi K2.7 Code' },
      { value: 'kimi-k2.7-code-highspeed', label: 'Kimi K2.7 Code Highspeed' },
      { value: 'kimi-k2.6', label: 'Kimi K2.6' },
    ],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openrouter/auto',
    models: [
      { value: 'openrouter/auto', label: 'Auto Router（自动选择）' },
      { value: '~openai/gpt-latest', label: 'OpenAI 最新旗舰' },
      { value: '~anthropic/claude-sonnet-latest', label: 'Claude Sonnet 最新版' },
      { value: '~google/gemini-latest', label: 'Gemini 最新版' },
    ],
  },
  {
    id: 'custom',
    label: '自定义',
    baseUrl: '',
    defaultModel: '',
    models: [],
  },
];

// 保留旧名称，避免外部引用此导出时中断。
export const aiPresets = aiProviders.filter(provider => provider.id !== 'custom').map(provider => ({
  label: provider.label,
  baseUrl: provider.baseUrl,
  model: provider.defaultModel,
}));

export const questionCategories = ['项目深挖', '技术原理', '业务理解', '协作沟通', '职业规划', '综合考察'];

export class AiError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'AiError';
    this.detail = detail || '';
  }
}

function normalizeBaseUrl(baseUrl) {
  const trimmed = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) throw new AiError('未配置 API 地址，请先在「AI 设置」中填写');
  // 允许用户直接粘贴完整的 chat/completions 地址
  if (/\/chat\/completions$/.test(trimmed)) return trimmed;
  return `${trimmed}/chat/completions`;
}

function friendlyHttpError(status, body) {
  if (status === 401 || status === 403) return 'API Key 无效或没有访问权限，请检查「AI 设置」中的 Key';
  if (status === 404) return 'API 地址或模型不存在，请检查服务地址与模型名称';
  if (status === 429) return '请求过于频繁或额度不足，请稍后重试';
  if (status >= 500) return 'AI 服务端异常，请稍后重试';
  return `请求失败（HTTP ${status}）`;
}

export function isAiConfigReady(config) {
  if (!config) return false;
  const needKey = !/localhost|127\.0\.0\.1/.test(config.baseUrl || '');
  return Boolean((config.baseUrl || '').trim() && (config.model || '').trim() && (!needKey || (config.apiKey || '').trim()));
}

// 调用一次对话补全，返回纯文本内容
export async function chatCompletion(config, messages, options = {}) {
  const url = normalizeBaseUrl(config.baseUrl);
  const timeoutMs = Math.max(10, Number(config.timeout) || 90) * 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey.trim()}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: options.temperature ?? Number(config.temperature) ?? 0.7,
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      throw new AiError(options.signal?.aborted ? '请求已取消' : `请求超时（超过 ${timeoutMs / 1000}s），可在设置中调大超时时间`);
    }
    throw new AiError('无法连接 AI 服务，请检查网络、API 地址，以及该服务是否允许浏览器跨域调用（CORS）', e.message);
  }
  clearTimeout(timer);

  const rawText = await response.text();
  if (!response.ok) {
    let detail = rawText;
    try {
      const parsed = JSON.parse(rawText);
      detail = parsed?.error?.message || parsed?.message || rawText;
    } catch {
      // 保留原始文本
    }
    throw new AiError(friendlyHttpError(response.status, detail), detail?.slice(0, 500));
  }

  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch {
    throw new AiError('AI 返回的数据无法解析，请重试', rawText?.slice(0, 500));
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content || !String(content).trim()) {
    throw new AiError('AI 返回内容为空，请重试', rawText?.slice(0, 500));
  }
  return String(content).trim();
}

// 从模型输出中尽量抽取 JSON，兼容 ```json 包裹和前后多余说明文字
export function extractJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();

  const direct = tryParse(cleaned);
  if (direct) return direct;

  for (const [open, close] of [['[', ']'], ['{', '}']]) {
    const start = cleaned.indexOf(open);
    const end = cleaned.lastIndexOf(close);
    if (start !== -1 && end > start) {
      const parsed = tryParse(cleaned.slice(start, end + 1));
      if (parsed) return parsed;
    }
  }
  return null;
}

function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toStringArray(value) {
  if (Array.isArray(value)) return value.map(v => String(typeof v === 'object' ? JSON.stringify(v) : v).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(/\n+/).map(line => line.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean);
  }
  return [];
}

function clampScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(100, Math.round(num)));
}

// 把简历数据序列化为紧凑文本，作为面试官的输入上下文
export function buildResumeContext(data) {
  if (!data) return '';
  const lines = [];
  const info = data.basicInfo || {};
  lines.push('## 基本信息');
  lines.push([
    info.name && `姓名：${info.name}`,
    info.gender && `性别：${info.gender}`,
    info.age && `年龄：${info.age}`,
    info.jobIntention && `求职意向：${info.jobIntention}`,
  ].filter(Boolean).join('，') || '（未填写）');
  if (info.personalSummary) lines.push(`个人简介：${info.personalSummary}`);

  const pushEntries = (title, list, formatter) => {
    if (!Array.isArray(list) || list.length === 0) return;
    lines.push(`\n## ${title}`);
    list.forEach(item => lines.push(formatter(item)));
  };

  pushEntries('教育背景', data.education, edu => [
    edu.school, edu.major, edu.degree, edu.tier,
    (edu.startDate || edu.endDate) && `${edu.startDate || ''}~${edu.endDate || ''}`,
    edu.courses && `主修课程：${edu.courses}`,
  ].filter(Boolean).join(' | '));

  if (data.skills) {
    lines.push('\n## 专业技能');
    lines.push(data.skills);
  }

  const experienceText = (exp) => {
    const head = [exp.company, exp.position, exp.department, `${exp.startDate || ''}~${exp.endDate || ''}`].filter(Boolean).join(' | ');
    const body = exp.contentMarkdown || (exp.descriptions || []).filter(Boolean).map(d => `- ${d}`).join('\n');
    return `### ${head}\n${body}`;
  };

  pushEntries('实习经历', data.internship, experienceText);
  pushEntries('工作经历', data.workExperience, experienceText);
  pushEntries('校园经历', data.campusExperience, experienceText);

  pushEntries('项目经历', data.projectExperience, proj => {
    const head = [proj.name, proj.role, `${proj.startDate || ''}~${proj.endDate || ''}`].filter(Boolean).join(' | ');
    const body = proj.contentMarkdown || (proj.descriptions || []).filter(Boolean).map(d => `- ${d}`).join('\n');
    return `### ${head}\n${body}`;
  });

  pushEntries('获奖经历', data.awards, award => [award.name, award.level, award.date].filter(Boolean).join(' | '));
  pushEntries('自定义模块', data.customModules, mod => `### ${mod.title || '未命名'}\n${mod.content || ''}`);

  return lines.join('\n').slice(0, 12000);
}

const INTERVIEWER_ROLE = '你是一位经验丰富的技术面试官，擅长基于候选人简历设计有深度、可追问的面试题，并给出客观、具体、可执行的反馈。所有输出使用简体中文。';

// 根据简历生成面试题列表
export async function generateQuestions(config, { resumeContext, jobTitle, level, count, style, existingQuestions = [] }, options = {}) {
  const avoid = existingQuestions.filter(Boolean).slice(0, 20);
  const prompt = [
    `请阅读以下候选人简历，作为面试官设计 ${count} 道面试题。`,
    `目标岗位：${jobTitle || '根据简历中的求职意向自行判断'}`,
    `面试难度：${level || '中级'}`,
    `提问风格：${style || '结合项目深挖与技术原理，逐步递进'}`,
    '',
    '要求：',
    '1. 题目必须紧密结合简历中的真实经历、项目和技术栈，避免空泛的通用题。',
    '2. 题目之间覆盖不同维度，包含项目深挖、技术原理、业务理解、协作沟通等。',
    '3. 每题一句话到三句话，明确、可回答，不要一次问多个不相关的问题。',
    avoid.length ? `4. 不要与以下已问过的题目重复：\n${avoid.map(q => `- ${q}`).join('\n')}` : '',
    '',
    '只输出 JSON 数组，不要输出任何解释或 Markdown 代码块，格式：',
    '[{"question":"题目内容","category":"项目深挖","intent":"这道题想考察什么"}]',
    '',
    '候选人简历：',
    resumeContext || '（简历内容为空，请围绕通用岗位能力提问）',
  ].filter(Boolean).join('\n');

  const text = await chatCompletion(config, [
    { role: 'system', content: INTERVIEWER_ROLE },
    { role: 'user', content: prompt },
  ], options);

  const parsed = extractJson(text);
  let items = [];
  if (Array.isArray(parsed)) items = parsed;
  else if (parsed && Array.isArray(parsed.questions)) items = parsed.questions;

  const questions = items
    .map(item => {
      if (typeof item === 'string') return { question: item.trim(), category: '综合考察', intent: '' };
      const question = String(item?.question || item?.title || '').trim();
      if (!question) return null;
      return {
        question,
        category: String(item?.category || '综合考察').trim(),
        intent: String(item?.intent || item?.purpose || '').trim(),
      };
    })
    .filter(Boolean);

  if (questions.length === 0) {
    // 兜底：按行解析纯文本输出
    const fallback = text.split('\n')
      .map(line => line.replace(/^[-*\d.、)\s]+/, '').trim())
      .filter(line => line.length > 8)
      .map(line => ({ question: line, category: '综合考察', intent: '' }));
    if (fallback.length === 0) throw new AiError('AI 未能生成有效的面试题，请点击重试', text.slice(0, 500));
    return fallback.slice(0, count);
  }

  return questions.slice(0, count);
}

// 针对单题回答给出评价
export async function evaluateAnswer(config, { resumeContext, jobTitle, level, question, intent, answer }, options = {}) {
  const prompt = [
    '请作为面试官评价候选人对以下面试题的回答。',
    `目标岗位：${jobTitle || '未指定'}`,
    `面试难度：${level || '中级'}`,
    '',
    `面试题：${question}`,
    intent ? `考察点：${intent}` : '',
    `候选人回答：${answer?.trim() ? answer : '（候选人未作答或回答为空）'}`,
    '',
    '评价要求：',
    '1. score 为 0-100 的整数，严格按回答质量打分，未作答或明显跑题应低于 40 分。',
    '2. summary 用 1-3 句话总体点评。',
    '3. strengths 列出回答中的亮点（若无亮点可为空数组）。',
    '4. improvements 列出具体、可操作的改进建议。',
    '5. reference 给出一个高分参考回答的要点提纲。',
    '6. followUp 给出一个面试官可能继续追问的问题。',
    '',
    '只输出 JSON 对象，不要输出任何解释或 Markdown 代码块，格式：',
    '{"score":80,"summary":"","strengths":[""],"improvements":[""],"reference":"","followUp":""}',
    '',
    '候选人简历（供参考，判断回答是否与经历一致）：',
    resumeContext || '（无）',
  ].filter(Boolean).join('\n');

  const text = await chatCompletion(config, [
    { role: 'system', content: INTERVIEWER_ROLE },
    { role: 'user', content: prompt },
  ], options);

  const parsed = extractJson(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    // 解析失败时降级为纯文本点评，避免整轮面试中断
    return {
      score: null,
      summary: text.slice(0, 1200),
      strengths: [],
      improvements: [],
      reference: '',
      followUp: '',
      parseFallback: true,
      createdAt: Date.now(),
    };
  }

  return {
    score: clampScore(parsed.score),
    summary: String(parsed.summary || parsed.comment || '').trim(),
    strengths: toStringArray(parsed.strengths),
    improvements: toStringArray(parsed.improvements || parsed.suggestions),
    reference: String(parsed.reference || parsed.referenceAnswer || '').trim(),
    followUp: String(parsed.followUp || parsed.follow_up || '').trim(),
    parseFallback: false,
    createdAt: Date.now(),
  };
}

// 全部答完后生成整场面试的总结
export async function generateSummary(config, { resumeContext, jobTitle, level, qaList }, options = {}) {
  const transcript = qaList.map((item, index) => [
    `【第 ${index + 1} 题】${item.question}`,
    `回答：${item.answer?.trim() || '（未作答）'}`,
    item.evaluation ? `单题评分：${item.evaluation.score ?? '未评分'}；点评：${item.evaluation.summary || ''}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');

  const prompt = [
    '请基于本场模拟面试的完整问答记录，输出整体面试评估。',
    `目标岗位：${jobTitle || '未指定'}`,
    `面试难度：${level || '中级'}`,
    '',
    '只输出 JSON 对象，不要输出任何解释或 Markdown 代码块，格式：',
    '{"score":80,"conclusion":"是否推荐进入下一轮及理由","strengths":[""],"improvements":[""],"actions":["面试后可执行的准备建议"]}',
    '',
    '问答记录：',
    transcript,
    '',
    '候选人简历：',
    resumeContext || '（无）',
  ].join('\n');

  const text = await chatCompletion(config, [
    { role: 'system', content: INTERVIEWER_ROLE },
    { role: 'user', content: prompt },
  ], options);

  const parsed = extractJson(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      score: null,
      conclusion: text.slice(0, 1500),
      strengths: [],
      improvements: [],
      actions: [],
      parseFallback: true,
      createdAt: Date.now(),
    };
  }

  return {
    score: clampScore(parsed.score),
    conclusion: String(parsed.conclusion || parsed.summary || '').trim(),
    strengths: toStringArray(parsed.strengths),
    improvements: toStringArray(parsed.improvements),
    actions: toStringArray(parsed.actions || parsed.suggestions),
    parseFallback: false,
    createdAt: Date.now(),
  };
}

// 设置弹窗中的连通性测试
export async function testConnection(config) {
  const text = await chatCompletion(config, [
    { role: 'user', content: '请只回复两个字：连接成功' },
  ], { temperature: 0 });
  return text;
}
