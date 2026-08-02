import { useEffect, useMemo, useState } from 'react';
import {
  buildResumeContext,
  generateQuestions,
  evaluateAnswer,
  generateSummary,
  isAiConfigReady,
} from '../utils/ai';
import { createId, formatTime } from '../utils/storage';

const levelOptions = ['初级', '中级', '高级', '专家'];
const countOptions = [3, 5, 8, 10];

function averageScore(questions) {
  const scores = questions.map(q => q.evaluation?.score).filter(s => typeof s === 'number');
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function scoreLevelClass(score) {
  if (typeof score !== 'number') return '';
  if (score >= 80) return 'score-good';
  if (score >= 60) return 'score-mid';
  return 'score-low';
}

function ErrorBox({ error, onRetry, retryText = '重试' }) {
  if (!error) return null;
  return (
    <div className="alert alert-error">
      <div className="alert-main">
        <span>{error.message}</span>
        {onRetry && <button className="btn btn-outline btn-sm" onClick={onRetry}>{retryText}</button>}
      </div>
      {error.detail && <pre className="alert-detail">{error.detail}</pre>}
    </div>
  );
}

function EvaluationBlock({ evaluation }) {
  if (!evaluation) return null;
  return (
    <div className="evaluation-block">
      <div className="evaluation-head">
        <span className="evaluation-title">面试官评价</span>
        {typeof evaluation.score === 'number' && (
          <span className={`score-badge ${scoreLevelClass(evaluation.score)}`}>{evaluation.score} 分</span>
        )}
        <span className="evaluation-time">{formatTime(evaluation.createdAt)}</span>
      </div>
      {evaluation.summary && <p className="evaluation-summary">{evaluation.summary}</p>}
      {evaluation.strengths?.length > 0 && (
        <div className="evaluation-list">
          <h5>亮点</h5>
          <ul>{evaluation.strengths.map((item, i) => <li key={i}>{item}</li>)}</ul>
        </div>
      )}
      {evaluation.improvements?.length > 0 && (
        <div className="evaluation-list">
          <h5>改进建议</h5>
          <ul>{evaluation.improvements.map((item, i) => <li key={i}>{item}</li>)}</ul>
        </div>
      )}
      {evaluation.reference && (
        <div className="evaluation-list">
          <h5>参考回答要点</h5>
          <p className="evaluation-text">{evaluation.reference}</p>
        </div>
      )}
      {evaluation.followUp && (
        <div className="evaluation-followup">可能的追问：{evaluation.followUp}</div>
      )}
      {evaluation.parseFallback && (
        <div className="evaluation-fallback">该结果未按结构化格式返回，已按原文展示，可点击「重新评价」再试一次。</div>
      )}
    </div>
  );
}

export default function AiInterview({ resume, sessions, onSessionsChange, aiConfig, onOpenSettings }) {
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [pending, setPending] = useState({});
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [setupError, setSetupError] = useState(null);
  const [setup, setSetup] = useState({
    jobTitle: resume?.data?.basicInfo?.jobIntention || '',
    level: '中级',
    count: 5,
    style: '',
  });

  const ready = isAiConfigReady(aiConfig);
  const resumeContext = useMemo(() => buildResumeContext(resume?.data), [resume]);
  const sortedSessions = useMemo(() => [...sessions].sort((a, b) => b.createdAt - a.createdAt), [sessions]);
  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  // 切换简历时回到新建面试界面，并同步默认岗位
  useEffect(() => {
    setActiveSessionId(null);
    setDrafts({});
    setSetupError(null);
    setSetup(prev => ({ ...prev, jobTitle: resume?.data?.basicInfo?.jobIntention || '' }));
  }, [resume?.id]);

  const openSession = (session) => {
    setActiveSessionId(session.id);
    setSetupError(null);
    const nextDrafts = {};
    session.questions.forEach(q => { nextDrafts[q.id] = q.answer || ''; });
    setDrafts(nextDrafts);
  };

  const updateSession = (sessionId, updater) => {
    onSessionsChange(prev => prev.map(s => (s.id === sessionId ? { ...updater(s), updatedAt: Date.now() } : s)));
  };

  const updateQuestion = (sessionId, questionId, patch) => {
    updateSession(sessionId, session => ({
      ...session,
      questions: session.questions.map(q => (q.id === questionId ? { ...q, ...patch } : q)),
    }));
  };

  const setQuestionPending = (questionId, value) => {
    setPending(prev => {
      const next = { ...prev };
      if (value) next[questionId] = value;
      else delete next[questionId];
      return next;
    });
  };

  const toQuestionItems = (raw) => raw.map(item => ({
    id: createId('q'),
    question: item.question,
    category: item.category,
    intent: item.intent,
    answer: '',
    evaluation: null,
    error: null,
    attempts: 0,
  }));

  // 开始一场新面试：生成成功后才落库，失败时保留表单并允许重试
  const handleStartInterview = async () => {
    if (loadingQuestions) return;
    if (!ready) {
      setSetupError({ message: '请先在「AI 设置」中配置你的大模型 API' });
      return;
    }
    setLoadingQuestions(true);
    setSetupError(null);
    try {
      const raw = await generateQuestions(aiConfig, {
        resumeContext,
        jobTitle: setup.jobTitle,
        level: setup.level,
        count: setup.count,
        style: setup.style,
      });
      const now = Date.now();
      const session = {
        id: createId('session'),
        resumeId: resume.id,
        resumeName: resume.name,
        jobTitle: setup.jobTitle || resume?.data?.basicInfo?.jobIntention || '未指定岗位',
        level: setup.level,
        style: setup.style,
        count: setup.count,
        createdAt: now,
        updatedAt: now,
        status: 'ongoing',
        questions: toQuestionItems(raw),
        summary: null,
        summaryError: null,
      };
      onSessionsChange(prev => [session, ...prev]);
      setActiveSessionId(session.id);
      setDrafts({});
    } catch (e) {
      setSetupError({ message: e.message, detail: e.detail });
    }
    setLoadingQuestions(false);
  };

  // 在已有面试中追加题目
  const handleAppendQuestions = async () => {
    if (!activeSession || loadingQuestions) return;
    setLoadingQuestions(true);
    updateSession(activeSession.id, s => ({ ...s, questionsError: null }));
    try {
      const raw = await generateQuestions(aiConfig, {
        resumeContext,
        jobTitle: activeSession.jobTitle,
        level: activeSession.level,
        count: 3,
        style: activeSession.style,
        existingQuestions: activeSession.questions.map(q => q.question),
      });
      updateSession(activeSession.id, s => ({
        ...s,
        status: 'ongoing',
        questions: [...s.questions, ...toQuestionItems(raw)],
      }));
    } catch (e) {
      updateSession(activeSession.id, s => ({ ...s, questionsError: { message: e.message, detail: e.detail } }));
    }
    setLoadingQuestions(false);
  };

  // 换掉某一道题
  const handleRegenerateQuestion = async (question) => {
    if (!activeSession || pending[question.id]) return;
    setQuestionPending(question.id, 'regenerate');
    updateQuestion(activeSession.id, question.id, { error: null });
    try {
      const raw = await generateQuestions(aiConfig, {
        resumeContext,
        jobTitle: activeSession.jobTitle,
        level: activeSession.level,
        count: 1,
        style: activeSession.style,
        existingQuestions: activeSession.questions.map(q => q.question),
      });
      const next = raw[0];
      if (next) {
        updateQuestion(activeSession.id, question.id, {
          question: next.question,
          category: next.category,
          intent: next.intent,
          answer: '',
          evaluation: null,
          error: null,
        });
        setDrafts(prev => ({ ...prev, [question.id]: '' }));
      }
    } catch (e) {
      updateQuestion(activeSession.id, question.id, { error: { message: `换题失败：${e.message}`, detail: e.detail } });
    }
    setQuestionPending(question.id, null);
  };

  // 提交/重新评价某一道题
  const handleEvaluate = async (question) => {
    if (!activeSession || pending[question.id]) return;
    const answer = drafts[question.id] ?? question.answer ?? '';
    if (!answer.trim() && !window.confirm('当前回答为空，仍要让面试官评价吗？')) return;

    setQuestionPending(question.id, 'evaluate');
    updateQuestion(activeSession.id, question.id, { answer, error: null });
    try {
      const evaluation = await evaluateAnswer(aiConfig, {
        resumeContext,
        jobTitle: activeSession.jobTitle,
        level: activeSession.level,
        question: question.question,
        intent: question.intent,
        answer,
      });
      updateQuestion(activeSession.id, question.id, {
        answer,
        evaluation,
        error: null,
        attempts: (question.attempts || 0) + 1,
      });
    } catch (e) {
      updateQuestion(activeSession.id, question.id, {
        error: { message: e.message, detail: e.detail },
        attempts: (question.attempts || 0) + 1,
      });
    }
    setQuestionPending(question.id, null);
  };

  const handleGenerateSummary = async () => {
    if (!activeSession || loadingSummary) return;
    setLoadingSummary(true);
    updateSession(activeSession.id, s => ({ ...s, summaryError: null }));
    try {
      const summary = await generateSummary(aiConfig, {
        resumeContext,
        jobTitle: activeSession.jobTitle,
        level: activeSession.level,
        qaList: activeSession.questions.map(q => ({
          question: q.question,
          answer: drafts[q.id] ?? q.answer ?? '',
          evaluation: q.evaluation,
        })),
      });
      updateSession(activeSession.id, s => ({ ...s, summary, status: 'finished', summaryError: null }));
    } catch (e) {
      updateSession(activeSession.id, s => ({ ...s, summaryError: { message: e.message, detail: e.detail } }));
    }
    setLoadingSummary(false);
  };

  const handleDeleteSession = (session) => {
    if (!window.confirm(`确认删除这场面试记录（${formatTime(session.createdAt)}）？`)) return;
    onSessionsChange(prev => prev.filter(s => s.id !== session.id));
    if (activeSessionId === session.id) setActiveSessionId(null);
  };

  const commitDraft = (question) => {
    const answer = drafts[question.id] ?? '';
    if (answer !== (question.answer || '')) {
      updateQuestion(activeSession.id, question.id, { answer });
    }
  };

  const renderSetup = () => (
    <div className="interview-setup">
      <div className="section-header">
        <h3>开始一场模拟面试</h3>
        <p className="section-desc">AI 面试官会读取「{resume.name}」的内容，围绕你的真实经历提问。</p>
      </div>

      {!ready && (
        <div className="alert alert-warning">
          <div className="alert-main">
            <span>尚未配置 AI API，配置后即可开始面试。</span>
            <button className="btn btn-primary btn-sm" onClick={onOpenSettings}>去设置</button>
          </div>
        </div>
      )}

      <div className="form-grid">
        <div className="form-group">
          <label>目标岗位</label>
          <input
            type="text"
            value={setup.jobTitle}
            onChange={e => setSetup(prev => ({ ...prev, jobTitle: e.target.value }))}
            placeholder="例如：前端开发工程师（电商交易）"
          />
        </div>
        <div className="form-group">
          <label>面试难度</label>
          <select value={setup.level} onChange={e => setSetup(prev => ({ ...prev, level: e.target.value }))}>
            {levelOptions.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>题目数量</label>
          <select value={setup.count} onChange={e => setSetup(prev => ({ ...prev, count: Number(e.target.value) }))}>
            {countOptions.map(c => <option key={c} value={c}>{c} 题</option>)}
          </select>
        </div>
        <div className="form-group form-group-full">
          <label>提问侧重（可选）</label>
          <textarea
            value={setup.style}
            onChange={e => setSetup(prev => ({ ...prev, style: e.target.value }))}
            placeholder="例如：多问性能优化和跨端方案的技术细节，少问八股文"
            rows={3}
          />
        </div>
      </div>

      <ErrorBox error={setupError} onRetry={setupError && ready ? handleStartInterview : null} />

      <button className="btn btn-primary btn-lg" onClick={handleStartInterview} disabled={loadingQuestions || !ready}>
        {loadingQuestions ? 'AI 正在出题...' : '开始面试'}
      </button>

      {sortedSessions.length > 0 && (
        <p className="setup-hint">左侧可以查看这份简历的 {sortedSessions.length} 场历史面试记录。</p>
      )}
    </div>
  );

  const renderSession = () => {
    const answered = activeSession.questions.filter(q => q.evaluation).length;
    const total = activeSession.questions.length;
    const avg = averageScore(activeSession.questions);

    return (
      <div className="interview-session">
        <div className="session-head">
          <div className="session-head-main">
            <h3>{activeSession.jobTitle}</h3>
            <div className="session-meta">
              <span className="tag tag-blue">{activeSession.level}</span>
              <span>{formatTime(activeSession.createdAt)}</span>
              <span>已评价 {answered}/{total}</span>
              {typeof avg === 'number' && <span className={`score-badge ${scoreLevelClass(avg)}`}>平均 {avg} 分</span>}
            </div>
          </div>
          <div className="session-head-actions">
            <button className="btn btn-outline btn-sm" onClick={handleAppendQuestions} disabled={loadingQuestions}>
              {loadingQuestions ? '出题中...' : '+ 追加 3 题'}
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setActiveSessionId(null)}>新建面试</button>
          </div>
        </div>

        <ErrorBox error={activeSession.questionsError} onRetry={handleAppendQuestions} />

        <div className="question-list">
          {activeSession.questions.map((q, index) => {
            const busy = pending[q.id];
            const answer = drafts[q.id] ?? q.answer ?? '';
            return (
              <div key={q.id} className={`question-card ${q.evaluation ? 'evaluated' : ''}`}>
                <div className="question-head">
                  <span className="question-index">Q{index + 1}</span>
                  {q.category && <span className="tag tag-orange">{q.category}</span>}
                  {q.evaluation && typeof q.evaluation.score === 'number' && (
                    <span className={`score-badge ${scoreLevelClass(q.evaluation.score)}`}>{q.evaluation.score} 分</span>
                  )}
                  <button
                    className="btn-link btn-link-sm"
                    onClick={() => handleRegenerateQuestion(q)}
                    disabled={Boolean(busy)}
                  >
                    {busy === 'regenerate' ? '换题中...' : '换一道题'}
                  </button>
                </div>
                <p className="question-text">{q.question}</p>
                {q.intent && <p className="question-intent">考察点：{q.intent}</p>}

                <textarea
                  className="answer-textarea"
                  value={answer}
                  onChange={e => setDrafts(prev => ({ ...prev, [q.id]: e.target.value }))}
                  onBlur={() => commitDraft(q)}
                  placeholder="在这里输入你的回答，尽量结合背景、方案、难点和结果来讲..."
                  rows={6}
                  disabled={busy === 'evaluate'}
                />

                <div className="question-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleEvaluate(q)}
                    disabled={Boolean(busy)}
                  >
                    {busy === 'evaluate' ? 'AI 正在评价...' : q.evaluation ? '重新评价' : '提交回答'}
                  </button>
                  {q.attempts > 0 && <span className="question-attempts">已评价 {q.attempts} 次</span>}
                </div>

                <ErrorBox error={q.error} onRetry={() => handleEvaluate(q)} />
                <EvaluationBlock evaluation={q.evaluation} />
              </div>
            );
          })}
        </div>

        <div className="session-summary-area">
          <ErrorBox error={activeSession.summaryError} onRetry={handleGenerateSummary} />
          {activeSession.summary ? (
            <div className="summary-card">
              <div className="summary-head">
                <h4>整体面试评估</h4>
                {typeof activeSession.summary.score === 'number' && (
                  <span className={`score-badge ${scoreLevelClass(activeSession.summary.score)}`}>{activeSession.summary.score} 分</span>
                )}
                <button className="btn btn-outline btn-sm" onClick={handleGenerateSummary} disabled={loadingSummary}>
                  {loadingSummary ? '生成中...' : '重新生成'}
                </button>
              </div>
              {activeSession.summary.conclusion && <p className="evaluation-summary">{activeSession.summary.conclusion}</p>}
              {activeSession.summary.strengths?.length > 0 && (
                <div className="evaluation-list">
                  <h5>整体优势</h5>
                  <ul>{activeSession.summary.strengths.map((item, i) => <li key={i}>{item}</li>)}</ul>
                </div>
              )}
              {activeSession.summary.improvements?.length > 0 && (
                <div className="evaluation-list">
                  <h5>待提升</h5>
                  <ul>{activeSession.summary.improvements.map((item, i) => <li key={i}>{item}</li>)}</ul>
                </div>
              )}
              {activeSession.summary.actions?.length > 0 && (
                <div className="evaluation-list">
                  <h5>后续准备建议</h5>
                  <ul>{activeSession.summary.actions.map((item, i) => <li key={i}>{item}</li>)}</ul>
                </div>
              )}
            </div>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={handleGenerateSummary} disabled={loadingSummary || answered === 0}>
              {loadingSummary ? 'AI 正在总结...' : '生成整体评估'}
            </button>
          )}
          {answered === 0 && !activeSession.summary && (
            <p className="setup-hint">至少完成一道题的评价后即可生成整体评估。</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="app-main interview-main">
      <aside className="history-panel">
        <div className="history-header">
          <h2>面试记录</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setActiveSessionId(null)}>+ 新面试</button>
        </div>
        <div className="history-list">
          {sortedSessions.length === 0 && <div className="history-empty">暂无面试记录</div>}
          {sortedSessions.map(session => {
            const answered = session.questions.filter(q => q.evaluation).length;
            const avg = averageScore(session.questions);
            return (
              <div
                key={session.id}
                className={`history-item ${session.id === activeSessionId ? 'active' : ''}`}
                onClick={() => openSession(session)}
              >
                <div className="history-item-head">
                  <span className="history-item-title">{session.jobTitle}</span>
                  <button
                    className="btn-icon btn-danger-icon"
                    title="删除记录"
                    onClick={e => { e.stopPropagation(); handleDeleteSession(session); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
                <div className="history-item-meta">
                  <span>{formatTime(session.createdAt)}</span>
                  <span>{answered}/{session.questions.length} 题</span>
                </div>
                <div className="history-item-foot">
                  <span className={`history-status ${session.status === 'finished' ? 'done' : ''}`}>
                    {session.status === 'finished' ? '已完成' : '进行中'}
                  </span>
                  {typeof avg === 'number' && <span className={`score-badge score-badge-sm ${scoreLevelClass(avg)}`}>{avg} 分</span>}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <section className="interview-panel">
        <div className="interview-panel-header">
          <h2>AI 面试官</h2>
          <div className="interview-panel-header-right">
            <span className="ai-status">
              {ready ? `模型：${aiConfig.model}` : '未配置 API'}
            </span>
            <button className="btn btn-outline btn-sm" onClick={onOpenSettings}>AI 设置</button>
          </div>
        </div>
        <div className="interview-content">
          {activeSession ? renderSession() : renderSetup()}
        </div>
      </section>
    </main>
  );
}
