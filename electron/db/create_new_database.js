/**
 * 数据库初始化公共模块
 *
 * 数据库初始化的唯一实现：建库（带 IF NOT EXISTS）+ 按文件名顺序执行 schemas/ 下全部 .sql。
 * 每张表的「建表语句 + 默认数据」都放在 electron/db/schemas/ 目录的独立 .sql 文件中
 * （以 01_ / 02_ 数字前缀命名控制执行顺序），本文件不再手写任何 CREATE TABLE。
 *
 * 这样新增一张表时，只需在 schemas/ 下新建一个「NN_表名.sql」即可，主初始化代码零改动；
 * 后续改表结构也直接改对应 .sql 文件，与 repositories/（运行时 CRUD）、services/、ipc/ 完全独立。
 *
 * 由 connectionService.add（添加新数据库）调用：自动建库 + 建表 + 默认数据。
 */
const fs = require('node:fs')
const path = require('node:path')
const mysql = require('mysql2/promise')

// schemas 目录：每个 .sql 文件对应一张表的建表 + 默认数据
const SCHEMAS_DIR = path.join(__dirname, 'schemas')

// 初始化目标库：库不存在则自动创建，随后按文件名顺序执行 schemas/ 下所有 .sql（建表 + 种子数据）
async function initDatabase({ host, port, user, password, database }) {
  // 先连 MySQL 服务（不指定库），用于建库
  const conn = await mysql.createConnection({ host, port, user, password })
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_general_ci`
    )
    await conn.query(`USE \`${database}\``)

    // 读取 schemas 目录下全部 .sql 文件，按文件名（数字前缀）排序后逐个执行
    const files = fs
      .readdirSync(SCHEMAS_DIR)
      .filter((f) => f.toLowerCase().endsWith('.sql'))
      .sort() // 依赖 01_ / 02_ 零填充前缀保证执行顺序

    for (const file of files) {
      const sql = fs.readFileSync(path.join(SCHEMAS_DIR, file), 'utf8')
      // 按分号拆成多条语句（建表 + 种子插入通常在一个文件内多句）。
      // 注意：若以后 .sql 含触发器 / 存储过程（内部有分号），需升级此分隔逻辑。
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
      for (const stmt of statements) {
        await conn.query(stmt)
      }
    }
  } finally {
    await conn.end().catch(() => {})
  }
}

module.exports = { initDatabase }
