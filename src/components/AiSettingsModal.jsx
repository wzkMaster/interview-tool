import { useMemo, useState } from 'react';
import { aiProviders, testConnection, isAiConfigReady } from '../utils/ai';

const createProfileId = () => (
  globalThis.crypto?.randomUUID?.() || `ai-profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);

function profilesFromConfig(config) {
  if (Array.isArray(config?.profiles) && config.profiles.length) return config.profiles.map(profile => ({ ...profile }));
  return [{
    id: config?.id || createProfileId(),
    name: config?.name || 'DeepSeek 默认配置',
    provider: config?.provider || 'deepseek',
    baseUrl: config?.baseUrl || 'https://api.deepseek.com/v1',
    apiKey: config?.apiKey || '',
    model: config?.model || 'deepseek-v4-flash',
    temperature: config?.temperature ?? 0.7,
    timeout: config?.timeout ?? 90,
  }];
}

export default function AiSettingsModal({ config, onSave, onClose }) {
  const [profiles, setProfiles] = useState(() => profilesFromConfig(config));
  const [activeId, setActiveId] = useState(() => (
    profiles.some(profile => profile.id === config?.activeProfileId) ? config.activeProfileId : profiles[0].id
  ));
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showKey, setShowKey] = useState(false);

  const draft = profiles.find(profile => profile.id === activeId) || profiles[0];
  const provider = aiProviders.find(item => item.id === draft.provider) || aiProviders.at(-1);
  const isCommonModel = provider.models.some(item => item.value === draft.model);
  const modelSelectValue = isCommonModel ? draft.model : '__custom__';

  const profileNamePlaceholder = useMemo(() => `${provider.label} 配置`, [provider.label]);

  const update = (field, value) => {
    setProfiles(current => current.map(profile => (
      profile.id === activeId ? { ...profile, [field]: value } : profile
    )));
    setTestResult(null);
  };

  const applyProvider = (nextProvider) => {
    if (nextProvider.id === draft.provider) return;
    const hasAutomaticName = !draft.name.trim() || draft.name.startsWith(`${provider.label} 配置`) || draft.name === `${provider.label} 默认配置`;
    const nextProviderCount = profiles.filter(profile => profile.id !== activeId && profile.provider === nextProvider.id).length;
    setProfiles(current => current.map(profile => (
      profile.id === activeId
        ? {
            ...profile,
            name: hasAutomaticName ? `${nextProvider.label} 配置 ${nextProviderCount + 1}` : profile.name,
            provider: nextProvider.id,
            baseUrl: nextProvider.baseUrl,
            model: nextProvider.defaultModel,
            apiKey: '',
          }
        : profile
    )));
    setShowKey(false);
    setTestResult(null);
  };

  const addProfile = () => {
    const deepseek = aiProviders[0];
    const sameProviderCount = profiles.filter(profile => profile.provider === deepseek.id).length;
    const next = {
      id: createProfileId(),
      name: `DeepSeek 配置 ${sameProviderCount + 1}`,
      provider: deepseek.id,
      baseUrl: deepseek.baseUrl,
      apiKey: '',
      model: deepseek.defaultModel,
      temperature: 0.7,
      timeout: 90,
    };
    setProfiles(current => [...current, next]);
    setActiveId(next.id);
    setShowKey(false);
    setTestResult(null);
  };

  const deleteProfile = () => {
    if (profiles.length <= 1) return;
    if (!window.confirm(`确定删除“${draft.name || '未命名配置'}”吗？`)) return;
    const nextProfiles = profiles.filter(profile => profile.id !== activeId);
    setProfiles(nextProfiles);
    setActiveId(nextProfiles[0].id);
    setShowKey(false);
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

  const handleSave = () => {
    const normalizedProfiles = profiles.map((profile, index) => ({
      ...profile,
      name: profile.name.trim() || `AI 配置 ${index + 1}`,
      baseUrl: profile.baseUrl.trim(),
      apiKey: profile.apiKey.trim(),
      model: profile.model.trim(),
    }));
    const active = normalizedProfiles.find(profile => profile.id === activeId) || normalizedProfiles[0];
    onSave({
      baseUrl: active.baseUrl,
      apiKey: active.apiKey,
      model: active.model,
      temperature: active.temperature,
      timeout: active.timeout,
      provider: active.provider,
      activeProfileId: active.id,
      profiles: normalizedProfiles,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>AI 面试官设置</h3>
          <button className="btn-icon" onClick={onClose} aria-label="关闭">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <p className="modal-tip">
            可保存多套 OpenAI 兼容 API 配置并随时切换。模型方案会同步，API Key 只保存在当前浏览器中。
          </p>

          <div className="config-group">
            <label>已保存的配置</label>
            <div className="profile-picker">
              <select value={activeId} onChange={e => { setActiveId(e.target.value); setTestResult(null); setShowKey(false); }}>
                {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name || '未命名配置'}</option>)}
              </select>
              <button type="button" className="btn btn-outline btn-sm" onClick={addProfile}>新增</button>
              <button type="button" className="btn btn-outline btn-sm btn-danger-soft" onClick={deleteProfile} disabled={profiles.length <= 1}>删除</button>
            </div>
          </div>

          <div className="config-group">
            <label>配置名称</label>
            <input value={draft.name} onChange={e => update('name', e.target.value)} placeholder={profileNamePlaceholder} />
          </div>

          <div className="config-group">
            <label>服务商</label>
            <div className="preset-list">
              {aiProviders.map(item => (
                <button
                  type="button"
                  key={item.id}
                  className={`preset-btn ${draft.provider === item.id ? 'active' : ''}`}
                  onClick={() => applyProvider(item)}
                >
                  {item.label}
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
            <p className="config-hint">选择服务商会自动填充；请求时会自动拼接 /chat/completions。</p>
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
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowKey(value => !value)}>
                {showKey ? '隐藏' : '显示'}
              </button>
            </div>
          </div>

          <div className="config-group">
            <label>模型</label>
            <select
              value={modelSelectValue}
              onChange={e => update('model', e.target.value === '__custom__' ? '' : e.target.value)}
            >
              {provider.models.map(item => <option key={item.value} value={item.value}>{item.label} · {item.value}</option>)}
              <option value="__custom__">自定义模型名称…</option>
            </select>
            {modelSelectValue === '__custom__' && (
              <input
                className="model-custom-input"
                type="text"
                value={draft.model}
                onChange={e => update('model', e.target.value)}
                placeholder={draft.provider === 'openrouter' ? '例如：厂商/模型名' : '请输入模型名称'}
                autoFocus
              />
            )}
          </div>

          <div className="config-row">
            <div className="config-group">
              <label>温度（0-2，越大越发散）</label>
              <input type="number" step="0.1" min="0" max="2" value={draft.temperature} onChange={e => update('temperature', Number(e.target.value))} />
            </div>
            <div className="config-group">
              <label>单次请求超时（秒）</label>
              <input type="number" min="10" max="600" value={draft.timeout} onChange={e => update('timeout', Number(e.target.value))} />
            </div>
          </div>

          {testResult && (
            <div className={`alert ${testResult.ok ? 'alert-success' : 'alert-error'}`}>
              <span>{testResult.message}</span>
              {testResult.detail && <pre className="alert-detail">{testResult.detail}</pre>}
            </div>
          )}

          <p className="config-hint">提示：浏览器直连需要服务商允许跨域（CORS）。切换服务商时会清空当前方案的 Key，避免误发给其他平台。</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={handleTest} disabled={testing || !isAiConfigReady(draft)}>{testing ? '测试中...' : '测试连接'}</button>
          <button className="btn btn-outline" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave}>保存并使用</button>
        </div>
      </div>
    </div>
  );
}
