import test from 'node:test'; import assert from 'node:assert/strict'; import crypto from 'node:crypto';
import { approve, approvals, assets, auditEvents, blockingIssues, checksumRegistry, consistencyReport, createApproval, createDelivery, createRevision, deliveries, markDeliveryDelivered, projectSummary, registerAsset, requestLock, rightsConflicts, rollback, swapVersion, DomainError, commitLock } from './domain.js';

const checksumFor = (id: string) => `sha256:${crypto.createHash('sha256').update(id).digest('hex')}`;
const find = (id: string) => { const asset = assets.find(item => item.id === id); assert.ok(asset, `资产 ${id} 应存在`); return asset!; };
const reload = (projectId: string) => {
  // 模拟客户端整页重载：摘要表、冲突表、审批表、资产表、交付表、票据表必须互相同步
  const summary = projectSummary(projectId);
  const report = consistencyReport(projectId);
  assert.equal(report.ok, true, `重载一致性检查应通过：${report.issues.join('；')}`);
  return summary;
};
const approveAsset = (assetId: string, projectId: string, title: string) => {
  const existing = approvals.find(item => item.entityType === 'asset' && item.entityId === assetId && item.status === 'approved');
  if (existing) return existing;
  const approval = createApproval({ projectId, entityType: 'asset', entityId: assetId, title, requestedBy: '后期制片', approver: '总制片人' });
  approve(approval.id, 'approved', '母版锁定授权通过');
  return approval;
};
const expectError = (code: string) => (error: unknown): boolean => { assert.ok(error instanceof DomainError, `应抛出 DomainError，实际 ${String(error)}`); assert.equal((error as DomainError).code, code); return true; };
const rejects = async (fn: () => unknown, code: string) => await assert.rejects(async () => { await fn(); }, expectError(code));
const auditLast = (action: string, entityId?: string) => auditEvents.find(event => event.action === action && (entityId === undefined || event.entityId === entityId));

test('budget summary exposes forecast variance and high risk lines', () => { const summary = projectSummary('PRJ-001'); assert.equal(summary.lines.length, 4); assert.ok(summary.forecast > summary.planned); assert.equal(summary.highRiskLines.length, 1); });
test('rights conflict engine detects overlapping licensed assets across different lineages', () => {
  const conflicts = rightsConflicts('PRJ-001');
  assert.ok(conflicts.some(item => item.reason.includes('音乐-同步许可')));
  assert.ok(conflicts.every(item => item.assetAId !== item.assetBId));
  // 同族替代版本（AST-001 与 AST-005）不得被当作双授权冲突
  assert.ok(!conflicts.some(item => (item.assetAId === 'AST-001' && item.assetBId === 'AST-005') || (item.assetAId === 'AST-005' && item.assetBId === 'AST-001')));
});
test('approval changes are auditable and stateful', () => { const result = approve('APR-01', 'approved', '预算已复核'); assert.equal(result?.status, 'approved'); assert.equal(result?.comment, '预算已复核'); });

test('门禁：checksum 有效、审批完成、授权窗口有效三者缺一不可', () => {
  const probe = registerAsset({ projectId: 'PRJ-002', name: '门禁探针母版', type: 'master', owner: '测试', checksum: checksumFor('probe'), territories: ['JP'], platforms: ['StreamBox'], availableFrom: '2020-01-01', availableTo: '2099-12-31', rightsTags: ['探针-独占'], requestedBy: '测试' });
  let codes = blockingIssues(probe).map(issue => issue.code);
  assert.deepEqual(codes, ['APPROVAL_REQUIRED']);
  approveAsset(probe.id, 'PRJ-002', '探针审批');
  assert.deepEqual(blockingIssues(probe), []);
  const registered = checksumRegistry[probe.id];
  probe.checksum = 'sha256:deadbeef';
  assert.ok(blockingIssues(probe).some(issue => issue.code === 'CHECKSUM_INVALID'));
  probe.checksum = registered;
  probe.availableTo = '2000-01-01';
  assert.ok(blockingIssues(probe).some(issue => issue.code === 'AUTHORIZATION_EXPIRED'));
  probe.availableTo = '2099-12-31';
});

test('统一锁定 / 换版 / 回退领域流程', async (t) => {
  // ---- T1 锁定不是状态翻转：门禁全过才允许锁定，且摘要/冲突/审批/资产表同步 ----
  await t.test('锁定：未过门禁拒绝且不半写，审批完成并重新申请后锁定', async () => {
    // 种子里的 AST-001 与已锁定 AST-003 存在标签+窗口+地域重叠，申请时预检即暴露 critical
    const risky = requestLock({ assetId: 'AST-001', requestedBy: '后期制片' });
    assert.ok(risky.preflight.some(issue => issue.code === 'CRITICAL_RIGHTS_CONFLICT'));
    assert.ok(risky.preflight.some(issue => issue.code === 'APPROVAL_REQUIRED'));
    await rejects(() => commitLock(risky.ticket.id), 'LOCK_PRECONDITIONS_FAILED');
    assert.equal(find('AST-001').status, 'review');
    assert.equal(risky.ticket.status, 'rejected');
    assert.ok(auditLast('LOCK_REJECTED', 'AST-001')?.details.includes('CRITICAL_RIGHTS_CONFLICT'));

    // 无冲突项目 PRJ-002 的 AST-004：仍需先完成审批
    const master = find('AST-004');
    const first = requestLock({ assetId: master.id, requestedBy: '视觉总监' });
    await rejects(() => commitLock(first.ticket.id), 'LOCK_PRECONDITIONS_FAILED');
    assert.equal(first.ticket.status, 'rejected');
    assert.equal(find(master.id).status, 'review'); // 失败不得改资产状态
    approveAsset(master.id, 'PRJ-002', 'Orbit 母版锁定');
    await rejects(() => commitLock(first.ticket.id), 'LOCK_TICKET_REJECTED'); // 旧票据不复活
    const second = requestLock({ assetId: master.id, requestedBy: '视觉总监' });
    const committed = await commitLock(second.ticket.id);
    assert.equal(committed.asset.status, 'locked');
    assert.equal(committed.asset.lockedByTicketId, second.ticket.id);
    assert.ok(committed.asset.lockedAt);
    assert.ok(auditLast('LOCK_COMMITTED', master.id));
    const summary = reload('PRJ-002');
    assert.equal(summary.assets.find(a => a.id === master.id)?.status, 'locked');
    assert.equal(summary.criticalConflicts, 0);
    assert.throws(() => requestLock({ assetId: master.id, requestedBy: '视觉总监' }), expectError('ASSET_NOT_LOCKABLE')); // 重复锁定
    await rejects(() => commitLock(second.ticket.id), 'LOCK_ALREADY_COMMITTED'); // 重复提交
  });

  // ---- T2 重复 / 并发锁定：pending 票据唯一，同资产提交串行化只放行一个 ----
  await t.test('重复申请被拒，并发提交只产生一次锁定', async () => {
    const trailer = find('AST-002');
    approveAsset(trailer.id, 'PRJ-001', '主预告锁定');
    const first = requestLock({ assetId: trailer.id, requestedBy: '营销部' });
    assert.throws(() => requestLock({ assetId: trailer.id, requestedBy: '营销部' }), expectError('DUPLICATE_LOCK_REQUEST'));
    const outcomes = await Promise.allSettled([
      commitLock(first.ticket.id, '操作员A'),
      commitLock(first.ticket.id, '操作员B')
    ]);
    assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
    const loser = outcomes.find(item => item.status === 'rejected') as PromiseRejectedResult;
    assert.equal((loser.reason as DomainError).code, 'LOCK_ALREADY_COMMITTED');
    assert.equal(find(trailer.id).status, 'locked');
    assert.equal(assets.filter(asset => asset.lineageId === trailer.lineageId && asset.status === 'locked').length, 1);
    reload('PRJ-001');
  });

  // ---- T3 请求进行中风险变化：提交时重新加载评估，风险修复后须重新申请 ----
  await t.test('请求后 checksum 篡改与授权失效均在提交时阻断，修复并重新申请后成功', async () => {
    const probe = registerAsset({ projectId: 'PRJ-002', name: '请求中风险变化探针', type: 'master', owner: '测试', checksum: checksumFor('risk-probe'), territories: ['KR'], platforms: ['影院'], availableFrom: '2020-01-01', availableTo: '2099-12-31', rightsTags: ['风险探针-独占'], requestedBy: '测试' });
    approveAsset(probe.id, 'PRJ-002', '探针锁定');
    const { ticket } = requestLock({ assetId: probe.id, requestedBy: '测试' });
    probe.checksum = checksumFor('tampered-content'); // 申请后、提交前对象存储回查发现内容被篡改
    await rejects(() => commitLock(ticket.id), 'LOCK_PRECONDITIONS_FAILED');
    assert.equal(ticket.status, 'rejected');
    assert.ok(auditLast('LOCK_REJECTED', probe.id)?.details.includes('CHECKSUM_INVALID'));
    assert.equal(find(probe.id).status, 'review');

    const { ticket: ticket2 } = requestLock({ assetId: probe.id, requestedBy: '测试' });
    probe.availableTo = '2000-01-01'; // 申请期间授权窗口失效
    await rejects(() => commitLock(ticket2.id), 'LOCK_PRECONDITIONS_FAILED');
    assert.ok(blockingIssues(probe).some(issue => issue.code === 'AUTHORIZATION_EXPIRED'));

    // 风险消除：checksum 与窗口恢复，旧票据不复活，重新申请即可
    probe.checksum = checksumRegistry[probe.id];
    probe.availableTo = '2099-12-31';
    const { ticket: ticket3 } = requestLock({ assetId: probe.id, requestedBy: '测试' });
    assert.equal((await commitLock(ticket3.id)).asset.status, 'locked');
    reload('PRJ-002');
    // 同族已有生效版本时，第二个版本不能直接锁定，必须走换版
    const secondRevision = createRevision({ assetId: probe.id, requestedBy: '测试', checksum: checksumFor('risk-probe-v2'), availableTo: '2099-12-31' });
    approveAsset(secondRevision.id, 'PRJ-002', '探针换版');
    assert.throws(() => requestLock({ assetId: secondRevision.id, requestedBy: '测试' }), expectError('LINEAGE_ALREADY_LOCKED'));
  });

  // ---- T4 换版：保留替代关系，先验证已有交付引用，预备交付改指向，已交付快照不动 ----
  await t.test('换版：候选新版经门禁后原子替代，交付引用须确认，历史不删除', () => {
    const current = find('AST-004'); assert.equal(current.status, 'locked');
    // 一个预备交付（随换版改指向）与一个已交付 DEL-007（快照不动，需确认）
    const prepared = createDelivery({ projectId: 'PRJ-002', name: '流媒体预备交付包', requestedBy: '发行部', references: [{ assetId: current.id }] });
    assert.equal(prepared.references[0].assetId, current.id);
    const revisionIdSeed = 'orbit-v4';
    const revision = createRevision({ assetId: current.id, requestedBy: '视觉总监', checksum: checksumFor(revisionIdSeed), territories: ['全球'], platforms: ['影院'], availableFrom: '2026-11-01', availableTo: '2100-12-31', rightsTags: ['航拍-编辑许可'] });
    assert.equal(revision.supersedesId, current.id);
    assert.equal(revision.lineageId, current.lineageId);
    assert.throws(() => swapVersion({ assetId: revision.id, requestedBy: '视觉总监' }), expectError('SWAP_PRECONDITIONS_FAILED')); // 审批未完成
    approveAsset(revision.id, 'PRJ-002', 'Orbit 母版换版 v4');
    assert.throws(() => swapVersion({ assetId: revision.id, requestedBy: '视觉总监' }), expectError('DELIVERY_REFERENCES_PRESENT')); // DEL-007 已交付
    const result = swapVersion({ assetId: revision.id, requestedBy: '视觉总监', acknowledgeDeliveries: true });
    assert.equal(result.current.id, revision.id);
    assert.equal(result.previous.id, current.id);
    assert.deepEqual(result.acknowledgedDeliveries, ['DEL-007']);
    assert.equal(find(current.id).status, 'superseded');
    assert.equal(find(current.id).supersededBy, revision.id);
    assert.ok(find(current.id).supersededAt);
    assert.ok(assets.some(asset => asset.id === current.id)); // 旧版本保留，绝不删除
    assert.ok(auditLast('VERSION_SWAPPED', revision.id));
    assert.equal(deliveries.find(d => d.id === prepared.id)!.references[0].assetId, revision.id); // 预备改指向
    const delivered = deliveries.find(d => d.id === 'DEL-007')!;
    assert.equal(delivered.status, 'delivered');
    assert.equal(delivered.references[0].assetId, current.id); // 已交付快照不动
    assert.equal(assets.filter(asset => asset.lineageId === current.lineageId && asset.status === 'locked').length, 1);
    reload('PRJ-002');
  });

  // ---- T5 回退失败：有审计、状态不半写；回退成功：revoked 留史、召回、预备改指向 ----
  await t.test('回退：失败留 ROLLBACK_FAILED 审计且不半写；确认后成功回退并召回交付', () => {
    const v3 = find('AST-004'); // T4 后 superseded
    const v4 = assets.find(asset => asset.lineageId === v3.lineageId && asset.status === 'locked')!;
    assert.equal(v3.status, 'superseded'); assert.equal(v4.status, 'locked');
    // 非法目标
    assert.throws(() => rollback({ assetId: v3.id, targetAssetId: v4.id, requestedBy: '法务', reason: '演练' }), expectError('ROLLBACK_INVALID'));
    assert.throws(() => rollback({ assetId: v4.id, targetAssetId: 'AST-001', requestedBy: '法务', reason: '演练' }), expectError('ROLLBACK_TARGET_INVALID'));
    // 目标授权失效：失败、有审计、任何状态不变
    const originalTo = v3.availableTo;
    v3.availableTo = '2000-01-01';
    assert.throws(() => rollback({ assetId: v4.id, targetAssetId: v3.id, requestedBy: '法务', reason: 'v4 授权失效应急回退' }), expectError('ROLLBACK_PRECONDITIONS_FAILED'));
    assert.ok(auditLast('ROLLBACK_FAILED', v4.id)?.details.includes('v4 授权失效应急回退'));
    assert.equal(find(v4.id).status, 'locked');
    assert.equal(find(v3.id).status, 'superseded');
    v3.availableTo = originalTo;
    // T4 中预备交付已改指向当前版本 v4；先将其发出，使当前生效版本存在已交付引用
    const prepared = deliveries.find(d => d.name === '流媒体预备交付包')!;
    assert.equal(prepared.references[0].assetId, v4.id);
    markDeliveryDelivered(prepared.id, '发行部');
    // 已交付引用未确认不得回退，且状态不半写
    assert.throws(() => rollback({ assetId: v4.id, targetAssetId: v3.id, requestedBy: '法务', reason: 'v4 授权失效应急回退' }), expectError('DELIVERY_REFERENCES_PRESENT'));
    assert.equal(find(v4.id).status, 'locked');
    const result = rollback({ assetId: v4.id, targetAssetId: v3.id, requestedBy: '法务', reason: 'v4 授权失效应急回退', acknowledgeDeliveries: true });
    assert.equal(result.current.id, v3.id);
    assert.ok(find(v3.id).reactivatedAt);
    assert.equal(find(v4.id).status, 'revoked');
    assert.equal(find(v4.id).revokedReason, 'v4 授权失效应急回退');
    assert.ok(assets.some(asset => asset.id === v4.id)); // 作废版本历史保留
    // 引用作废版本 v4 的交付被召回，快照仍指向 v4 可追溯；无预备交付需要改指向
    const recalled = deliveries.find(d => d.id === prepared.id)!;
    assert.equal(recalled.status, 'recalled');
    assert.ok(recalled.recalledAt);
    assert.equal(recalled.references[0].assetId, v4.id);
    assert.deepEqual(result.recalledDeliveries, [prepared.id]);
    assert.deepEqual(result.repointedDeliveries, []);
    // DEL-007 引用的是回退目标 v3：回退后 v3 重新生效，该交付快照仍然有效，不召回
    const legacy = deliveries.find(d => d.id === 'DEL-007')!;
    assert.equal(legacy.status, 'delivered');
    assert.equal(legacy.references[0].assetId, v3.id);
    assert.ok(auditLast('VERSION_ROLLED_BACK', v3.id));
    assert.ok(auditLast(`DELIVERY_RECALLED`, prepared.id));
    assert.equal(assets.filter(asset => asset.lineageId === v3.lineageId && asset.status === 'locked').length, 1);
    reload('PRJ-002');
  });

  // ---- T6 第二条谱系：换版 → 发出 → 回退，验证引用作废版本的交付召回、引用目标版本的交付继续有效 ----
  await t.test('授权失效场景：换版后新版本失效应回退旧版；引用作废版本的交付召回，目标快照继续有效', () => {
    const v2 = find('AST-003'); assert.equal(v2.status, 'locked');
    // 清理授权窗口与地域，使回退目标 v2 在 2099 年仍可用、且不与母版产生 critical 冲突（仅 US/CA，不含 CN）
    v2.availableTo = '2099-12-31'; v2.territories = ['US', 'CA'];
    const v3Seed = 'audio-v3';
    const v3 = createRevision({ assetId: v2.id, requestedBy: '音乐版权', checksum: checksumFor(v3Seed), territories: ['US', 'CA'], availableFrom: '2026-11-01', availableTo: '2100-06-30', rightsTags: ['音乐-同步许可'] });
    approveAsset(v3.id, 'PRJ-001', '片尾曲换版 v3');
    // v2 被已交付 DEL-008 引用
    assert.throws(() => swapVersion({ assetId: v3.id, requestedBy: '音乐版权' }), expectError('DELIVERY_REFERENCES_PRESENT'));
    swapVersion({ assetId: v3.id, requestedBy: '音乐版权', acknowledgeDeliveries: true });
    assert.equal(find(v2.id).status, 'superseded');
    assert.equal(find(v3.id).status, 'locked');
    // 新交付基于 v3 发出
    const fresh = createDelivery({ projectId: 'PRJ-001', name: '北美平台交付包', requestedBy: '发行部', references: [{ assetId: v3.id }] });
    markDeliveryDelivered(fresh.id, '发行部');
    assert.equal(deliveries.find(d => d.id === fresh.id)!.status, 'delivered');
    // v3 授权提前失效需应急回退 v2：旧版本恢复生效同样需要审批
    assert.throws(() => rollback({ assetId: v3.id, targetAssetId: v2.id, requestedBy: '法务', reason: 'v3 授权提前失效' }), expectError('ROLLBACK_PRECONDITIONS_FAILED'));
    approveAsset(v2.id, 'PRJ-001', '片尾曲应急恢复 v2');
    // 引用作废版本 v3 的交付未确认前一律拦下，且状态不半写
    assert.throws(() => rollback({ assetId: v3.id, targetAssetId: v2.id, requestedBy: '法务', reason: 'v3 授权提前失效' }), expectError('DELIVERY_REFERENCES_PRESENT'));
    assert.equal(find(v3.id).status, 'locked');
    const result = rollback({ assetId: v3.id, targetAssetId: v2.id, requestedBy: '法务', reason: 'v3 授权提前失效', acknowledgeDeliveries: true });
    // 只有引用作废版本 v3 的交付需要召回；DEL-008 引用的是恢复生效的 v2，快照继续有效
    assert.deepEqual(result.recalledDeliveries, [fresh.id]);
    assert.equal(find(v3.id).status, 'revoked');
    assert.equal(find(v2.id).status, 'locked');
    const recalled = deliveries.find(d => d.id === fresh.id)!;
    assert.equal(recalled.status, 'recalled');
    assert.ok(recalled.recalledAt);
    assert.ok(assets.find(a => a.id === recalled.references[0].assetId), '召回交付引用的作废版本必须仍可在资产表追溯');
    const legacy = deliveries.find(d => d.id === 'DEL-008')!;
    assert.equal(legacy.status, 'delivered');
    assert.equal(legacy.references[0].assetId, v2.id);
    // 完整生命史审计链可串联
    assert.ok(auditLast('VERSION_ROLLED_BACK', v2.id)?.details.includes('v3 授权提前失效'));
    const report = consistencyReport('PRJ-001');
    assert.equal(report.ok, true);
    const report2 = consistencyReport('PRJ-002');
    assert.equal(report2.ok, true);
  });
});
