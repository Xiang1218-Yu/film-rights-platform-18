export type ProjectStatus = 'development' | 'production' | 'post' | 'delivered';
export type AssetType = 'master' | 'trailer' | 'poster' | 'audio' | 'subtitle';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
// draft/review/approved 为可继续流转状态；locked 为当前生效母版；
// superseded = 被换版替代（保留谱系）；revoked = 回退后作废（历史不可删除）
export type AssetStatus = 'draft' | 'review' | 'approved' | 'locked' | 'superseded' | 'revoked';

export interface Project { id: string; code: string; title: string; season: number; status: ProjectStatus; currency: string; budgetVersionId: string; deliveryDate: string; }
export interface BudgetLine { id: string; projectId: string; category: string; subcategory: string; planned: number; committed: number; actual: number; forecast: number; owner: string; risk: 'low' | 'medium' | 'high'; }
export interface BudgetVersion { id: string; projectId: string; version: number; note: string; createdAt: string; }
export interface Contract { id: string; projectId: string; vendor: string; scope: string; ceiling: number; committed: number; paid: number; milestones: { name: string; due: string; amount: number; status: 'open' | 'invoiced' | 'paid' }[]; }
export interface Asset {
  id: string; projectId: string; name: string; type: AssetType; version: number; status: AssetStatus; owner: string; checksum: string;
  territories: string[]; platforms: string[]; availableFrom: string; availableTo: string; rightsTags: string[];
  /** 同一谱系（可互相换版/回退的版本族），取族内首个资产 id */
  lineageId: string;
  supersedesId?: string; supersededBy?: string; supersededAt?: string;
  lockedAt?: string; lockedByTicketId?: string; reactivatedAt?: string;
  revokedAt?: string; revokedReason?: string;
}
export interface Approval { id: string; projectId: string; entityType: 'budget' | 'asset' | 'delivery'; entityId: string; title: string; requestedBy: string; status: ApprovalStatus; approver: string; createdAt: string; comment?: string; }
export interface AuditEvent { id: string; action: string; entity: string; entityId: string; actor: string; at: string; details: string; }
export interface DeliveryRef { assetId: string; version: number; checksum: string; lineageId: string; }
export interface Delivery { id: string; projectId: string; name: string; status: 'prepared' | 'delivered' | 'recalled'; references: DeliveryRef[]; createdAt: string; deliveredAt?: string; recalledAt?: string; recallReason?: string; }
export interface LockTicket { id: string; projectId: string; assetId: string; requestedBy: string; status: 'pending' | 'committed' | 'rejected'; reason?: string; createdAt: string; committedAt?: string; }
export interface BlockingIssue { code: string; message: string; }

/** 领域错误：携带稳定 code 与 HTTP 映射，调用方据此分支处理，不靠字符串匹配 */
export class DomainError extends Error {
  code: string; httpStatus: number; details?: unknown;
  constructor(code: string, message: string, httpStatus = 422, details?: unknown) { super(message); this.name = 'DomainError'; this.code = code; this.httpStatus = httpStatus; this.details = details; }
}

const now = Date.now();
const iso = (days: number) => new Date(now + days * 86400000).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

export const projects: Project[] = [
  { id: 'PRJ-001', code: 'NORTHSTAR-S1', title: 'Northstar / 北境回声', season: 1, status: 'post', currency: 'CNY', budgetVersionId: 'BUD-001-V3', deliveryDate: iso(44) },
  { id: 'PRJ-002', code: 'ORBIT-DOC', title: 'Orbit / 轨道之外', season: 1, status: 'production', currency: 'CNY', budgetVersionId: 'BUD-002-V2', deliveryDate: iso(126) }
];
export const budgetVersions: BudgetVersion[] = [
  { id: 'BUD-001-V3', projectId: 'PRJ-001', version: 3, note: '后期超支预案 V3', createdAt: iso(-2) },
  { id: 'BUD-002-V2', projectId: 'PRJ-002', version: 2, note: '跨国拍摄基线 V2', createdAt: iso(-9) }
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
  { id: 'AST-001', projectId: 'PRJ-001', name: '北境回声 S01E01 4K HDR Master', type: 'master', version: 7, status: 'review', owner: '后期制片', checksum: 'sha256:4b4185cdb6f565d641c67733346057257241566a7551400286b5c9683694b856', territories: ['CN', 'HK', 'SG'], platforms: ['影院', 'StreamBox'], availableFrom: iso(-2), availableTo: iso(730), rightsTags: ['音乐-同步许可', '演员-全媒介'], lineageId: 'AST-005', supersedesId: 'AST-005' },
  { id: 'AST-002', projectId: 'PRJ-001', name: '主预告 90s / Cut A', type: 'trailer', version: 4, status: 'approved', owner: '营销部', checksum: 'sha256:eda2d6b01890e6b3cb9fe24adc12930367d7fdc27c4c537e73510a6fc7d28301', territories: ['CN'], platforms: ['StreamBox', '短视频'], availableFrom: iso(6), availableTo: iso(180), rightsTags: ['演员-宣传许可'], lineageId: 'AST-002' },
  { id: 'AST-003', projectId: 'PRJ-001', name: '片尾曲 / Winter Signal', type: 'audio', version: 2, status: 'locked', owner: '音乐版权', checksum: 'sha256:9aebcff93f03e14ccd27b5d2010af1202b675d550b96c2fa135ddf0242681beb', territories: ['CN', 'US', 'CA'], platforms: ['影院', 'StreamBox'], availableFrom: iso(-40), availableTo: iso(52), rightsTags: ['音乐-同步许可'], lineageId: 'AST-003', lockedAt: iso(-40) },
  { id: 'AST-004', projectId: 'PRJ-002', name: 'Orbit E02 Satellite Plates', type: 'master', version: 3, status: 'review', owner: '视觉总监', checksum: 'sha256:a3321edcf55655c14efb4c96d38b08a57ba832d08bdb68457541118568d16f0e', territories: ['全球'], platforms: ['影院'], availableFrom: iso(18), availableTo: iso(365), rightsTags: ['航拍-编辑许可'], lineageId: 'AST-004' },
  // 已被 AST-001 替代的历史版本：换版/回退谱系演示，冲突检测中按族排除
  { id: 'AST-005', projectId: 'PRJ-001', name: '北境回声 S01E01 4K HDR Master', type: 'master', version: 6, status: 'superseded', owner: '后期制片', checksum: 'sha256:9c7bbba7d451854e79adfcede8c50958aa0b84cdd2cc383748d284838310c1fa', territories: ['CN', 'HK', 'SG'], platforms: ['影院', 'StreamBox'], availableFrom: iso(-30), availableTo: iso(700), rightsTags: ['音乐-同步许可', '演员-全媒介'], lineageId: 'AST-005', supersededBy: 'AST-001', supersededAt: iso(-2) }
];
/** checksum 登记台账：资产上记录的值必须与登记一致才视为有效（模拟对象存储校验回查） */
export const checksumRegistry: Record<string, string> = Object.fromEntries(assets.map(asset => [asset.id, asset.checksum]));
export const approvals: Approval[] = [
  { id: 'APR-01', projectId: 'PRJ-001', entityType: 'budget', entityId: 'BUD-001-V3', title: '后期超支预案 V3', requestedBy: '制片主任', status: 'pending', approver: '财务负责人', createdAt: iso(-1) },
  { id: 'APR-02', projectId: 'PRJ-001', entityType: 'asset', entityId: 'AST-001', title: 'E01 最终母版锁定', requestedBy: '后期制片', status: 'pending', approver: '总制片人', createdAt: iso(-2) },
  { id: 'APR-03', projectId: 'PRJ-002', entityType: 'delivery', entityId: 'DEL-007', title: '海外节展交付包', requestedBy: '发行部', status: 'approved', approver: '法务负责人', createdAt: iso(-5), comment: '已补充航拍授权凭证' }
];
export const deliveries: Delivery[] = [
  { id: 'DEL-007', projectId: 'PRJ-002', name: '海外节展交付包', status: 'delivered', references: [{ assetId: 'AST-004', version: 3, checksum: checksumRegistry['AST-004'], lineageId: 'AST-004' }], createdAt: iso(-6), deliveredAt: iso(-5) },
  { id: 'DEL-008', projectId: 'PRJ-001', name: '音乐版权方同步交付', status: 'delivered', references: [{ assetId: 'AST-003', version: 2, checksum: checksumRegistry['AST-003'], lineageId: 'AST-003' }], createdAt: iso(-30), deliveredAt: iso(-28) }
];
export const lockTickets: LockTicket[] = [];
export const auditEvents: AuditEvent[] = [{ id: 'AUD-0001', action: 'CREATE', entity: 'budget', entityId: 'BUD-001-V3', actor: '制片主任', at: new Date(now - 86400000).toISOString(), details: '从 V2 复制并调整后期科目' }];

let auditSeq = 0;
function recordAudit(action: string, entity: string, entityId: string, actor: string, details: string) {
  auditSeq += 1;
  const event: AuditEvent = { id: `AUD-${Date.now()}-${auditSeq}`, action, entity, entityId, actor, at: new Date().toISOString(), details };
  auditEvents.unshift(event);
  return event;
}
const getAsset = (id: string) => assets.find(asset => asset.id === id);
function groupBy<T>(items: T[], keyOf: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) { const key = keyOf(item); (groups[key] ??= []).push(item); }
  return groups;
}
const activeAssets = (projectId: string) => assets.filter(asset => asset.projectId === projectId && asset.status !== 'superseded' && asset.status !== 'revoked');
const LOCKABLE: AssetStatus[] = ['review', 'approved'];

export function isChecksumWellFormed(checksum: string) { return /^sha256:[0-9a-f]{64}$/i.test(checksum); }
/** checksum 有效：格式合法且与登记台账一致（资产被篡改或登记缺失均无效） */
export function isValidChecksum(asset: Asset) { return isChecksumWellFormed(asset.checksum) && checksumRegistry[asset.id] === asset.checksum; }

/** 冲突检测只看生效资产：同族版本不算冲突（替代关系，不是双授权），作废/被替代版本不参与。
 * includeAsset 用于门禁评估：把候选（如回退目标 superseded 版本）按"假设生效"纳入计算 */
export function rightsConflicts(projectId = projects[0].id, includeAssetId?: string) {
  const list = activeAssets(projectId);
  const included = includeAssetId && !list.some(asset => asset.id === includeAssetId) ? getAsset(includeAssetId) : undefined;
  if (included && included.projectId === projectId) list.push(included);
  const conflicts: { severity: 'critical' | 'warning'; assetAId: string; assetBId: string; assetA: string; assetB: string; reason: string }[] = [];
  for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) {
    const a = list[i], b = list[j];
    if (a.lineageId === b.lineageId) continue;
    const sharedTags = a.rightsTags.filter(tag => b.rightsTags.includes(tag));
    const sameTerritory = a.territories.includes('全球') || b.territories.includes('全球') || a.territories.some(territory => b.territories.includes(territory));
    if (sharedTags.length && sameTerritory && a.availableTo >= b.availableFrom && b.availableTo >= a.availableFrom) conflicts.push({ severity: a.status === 'locked' || b.status === 'locked' ? 'critical' : 'warning', assetAId: a.id, assetBId: b.id, assetA: a.name, assetB: b.name, reason: `同一授权标签在重叠窗口内覆盖相同地域：${sharedTags.join('、')}` });
  }
  return conflicts;
}

/** 锁定/换版/回退共用的门禁评估：checksum、审批、授权窗口、版权冲突任一 critical 即阻断 */
export function blockingIssues(asset: Asset): BlockingIssue[] {
  const issues: BlockingIssue[] = [];
  if (!isValidChecksum(asset)) issues.push({ code: 'CHECKSUM_INVALID', message: `checksum 无效：${asset.id} 的校验值缺失、格式错误或与登记台账不一致` });
  if (asset.availableTo < today()) issues.push({ code: 'AUTHORIZATION_EXPIRED', message: `授权窗口已于 ${asset.availableTo} 失效，不得锁定/换版/回退为生效版本` });
  // 候选资产（review/approved/superseded）按"假设生效"评估：一旦生效即 critical 的冲突必须提前阻断
  const conflicts = LOCKABLE.includes(asset.status) || asset.status === 'superseded'
    ? rightsConflicts(asset.projectId, asset.id)
    : rightsConflicts(asset.projectId);
  const conflict = conflicts.find(item => (item.assetAId === asset.id || item.assetBId === asset.id) && (item.severity === 'critical' || LOCKABLE.includes(asset.status) || asset.status === 'superseded'));
  if (conflict) issues.push({ code: 'CRITICAL_RIGHTS_CONFLICT', message: `与 ${conflict.assetAId === asset.id ? conflict.assetB : conflict.assetA} 存在 critical 权利风险：${conflict.reason}` });
  const approved = approvals.some(item => item.entityType === 'asset' && item.entityId === asset.id && item.status === 'approved');
  if (!approved) issues.push({ code: 'APPROVAL_REQUIRED', message: `资产 ${asset.id} 缺少已通过的锁定审批（必要审批未完成）` });
  return issues;
}

// ---------- 锁定：申请（票据）→ 提交（门禁 + 互斥），两步以暴露请求期间的风险变化 ----------
export function requestLock(input: { assetId: string; requestedBy: string }) {
  const asset = getAsset(input.assetId);
  if (!asset) throw new DomainError('ASSET_NOT_FOUND', `资产 ${input.assetId} 不存在`, 404);
  if (!LOCKABLE.includes(asset.status)) throw new DomainError('ASSET_NOT_LOCKABLE', `资产 ${asset.id} 当前状态为 ${asset.status}，仅 review/approved 可申请锁定（重复锁定被拒绝）`, 409);
  const otherLocked = assets.find(item => item.lineageId === asset.lineageId && item.status === 'locked' && item.id !== asset.id);
  if (otherLocked) throw new DomainError('LINEAGE_ALREADY_LOCKED', `谱系 ${asset.lineageId} 已有生效版本 ${otherLocked.id}，替代必须走换版流程，不能直接锁定第二个版本`, 409);
  const pending = lockTickets.find(ticket => ticket.assetId === asset.id && ticket.status === 'pending');
  if (pending) throw new DomainError('DUPLICATE_LOCK_REQUEST', `资产 ${asset.id} 已存在待处理锁定申请 ${pending.id}，禁止重复发起`, 409, { ticketId: pending.id });
  const ticket: LockTicket = { id: `LCK-${Date.now()}-${++auditSeq}`, projectId: asset.projectId, assetId: asset.id, requestedBy: input.requestedBy, status: 'pending', createdAt: new Date().toISOString() };
  lockTickets.unshift(ticket);
  recordAudit('LOCK_REQUESTED', 'asset', asset.id, input.requestedBy, `提交锁定申请 ${ticket.id}；当前待清障项：${blockingIssues(asset).map(item => item.code).join('、') || '无'}`);
  return { ticket, preflight: blockingIssues(asset) };
}

// 同一资产的提交串行化，模拟数据库行锁/乐观锁，杜绝并发双锁
const mutexes = new Map<string, Promise<unknown>>();
function serialize<T>(key: string, fn: () => T): Promise<T> {
  const previous = mutexes.get(key) ?? Promise.resolve();
  let release: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const current = previous.then(() => gate);
  mutexes.set(key, current);
  return previous.then(() => Promise.resolve().then(fn)).finally(() => { release(); if (mutexes.get(key) === current) mutexes.delete(key); });
}

export function commitLock(ticketId: string, actor = '当前审批人') {
  const ticket = lockTickets.find(item => item.id === ticketId);
  if (!ticket) throw new DomainError('LOCK_TICKET_NOT_FOUND', `锁定申请 ${ticketId} 不存在`, 404);
  return serialize(`lock:${ticket.assetId}`, () => {
    if (ticket.status === 'committed') throw new DomainError('LOCK_ALREADY_COMMITTED', `锁定申请 ${ticketId} 已提交，重复/并发提交被拒绝`, 409, { assetId: ticket.assetId });
    if (ticket.status === 'rejected') throw new DomainError('LOCK_TICKET_REJECTED', `锁定申请 ${ticketId} 已被拒绝（${ticket.reason ?? '门禁未通过'}），请重新发起申请`, 409);
    // 提交时重新加载资产并重新评估，捕获请求期间的风险变化（checksum 被篡改、授权失效、冲突出现等）
    const asset = getAsset(ticket.assetId);
    if (!asset) throw new DomainError('ASSET_NOT_FOUND', `资产 ${ticket.assetId} 不存在`, 404);
    if (!LOCKABLE.includes(asset.status)) throw new DomainError('ASSET_NOT_LOCKABLE', `资产 ${asset.id} 已流转为 ${asset.status}，申请 ${ticketId} 失效`, 409);
    const issues = blockingIssues(asset);
    if (issues.length) {
      ticket.status = 'rejected';
      ticket.reason = issues.map(item => item.code).join('、');
      recordAudit('LOCK_REJECTED', 'asset', asset.id, actor, `锁定申请 ${ticketId} 被拒：${issues.map(item => `${item.code} ${item.message}`).join('；')}`);
      throw new DomainError('LOCK_PRECONDITIONS_FAILED', `锁定 ${asset.id} 未通过门禁：${issues.map(item => item.code).join('、')}`, 422, { ticketId, issues });
    }
    asset.status = 'locked';
    asset.lockedAt = new Date().toISOString();
    asset.lockedByTicketId = ticket.id;
    ticket.status = 'committed';
    ticket.committedAt = new Date().toISOString();
    recordAudit('LOCK_COMMITTED', 'asset', asset.id, actor, `锁定申请 ${ticketId} 提交成功，${asset.name} v${asset.version} 成为生效版本（checksum、审批、权利风险均已校验）`);
    return { asset, ticket };
  });
}

// ---------- 换版：只能对已锁定母版登记新版，新版审批与门禁通过后原子替代，替代关系永久保留 ----------
export function createRevision(input: { assetId: string; requestedBy: string; checksum: string; name?: string; territories?: string[]; platforms?: string[]; availableFrom?: string; availableTo?: string; rightsTags?: string[] }) {
  const source = getAsset(input.assetId);
  if (!source) throw new DomainError('ASSET_NOT_FOUND', `资产 ${input.assetId} 不存在`, 404);
  if (source.status !== 'locked') throw new DomainError('ASSET_NOT_LOCKED', `仅已锁定版本可登记替代新版，${source.id} 当前为 ${source.status}`, 409);
  if (!isChecksumWellFormed(input.checksum)) throw new DomainError('INVALID_CHECKSUM_FORMAT', '新 checksum 必须为 sha256: 加 64 位十六进制', 400);
  const id = `AST-${Date.now()}-${++auditSeq}`;
  const revision: Asset = {
    id, projectId: source.projectId, name: input.name ?? source.name, type: source.type, version: source.version + 1, status: 'review', owner: source.owner,
    checksum: input.checksum, territories: input.territories ?? source.territories, platforms: input.platforms ?? source.platforms,
    availableFrom: input.availableFrom ?? today(), availableTo: input.availableTo ?? source.availableTo,
    rightsTags: input.rightsTags ?? source.rightsTags, lineageId: source.lineageId, supersedesId: source.id
  };
  checksumRegistry[id] = input.checksum;
  assets.push(revision);
  recordAudit('REVISION_CREATED', 'asset', id, input.requestedBy, `基于 ${source.id} v${source.version} 登记候选新版 v${revision.version}（谱系 ${source.lineageId}），原生效版本保持锁定`);
  return revision;
}

const findDeliveriesUsing = (assetId: string) => deliveries.filter(delivery => delivery.references.some(ref => ref.assetId === assetId));

export function swapVersion(input: { assetId: string; requestedBy: string; acknowledgeDeliveries?: boolean }) {
  const candidate = getAsset(input.assetId);
  if (!candidate) throw new DomainError('ASSET_NOT_FOUND', `资产 ${input.assetId} 不存在`, 404);
  if (!LOCKABLE.includes(candidate.status) || !candidate.supersedesId) throw new DomainError('SWAP_INVALID', `${candidate.id} 不是带替代关系的候选新版（需为 review/approved 且声明 supersedesId）`, 422);
  const current = assets.find(asset => asset.lineageId === candidate.lineageId && asset.status === 'locked');
  if (!current || candidate.supersedesId !== current.id) throw new DomainError('SWAP_INVALID', `${candidate.id} 的替代目标不是谱系 ${candidate.lineageId} 当前生效版本`, 422);
  const issues = blockingIssues(candidate);
  if (issues.length) throw new DomainError('SWAP_PRECONDITIONS_FAILED', `换版 ${candidate.id} 未通过门禁：${issues.map(item => item.code).join('、')}`, 422, { issues });
  // 验证已有交付引用：已交付引用不可悄悄改写，必须显式知情确认
  const referenced = findDeliveriesUsing(current.id).filter(delivery => delivery.status === 'delivered');
  if (referenced.length && !input.acknowledgeDeliveries) throw new DomainError('DELIVERY_REFERENCES_PRESENT', `当前生效版本被 ${referenced.length} 个已交付交付包引用，换版会使新交付与历史交付版本不一致，请确认后重试`, 409, { deliveries: referenced.map(delivery => ({ id: delivery.id, name: delivery.name })) });

  candidate.status = 'locked';
  candidate.lockedAt = new Date().toISOString();
  candidate.lockedByTicketId = undefined;
  current.status = 'superseded';
  current.supersededBy = candidate.id;
  current.supersededAt = new Date().toISOString();
  recordAudit('VERSION_SWAPPED', 'asset', candidate.id, input.requestedBy, `换版生效：${current.id} v${current.version} → ${candidate.id} v${candidate.version}（谱系 ${candidate.lineageId}）；替代关系保留${referenced.length ? `，已交付引用 ${referenced.map(d => d.id).join('、')} 经确认保留历史快照` : ''}`);
  // 尚未交付的预备交付包安全地改指向新版本；已交付的快照一行不动
  for (const delivery of findDeliveriesUsing(current.id).filter(delivery => delivery.status === 'prepared')) {
    delivery.references = delivery.references.map(ref => ref.assetId === current.id ? { ...ref, assetId: candidate.id, version: candidate.version, checksum: candidate.checksum } : ref);
    recordAudit('DELIVERY_REPOINTED', 'delivery', delivery.id, input.requestedBy, `预备交付包改指向新版本 ${candidate.id} v${candidate.version}`);
  }
  return { current: candidate, previous: current, acknowledgedDeliveries: referenced.map(delivery => delivery.id) };
}

// ---------- 回退：授权失效等场景回到族内旧版；旧版只标记 revoked，任何失败都留审计、状态不半写 ----------
export function rollback(input: { assetId: string; targetAssetId: string; requestedBy: string; reason: string; acknowledgeDeliveries?: boolean }) {
  const current = getAsset(input.assetId);
  if (!current) throw new DomainError('ASSET_NOT_FOUND', `资产 ${input.assetId} 不存在`, 404);
  const fail = (code: string, message: string, httpStatus = 422, details?: unknown): never => {
    recordAudit('ROLLBACK_FAILED', 'asset', current.id, input.requestedBy, `回退 ${current.id} → ${input.targetAssetId} 失败（${code}）：${message}；原因：${input.reason}`);
    throw new DomainError(code, message, httpStatus, details);
  };
  if (current.status !== 'locked') fail('ROLLBACK_INVALID', `只有生效版本可回退，${current.id} 当前为 ${current.status}`, 409);
  const targetOpt = getAsset(input.targetAssetId);
  if (!targetOpt) fail('ROLLBACK_TARGET_INVALID', `回退目标 ${input.targetAssetId} 不存在`, 404);
  const targetAsset: Asset = targetOpt as Asset; // fail() 必抛 never，到这里 targetOpt 必已定义
  // 沿 supersedesId 链验证目标确属同族祖先，防止跨谱系/伪造回退
  const ancestors: string[] = [];
  let cursor: Asset | undefined = current;
  while (cursor?.supersedesId) { ancestors.push(cursor.supersedesId); cursor = getAsset(cursor.supersedesId); }
  if (targetAsset.lineageId !== current.lineageId || !ancestors.includes(targetAsset.id)) fail('ROLLBACK_TARGET_INVALID', `${targetAsset.id} 不是 ${current.id} 谱系内的历史版本`);

  const issues = blockingIssues(targetAsset);
  if (issues.length) fail('ROLLBACK_PRECONDITIONS_FAILED', `回退目标 ${targetAsset.id} 仍有阻断项：${issues.map(item => item.code).join('、')}`, 422, { issues });

  const using = findDeliveriesUsing(current.id);
  const delivered = using.filter(delivery => delivery.status === 'delivered');
  const prepared = using.filter(delivery => delivery.status === 'prepared');
  if (delivered.length && !input.acknowledgeDeliveries) fail('DELIVERY_REFERENCES_PRESENT', `生效版本被 ${delivered.length} 个已交付交付包引用，回退须召回并确认：${delivered.map(d => d.id).join('、')}`, 409, { deliveries: delivered.map(delivery => ({ id: delivery.id, name: delivery.name })) });

  // 以下为单一同步事务段：先计算全部写入，失败不会留下半写状态
  targetAsset.status = 'locked';
  targetAsset.reactivatedAt = new Date().toISOString();
  current.status = 'revoked';
  current.revokedAt = new Date().toISOString();
  current.revokedReason = input.reason;
  for (const delivery of delivered) {
    delivery.status = 'recalled';
    delivery.recalledAt = new Date().toISOString();
    delivery.recallReason = input.reason;
    recordAudit('DELIVERY_RECALLED', 'delivery', delivery.id, input.requestedBy, `随版本回退召回已交付交付包（引用 ${current.id} v${current.version} 已作废），历史快照保留不删除`);
  }
  for (const delivery of prepared) {
    delivery.references = delivery.references.map(ref => ref.assetId === current.id ? { ...ref, assetId: targetAsset.id, version: targetAsset.version, checksum: targetAsset.checksum } : ref);
    recordAudit('DELIVERY_REPOINTED', 'delivery', delivery.id, input.requestedBy, `预备交付包随回退改指向 ${targetAsset.id} v${targetAsset.version}`);
  }
  recordAudit('VERSION_ROLLED_BACK', 'asset', targetAsset.id, input.requestedBy, `回退生效：${current.id} v${current.version} 作废（revoked，历史保留）→ ${targetAsset.id} v${targetAsset.version} 恢复为生效版本；原因：${input.reason}`);
  return { current: targetAsset, revoked: current, recalledDeliveries: delivered.map(delivery => delivery.id), repointedDeliveries: prepared.map(delivery => delivery.id) };
}

export function createDelivery(input: { projectId: string; name: string; requestedBy: string; references: { assetId: string }[] }) {
  const refs: DeliveryRef[] = input.references.map(({ assetId }) => {
    const asset = getAsset(assetId);
    if (!asset) throw new DomainError('ASSET_NOT_FOUND', `资产 ${assetId} 不存在`, 404);
    return { assetId, version: asset.version, checksum: asset.checksum, lineageId: asset.lineageId };
  });
  const delivery: Delivery = { id: `DEL-${Date.now()}-${++auditSeq}`, projectId: input.projectId, name: input.name, status: 'prepared', references: refs, createdAt: new Date().toISOString() };
  deliveries.unshift(delivery);
  recordAudit('DELIVERY_CREATED', 'delivery', delivery.id, input.requestedBy, `登记预备交付包，引用 ${refs.map(ref => `${ref.assetId}@v${ref.version}`).join('、')}`);
  return delivery;
}

/** 预备交付包对外发出：引用快照冻结，之后版本变动只能经召回/回退流程处理 */
export function markDeliveryDelivered(id: string, requestedBy: string) {
  const delivery = deliveries.find(item => item.id === id);
  if (!delivery) throw new DomainError('DELIVERY_NOT_FOUND', `交付包 ${id} 不存在`, 404);
  if (delivery.status !== 'prepared') throw new DomainError('DELIVERY_NOT_PREPARED', `交付包 ${id} 当前为 ${delivery.status}，只有预备状态可发出`, 409);
  delivery.status = 'delivered';
  delivery.deliveredAt = new Date().toISOString();
  recordAudit('DELIVERY_SENT', 'delivery', delivery.id, requestedBy, `交付包发出，引用快照冻结：${delivery.references.map(ref => `${ref.assetId}@v${ref.version}`).join('、')}`);
  return delivery;
}

/** 登记全新资产（独立谱系根）；替代版本必须走 createRevision 以保留替代关系 */
export function registerAsset(input: { projectId: string; name: string; type: AssetType; owner: string; checksum: string; territories: string[]; platforms: string[]; availableFrom: string; availableTo: string; rightsTags: string[]; requestedBy: string }) {
  if (!isChecksumWellFormed(input.checksum)) throw new DomainError('INVALID_CHECKSUM_FORMAT', 'checksum 必须为 sha256: 加 64 位十六进制', 400);
  const id = `AST-${Date.now()}-${++auditSeq}`;
  const asset: Asset = { id, projectId: input.projectId, name: input.name, type: input.type, version: 1, status: 'review', owner: input.owner, checksum: input.checksum, territories: input.territories, platforms: input.platforms, availableFrom: input.availableFrom, availableTo: input.availableTo, rightsTags: input.rightsTags, lineageId: id };
  checksumRegistry[id] = input.checksum;
  assets.push(asset);
  recordAudit('ASSET_REGISTERED', 'asset', id, input.requestedBy, `登记全新资产 ${input.name} v1（独立谱系 ${id}）`);
  return asset;
}

/** 表间一致性自检：摘要/冲突/审批/资产/交付/票据重载后必须互相吻合，供"重载"验证与测试使用 */
export function consistencyReport(projectId = projects[0].id) {
  const issues: string[] = [];
  const projectAssets = assets.filter(asset => asset.projectId === projectId);
  const projectApprovals = approvals.filter(approval => approval.projectId === projectId);
  const projectDeliveries = deliveries.filter(delivery => delivery.projectId === projectId);
  const projectTickets = lockTickets.filter(ticket => ticket.projectId === projectId);

  for (const [assetId, group] of Object.entries(groupBy(projectAssets, asset => asset.lineageId))) {
    const locked = group!.filter(asset => asset.status === 'locked');
    if (locked.length > 1) issues.push(`谱系 ${assetId} 存在多个生效版本：${locked.map(asset => asset.id).join('、')}`);
  }
  for (const [assetId, group] of Object.entries(groupBy(projectTickets, ticket => ticket.assetId))) {
    if (group!.filter(ticket => ticket.status === 'pending').length > 1) issues.push(`资产 ${assetId} 存在多个 pending 锁定申请`);
  }
  for (const approval of projectApprovals) {
    const exists = approval.entityType === 'budget' ? budgetVersions.some(version => version.id === approval.entityId)
      : approval.entityType === 'asset' ? !!getAsset(approval.entityId)
      : deliveries.some(delivery => delivery.id === approval.entityId);
    if (!exists) issues.push(`审批 ${approval.id} 引用的 ${approval.entityType}/${approval.entityId} 不存在`);
  }
  for (const delivery of projectDeliveries) {
    for (const ref of delivery.references) {
      const asset = getAsset(ref.assetId);
      if (!asset) { issues.push(`交付 ${delivery.id} 引用了已删除资产 ${ref.assetId}（历史不得删除）`); continue; }
      if (delivery.status === 'delivered' && asset.status === 'revoked') issues.push(`交付 ${delivery.id} 仍标记 delivered，但引用版本 ${ref.assetId} 已 revoked（应召回）`);
      if (delivery.status === 'recalled' && !delivery.recalledAt) issues.push(`交付 ${delivery.id} 已召回但缺少 recalledAt`);
    }
  }
  // 与摘要/冲突视图表对账（模拟页面重载）
  const summary = projectSummary(projectId);
  if (summary.assetCount !== projectAssets.length) issues.push(`摘要 assetCount=${summary.assetCount} 与资产表 ${projectAssets.length} 不同步`);
  if (summary.pendingApprovals !== projectApprovals.filter(item => item.status === 'pending').length) issues.push('摘要 pendingApprovals 与审批表不同步');
  const conflicts = rightsConflicts(projectId);
  if (summary.criticalConflicts !== conflicts.filter(item => item.severity === 'critical').length) issues.push('摘要 critical 冲突数与冲突表不同步');
  return {
    ok: issues.length === 0, issues,
    assetCount: projectAssets.length, activeAssetCount: activeAssets(projectId).length,
    approvalCount: projectApprovals.length, pendingApprovals: summary.pendingApprovals,
    deliveryCount: projectDeliveries.length, conflictCount: conflicts.length, criticalConflicts: summary.criticalConflicts,
    pendingLockTickets: projectTickets.filter(ticket => ticket.status === 'pending').length
  };
}

export function projectSummary(projectId = projects[0].id) {
  const lines = budgetLines.filter(line => line.projectId === projectId);
  const projectContracts = contracts.filter(contract => contract.projectId === projectId);
  const projectAssets = assets.filter(asset => asset.projectId === projectId);
  const projectApprovals = approvals.filter(approval => approval.projectId === projectId);
  const projectDeliveries = deliveries.filter(delivery => delivery.projectId === projectId);
  const projectTickets = lockTickets.filter(ticket => ticket.projectId === projectId);
  const conflicts = rightsConflicts(projectId);
  const planned = lines.reduce((sum, line) => sum + line.planned, 0);
  const forecast = lines.reduce((sum, line) => sum + line.forecast, 0);
  const actual = lines.reduce((sum, line) => sum + line.actual, 0);
  return { project: projects.find(project => project.id === projectId), planned, forecast, actual, variance: forecast - planned, utilization: planned ? actual / planned : 0, committed: lines.reduce((sum, line) => sum + line.committed, 0), contractExposure: projectContracts.reduce((sum, contract) => sum + contract.ceiling, 0), assetCount: projectAssets.length, activeAssetCount: activeAssets(projectId).length, pendingApprovals: projectApprovals.filter(item => item.status === 'pending').length, highRiskLines: lines.filter(line => line.risk === 'high'), rightsConflicts: conflicts, conflictCount: conflicts.length, criticalConflicts: conflicts.filter(item => item.severity === 'critical').length, lines, contracts: projectContracts, assets: projectAssets, approvals: projectApprovals, deliveries: projectDeliveries, lockTickets: projectTickets };
}

export function approve(id: string, status: ApprovalStatus, comment = '', actor = '当前审批人') {
  const item = approvals.find(approval => approval.id === id); if (!item) return undefined;
  item.status = status; item.comment = comment;
  recordAudit(status.toUpperCase(), item.entityType, item.entityId, actor, comment || `${item.title} 已${status === 'approved' ? '通过' : '驳回'}`);
  return item;
}
export function createApproval(input: Pick<Approval, 'projectId' | 'entityType' | 'entityId' | 'title' | 'requestedBy' | 'approver'>) { const item: Approval = { ...input, id: `APR-${Date.now()}-${++auditSeq}`, status: 'pending', createdAt: new Date().toISOString() }; approvals.unshift(item); recordAudit('APPROVAL_REQUESTED', input.entityType, input.entityId, input.requestedBy, `发起审批：${input.title}`); return item; }
export function dashboard() { return projects.map(project => projectSummary(project.id)).map(summary => ({ id: summary.project?.id, title: summary.project?.title, status: summary.project?.status, forecast: summary.forecast, variance: summary.variance, pendingApprovals: summary.pendingApprovals, rightsConflicts: summary.conflictCount })); }
