/**
 * 仿真记录服务（Service Layer）—— 疏散结果的写入 / 列表 / 详情
 *
 * 每次仿真结束后由渲染层调用 save() 落库（方案 A：Python 纯计算，Electron 管库）。
 * 记录挂当前登录用户；JSON 列入库前 stringify，读取时 parse。
 */
const simulationRecordRepository = require('../db/repositories/simulationRecordRepository')
const authService = require('./authService')

/** 获取当前登录用户，未登录抛错（由 ipc 层兜底返回消息） */
function requireUser() {
  const user = authService.getCurrentUser()
  if (!user) {
    const err = new Error('未登录，请重新登录')
    err.code = 'NO_LOGIN'
    throw err
  }
  return user
}

/**
 * 写入一条仿真记录
 * @param {{ scenarioId?: number|null, algorithm: string, stats: Object, paths: Object[], computationTimeMs?: number }} payload
 */
async function save(payload) {
  const user = requireUser()
  if (!payload || !payload.algorithm || !payload.stats || !Array.isArray(payload.paths)) {
    return { success: false, message: '记录数据不完整' }
  }
  try {
    const id = await simulationRecordRepository.create({
      scenario_id: payload.scenarioId || null,
      user_id: user.id,
      algorithm: payload.algorithm,
      stats: JSON.stringify(payload.stats),
      paths: JSON.stringify(payload.paths),
      computation_time_ms: payload.computationTimeMs ?? null
    })
    return { success: true, message: '记录已保存', id }
  } catch (err) {
    console.error('[simulationRecordService.save] 数据库异常:', err)
    return { success: false, message: '记录保存失败，请检查数据库连接' }
  }
}

/** 当前用户的仿真记录列表（仅摘要字段，paths 不整包返回，避免列表过重） */
async function list() {
  const user = requireUser()
  try {
    const rows = await simulationRecordRepository.listByUser(user.id)
    const records = rows.map((row) => ({
      id: row.id,
      scenarioId: row.scenario_id,
      algorithm: row.algorithm,
      stats: JSON.parse(row.stats),
      computationTimeMs: row.computation_time_ms,
      createdAt: row.created_at,
      // 列表不携带 paths（体积大），详情接口按需取
      pathCount: Array.isArray(JSON.parse(row.paths)) ? JSON.parse(row.paths).length : 0
    }))
    return { success: true, records }
  } catch (err) {
    console.error('[simulationRecordService.list] 数据库异常:', err)
    return { success: false, message: '读取记录列表失败' }
  }
}

/** 记录详情（含完整 paths，供回放 / 分析） */
async function get(id) {
  const user = requireUser()
  try {
    const row = await simulationRecordRepository.findOwned(id, user.id)
    if (!row) return { success: false, message: '记录不存在或无权访问' }
    return {
      success: true,
      record: {
        id: row.id,
        scenarioId: row.scenario_id,
        algorithm: row.algorithm,
        stats: JSON.parse(row.stats),
        paths: JSON.parse(row.paths),
        computationTimeMs: row.computation_time_ms,
        createdAt: row.created_at
      }
    }
  } catch (err) {
    console.error('[simulationRecordService.get] 数据库异常:', err)
    return { success: false, message: '读取记录失败' }
  }
}

module.exports = { save, list, get }
