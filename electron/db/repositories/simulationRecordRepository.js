/**
 * 仿真记录仓库（Repository Layer）—— 对应 `simulation_record` 表
 *
 * 导出单例：全局共用同一个仓库实例。
 */
const BaseRepository = require('./BaseRepository')

class SimulationRecordRepository extends BaseRepository {
  constructor() {
    super('simulation_record')
  }

  /**
   * 某用户的仿真记录列表（按时间倒序）
   * @param {number} userId
   * @returns {Object[]}
   */
  async listByUser(userId) {
    const { conn, release } = await this._acquire()
    try {
      const [rows] = await conn.execute(
        `SELECT id, scenario_id, user_id, algorithm, stats, paths, computation_time_ms, created_at
         FROM \`simulation_record\` WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
        [userId]
      )
      return rows
    } finally {
      release()
    }
  }

  /**
   * 校验归属后取单条
   * @param {number} id
   * @param {number} userId
   * @returns {Object|null}
   */
  async findOwned(id, userId) {
    const { conn, release } = await this._acquire()
    try {
      const [rows] = await conn.execute(
        `SELECT id, scenario_id, user_id, algorithm, stats, paths, computation_time_ms, created_at
         FROM \`simulation_record\` WHERE id = ? AND user_id = ?`,
        [id, userId]
      )
      return rows[0] || null
    } finally {
      release()
    }
  }
}

module.exports = new SimulationRecordRepository()
