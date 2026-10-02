import express, { type RequestHandler } from 'express';
import { type ApprovalStatus, type AssetType, approve, assets, budgetLines, commitLock, consistencyReport, contracts, createApproval, createDelivery, createRevision, dashboard, DomainError, lockTickets, markDeliveryDelivered, projectSummary, projects, registerAsset, requestLock, rightsConflicts, rollback, swapVersion, deliveries } from './domain.js';
const app = express(); app.use(express.json());
type Body = Record<string, unknown>;
const body = (req: { body?: unknown }): Body => (req.body ?? {}) as Body;
const param = (req: { params: Record<string, unknown> }, key: string): string => String(req.params[key] ?? '');
const str = (value: unknown, fallback: string): string => typeof value === 'string' ? value : fallback;
const bool = (value: unknown): boolean => value === true;
const strList = (value: unknown): string[] | undefined => Array.isArray(value) && value.every(item => typeof item === 'string') ? value as string[] : undefined;
// 领域错误统一映射为稳定的 HTTP 状态与 code，前端可据 code 提示"确认后重试"
const handler = (fn: RequestHandler): RequestHandler => (req, res, next) => {
  try {
    return Promise.resolve(fn(req, res, next)).catch(error => {
      if (error instanceof DomainError) return res.status(error.httpStatus).json({ code: error.code, message: error.message, details: error.details });
      console.error(error); res.status(500).json({ code: 'INTERNAL', message: '服务内部错误' });
    });
  } catch (error) {
    if (error instanceof DomainError) return res.status(error.httpStatus).json({ code: error.code, message: error.message, details: error.details });
    console.error(error); res.status(500).json({ code: 'INTERNAL', message: '服务内部错误' });
  }
};
app.get('/api/dashboard', (_req, res) => res.json(dashboard()));
app.get('/api/projects', (_req, res) => res.json(projects));
app.get('/api/projects/:id/summary', handler((req, res) => { const id = param(req, 'id'); const result = projectSummary(id); if (!result.project) return res.status(404).json({ message: '项目不存在' }); res.json(result); }));
app.get('/api/projects/:id/rights-conflicts', (req, res) => res.json(rightsConflicts(param(req, 'id'))));
app.get('/api/projects/:id/assets', (req, res) => res.json(assets.filter(asset => asset.projectId === param(req, 'id'))));
app.get('/api/projects/:id/deliveries', (req, res) => res.json(deliveries.filter(delivery => delivery.projectId === param(req, 'id'))));
app.get('/api/projects/:id/contracts', (req, res) => res.json(contracts.filter(contract => contract.projectId === param(req, 'id'))));
app.get('/api/projects/:id/consistency', handler((req, res) => res.json(consistencyReport(param(req, 'id')))));
app.get('/api/budgets/:projectId/lines', (req, res) => res.json(budgetLines.filter(line => line.projectId === param(req, 'projectId'))));
app.post('/api/approvals', (req, res) => res.status(201).json(createApproval(req.body as Parameters<typeof createApproval>[0])));
app.patch('/api/approvals/:id', (req, res) => { const b = body(req); const result = approve(param(req, 'id'), str(b.status, 'pending') as ApprovalStatus, str(b.comment, '')); if (!result) return res.status(404).json({ message: '审批不存在' }); res.json(result); });
// 统一锁定流程：申请（票据）→ 提交（checksum/审批/无 critical 风险三重门禁，串行互斥）
app.post('/api/assets/:id/lock-requests', handler((req, res) => res.status(201).json(requestLock({ assetId: param(req, 'id'), requestedBy: str(body(req).requestedBy, '控制台操作员') }))));
app.post('/api/lock-tickets/:id/commit', handler(async (req, res) => res.json(await commitLock(param(req, 'id'), str(body(req).actor, '控制台操作员')))));
app.get('/api/lock-tickets', (_req, res) => res.json(lockTickets));
// 换版：登记候选新版 → 通过审批 → 原子换版（已交付引用须显式确认）
app.post('/api/assets/:id/revisions', handler((req, res) => {
  const b = body(req);
  if (typeof b.checksum !== 'string') return res.status(400).json({ code: 'INVALID_CHECKSUM_FORMAT', message: 'checksum 必填且必须为字符串' });
  res.status(201).json(createRevision({ assetId: param(req, 'id'), requestedBy: str(b.requestedBy, '控制台操作员'), checksum: b.checksum, name: typeof b.name === 'string' ? b.name : undefined, territories: strList(b.territories), platforms: strList(b.platforms), availableFrom: typeof b.availableFrom === 'string' ? b.availableFrom : undefined, availableTo: typeof b.availableTo === 'string' ? b.availableTo : undefined, rightsTags: strList(b.rightsTags) }));
}));
app.post('/api/assets/:id/swap', handler((req, res) => { const b = body(req); res.json(swapVersion({ assetId: param(req, 'id'), requestedBy: str(b.requestedBy, '控制台操作员'), acknowledgeDeliveries: bool(b.acknowledgeDeliveries) })); }));
// 回退：作废当前版本（revoked 不删除历史）、恢复族内旧版，全程审计；失败也写 ROLLBACK_FAILED
app.post('/api/assets/:id/rollback', handler((req, res) => {
  const b = body(req);
  if (typeof b.targetAssetId !== 'string') return res.status(400).json({ code: 'TARGET_REQUIRED', message: 'targetAssetId 必填且必须为字符串' });
  res.json(rollback({ assetId: param(req, 'id'), targetAssetId: b.targetAssetId, requestedBy: str(b.requestedBy, '控制台操作员'), reason: str(b.reason, ''), acknowledgeDeliveries: bool(b.acknowledgeDeliveries) }));
}));
app.post('/api/projects/:id/deliveries', handler((req, res) => {
  const b = body(req);
  const references = Array.isArray(b.references) ? b.references.filter((item): item is { assetId: string } => !!item && typeof (item as { assetId?: unknown }).assetId === 'string') : [];
  res.status(201).json(createDelivery({ projectId: param(req, 'id'), name: str(b.name, '未命名交付包'), requestedBy: str(b.requestedBy, '控制台操作员'), references }));
}));
app.post('/api/deliveries/:id/send', handler((req, res) => res.json(markDeliveryDelivered(param(req, 'id'), str(body(req).requestedBy, '控制台操作员')))));
app.post('/api/projects/:id/assets', handler((req, res) => {
  const b = body(req);
  if (typeof b.checksum !== 'string') return res.status(400).json({ code: 'INVALID_CHECKSUM_FORMAT', message: 'checksum 必填且必须为字符串' });
  res.status(201).json(registerAsset({ projectId: param(req, 'id'), name: str(b.name, '未命名资产'), type: str(b.type, 'master') as AssetType, owner: str(b.owner, '控制台操作员'), checksum: b.checksum, territories: strList(b.territories) ?? [], platforms: strList(b.platforms) ?? [], availableFrom: str(b.availableFrom, '2020-01-01'), availableTo: str(b.availableTo, '2099-12-31'), rightsTags: strList(b.rightsTags) ?? [], requestedBy: str(b.requestedBy, '控制台操作员') }));
}));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'film-rights-platform' }));
const port = Number(process.env.PORT || 4104); app.listen(port, () => console.log(`film rights API listening on ${port}`));
