import test from 'node:test';
import assert from 'node:assert/strict';
import { approve, approvals, assets, auditEvents, createApproval, deliveries, DomainError, lockAsset, projectSummary, replaceAsset, resetDomain, rightsConflicts, rollbackAsset } from './domain.js';

test.beforeEach(() => resetDomain());

const approveAsset = (assetId: string, projectId: string) => {
  const request = createApproval({ projectId, entityType: 'asset', entityId: assetId, title: '母版锁定审批', requestedBy: '后期制片', approver: '总制片人' });
  approve(request.id, 'approved', '复核通过');
  return request;
};
const assertDomainError = (fn: () => unknown, code: string) => assert.throws(fn, (error: unknown) => error instanceof DomainError && error.code === code);

test('budget summary exposes forecast variance and high risk lines', () => {
  const summary = projectSummary('PRJ-001');
  assert.equal(summary.lines.length, 4);
  assert.ok(summary.forecast > summary.planned);
  assert.equal(summary.highRiskLines.length, 1);
});

test('rights conflict engine detects overlapping licensed assets', () => {
  const conflicts = rightsConflicts('PRJ-001');
  assert.ok(conflicts.length >= 1);
  assert.ok(conflicts.some(item => item.reason.includes('音乐-同步许可')));
});

test('approval changes are auditable and stateful', () => {
  const result = approve('APR-01', 'approved', '预算已复核');
  assert.equal(result?.status, 'approved');
  assert.equal(result?.comment, '预算已复核');
});

test('lock requires a valid checksum', () => {
  assertDomainError(() => lockAsset('AST-005'), 'INVALID_CHECKSUM');
  assert.equal(assets.find(asset => asset.id === 'AST-005')?.status, 'review');
});

test('lock requires completed asset approvals', () => {
  assertDomainError(() => lockAsset('AST-001'), 'APPROVAL_INCOMPLETE');
  approve('APR-02', 'approved', '母版已复核');
  assertDomainError(() => lockAsset('AST-004'), 'APPROVAL_INCOMPLETE');
});

test('lock is blocked by critical rights conflicts', () => {
  approve('APR-02', 'approved', '母版已复核');
  assertDomainError(() => lockAsset('AST-001'), 'CRITICAL_CONFLICT');
});

test('lock succeeds with checksum, approvals and clean risk, and writes audit', () => {
  approveAsset('AST-004', 'PRJ-002');
  const locked = lockAsset('AST-004', { actor: '后期制片' });
  assert.equal(locked.status, 'locked');
  assert.ok(locked.lockedAt);
  assert.ok(auditEvents.some(event => event.action === 'LOCK' && event.entityId === 'AST-004'));
  assert.equal(projectSummary('PRJ-002').lockedAssets, 1);
});

test('duplicate and concurrent locks are rejected', () => {
  approveAsset('AST-004', 'PRJ-002');
  lockAsset('AST-004');
  assertDomainError(() => lockAsset('AST-004'), 'ALREADY_LOCKED');
  resetDomain();
  approveAsset('AST-004', 'PRJ-002');
  assertDomainError(() => lockAsset('AST-004', { expectedVersion: 99 }), 'VERSION_CONFLICT');
});

test('lock is rejected when risk changed after the request was made', () => {
  approveAsset('AST-004', 'PRJ-002');
  const snapshot = rightsConflicts('PRJ-002').length;
  assertDomainError(() => lockAsset('AST-004', { expectedConflictCount: snapshot + 1 }), 'RISK_CHANGED');
  assert.equal(assets.find(asset => asset.id === 'AST-004')?.status, 'review');
});

test('replace keeps supersedes chain, preserves history and expires deliveries', () => {
  approveAsset('AST-004', 'PRJ-002');
  lockAsset('AST-004');
  const next = replaceAsset('AST-004', { checksum: 'sha256:ff00…11aa', actor: '视觉总监' });
  assert.equal(next.version, 4);
  assert.equal(next.status, 'review');
  assert.equal(next.replaces, 'AST-004');
  const previous = assets.find(asset => asset.id === 'AST-004');
  assert.equal(previous?.status, 'superseded');
  assert.equal(previous?.supersededBy, next.id);
  assert.ok(assets.some(asset => asset.id === 'AST-004'), '历史版本必须保留，不能删除');
  assert.equal(deliveries.find(delivery => delivery.id === 'DEL-007')?.status, 'outdated');
  assert.equal(projectSummary('PRJ-002').outdatedDeliveries, 1);
  assertDomainError(() => lockAsset('AST-004'), 'INVALID_STATE');
});

test('replace requires a real, well-formed new checksum', () => {
  approveAsset('AST-004', 'PRJ-002');
  lockAsset('AST-004');
  assertDomainError(() => replaceAsset('AST-004', { checksum: '' }), 'INVALID_CHECKSUM');
  assertDomainError(() => replaceAsset('AST-004', { checksum: 'sha256:8a10…4a9d' }), 'INVALID_CHECKSUM');
  assertDomainError(() => replaceAsset('AST-001', { checksum: 'sha256:ff00…11aa' }), 'INVALID_STATE');
});

test('rollback fails without reason, on non-locked assets, and while deliveries reference the version', () => {
  assertDomainError(() => rollbackAsset('AST-004', { reason: '授权到期' }), 'INVALID_STATE');
  approveAsset('AST-004', 'PRJ-002');
  lockAsset('AST-004');
  assertDomainError(() => rollbackAsset('AST-004'), 'REASON_REQUIRED');
  assertDomainError(() => rollbackAsset('AST-004', { reason: '音乐授权到期' }), 'DELIVERY_REFERENCE');
  assert.equal(assets.find(asset => asset.id === 'AST-004')?.status, 'locked');
});

test('rollback reverts lock with audit and never deletes history', () => {
  approveAsset('AST-004', 'PRJ-002');
  lockAsset('AST-004');
  const next = replaceAsset('AST-004', { checksum: 'sha256:ff00…11aa' });
  approveAsset(next.id, 'PRJ-002');
  lockAsset(next.id);
  const reverted = rollbackAsset(next.id, { reason: '航拍素材海外授权被撤回', actor: '法务负责人' });
  assert.equal(reverted.status, 'review');
  assert.equal(reverted.lockedAt, undefined);
  assert.ok(auditEvents.some(event => event.action === 'ROLLBACK' && event.entityId === next.id && event.details.includes('航拍素材海外授权被撤回')));
  assert.ok(assets.some(asset => asset.id === 'AST-004' && asset.status === 'superseded'), '换版历史必须保留');
  assert.ok(assets.some(asset => asset.id === next.id), '回退只改状态，不删除资产');
});

test('summary, conflicts, approvals and asset views stay in sync and survive reload', () => {
  const before = projectSummary('PRJ-001');
  approve('APR-02', 'approved', '母版已复核');
  const after = projectSummary('PRJ-001');
  assert.equal(after.pendingApprovals, before.pendingApprovals - 1);
  assert.equal(after.approvals.find(item => item.id === 'APR-02')?.status, 'approved');
  approveAsset('AST-004', 'PRJ-002');
  lockAsset('AST-004');
  replaceAsset('AST-004', { checksum: 'sha256:ff00…11aa' });
  const synced = projectSummary('PRJ-002');
  assert.equal(synced.assets.find(asset => asset.id === 'AST-004')?.status, 'superseded');
  assert.equal(synced.assetCount, 3);
  assert.ok(!rightsConflicts('PRJ-002').some(item => item.assetAId === 'AST-004' || item.assetBId === 'AST-004'), '被替代版本不再参与冲突检测');
  resetDomain();
  const reloaded = projectSummary('PRJ-002');
  assert.equal(reloaded.assets.find(asset => asset.id === 'AST-004')?.status, 'review');
  assert.equal(reloaded.assetCount, 2);
  assert.equal(reloaded.outdatedDeliveries, 0);
  assert.equal(deliveries.find(delivery => delivery.id === 'DEL-007')?.status, 'delivered');
  assert.ok(approvals.every(item => !item.title.includes('母版锁定审批')), '重载后临时审批不应残留');
});
