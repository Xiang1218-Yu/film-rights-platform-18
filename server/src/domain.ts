export type ProjectStatus = 'development' | 'production' | 'post' | 'delivered';
export type AssetType = 'master' | 'trailer' | 'poster' | 'audio' | 'subtitle';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type AssetStatus = 'draft' | 'review' | 'approved' | 'locked' | 'superseded';
export type DeliveryStatus = 'preparing' | 'delivered' | 'outdated';

export class DomainError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'DomainError'; }
}

export interface Project { id: string; code: string; title: string; season: number; status: ProjectStatus; currency: string; budgetVersionId: string; deliveryDate: string; }
export interface BudgetLine { id: string; projectId: string; category: string; subcategory: string; planned: number; committed: number; actual: number; forecast: number; owner: string; risk: 'low' | 'medium' | 'high'; }
export interface Contract { id: string; projectId: string; vendor: string; scope: string; ceiling: number; committed: number; paid: number; milestones: { name: string; due: string; amount: number; status: 'open' | 'invoiced' | 'paid' }[]; }
export interface Asset { id: string; projectId: string; name: string; type: AssetType; version: number; status: AssetStatus; owner: string; checksum: string; territories: string[]; platforms: string[]; availableFrom: string; availableTo: string; rightsTags: string[]; lockedAt?: string; lockedBy?: string; replaces?: string; supersededBy?: string; }
export interface Delivery { id: string; projectId: string; assetId: string; assetVersion: number; title: string; status: DeliveryStatus; createdAt: string; }
export interface Approval { id: string; projectId: string; entityType: 'budget' | 'asset' | 'delivery'; entityId: string; title: string; requestedBy: string; status: ApprovalStatus; approver: string; createdAt: string; comment?: string; }
export interface AuditEvent { id: string; action: string; entity: string; entityId: string; actor: string; at: string; details: string; }

const now = Date.now();
const iso = (days: number) => new Date(now + days * 86400000).toISOString().slice(0, 10);

export const projects: Project[] = [
  { id: 'PRJ-001', code: 'NORTHSTAR-S1', title: 'Northstar / 北境回声', season: 1, status: 'post', currency: 'CNY', budgetVersionId: 'BUD-001-V3', deliveryDate: iso(44) },
  { id: 'PRJ-002', code: 'ORBIT-DOC', title: 'Orbit / 轨道之外', season: 1, status: 'production', currency: 'CNY', budgetVersionId: 'BUD-002-V2', deliveryDate: iso(126) }
];
export const budgetLines: BudgetLine[] = [
  { id: 'BL-101', projectId: 'PRJ-001', category: '制作', subcategory: '主演与主创', planned: 12800000, committed: 11200000, actual: 10400000, forecast: 13100000, owner: '制片部', risk: 'medium' },
  { id: 'BL-102', projectId: 'PRJ-001', category: '制作', subcategory: '摄影器材与场地', planned: 6800000, committed: 6400000, actual: 5980000, forecast: 7020000, owner: '现场制片', risk: 'low' },
  { id: 'BL-103', projectId: 'PRJ-001', category: '后期', subcategory: '调色、DIT、母版', planned: 5400000, committed: 4300000, actual: 2800000, forecast: 5750000, owner: '后期制片', risk: 'high' },
  { id: 'BL-104', projectId: 'PRJ-001', category: '宣发', subcategory: '预告片与物料', planned: 3600000, committed: 1900000, actual: 1240000, forecast: 3200000, owner: '营销部', risk: 'medium' },
  { id: 'BL-201', projectId: 'PRJ-002', category: '制作', subcategory: '跨国拍摄', planned: 9200000, committed: 5100000, actual: 3300000, forecast: 9000000, owner: '制片部', risk: 'medium' }
];
export const contracts: Contract[] = [
  { id: 'CTR-01', projectId: 'PRJ-001', vendor: '曜石后期制作', scope: '4K HDR 调色、声音、DCP 母版', ceiling: 5200000, committed: 4300000, paid: 2300000, milestones: [{ name: '锁剪交付', due: iso(8), amount: 1200000, status: 'invoiced' }, { name: '母版验收', due: iso(36), amount: 2000000, status: 'open' }] },
  { id: 'CTR-02', projectId: 'PRJ-001', vendor: '远景国际版权', scope: '北美与欧洲音乐同步许可', ceiling: 880000, committed: 880000, paid: 440000, milestones: [{ name: '签署', due: iso(-16), amount: 440000, status: 'paid' }, { name: '交付版权证明', due: iso(4), amount: 440000, status: 'invoiced' }] },
  { id: 'CTR-03', projectId: 'PRJ-002', vendor: '云帧视觉', scope: '纪录片航拍与卫星素材', ceiling: 1600000, committed: 1100000, paid: 600000, milestones: [{ name: '素材包一', due: iso(20), amount: 500000, status: 'open' }] }
];
export const assets: Asset[] = [
  { id: 'AST-001', projectId: 'PRJ-001', name: '北境回声 S01E01 4K HDR Master', type: 'master', version: 7, status: 'review', owner: '后期制片', checksum: 'sha256:91b7…e2a1', territories: ['CN', 'HK', 'SG'], platforms: ['影院', 'StreamBox'], availableFrom: iso(-2), availableTo: iso(730), rightsTags: ['音乐-同步许可', '演员-全媒介'] },
  { id: 'AST-002', projectId: 'PRJ-001', name: '主预告 90s / Cut A', type: 'trailer', version: 4, status: 'approved', owner: '营销部', checksum: 'sha256:42ca…9b02', territories: ['CN'], platforms: ['StreamBox', '短视频'], availableFrom: iso(6), availableTo: iso(180), rightsTags: ['演员-宣传许可'] },
  { id: 'AST-003', projectId: 'PRJ-001', name: '片尾曲 / Winter Signal', type: 'audio', version: 2, status: 'locked', owner: '音乐版权', checksum: 'sha256:113c…78f0', territories: ['CN', 'US', 'CA'], platforms: ['影院', 'StreamBox'], availableFrom: iso(-40), availableTo: iso(52), rightsTags: ['音乐-同步许可'] },
  { id: 'AST-004', projectId: 'PRJ-002', name: 'Orbit E02 Satellite Plates', type: 'master', version: 3, status: 'review', owner: '视觉总监', checksum: 'sha256:8a10…4a9d', territories: ['全球'], platforms: ['影院'], availableFrom: iso(18), availableTo: iso(365), rightsTags: ['航拍-编辑许可'] },
  { id: 'AST-005', projectId: 'PRJ-002', name: 'Orbit E03 粗剪母版', type: 'master', version: 1, status: 'review', owner: '视觉总监', checksum: '', territories: ['CN'], platforms: ['影院'], availableFrom: iso(30), availableTo: iso(400), rightsTags: ['音乐-待清理'] }
];
export const deliveries: Delivery[] = [
  { id: 'DEL-006', projectId: 'PRJ-001', assetId: 'AST-001', assetVersion: 6, title: '平台预审交付包', status: 'delivered', createdAt: iso(-9) },
  { id: 'DEL-007', projectId: 'PRJ-002', assetId: 'AST-004', assetVersion: 3, title: '海外节展交付包', status: 'delivered', createdAt: iso(-5) }
];
export const approvals: Approval[] = [
  { id: 'APR-01', projectId: 'PRJ-001', entityType: 'budget', entityId: 'BUD-001-V3', title: '后期超支预案 V3', requestedBy: '制片主任', status: 'pending', approver: '财务负责人', createdAt: iso(-1) },
  { id: 'APR-02', projectId: 'PRJ-001', entityType: 'asset', entityId: 'AST-001', title: 'E01 最终母版锁定', requestedBy: '后期制片', status: 'pending', approver: '总制片人', createdAt: iso(-2) },
  { id: 'APR-03', projectId: 'PRJ-002', entityType: 'delivery', entityId: 'DEL-007', title: '海外节展交付包', requestedBy: '发行部', status: 'approved', approver: '法务负责人', createdAt: iso(-5), comment: '已补充航拍授权凭证' }
];
export const auditEvents: AuditEvent[] = [{ id: 'AUD-01', action: 'CREATE', entity: 'budget', entityId: 'BUD-001-V3', actor: '制片主任', at: new Date(now - 86400000).toISOString(), details: '从 V2 复制并调整后期科目' }];

export function projectSummary(projectId = projects[0].id) {
  const lines = budgetLines.filter(line => line.projectId === projectId);
  const projectContracts = contracts.filter(contract => contract.projectId === projectId);
  const projectAssets = assets.filter(asset => asset.projectId === projectId);
  const projectApprovals = approvals.filter(approval => approval.projectId === projectId);
  const projectDeliveries = deliveries.filter(delivery => delivery.projectId === projectId);
  const planned = lines.reduce((sum, line) => sum + line.planned, 0);
  const forecast = lines.reduce((sum, line) => sum + line.forecast, 0);
  const actual = lines.reduce((sum, line) => sum + line.actual, 0);
  return { project: projects.find(project => project.id === projectId), planned, forecast, actual, variance: forecast - planned, utilization: planned ? actual / planned : 0, committed: lines.reduce((sum, line) => sum + line.committed, 0), contractExposure: projectContracts.reduce((sum, contract) => sum + contract.ceiling, 0), assetCount: projectAssets.length, lockedAssets: projectAssets.filter(asset => asset.status === 'locked').length, pendingApprovals: projectApprovals.filter(item => item.status === 'pending').length, outdatedDeliveries: projectDeliveries.filter(delivery => delivery.status === 'outdated').length, highRiskLines: lines.filter(line => line.risk === 'high'), lines, contracts: projectContracts, assets: projectAssets, approvals: projectApprovals, deliveries: projectDeliveries };
}

export function rightsConflicts(projectId = projects[0].id) {
  const list = assets.filter(asset => asset.projectId === projectId && asset.status !== 'superseded');
  const conflicts: { severity: 'critical' | 'warning'; assetA: string; assetB: string; assetAId: string; assetBId: string; reason: string }[] = [];
  for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) {
    const a = list[i], b = list[j];
    const sameTag = a.rightsTags.some(tag => b.rightsTags.includes(tag));
    const sameTerritory = a.territories.includes('全球') || b.territories.includes('全球') || a.territories.some(territory => b.territories.includes(territory));
    if (sameTag && sameTerritory && a.availableTo >= b.availableFrom && b.availableTo >= a.availableFrom) conflicts.push({ severity: a.status === 'locked' || b.status === 'locked' ? 'critical' : 'warning', assetA: a.name, assetB: b.name, assetAId: a.id, assetBId: b.id, reason: `同一授权标签在重叠窗口内覆盖相同地域：${a.rightsTags.filter(tag => b.rightsTags.includes(tag)).join('、')}` });
  }
  return conflicts;
}

export function approve(id: string, status: ApprovalStatus, comment = '') {
  const item = approvals.find(approval => approval.id === id); if (!item) return undefined;
  item.status = status; item.comment = comment; auditEvents.unshift({ id: `AUD-${Date.now()}`, action: status.toUpperCase(), entity: item.entityType, entityId: item.entityId, actor: '当前审批人', at: new Date().toISOString(), details: comment || `${item.title} 已${status === 'approved' ? '通过' : '驳回'}` }); return item;
}
export function createApproval(input: Pick<Approval, 'projectId' | 'entityType' | 'entityId' | 'title' | 'requestedBy' | 'approver'>) { const item: Approval = { ...input, id: `APR-${Date.now()}`, status: 'pending', createdAt: new Date().toISOString() }; approvals.unshift(item); return item; }

const CHECKSUM_PATTERN = /^sha256:[0-9a-fA-F…]{6,}$/;
export const isValidChecksum = (checksum: string) => CHECKSUM_PATTERN.test((checksum || '').trim());

function audit(action: string, entityId: string, actor: string, details: string) {
  auditEvents.unshift({ id: `AUD-${Date.now()}-${auditEvents.length}`, action, entity: 'asset', entityId, actor, at: new Date().toISOString(), details });
}

export interface LockOptions { actor?: string; expectedVersion?: number; expectedConflictCount?: number; }
export function lockAsset(assetId: string, options: LockOptions = {}) {
  const asset = assets.find(item => item.id === assetId);
  if (!asset) throw new DomainError('ASSET_NOT_FOUND', '资产不存在');
  if (asset.status === 'locked') throw new DomainError('ALREADY_LOCKED', `${asset.name} 已锁定，禁止重复锁定`);
  if (asset.status === 'superseded') throw new DomainError('INVALID_STATE', `${asset.name} v${asset.version} 已被 v${asset.version + 1} 替代，历史版本不能重新锁定`);
  if (asset.status !== 'review' && asset.status !== 'approved') throw new DomainError('INVALID_STATE', `仅评审中或已通过的版本可以锁定，当前状态为 ${asset.status}`);
  if (options.expectedVersion !== undefined && options.expectedVersion !== asset.version) throw new DomainError('VERSION_CONFLICT', `请求基于 v${options.expectedVersion} 发起，但资产已变为 v${asset.version}，存在并发修改，请刷新后重试`);
  if (!isValidChecksum(asset.checksum)) throw new DomainError('INVALID_CHECKSUM', 'checksum 缺失或格式非法（要求 sha256:…），不能锁定来源不可校验的母版');
  const assetApprovals = approvals.filter(item => item.entityType === 'asset' && item.entityId === assetId);
  if (!assetApprovals.length) throw new DomainError('APPROVAL_INCOMPLETE', '缺少针对该资产的锁定审批，请先发起审批');
  if (assetApprovals.some(item => item.status !== 'approved')) throw new DomainError('APPROVAL_INCOMPLETE', '资产锁定审批尚未全部通过');
  const conflicts = rightsConflicts(asset.projectId);
  if (options.expectedConflictCount !== undefined && options.expectedConflictCount !== conflicts.length) throw new DomainError('RISK_CHANGED', `请求发起后版权风险已由 ${options.expectedConflictCount} 条变为 ${conflicts.length} 条，请重新评估后再锁定`);
  if (conflicts.some(item => item.severity === 'critical' && (item.assetAId === assetId || item.assetBId === assetId))) throw new DomainError('CRITICAL_CONFLICT', '该资产涉及 critical 级版权冲突，必须先处理授权风险');
  const actor = options.actor || '当前操作人';
  asset.status = 'locked'; asset.lockedAt = new Date().toISOString(); asset.lockedBy = actor;
  audit('LOCK', asset.id, actor, `${asset.name} v${asset.version} 校验 checksum、审批与版权风险后锁定`);
  return asset;
}

export interface ReplaceInput { checksum: string; name?: string; owner?: string; actor?: string; }
export function replaceAsset(assetId: string, input: ReplaceInput) {
  const asset = assets.find(item => item.id === assetId);
  if (!asset) throw new DomainError('ASSET_NOT_FOUND', '资产不存在');
  if (asset.status !== 'locked') throw new DomainError('INVALID_STATE', '只有已锁定的母版才能发起换版');
  if (!isValidChecksum(input.checksum)) throw new DomainError('INVALID_CHECKSUM', '新版本 checksum 缺失或格式非法（要求 sha256:…）');
  if (input.checksum === asset.checksum) throw new DomainError('INVALID_CHECKSUM', '新版本 checksum 与当前版本相同，换版必须对应真实文件变更');
  const next: Asset = { ...asset, id: `AST-${Date.now()}`, name: input.name || asset.name, owner: input.owner || asset.owner, version: asset.version + 1, status: 'review', checksum: input.checksum, replaces: asset.id, supersededBy: undefined, lockedAt: undefined, lockedBy: undefined };
  asset.status = 'superseded'; asset.supersededBy = next.id;
  assets.push(next);
  deliveries.filter(delivery => delivery.assetId === asset.id && delivery.assetVersion === asset.version && delivery.status !== 'outdated').forEach(delivery => { delivery.status = 'outdated'; });
  audit('REPLACE', asset.id, input.actor || '当前操作人', `${asset.name} v${asset.version} 由 ${next.id} v${next.version} 替代，历史版本保留，相关交付已标记过期`);
  return next;
}

export interface RollbackInput { reason?: string; actor?: string; }
export function rollbackAsset(assetId: string, input: RollbackInput = {}) {
  const asset = assets.find(item => item.id === assetId);
  if (!asset) throw new DomainError('ASSET_NOT_FOUND', '资产不存在');
  if (!input.reason || !input.reason.trim()) throw new DomainError('REASON_REQUIRED', '回退必须记录授权失效原因');
  if (asset.status !== 'locked') throw new DomainError('INVALID_STATE', `仅锁定状态的资产可以回退，当前状态为 ${asset.status}`);
  const deliveredRefs = deliveries.filter(delivery => delivery.assetId === asset.id && delivery.assetVersion === asset.version && delivery.status === 'delivered');
  if (deliveredRefs.length) throw new DomainError('DELIVERY_REFERENCE', `交付 ${deliveredRefs.map(delivery => delivery.id).join('、')} 仍引用该版本，需先处理交付记录，不能直接回退`);
  asset.status = 'review'; asset.lockedAt = undefined; asset.lockedBy = undefined;
  audit('ROLLBACK', asset.id, input.actor || '当前操作人', `授权失效回退：${input.reason}。${asset.name} v${asset.version} 退回评审，历史记录保留`);
  return asset;
}

const seedSnapshot = { projects: structuredClone(projects), budgetLines: structuredClone(budgetLines), contracts: structuredClone(contracts), assets: structuredClone(assets), deliveries: structuredClone(deliveries), approvals: structuredClone(approvals), auditEvents: structuredClone(auditEvents) };
export function resetDomain() {
  projects.splice(0, projects.length, ...structuredClone(seedSnapshot.projects));
  budgetLines.splice(0, budgetLines.length, ...structuredClone(seedSnapshot.budgetLines));
  contracts.splice(0, contracts.length, ...structuredClone(seedSnapshot.contracts));
  assets.splice(0, assets.length, ...structuredClone(seedSnapshot.assets));
  deliveries.splice(0, deliveries.length, ...structuredClone(seedSnapshot.deliveries));
  approvals.splice(0, approvals.length, ...structuredClone(seedSnapshot.approvals));
  auditEvents.splice(0, auditEvents.length, ...structuredClone(seedSnapshot.auditEvents));
}
export function dashboard() { return projects.map(project => projectSummary(project.id)).map(summary => ({ id: summary.project?.id, title: summary.project?.title, status: summary.project?.status, forecast: summary.forecast, variance: summary.variance, pendingApprovals: summary.pendingApprovals, rightsConflicts: rightsConflicts(summary.project?.id).length })); }
