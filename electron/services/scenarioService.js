/**
 * 场景服务（Service Layer）—— 疏散场景的保存 / 列表 / 加载 / 删除
 *
 * 归属规则：场景一律挂当前登录用户（user_id），非本人数据不可读不可删。
 * JSON 列在入库前统一 JSON.stringify，读取时 JSON.parse。
 */
const scenarioRepository = require('../db/repositories/scenarioRepository')
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
 * 保存场景（新增）
 * @param {{ name: string, description?: string, gridData: Object, exits: Object[], agents: Object[], settings?: Object }} payload
 */
async function save(payload) {
  const user = requireUser()
  if (!payload || !payload.name || !payload.name.trim()) {
    return { success: false, message: '场景名称不能为空' }
  }
  if (!payload.gridData || !Array.isArray(payload.exits) || !Array.isArray(payload.agents)) {
    return { success: false, message: '场景数据不完整（缺少地形 / 出口 / 人员）' }
  }
  try {
    const id = await scenarioRepository.create({
      user_id: user.id,
      name: payload.name.trim(),
      description: payload.description || '',
      grid_data: JSON.stringify(payload.gridData),
      exits: JSON.stringify(payload.exits),
      agents: JSON.stringify(payload.agents),
      settings: payload.settings ? JSON.stringify(payload.settings) : null
    })
    return { success: true, message: '场景保存成功', id }
  } catch (err) {
    console.error('[scenarioService.save] 数据库异常:', err)
    return { success: false, message: '保存失败，请检查数据库连接' }
  }
}

/** 当前用户的场景列表（JSON 列解析为对象返回） */
async function list() {
  const user = requireUser()
  try {
    const rows = await scenarioRepository.listByUser(user.id)
    const scenarios = rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      gridData: JSON.parse(row.grid_data),
      exits: JSON.parse(row.exits),
      agents: JSON.parse(row.agents),
      settings: row.settings ? JSON.parse(row.settings) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
    return { success: true, scenarios }
  } catch (err) {
    console.error('[scenarioService.list] 数据库异常:', err)
    return { success: false, message: '读取场景列表失败' }
  }
}

/** 按 id 取场景（仅本人） */
async function get(id) {
  const user = requireUser()
  try {
    const row = await scenarioRepository.findOwned(id, user.id)
    if (!row) return { success: false, message: '场景不存在或无权访问' }
    return {
      success: true,
      scenario: {
        id: row.id,
        name: row.name,
        description: row.description,
        gridData: JSON.parse(row.grid_data),
        exits: JSON.parse(row.exits),
        agents: JSON.parse(row.agents),
        settings: row.settings ? JSON.parse(row.settings) : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    }
  } catch (err) {
    console.error('[scenarioService.get] 数据库异常:', err)
    return { success: false, message: '读取场景失败' }
  }
}

/** 删除场景（仅本人） */
async function remove(id) {
  const user = requireUser()
  try {
    const ok = await scenarioRepository.deleteOwned(id, user.id)
    return ok
      ? { success: true, message: '删除成功' }
      : { success: false, message: '场景不存在或无权删除' }
  } catch (err) {
    console.error('[scenarioService.remove] 数据库异常:', err)
    return { success: false, message: '删除失败' }
  }
}

module.exports = { save, list, get, remove }
