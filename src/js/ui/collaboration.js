import { escapeHtml, download } from '../core/utils.js';
import { t } from '../core/i18n.js';
import { readField } from '../core/sync-protocol.js';
export function syncLabel(sync) {
  const labels = { disconnected: '连接协作', connecting: '正在连接', pending: '待同步', syncing: '同步中', synced: '已同步', conflict: '待人工裁定', offline: '离线 · 已保存本地', blocked: '提交被拒绝 · 草稿已保留' };
  return t(labels[sync.status] || '连接协作');
}
function valueText(value) { return value.exists ? typeof value.value === 'string' ? value.value : JSON.stringify(value.value, null, 2) : t('字段不存在'); }
export function openCollaboration(sync, { onChange = () => {}, onError = () => {} } = {}) {
  let dialog = document.getElementById('collaboration-dialog');
  if (!dialog) { dialog = document.createElement('dialog'); dialog.id = 'collaboration-dialog'; dialog.className = 'collaboration-dialog'; document.body.append(dialog); }
  const render = () => {
    dialog.innerHTML = `<div class="dialog-body"><div class="section-heading"><h2>${t('小组协作')}</h2><button class="button secondary" data-sync="close">${t('关闭')}</button></div><p>${escapeHtml(syncLabel(sync))}${sync.enabled ? ` · ${escapeHtml(sync.actor.name)} · v${sync.revision}` : ''}</p>${sync.error ? `<p role="alert">${escapeHtml(sync.error)}</p>` : ''}${sync.cacheError ? `<p role="alert">${t('本地草稿缓存失败，请导出备份。')}</p>` : ''}`;
    if (!sync.enabled) dialog.querySelector('.dialog-body').insertAdjacentHTML('beforeend', `<form id="sync-connect"><label>${t('项目编号')}<input name="project" value="default" required pattern="[\\w-]{1,64}"></label><label>${t('成员访问令牌')}<input name="token" type="password" autocomplete="off"></label><p class="subtle">${t('本机开发可留空；远程协作请使用管理员分配的令牌。连接前的离线项目保留在原本地存储。')}</p><button class="button primary" type="submit">${t('连接项目')}</button></form>`);
    else {
      dialog.querySelector('.dialog-body').insertAdjacentHTML('beforeend', `<p class="info-note">${t('数组采用去重并集，取消勾选不会自动删除团队已有项。')}</p><div class="inline-actions"><button class="button secondary" data-sync="refresh">${t('立即同步')}</button><button class="button secondary" data-sync="history">${t('修改历史')}</button><button class="button secondary" data-sync="disconnect">${t('断开连接')}</button>${sync.status === 'blocked' ? `<button class="button secondary" data-sync="discard">${t('导出并放弃失败提交')}</button>` : ''}</div><h3>${t('待人工裁定')}</h3>${sync.conflicts.length ? sync.conflicts.map(conflict => `<section class="sync-conflict" data-conflict="${conflict.id}"><strong>${escapeHtml(conflict.path.join(' / '))}</strong><p>${escapeHtml(conflict.actorName)} · ${escapeHtml(conflict.createdAt)}</p><label>${t('修改前快照')}<pre>${escapeHtml(valueText(conflict.base))}</pre></label><label>${t('后端当前内容')}<pre>${escapeHtml(valueText(readField(sync.baseState, conflict.path)))}</pre></label><label>${t('提交的新内容')}<pre>${escapeHtml(valueText(conflict.proposed))}</pre></label>${sync.actor.admin ? `<div class="inline-actions"><button class="button secondary" data-sync="current">${t('保留后端内容')}</button><button class="button primary" data-sync="proposed">${t('采用提交内容')}</button></div>` : `<p>${t('等待管理成员裁定。')}</p>`}</section>`).join('') : `<p>${t('没有待裁定冲突。')}</p>`}<div id="sync-history"></div>`);
    }
  };
  render(); if (!dialog.open) dialog.showModal();
  dialog.onsubmit = async event => {
    event.preventDefault(); const form = event.target, button = form.querySelector('button'); button.disabled = true;
    try { await sync.connect({ projectId: form.elements.project.value, token: form.elements.token.value }); onChange(sync); render(); } catch (error) { onError(error); button.disabled = false; }
  };
  dialog.onclick = async event => {
    const button = event.target.closest('[data-sync]'); if (!button) return;
    const action = button.dataset.sync; if (action === 'close') { dialog.close(); return; }
    button.disabled = true;
    try {
      if (action === 'refresh') { await sync.flush(); await sync.poll(); }
      if (action === 'disconnect') { sync.disconnect(); onChange(sync); }
      if (action === 'discard') { download(JSON.stringify(sync.store.state, null, 2), '未确认的协作草稿.json'); sync.discardFailed(); }
      if (['current', 'proposed'].includes(action)) {
        const conflict = sync.conflicts.find(item => item.id === button.closest('[data-conflict]').dataset.conflict);
        await sync.resolve(conflict, action, readField(sync.baseState, conflict.path));
      }
      if (action === 'history') {
        const entries = await sync.request('/history');
        dialog.querySelector('#sync-history').innerHTML = `<h3>${t('最近 30 次提交')}</h3>${entries.map(entry => `<section class="sync-conflict"><strong>v${entry.revision} · ${escapeHtml(entry.actorName)}</strong><p>${escapeHtml(entry.createdAt)} · ${escapeHtml(entry.kind)}</p><pre>${escapeHtml(JSON.stringify(entry.details, null, 2))}</pre><button class="button secondary" data-sync="export-version" data-revision="${entry.revision}">${t('导出此版本')}</button>${sync.actor.admin ? `<button class="button secondary" data-sync="restore-version" data-revision="${entry.revision}">${t('恢复此版本')}</button>` : ''}</section>`).join('')}`; return;
      }
      if (['export-version', 'restore-version'].includes(action)) {
        const version = await sync.request(`/revisions/${button.dataset.revision}`);
        if (action === 'export-version') download(JSON.stringify(version.state, null, 2), `project-v${version.revision}.json`);
        else if (window.confirm(t('将此历史内容恢复为一个新版本？当前内容会先导出备份。'))) { download(JSON.stringify(sync.store.state, null, 2), '恢复前项目备份.json'); await sync.replace(version.state, version.revision); }
      }
      render();
    } catch (error) { onError(error); try { await sync.poll(); } catch {} render(); }
    finally { button.disabled = false; }
  };
}
