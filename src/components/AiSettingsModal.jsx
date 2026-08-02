import { useState } from 'react';
import { aiPresets, testConnection, isAiConfigReady } from '../utils/ai';

export default function AiSettingsModal({ config, onSave, onClose }) {
  const [draft, setDraft] = useState({ ...config });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showKey, setShowKey] = useState(false);

  const update = (field, value) => {
    setDraft(prev => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const applyPreset = (preset) => {
    setDraft(prev => ({ ...prev, baseUrl: preset.baseUrl, model: preset.model }));
    setTestResult(null);
  };

  const handleTest = async () => {
    if (testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const reply = await testConnection(draft);
      setTestResult({ ok: true, message: `连接成功，模型回复：${reply.slice(0, 60)}` });
    } catch (e) {
      setTestResult({ ok: false, message: e.message, detail: e.detail });
    }
    setTesting(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>AI 面试官设置</h3>
          <button className="btn-icon" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <p className="modal-tip">
            使用你自己的大模型 API（任何兼容 OpenAI <code>/chat/completions</code> 协议的服务均可）。
            配置只保存在当前浏览器的本地存储中，不会上传到任何服务器。
          </p>

          <div className="config-group">
            <label>快速填充</label>
            <div className="preset-list">
              {aiPresets.map(preset => (
                <button
                  key={preset.label}
                  className={`preset-btn ${draft.baseUrl === preset.baseUrl ? 'active' : ''}`}
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="config-group">
            <label>API 地址（Base URL）</label>
            <input
              type="text"
              value={draft.baseUrl}
              onChange={e => update('baseUrl', e.target.value)}
              placeholder="例如：https://api.deepseek.com/v1"
            />
            <p className="config-hint">会自动拼接 /chat/completions；若你的地址已包含该路径也可直接粘贴。</p>
          </div>

          <div className="config-group">
            <label>API Key</label>
            <div className="input-with-action">
              <input
                type={showKey ? 'text' : 'password'}
                value={draft.apiKey}
                onChange={e => update('apiKey', e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
              />
              <button className="btn btn-outline btn-sm" onClick={() => setShowKey(v => !v)}>
                {showKey ? '隐藏' : '显示'}
              </button>
            </div>
          </div>

          <div className="config-group">
            <label>模型名称</label>
            <input
              type="text"
              value={draft.model}
              onChange={e => update('model', e.target.value)}
              placeholder="例如：deepseek-chat"
            />
          </div>

          <div className="config-row">
            <div className="config-group">
              <label>温度（0-2，越大越发散）</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={draft.temperature}
                onChange={e => update('temperature', Number(e.target.value))}
              />
            </div>
            <div className="config-group">
              <label>单次请求超时（秒）</label>
              <input
                type="number"
                min="10"
                max="600"
                value={draft.timeout}
                onChange={e => update('timeout', Number(e.target.value))}
              />
            </div>
          </div>

          {testResult && (
            <div className={`alert ${testResult.ok ? 'alert-success' : 'alert-error'}`}>
              <span>{testResult.message}</span>
              {testResult.detail && <pre className="alert-detail">{testResult.detail}</pre>}
            </div>
          )}

          <p className="config-hint">
            提示：浏览器直连需要该服务允许跨域（CORS）。若提示无法连接，可换用支持跨域的服务商或自建代理地址。
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={handleTest} disabled={testing || !isAiConfigReady(draft)}>
            {testing ? '测试中...' : '测试连接'}
          </button>
          <button className="btn btn-outline" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={() => onSave(draft)}>保存</button>
        </div>
      </div>
    </div>
  );
}
