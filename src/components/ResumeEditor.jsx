import { useState, useRef } from 'react';
import {
  recommendedResumeData,
  tabList,
  educationEntry,
  experienceEntry,
  projectEntry,
  awardEntry,
  customModuleEntry,
  degreeOptions,
} from '../utils/defaults';
import ResumePreview from './ResumePreview';
import { exportToPDF } from '../utils/pdf';

const themeColors = ['#0066cc', '#e74c3c', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c', '#34495e', '#e67e22'];

export default function ResumeEditor({ resumeData, setResumeData, config, setConfig, onManualSave }) {
  const [activeTab, setActiveTab] = useState('basicInfo');
  const [showConfig, setShowConfig] = useState(false);
  const [saveTime, setSaveTime] = useState('');
  const [exporting, setExporting] = useState(false);
  const previewRef = useRef(null);

  const markSaved = (prefix = '已保存') => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    setSaveTime(`${prefix} · ${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
  };

  const handleSave = () => {
    onManualSave?.();
    markSaved();
  };

  const handleExportPDF = async () => {
    if (exporting || !previewRef.current) return;
    setExporting(true);
    try {
      exportToPDF(previewRef.current, `${resumeData.basicInfo.name || '简历'}.pdf`);
    } catch (e) {
      console.error('PDF导出失败:', e);
      alert(`PDF导出失败：${e.message || '请重试'}`);
    } finally {
      setExporting(false);
    }
  };

  const handleQuickImport = () => {
    const shouldImport = window.confirm('快速导入会覆盖当前编辑内容，是否继续？');
    if (!shouldImport) return;

    setResumeData(JSON.parse(JSON.stringify(recommendedResumeData)));
    setConfig(prev => ({
      ...prev,
      themeColor: '#0066cc',
      moduleTitleFontSize: 16,
      moduleContentFontSize: 14,
      lineHeight: 1.45,
      moduleSpacing: 18,
      pageMargin: { top: 32, bottom: 32, left: 36, right: 36 },
    }));
    setActiveTab('basicInfo');
    markSaved('已导入');
  };

  const updateBasicInfo = (field, value) => {
    setResumeData(prev => ({
      ...prev,
      basicInfo: { ...prev.basicInfo, [field]: value },
    }));
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      alert('仅支持 JPG、PNG、JPEG 格式');
      return;
    }
    if (file.size > 1024 * 1024) {
      alert('图片大小不能超过 1 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => updateBasicInfo('avatar', ev.target.result);
    reader.readAsDataURL(file);
  };

  // Array-based section helpers
  const addEntry = (section, entryFn) => {
    setResumeData(prev => ({
      ...prev,
      [section]: [...prev[section], entryFn()],
    }));
  };

  const updateEntry = (section, id, field, value) => {
    setResumeData(prev => ({
      ...prev,
      [section]: prev[section].map(item => item.id === id ? { ...item, [field]: value } : item),
    }));
  };

  const removeEntry = (section, id) => {
    setResumeData(prev => ({
      ...prev,
      [section]: prev[section].filter(item => item.id !== id),
    }));
  };

  const getMarkdownContent = (item) => {
    if (typeof item.contentMarkdown === 'string' && item.contentMarkdown) return item.contentMarkdown;
    return (item.descriptions || []).filter(Boolean).map(desc => `- ${desc}`).join('\n');
  };

  const updateMarkdownContent = (section, id, value) => {
    setResumeData(prev => ({
      ...prev,
      [section]: prev[section].map(item =>
        item.id === id ? { ...item, contentMarkdown: value } : item
      ),
    }));
  };

  const applyMarkdownSyntax = (section, id, type) => {
    const textarea = document.getElementById(`${section}-${id}-markdown`);
    if (!textarea) return;

    const currentValue = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = currentValue.slice(start, end);
    let replacement = selected;

    if (type === 'bold') replacement = selected ? `**${selected}**` : '**加粗文本**';
    if (type === 'italic') replacement = selected ? `*${selected}*` : '*斜体文本*';
    if (type === 'unordered') {
      const text = selected || '请输入列表内容';
      replacement = text.split('\n').map(line => line.trim() ? `- ${line.replace(/^[-*]\s+/, '')}` : '').join('\n');
    }
    if (type === 'ordered') {
      const text = selected || '请输入列表内容';
      replacement = text.split('\n').map((line, index) => line.trim() ? `${index + 1}. ${line.replace(/^\d+\.\s+/, '')}` : '').join('\n');
    }

    const nextValue = `${currentValue.slice(0, start)}${replacement}${currentValue.slice(end)}`;
    updateMarkdownContent(section, id, nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + replacement.length);
    });
  };

  const renderBasicInfoForm = () => (
    <div className="form-section">
      <div className="section-header">
        <h3>基本信息</h3>
        <p className="section-desc">此信息显示简历的头部，请务必准确填写。</p>
      </div>
      <div className="avatar-section">
        <div className="avatar-preview">
          {resumeData.basicInfo.avatar ? (
            <img src={resumeData.basicInfo.avatar} alt="头像" className="avatar-img" />
          ) : (
            <div className="avatar-placeholder">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/></svg>
            </div>
          )}
        </div>
        <div className="avatar-actions">
          <p className="avatar-hint">支持 JPG、PNG、JPEG 格式，大小不超过 1 MB</p>
          <div className="avatar-btns">
            <label className="btn btn-primary btn-sm avatar-upload-btn">
              上传头像
              <input type="file" accept="image/jpeg,image/png,image/jpg" onChange={handleAvatarUpload} style={{ display: 'none' }} />
            </label>
            <button className="btn btn-danger-outline btn-sm" onClick={() => updateBasicInfo('avatar', '')}>移除头像</button>
          </div>
        </div>
      </div>
      <div className="form-grid">
        <div className="form-group">
          <label><span className="required">*</span> 姓名</label>
          <input type="text" value={resumeData.basicInfo.name} onChange={e => updateBasicInfo('name', e.target.value)} placeholder="例如：张三" />
        </div>
        <div className="form-group">
          <label><span className="required">*</span> 电话</label>
          <input type="text" value={resumeData.basicInfo.phone} onChange={e => updateBasicInfo('phone', e.target.value)} placeholder="例如：13800138000" />
        </div>
        <div className="form-group">
          <label><span className="required">*</span> 邮箱</label>
          <input type="email" value={resumeData.basicInfo.email} onChange={e => updateBasicInfo('email', e.target.value)} placeholder="例如：your@email.com" />
        </div>
        <div className="form-group">
          <label>性别</label>
          <select value={resumeData.basicInfo.gender} onChange={e => updateBasicInfo('gender', e.target.value)}>
            <option value="">请选择</option>
            <option value="男">男</option>
            <option value="女">女</option>
          </select>
        </div>
        <div className="form-group">
          <label>年龄</label>
          <input type="number" value={resumeData.basicInfo.age} onChange={e => updateBasicInfo('age', e.target.value)} placeholder="例如：25" />
        </div>
        <div className="form-group">
          <label>求职意向</label>
          <input type="text" value={resumeData.basicInfo.jobIntention} onChange={e => updateBasicInfo('jobIntention', e.target.value)} placeholder="例如：前端开发工程师" />
        </div>
        <div className="form-group">
          <label>GitHub</label>
          <input type="text" value={resumeData.basicInfo.github} onChange={e => updateBasicInfo('github', e.target.value)} placeholder="例如：https://github.com/username" />
        </div>
        <div className="form-group">
          <label>个人博客</label>
          <input type="text" value={resumeData.basicInfo.blog} onChange={e => updateBasicInfo('blog', e.target.value)} placeholder="例如：https://yourblog.com" />
        </div>
        <div className="form-group form-group-full">
          <label>个人简介</label>
          <textarea
            value={resumeData.basicInfo.personalSummary || ''}
            onChange={e => updateBasicInfo('personalSummary', e.target.value)}
            placeholder="用 2-3 句话总结你的核心经历、技术方向和项目优势"
            rows={4}
          />
        </div>
      </div>
    </div>
  );

  const renderEducationForm = () => (
    <div className="form-section">
      <div className="section-header">
        <h3>教育背景</h3>
        <p className="section-desc">填写您的教育背景信息，包括学校、专业、学位等。</p>
      </div>
      {resumeData.education.map((edu) => (
        <div key={edu.id} className="entry-card">
          <div className="entry-header">
            <span className="entry-title">{edu.school || '未填写学校'}</span>
            <span className="entry-date">{edu.startDate} ~ {edu.endDate}</span>
            <div className="entry-actions">
              <button className="btn-icon btn-danger-icon" title="删除" onClick={() => removeEntry('education', edu.id)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            </div>
          </div>
          <div className="entry-tags">
            {edu.major && <span className="tag tag-blue">{edu.major}</span>}
            {edu.degree && <span className="tag tag-orange">{edu.degree}</span>}
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label><span className="required">*</span> 学校名称</label>
              <input type="text" value={edu.school} onChange={e => updateEntry('education', edu.id, 'school', e.target.value)} placeholder="例如：北京大学" />
            </div>
            <div className="form-group">
              <label><span className="required">*</span> 专业</label>
              <input type="text" value={edu.major} onChange={e => updateEntry('education', edu.id, 'major', e.target.value)} placeholder="例如：计算机科学与技术" />
            </div>
            <div className="form-group">
              <label><span className="required">*</span> 学位</label>
              <select value={edu.degree} onChange={e => updateEntry('education', edu.id, 'degree', e.target.value)}>
                <option value="">请选择学位</option>
                {degreeOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>学校层级</label>
              <input type="text" value={edu.tier} onChange={e => updateEntry('education', edu.id, 'tier', e.target.value)} placeholder="例如：985" />
            </div>
            <div className="form-group">
              <label>GPA</label>
              <input type="text" value={edu.gpa} onChange={e => updateEntry('education', edu.id, 'gpa', e.target.value)} placeholder="例如：3.8/4.0" />
            </div>
            <div className="form-group">
              <label>开始时间</label>
              <input type="text" value={edu.startDate} onChange={e => updateEntry('education', edu.id, 'startDate', e.target.value)} placeholder="例如：2019-09" />
            </div>
            <div className="form-group">
              <label>结束时间</label>
              <input type="text" value={edu.endDate} onChange={e => updateEntry('education', edu.id, 'endDate', e.target.value)} placeholder="例如：2023-07" />
            </div>
            <div className="form-group form-group-full">
              <label>主修课程</label>
              <textarea
                value={edu.courses || ''}
                onChange={e => updateEntry('education', edu.id, 'courses', e.target.value)}
                placeholder="例如：数据结构、操作系统、计算机网络、数据库系统、信息系统分析与设计"
                rows={3}
              />
            </div>
          </div>
        </div>
      ))}
      <button className="btn-link" onClick={() => addEntry('education', educationEntry)}>+ 添加新的教育背景</button>
    </div>
  );

  const renderExperienceForm = (section, label) => (
    <div className="form-section">
      <div className="section-header">
        <h3>{label}</h3>
        <p className="section-desc">填写您的{label}信息，包括公司、职位、工作内容等。</p>
      </div>
      {resumeData[section].map((exp) => (
        <div key={exp.id} className="entry-card">
          <div className="entry-header">
            <span className="entry-title">{exp.company || '未填写公司'}</span>
            <span className="entry-date">{exp.startDate} ~ {exp.endDate}</span>
            <div className="entry-actions">
              <button className="btn-icon btn-danger-icon" title="删除" onClick={() => removeEntry(section, exp.id)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            </div>
          </div>
          {exp.position && <div className="entry-tags"><span className="tag tag-blue">{exp.position}</span></div>}
          <div className="form-grid">
            <div className="form-group">
              <label><span className="required">*</span> 公司/机构名称</label>
              <input type="text" value={exp.company} onChange={e => updateEntry(section, exp.id, 'company', e.target.value)} placeholder="例如：示例科技有限公司" />
            </div>
            <div className="form-group">
              <label><span className="required">*</span> 职位</label>
              <input type="text" value={exp.position} onChange={e => updateEntry(section, exp.id, 'position', e.target.value)} placeholder="例如：前端开发工程师" />
            </div>
            <div className="form-group">
              <label>部门</label>
              <input type="text" value={exp.department} onChange={e => updateEntry(section, exp.id, 'department', e.target.value)} placeholder="例如：技术部" />
            </div>
            <div className="form-group">
              <label>开始时间</label>
              <input type="text" value={exp.startDate} onChange={e => updateEntry(section, exp.id, 'startDate', e.target.value)} placeholder="例如：2022-05" />
            </div>
            <div className="form-group">
              <label>结束时间</label>
              <input type="text" value={exp.endDate} onChange={e => updateEntry(section, exp.id, 'endDate', e.target.value)} placeholder="例如：2023-07 或 至今" />
            </div>
          </div>
          <div className="desc-section markdown-editor-section">
            <label><span className="required">*</span> 工作内容</label>
            <div className="markdown-toolbar" aria-label="Markdown 工具栏">
              <button type="button" className="markdown-toolbar-btn" title="加粗" onClick={() => applyMarkdownSyntax(section, exp.id, 'bold')}>B</button>
              <button type="button" className="markdown-toolbar-btn italic" title="斜体" onClick={() => applyMarkdownSyntax(section, exp.id, 'italic')}>I</button>
              <button type="button" className="markdown-toolbar-btn" title="无序列表" onClick={() => applyMarkdownSyntax(section, exp.id, 'unordered')}>• 列表</button>
              <button type="button" className="markdown-toolbar-btn" title="有序列表" onClick={() => applyMarkdownSyntax(section, exp.id, 'ordered')}>1. 列表</button>
            </div>
            <textarea
              id={`${section}-${exp.id}-markdown`}
              className="markdown-textarea"
              value={getMarkdownContent(exp)}
              onChange={e => updateMarkdownContent(section, exp.id, e.target.value)}
              placeholder="支持 Markdown，例如：&#10;负责交易链路前端研发，覆盖下单、支付核心流程。&#10;&#10;- 负责复杂交易业务的需求分析、技术方案设计和开发交付&#10;- 持续推进页面性能优化&#10;- 探索 **AI Agent** 在研发环节的应用"
              rows={9}
            />
          </div>
        </div>
      ))}
      <button className="btn-link" onClick={() => addEntry(section, experienceEntry)}>+ 添加新的{label}</button>
    </div>
  );

  const renderSkillsForm = () => (
    <div className="form-section">
      <div className="section-header">
        <h3>专业技能</h3>
        <p className="section-desc">填写您的专业技能信息，每行一条技能描述。</p>
      </div>
      <div className="skills-textarea">
        <textarea
          value={resumeData.skills}
          onChange={e => setResumeData(prev => ({ ...prev, skills: e.target.value }))}
          placeholder="请输入您的专业技能，例如：&#10;熟练掌握 JavaScript、TypeScript&#10;熟悉 React、Vue 等主流前端框架&#10;了解 Node.js、Webpack 等前端工程化工具"
          rows={8}
        />
      </div>
    </div>
  );

  const renderProjectForm = () => (
    <div className="form-section">
      <div className="section-header">
        <h3>项目经历</h3>
        <p className="section-desc">填写您的项目经历信息。</p>
      </div>
      {resumeData.projectExperience.map((proj) => (
        <div key={proj.id} className="entry-card">
          <div className="entry-header">
            <span className="entry-title">{proj.name || '未填写项目名'}</span>
            <span className="entry-date">{proj.startDate} ~ {proj.endDate}</span>
            <div className="entry-actions">
              <button className="btn-icon btn-danger-icon" title="删除" onClick={() => removeEntry('projectExperience', proj.id)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label><span className="required">*</span> 项目名称</label>
              <input type="text" value={proj.name} onChange={e => updateEntry('projectExperience', proj.id, 'name', e.target.value)} placeholder="例如：电商平台系统" />
            </div>
            <div className="form-group">
              <label>担任角色</label>
              <input type="text" value={proj.role} onChange={e => updateEntry('projectExperience', proj.id, 'role', e.target.value)} placeholder="例如：前端负责人" />
            </div>
            <div className="form-group">
              <label>开始时间</label>
              <input type="text" value={proj.startDate} onChange={e => updateEntry('projectExperience', proj.id, 'startDate', e.target.value)} placeholder="例如：2022-05" />
            </div>
            <div className="form-group">
              <label>结束时间</label>
              <input type="text" value={proj.endDate} onChange={e => updateEntry('projectExperience', proj.id, 'endDate', e.target.value)} placeholder="例如：2023-07" />
            </div>
          </div>
          <div className="desc-section markdown-editor-section">
            <label>项目描述</label>
            <div className="markdown-toolbar" aria-label="Markdown 工具栏">
              <button type="button" className="markdown-toolbar-btn" title="加粗" onClick={() => applyMarkdownSyntax('projectExperience', proj.id, 'bold')}>B</button>
              <button type="button" className="markdown-toolbar-btn italic" title="斜体" onClick={() => applyMarkdownSyntax('projectExperience', proj.id, 'italic')}>I</button>
              <button type="button" className="markdown-toolbar-btn" title="无序列表" onClick={() => applyMarkdownSyntax('projectExperience', proj.id, 'unordered')}>• 列表</button>
              <button type="button" className="markdown-toolbar-btn" title="有序列表" onClick={() => applyMarkdownSyntax('projectExperience', proj.id, 'ordered')}>1. 列表</button>
            </div>
            <textarea
              id={`projectExperience-${proj.id}-markdown`}
              className="markdown-textarea"
              value={getMarkdownContent(proj)}
              onChange={e => updateMarkdownContent('projectExperience', proj.id, e.target.value)}
              placeholder="支持 Markdown，例如：&#10;负责项目核心模块开发。&#10;&#10;- 主导前端架构升级&#10;- 建设通用组件库&#10;- 使用 **React** 提升开发效率"
              rows={8}
            />
          </div>
        </div>
      ))}
      <button className="btn-link" onClick={() => addEntry('projectExperience', projectEntry)}>+ 添加新的项目经历</button>
    </div>
  );

  const renderAwardsForm = () => (
    <div className="form-section">
      <div className="section-header">
        <h3>获奖经历</h3>
        <p className="section-desc">填写您的获奖经历信息。</p>
      </div>
      {resumeData.awards.map((award) => (
        <div key={award.id} className="entry-card">
          <div className="entry-header">
            <span className="entry-title">{award.name || '未填写奖项'}</span>
            <span className="entry-date">{award.date}</span>
            <div className="entry-actions">
              <button className="btn-icon btn-danger-icon" title="删除" onClick={() => removeEntry('awards', award.id)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label><span className="required">*</span> 奖项名称</label>
              <input type="text" value={award.name} onChange={e => updateEntry('awards', award.id, 'name', e.target.value)} placeholder="例如：ACM程序设计竞赛" />
            </div>
            <div className="form-group">
              <label>奖项等级</label>
              <input type="text" value={award.level} onChange={e => updateEntry('awards', award.id, 'level', e.target.value)} placeholder="例如：全国一等奖" />
            </div>
            <div className="form-group">
              <label>获奖时间</label>
              <input type="text" value={award.date} onChange={e => updateEntry('awards', award.id, 'date', e.target.value)} placeholder="例如：2022-06" />
            </div>
          </div>
        </div>
      ))}
      <button className="btn-link" onClick={() => addEntry('awards', awardEntry)}>+ 添加新的获奖经历</button>
    </div>
  );

  const renderCustomModulesForm = () => (
    <div className="form-section">
      <div className="section-header">
        <h3>自定义模块</h3>
        <p className="section-desc">添加自定义的简历模块。</p>
      </div>
      {resumeData.customModules.map((mod) => (
        <div key={mod.id} className="entry-card">
          <div className="entry-header">
            <span className="entry-title">{mod.title || '未填写标题'}</span>
            <div className="entry-actions">
              <button className="btn-icon btn-danger-icon" title="删除" onClick={() => removeEntry('customModules', mod.id)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label><span className="required">*</span> 模块标题</label>
              <input type="text" value={mod.title} onChange={e => updateEntry('customModules', mod.id, 'title', e.target.value)} placeholder="请输入模块标题" />
            </div>
          </div>
          <div className="desc-section">
            <label>模块内容</label>
            <textarea value={mod.content} onChange={e => updateEntry('customModules', mod.id, 'content', e.target.value)} placeholder="请输入模块内容..." rows={4} />
          </div>
        </div>
      ))}
      <button className="btn-link" onClick={() => addEntry('customModules', customModuleEntry)}>+ 添加自定义模块</button>
    </div>
  );

  const renderForm = () => {
    switch (activeTab) {
      case 'basicInfo': return renderBasicInfoForm();
      case 'education': return renderEducationForm();
      case 'campusExperience': return renderExperienceForm('campusExperience', '校园经历');
      case 'skills': return renderSkillsForm();
      case 'internship': return renderExperienceForm('internship', '实习经历');
      case 'workExperience': return renderExperienceForm('workExperience', '工作经历');
      case 'projectExperience': return renderProjectForm();
      case 'awards': return renderAwardsForm();
      case 'customModules': return renderCustomModulesForm();
      default: return null;
    }
  };

  return (
    <>
      <main className="app-main">
        <aside className="editor-panel">
          <div className="editor-header editor-header-row">
            <h2>简历编辑器</h2>
            <div className="editor-header-actions">
              <button className="btn btn-outline btn-sm" onClick={handleQuickImport}>快速导入</button>
              <button className="btn btn-outline btn-sm" onClick={() => setShowConfig(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                样式配置
              </button>
            </div>
          </div>
          <nav className="tab-nav">
            {tabList.map(tab => (
              <button
                key={tab.key}
                className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="editor-content">
            {renderForm()}
          </div>
          <div className="editor-footer">
            {saveTime ? <span className="save-status">{saveTime}</span> : <span className="save-status save-status-hint">编辑内容会自动保存到本地</span>}
            <button className="btn btn-primary" onClick={handleSave}>保存</button>
          </div>
        </aside>

        <section className="preview-panel">
          <div className="preview-header">
            <h2>简历预览</h2>
          </div>
          <div className="preview-content">
            <ResumePreview ref={previewRef} data={resumeData} config={config} />
          </div>
          <div className="preview-footer">
            <span className="pdf-export-hint">在打印窗口中选择「另存为 PDF」</span>
            <button className="btn btn-primary btn-lg" onClick={handleExportPDF} disabled={exporting}>
              {exporting ? '正在打开...' : '导出高清 PDF'}
            </button>
          </div>
        </section>
      </main>

      {showConfig && (
        <div className="modal-overlay" onClick={() => setShowConfig(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>自定义简历配置</h3>
              <button className="btn-icon" onClick={() => setShowConfig(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="config-group">
                <label>主题色</label>
                <div className="color-picker">
                  {themeColors.map(c => (
                    <button
                      key={c}
                      className={`color-swatch ${config.themeColor === c ? 'active' : ''}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setConfig(prev => ({ ...prev, themeColor: c }))}
                    />
                  ))}
                  <input type="color" value={config.themeColor} onChange={e => setConfig(prev => ({ ...prev, themeColor: e.target.value }))} className="color-input" />
                </div>
              </div>
              <div className="config-group">
                <label>模块标题字体大小</label>
                <select value={config.moduleTitleFontSize} onChange={e => setConfig(prev => ({ ...prev, moduleTitleFontSize: Number(e.target.value) }))}>
                  {[14, 15, 16, 17, 18, 20].map(v => <option key={v} value={v}>{v}px</option>)}
                </select>
              </div>
              <div className="config-group">
                <label>模块内容字体大小</label>
                <select value={config.moduleContentFontSize} onChange={e => setConfig(prev => ({ ...prev, moduleContentFontSize: Number(e.target.value) }))}>
                  {[12, 13, 14, 15, 16].map(v => <option key={v} value={v}>{v}px</option>)}
                </select>
              </div>
              <div className="config-group">
                <label>行高</label>
                <input type="number" step="0.1" min="1" max="3" value={config.lineHeight} onChange={e => setConfig(prev => ({ ...prev, lineHeight: Number(e.target.value) }))} />
              </div>
              <div className="config-group">
                <label>模块间距 (px)</label>
                <input type="number" value={config.moduleSpacing} onChange={e => setConfig(prev => ({ ...prev, moduleSpacing: Number(e.target.value) }))} />
              </div>
              <div className="config-group">
                <label>页面边距 (px)</label>
                <div className="margin-inputs">
                  {['top', 'bottom', 'left', 'right'].map(dir => (
                    <div key={dir} className="margin-input">
                      <span>{dir === 'top' ? '上' : dir === 'bottom' ? '下' : dir === 'left' ? '左' : '右'}</span>
                      <input type="number" value={config.pageMargin[dir]} onChange={e => setConfig(prev => ({ ...prev, pageMargin: { ...prev.pageMargin, [dir]: Number(e.target.value) } }))} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowConfig(false)}>关闭</button>
              <button className="btn btn-primary" onClick={() => { handleSave(); setShowConfig(false); }}>保存配置</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
