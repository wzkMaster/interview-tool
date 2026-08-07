import { defaultConfig, defaultResumeData } from './defaults';

const FORMAT_VERSION = 1;

const sectionDefinitions = [
  { key: 'education', title: '教育背景', fields: [['学校', 'school'], ['专业', 'major'], ['学历', 'degree'], ['院校层次', 'tier'], ['GPA', 'gpa'], ['主修课程', 'courses'], ['开始时间', 'startDate'], ['结束时间', 'endDate']] },
  { key: 'campusExperience', title: '校园经历', fields: [['组织/单位', 'company'], ['职位', 'position'], ['部门', 'department'], ['地点', 'location'], ['开始时间', 'startDate'], ['结束时间', 'endDate']], contentKey: 'contentMarkdown' },
  { key: 'internship', title: '实习经历', fields: [['公司', 'company'], ['职位', 'position'], ['部门', 'department'], ['地点', 'location'], ['开始时间', 'startDate'], ['结束时间', 'endDate']], contentKey: 'contentMarkdown' },
  { key: 'workExperience', title: '工作经历', fields: [['公司', 'company'], ['职位', 'position'], ['部门', 'department'], ['地点', 'location'], ['开始时间', 'startDate'], ['结束时间', 'endDate']], contentKey: 'contentMarkdown' },
  { key: 'careerProgression', title: '绩效与晋升', fields: [['公司', 'company'], ['考核周期', 'reviewPeriod'], ['绩效结果', 'performanceRating'], ['原级别', 'fromLevel'], ['晋升级别', 'toLevel'], ['晋升时间', 'promotionDate']], contentKey: 'description' },
  { key: 'projectExperience', title: '项目经历', fields: [['项目名称', 'name'], ['角色', 'role'], ['开始时间', 'startDate'], ['结束时间', 'endDate']], contentKey: 'contentMarkdown' },
  { key: 'awards', title: '获奖经历', fields: [['奖项名称', 'name'], ['级别', 'level'], ['时间', 'date']] },
  { key: 'customModules', title: '自定义模块', fields: [['模块标题', 'title']], contentKey: 'content' },
];

function cleanInline(value) {
  return String(value ?? '').replace(/\r?\n/g, ' ').trim();
}

function getDescription(item) {
  if (item.contentMarkdown) return item.contentMarkdown;
  if (Array.isArray(item.descriptions)) return item.descriptions.filter(Boolean).map(line => `- ${line}`).join('\n');
  return '';
}

function itemHeading(item, definition, index) {
  if (definition.key === 'education') return item.school || `教育经历 ${index + 1}`;
  if (definition.key === 'projectExperience') return item.name || `项目 ${index + 1}`;
  if (definition.key === 'awards') return item.name || `奖项 ${index + 1}`;
  if (definition.key === 'customModules') return item.title || `自定义模块 ${index + 1}`;
  if (definition.key === 'careerProgression') return [item.company, item.reviewPeriod].filter(Boolean).join(' · ') || `晋升记录 ${index + 1}`;
  return [item.company, item.position].filter(Boolean).join(' · ') || `经历 ${index + 1}`;
}

export function resumeToMarkdown(resume) {
  const data = { ...defaultResumeData, ...(resume?.data || {}) };
  const basic = { ...defaultResumeData.basicInfo, ...(data.basicInfo || {}) };
  const meta = {
    format: 'resume-app-markdown',
    version: FORMAT_VERSION,
    name: resume?.name || `${basic.name || '我的'}的简历`,
    config: { ...defaultConfig, ...(resume?.config || {}) },
  };
  const lines = [
    '<!-- resume-meta',
    JSON.stringify(meta),
    '-->',
    '',
    `# ${cleanInline(basic.name) || '未填写姓名'}`,
    '',
    cleanInline(basic.jobIntention) ? `> 求职意向：${cleanInline(basic.jobIntention)}` : '',
    '',
    '<!-- resume-section:basicInfo -->',
    '## 基本信息',
    ...[
      ['姓名', 'name'], ['电话', 'phone'], ['邮箱', 'email'], ['性别', 'gender'], ['年龄', 'age'],
      ['博客', 'blog'], ['GitHub', 'github'], ['求职意向', 'jobIntention'], ['头像', 'avatar'],
    ].map(([label, key]) => `- ${label}：${cleanInline(basic[key])}`),
    '',
    '### 个人简介',
    '<!-- resume-content -->',
    String(basic.personalSummary || '').trim(),
    '<!-- /resume-content -->',
    '<!-- /resume-section -->',
    '',
    '<!-- resume-section:skills -->',
    '## 专业技能',
    '<!-- resume-content -->',
    String(data.skills || '').trim(),
    '<!-- /resume-content -->',
    '<!-- /resume-section -->',
  ].filter((line, index, all) => !(line === '' && all[index - 1] === ''));

  sectionDefinitions.forEach(definition => {
    lines.push('', `<!-- resume-section:${definition.key} -->`, `## ${definition.title}`);
    const items = Array.isArray(data[definition.key]) ? data[definition.key] : [];
    items.forEach((item, index) => {
      lines.push(
        '',
        `<!-- resume-item:${cleanInline(item.id) || `item-${index + 1}`} -->`,
        `### ${cleanInline(itemHeading(item, definition, index))}`,
        ...definition.fields.map(([label, key]) => `- ${label}：${cleanInline(item[key])}`)
      );
      if (definition.contentKey) {
        const content = ['campusExperience', 'internship', 'workExperience', 'projectExperience'].includes(definition.key)
          ? getDescription(item)
          : item[definition.contentKey];
        lines.push('', '<!-- resume-content -->', String(content || '').trim(), '<!-- /resume-content -->');
      }
      lines.push('<!-- /resume-item -->');
    });
    lines.push('<!-- /resume-section -->');
  });

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function extractMeta(markdown) {
  const match = markdown.match(/<!--\s*resume-meta\s*\n([\s\S]*?)\n-->/);
  if (!match) throw new Error('缺少 resume-meta，文件不是本应用导出的 Markdown 简历');
  try {
    const meta = JSON.parse(match[1].trim());
    if (meta.format !== 'resume-app-markdown') throw new Error('格式标识不匹配');
    return meta;
  } catch (error) {
    throw new Error(`简历元数据无效：${error.message}`);
  }
}

function extractSection(markdown, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`<!--\\s*resume-section:${escaped}\\s*-->([\\s\\S]*?)<!--\\s*\\/resume-section\\s*-->`));
  return match?.[1] || '';
}

function extractContent(block) {
  return block.match(/<!--\s*resume-content\s*-->([\s\S]*?)<!--\s*\/resume-content\s*-->/)?.[1].trim() || '';
}

function parseFields(block, fields) {
  const result = {};
  fields.forEach(([label, key]) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = block.match(new RegExp(`^\\s*[-*]\\s+${escaped}[：:]\\s*(.*)$`, 'm'));
    result[key] = match?.[1]?.trim() || '';
  });
  return result;
}

export function markdownToResume(markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) throw new Error('Markdown 文件为空');
  const meta = extractMeta(markdown);
  const basicFields = [
    ['姓名', 'name'], ['电话', 'phone'], ['邮箱', 'email'], ['性别', 'gender'], ['年龄', 'age'],
    ['博客', 'blog'], ['GitHub', 'github'], ['求职意向', 'jobIntention'], ['头像', 'avatar'],
  ];
  const basicBlock = extractSection(markdown, 'basicInfo');
  if (!basicBlock) throw new Error('缺少基本信息模块，请保留 resume-section 注释');

  const data = JSON.parse(JSON.stringify(defaultResumeData));
  data.basicInfo = {
    ...data.basicInfo,
    ...parseFields(basicBlock, basicFields),
    personalSummary: extractContent(basicBlock),
  };
  data.skills = extractContent(extractSection(markdown, 'skills'));

  sectionDefinitions.forEach(definition => {
    const section = extractSection(markdown, definition.key);
    const items = [];
    const itemPattern = /<!--\s*resume-item:([^>]*?)\s*-->([\s\S]*?)<!--\s*\/resume-item\s*-->/g;
    let match;
    while ((match = itemPattern.exec(section)) !== null) {
      const item = { id: match[1].trim() || `item-${Date.now()}-${items.length}`, ...parseFields(match[2], definition.fields) };
      if (definition.contentKey) item[definition.contentKey] = extractContent(match[2]);
      if (['campusExperience', 'internship', 'workExperience', 'projectExperience'].includes(definition.key)) {
        item.contentMarkdown = extractContent(match[2]);
        item.descriptions = [];
      }
      items.push(item);
    }
    data[definition.key] = items;
  });

  return {
    name: cleanInline(meta.name) || `${data.basicInfo.name || '导入'}的简历`,
    data,
    config: { ...defaultConfig, ...(meta.config || {}) },
  };
}

export function downloadResumeMarkdown(resume) {
  const blob = new Blob([resumeToMarkdown(resume)], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeName = (resume?.name || resume?.data?.basicInfo?.name || '简历').replace(/[\\/:*?"<>|]/g, '-');
  anchor.href = url;
  anchor.download = `${safeName}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
