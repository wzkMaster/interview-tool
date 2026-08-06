import { useMemo, useRef, useState } from 'react';
import { formatTime } from '../utils/storage';

function countModules(data) {
  if (!data) return 0;
  const arrays = ['education', 'campusExperience', 'internship', 'workExperience', 'careerProgression', 'projectExperience', 'awards', 'customModules'];
  return arrays.reduce((sum, key) => sum + (Array.isArray(data[key]) ? data[key].length : 0), 0);
}

export default function ResumeManager({
  resumes,
  activeId,
  interviewCounts,
  onEdit,
  onInterview,
  onCreate,
  onDuplicate,
  onRename,
  onDelete,
  onExportMarkdown,
  onImportMarkdown,
}) {
  const [keyword, setKeyword] = useState('');
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const importInputRef = useRef(null);

  const filtered = useMemo(() => {
    const list = [...resumes].sort((a, b) => b.updatedAt - a.updatedAt);
    const kw = keyword.trim().toLowerCase();
    if (!kw) return list;
    return list.filter(r =>
      r.name.toLowerCase().includes(kw) ||
      (r.data?.basicInfo?.jobIntention || '').toLowerCase().includes(kw) ||
      (r.data?.basicInfo?.name || '').toLowerCase().includes(kw)
    );
  }, [resumes, keyword]);

  const openRename = (resume) => {
    setRenameTarget(resume);
    setRenameValue(resume.name);
  };

  const submitRename = () => {
    const name = renameValue.trim();
    if (!name) return;
    onRename(renameTarget.id, name);
    setRenameTarget(null);
  };

  const handleDelete = (resume) => {
    const count = interviewCounts?.[resume.id] || 0;
    const extra = count > 0 ? `，及其 ${count} 场面试记录` : '';
    if (window.confirm(`确认删除「${resume.name}」${extra}？该操作不可恢复。`)) {
      onDelete(resume.id);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await onImportMarkdown(file);
  };

  return (
    <main className="manager-page">
      <div className="manager-toolbar">
        <div className="manager-toolbar-left">
          <h2>我的简历</h2>
          <span className="manager-count">共 {resumes.length} 个版本</span>
        </div>
        <div className="manager-toolbar-right">
          <input
            ref={importInputRef}
            className="visually-hidden"
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            onChange={handleImport}
          />
          <input
            className="manager-search"
            type="search"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="搜索版本名称 / 求职意向"
          />
          <button className="btn btn-outline" onClick={() => onCreate('template')}>使用推荐模板</button>
          <button className="btn btn-outline" onClick={() => importInputRef.current?.click()}>导入 Markdown</button>
          <button className="btn btn-primary" onClick={() => onCreate('blank')}>+ 新建简历</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="manager-empty">
          {keyword ? '没有匹配的简历版本' : '还没有简历，点击右上角「新建简历」开始吧'}
        </div>
      ) : (
        <div className="resume-grid">
          {filtered.map(resume => {
            const info = resume.data?.basicInfo || {};
            const interviewCount = interviewCounts?.[resume.id] || 0;
            return (
              <div key={resume.id} className={`resume-card ${resume.id === activeId ? 'current' : ''}`}>
                <div className="resume-card-head">
                  <h3 title={resume.name}>{resume.name}</h3>
                  {resume.id === activeId && <span className="badge badge-current">当前</span>}
                </div>
                <div className="resume-card-meta">
                  <span>{info.name || '未填写姓名'}</span>
                  {info.jobIntention && <span className="dot-sep">{info.jobIntention}</span>}
                </div>
                <p className="resume-card-summary">
                  {info.personalSummary || '暂无个人简介'}
                </p>
                <div className="resume-card-stats">
                  <span>{countModules(resume.data)} 条经历</span>
                  <span>{interviewCount} 场面试</span>
                </div>
                <div className="resume-card-time">更新于 {formatTime(resume.updatedAt)}</div>
                <div className="resume-card-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => onEdit(resume.id)}>编辑</button>
                  <button className="btn btn-outline btn-sm" onClick={() => onInterview(resume.id)}>AI 面试</button>
                </div>
                <div className="resume-card-links">
                  <button className="btn-link btn-link-sm" onClick={() => openRename(resume)}>重命名</button>
                  <button className="btn-link btn-link-sm" onClick={() => onDuplicate(resume.id)}>复制</button>
                  <button className="btn-link btn-link-sm" onClick={() => onExportMarkdown(resume)}>导出 Markdown</button>
                  <button
                    className="btn-link btn-link-sm btn-link-danger"
                    onClick={() => handleDelete(resume)}
                    disabled={resumes.length <= 1}
                    title={resumes.length <= 1 ? '至少保留一个简历版本' : '删除'}
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {renameTarget && (
        <div className="modal-overlay" onClick={() => setRenameTarget(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>重命名简历版本</h3>
              <button className="btn-icon" onClick={() => setRenameTarget(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="config-group">
                <label>版本名称</label>
                <input
                  type="text"
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitRename()}
                  placeholder="例如：前端工程师-阿里投递版"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setRenameTarget(null)}>取消</button>
              <button className="btn btn-primary" onClick={submitRename} disabled={!renameValue.trim()}>确定</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
