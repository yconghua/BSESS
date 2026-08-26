/**
 * 场景仓库（Repository Layer）—— 对应 `scenario` 表
 *
 * 继承 BaseRepository 获得通用 CRUD；列表按用户过滤用裸 SQL 表达。
 * 导出单例：全局共用同一个仓库实例。
 */
const BaseRepository = require('./BaseRepository')

class ScenarioRepository extends BaseRepository {
  constructor() {
    super('scenario')
  }

  /**
   * 某用户的场景列表（按更新时间倒序）
   * @param {number} userId
   * @returns {Object[]}
   */
  async listByUser(userId) {
    const { conn, release } = await this._acquire()
    try {
      const [rows] = await conn.execute(
        `SELECT id, user_id, name, description, grid_data, exits, agents, settings, created_at, updated_at
         FROM \`scenario\` WHERE user_id = ? ORDER BY updated_at DESC, id DESC`,
        [userId]
      )
      return rows
    } finally {
      release()
    }
  }

  /**
   * 校验归属后按 id 取场景
   * @param {number} id
   * @param {number} userId
   * @returns {Object|null}
   */
  async findOwned(id, userId) {
    const { conn, release } = await this._acquire()
    try {
      const [rows] = await conn.execute(
        `SELECT id, user_id, name, description, grid_data, exits, agents, settings, created_at, updated_at
         FROM \`scenario\` WHERE id = ? AND user_id = ?`,
        [id, userId]
      )
      return rows[0] || null
    } finally {
      release()
    }
  }

  /**
   * 校验归属后删除
   * @param {number} id
   * @param {number} userId
   * @returns {boolean} 是否真的删除了
   */
  async deleteOwned(id, userId) {
    const { conn, release } = await this._acquire()
    try {
      const [result] = await conn.execute(
        'DELETE FROM `scenario` WHERE id = ? AND user_id = ?',
        [id, userId]
      )
      return result.affectedRows > 0
    } finally {
      release()
    }
  }
}

module.exports = new ScenarioRepository()
