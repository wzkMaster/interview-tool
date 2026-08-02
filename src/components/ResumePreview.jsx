import { forwardRef } from 'react';

const ResumePreview = forwardRef(function ResumePreview({ data, config }, ref) {
  const { basicInfo, education, campusExperience, skills, internship, workExperience, projectExperience, awards, customModules } = data;
  const { themeColor, moduleTitleFontSize, moduleContentFontSize, lineHeight, moduleSpacing, pageMargin } = config;

  const sectionStyle = {
    marginBottom: `${moduleSpacing}px`,
  };

  const titleStyle = {
    fontSize: `${moduleTitleFontSize}px`,
    color: themeColor,
    fontWeight: 'bold',
    borderBottom: `2px solid ${themeColor}`,
    paddingBottom: '4px',
    marginBottom: '10px',
  };

  const contentStyle = {
    fontSize: `${moduleContentFontSize}px`,
    lineHeight: lineHeight,
    color: '#333',
  };

  const hasContent = (arr) => arr && arr.length > 0 && arr.some(item =>
    Object.entries(item).some(([k, v]) => k !== 'id' && v)
  );

  const getMarkdownContent = (item) => {
    if (typeof item.contentMarkdown === 'string' && item.contentMarkdown.trim()) return item.contentMarkdown;
    return (item.descriptions || []).filter(Boolean).map(desc => `- ${desc}`).join('\n');
  };

  const renderInlineMarkdown = (text) => {
    const parts = [];
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
      const token = match[0];
      if (token.startsWith('**')) {
        parts.push(<strong key={`${match.index}-bold`}>{token.slice(2, -2)}</strong>);
      } else {
        parts.push(<em key={`${match.index}-italic`}>{token.slice(1, -1)}</em>);
      }
      lastIndex = match.index + token.length;
    }

    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
  };

  const renderMarkdownContent = (markdown) => {
    if (!markdown || !markdown.trim()) return null;
    const lines = markdown.split('\n');
    const blocks = [];
    let listItems = [];
    let listType = null;
    let paragraph = [];

    const flushParagraph = () => {
      if (!paragraph.length) return;
      blocks.push(
        <p key={`p-${blocks.length}`} className="resume-md-paragraph">
          {renderInlineMarkdown(paragraph.join(' '))}
        </p>
      );
      paragraph = [];
    };

    const flushList = () => {
      if (!listItems.length) return;
      const ListTag = listType === 'ordered' ? 'ol' : 'ul';
      blocks.push(
        <ListTag key={`list-${blocks.length}`} className="resume-desc-list">
          {listItems.map((item, index) => (
            <li key={index}>{renderInlineMarkdown(item)}</li>
          ))}
        </ListTag>
      );
      listItems = [];
      listType = null;
    };

    lines.forEach(rawLine => {
      const line = rawLine.trim();
      if (!line) {
        flushParagraph();
        flushList();
        return;
      }

      const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
      const orderedMatch = line.match(/^\d+\.\s+(.+)$/);

      if (unorderedMatch) {
        flushParagraph();
        if (listType && listType !== 'unordered') flushList();
        listType = 'unordered';
        listItems.push(unorderedMatch[1]);
        return;
      }

      if (orderedMatch) {
        flushParagraph();
        if (listType && listType !== 'ordered') flushList();
        listType = 'ordered';
        listItems.push(orderedMatch[1]);
        return;
      }

      flushList();
      paragraph.push(line);
    });

    flushParagraph();
    flushList();

    return <div className="resume-markdown-content">{blocks}</div>;
  };

  const renderHeader = () => {
    const info = basicInfo;
    const hasAny = info.name || info.phone || info.email || info.github || info.blog || info.jobIntention || info.personalSummary;
    if (!hasAny) return null;

    return (
      <div className="resume-header-section">
        {info.avatar && (
          <div className="resume-avatar-wrapper">
            <img src={info.avatar} alt="头像" className="resume-avatar" />
          </div>
        )}
        <div className="resume-header-info">
          {info.name && <h1 className="resume-name">{info.name}</h1>}
          {(info.gender || info.age) && (
            <div className="resume-meta">
              {info.gender && <span>{info.gender}</span>}
              {info.gender && info.age && <span className="sep">|</span>}
              {info.age && <span>{info.age} 岁</span>}
            </div>
          )}
          {(info.phone || info.email) && (
            <div className="resume-contact">
              {info.phone && <span>{info.phone}</span>}
              {info.phone && info.email && <span className="sep">|</span>}
              {info.email && <span>{info.email}</span>}
            </div>
          )}
          {info.github && (
            <div className="resume-link">
              <a href={info.github} target="_blank" rel="noreferrer">{info.github}</a>
            </div>
          )}
          {info.blog && (
            <div className="resume-link">
              <a href={info.blog} target="_blank" rel="noreferrer">{info.blog}</a>
            </div>
          )}
          {info.jobIntention && (
            <div className="resume-intention">求职意向：{info.jobIntention}</div>
          )}
          {info.personalSummary && (
            <div className="resume-summary">{info.personalSummary}</div>
          )}
        </div>
      </div>
    );
  };

  const renderEducation = () => {
    if (!hasContent(education)) return null;
    return (
      <div className="resume-section" style={sectionStyle}>
        <div className="resume-section-title" style={titleStyle}>教育背景</div>
        <div style={contentStyle}>
          {education.map(edu => {
            const hasAnyField = edu.school || edu.major || edu.degree || edu.startDate || edu.endDate || edu.courses;
            if (!hasAnyField) return null;
            return (
              <div key={edu.id} className="resume-entry">
                <div className="resume-entry-header">
                  <div className="resume-entry-left">
                    <span className="resume-entry-title">{edu.school}</span>
                    {edu.major && <span className="resume-entry-sub">{edu.major}</span>}
                    {edu.degree && <span className="resume-entry-sub">{edu.degree}</span>}
                    {edu.tier && <span className="resume-entry-sub resume-entry-tier">{edu.tier}</span>}
                  </div>
                  <div className="resume-entry-date">
                    {edu.startDate}{edu.startDate && edu.endDate ? ' ~ ' : ''}{edu.endDate}
                  </div>
                </div>
                {edu.gpa && <div className="resume-entry-detail">GPA: {edu.gpa}</div>}
                {edu.courses && (
                  <div className="resume-entry-detail resume-courses">
                    <span className="resume-detail-label">主修课程：</span>{edu.courses}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderExperienceSection = (items, title) => {
    if (!hasContent(items)) return null;
    return (
      <div className="resume-section" style={sectionStyle}>
        <div className="resume-section-title" style={titleStyle}>{title}</div>
        <div style={contentStyle}>
          {items.map(exp => {
            const contentMarkdown = getMarkdownContent(exp);
            const hasAnyField = exp.company || exp.position || exp.startDate || exp.endDate || contentMarkdown;
            if (!hasAnyField) return null;
            return (
              <div key={exp.id} className="resume-entry">
                <div className="resume-entry-header">
                  <div className="resume-entry-left">
                    <span className="resume-entry-title">{exp.company}</span>
                    {exp.position && <span className="resume-entry-sub">{exp.position}</span>}
                    {exp.department && <span className="resume-entry-sub resume-entry-dept">（{exp.department}）</span>}
                  </div>
                  <div className="resume-entry-date">
                    {exp.startDate}{exp.startDate && exp.endDate ? ' ~ ' : ''}{exp.endDate}
                  </div>
                </div>
                {renderMarkdownContent(contentMarkdown)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSkills = () => {
    if (!skills) return null;
    const lines = skills.split('\n').filter(l => l.trim());
    if (lines.length === 0) return null;
    return (
      <div className="resume-section" style={sectionStyle}>
        <div className="resume-section-title" style={titleStyle}>专业技能</div>
        <div style={contentStyle}>
          <ul className="resume-desc-list">
            {lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  const renderProjects = () => {
    if (!hasContent(projectExperience)) return null;
    return (
      <div className="resume-section" style={sectionStyle}>
        <div className="resume-section-title" style={titleStyle}>项目经历</div>
        <div style={contentStyle}>
          {projectExperience.map(proj => {
            const contentMarkdown = getMarkdownContent(proj);
            const hasAnyField = proj.name || proj.role || proj.startDate || proj.endDate || contentMarkdown;
            if (!hasAnyField) return null;
            return (
              <div key={proj.id} className="resume-entry">
                <div className="resume-entry-header">
                  <div className="resume-entry-left">
                    <span className="resume-entry-title">{proj.name}</span>
                    {proj.role && <span className="resume-entry-sub">{proj.role}</span>}
                  </div>
                  <div className="resume-entry-date">
                    {proj.startDate}{proj.startDate && proj.endDate ? ' ~ ' : ''}{proj.endDate}
                  </div>
                </div>
                {renderMarkdownContent(contentMarkdown)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAwards = () => {
    if (!hasContent(awards)) return null;
    return (
      <div className="resume-section" style={sectionStyle}>
        <div className="resume-section-title" style={titleStyle}>获奖经历</div>
        <div style={contentStyle}>
          {awards.map(award => {
            if (!award.name) return null;
            return (
              <div key={award.id} className="resume-entry">
                <div className="resume-entry-header">
                  <div className="resume-entry-left">
                    <span className="resume-entry-title">{award.name}</span>
                    {award.level && <span className="resume-entry-sub">{award.level}</span>}
                  </div>
                  <div className="resume-entry-date">{award.date}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCustomModules = () => {
    if (!customModules || customModules.length === 0) return null;
    const validModules = customModules.filter(m => m.title || m.content);
    if (validModules.length === 0) return null;
    return validModules.map(mod => (
      <div key={mod.id} className="resume-section" style={sectionStyle}>
        <div className="resume-section-title" style={titleStyle}>{mod.title}</div>
        {mod.content && (
          <div style={contentStyle}>
            {mod.content.split('\n').map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div
      ref={ref}
      className="resume-preview-page"
      style={{
        padding: `${pageMargin.top}px ${pageMargin.right}px ${pageMargin.bottom}px ${pageMargin.left}px`,
        fontSize: `${moduleContentFontSize}px`,
        lineHeight: lineHeight,
      }}
    >
      {renderHeader()}
      {renderEducation()}
      {renderSkills()}
      {renderExperienceSection(campusExperience, '校园经历')}
      {renderExperienceSection(internship, '实习经历')}
      {renderExperienceSection(workExperience, '工作经历')}
      {renderProjects()}
      {renderAwards()}
      {renderCustomModules()}
    </div>
  );
});

export default ResumePreview;
