import { useEffect, useState } from 'react';
import { isRemoteStorageConfigured, remoteAccount } from '../utils/supabase';

export default function StorageAccountModal({ mode, syncStatus, error, busy, onLogin, onLogout, onClose }) {
  const [password, setPassword] = useState('');

  useEffect(() => {
    setPassword('');
  }, [mode]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!password || busy) return;
    onLogin(remoteAccount.username, password);
  };

  const statusText = {
    idle: '云端数据已加载',
    syncing: '正在同步…',
    synced: '已同步到云端',
    error: '同步失败',
  }[syncStatus] || '';

  return (
    <div className="modal-overlay" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <div className="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="storage-account-title">
        <div className="modal-header">
          <h3 id="storage-account-title">存储与账号</h3>
          <button className="btn-icon" onClick={onClose} aria-label="关闭">✕</button>
        </div>

        <div className="modal-body">
          {mode === 'remote' ? (
            <>
              <div className="storage-account-summary">
                <span className="storage-account-avatar">W</span>
                <div>
                  <strong>{remoteAccount.username}</strong>
                  <p>正在使用 Supabase 远程存储</p>
                </div>
              </div>
              <div className={`storage-sync-detail ${syncStatus === 'error' ? 'is-error' : ''}`}>
                <span className={`storage-status-dot ${syncStatus === 'syncing' ? 'is-syncing' : ''}`} />
                {statusText}
              </div>
              {error && <div className="alert alert-error storage-alert">{error}</div>}
              <p className="modal-tip storage-tip">
                简历、模型配置和问答历史会自动同步。退出后将切回这台设备原有的本地数据。
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="modal-tip">
                当前使用浏览器本地存储，无需账号。只有管理员开通的账号可以使用远程存储。
              </p>

              {!isRemoteStorageConfigured && (
                <div className="alert alert-warning storage-alert">
                  远程存储尚未配置，请先按 README 设置 Supabase 环境变量。
                </div>
              )}

              {error && <div className="alert alert-error storage-alert">{error}</div>}

              <div className="config-group">
                <label htmlFor="remote-username">账号</label>
                <input id="remote-username" value={remoteAccount.username} readOnly autoComplete="username" />
              </div>
              <div className="config-group">
                <label htmlFor="remote-password">密码</label>
                <input
                  id="remote-password"
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder="请输入管理员设置的密码"
                  autoComplete="current-password"
                  autoFocus
                />
              </div>

              <button
                className="btn btn-primary storage-login-btn"
                type="submit"
                disabled={!isRemoteStorageConfigured || !password || busy}
              >
                {busy ? '正在登录…' : '登录并启用远程存储'}
              </button>
            </form>
          )}
        </div>

        {mode === 'remote' && (
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={onClose}>关闭</button>
            <button className="btn btn-danger" onClick={onLogout} disabled={busy}>
              {busy ? '正在退出…' : '退出远程账号'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
