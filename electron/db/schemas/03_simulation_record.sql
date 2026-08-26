-- 仿真记录表：每次疏散计算的结果快照（路径 / 统计 / 耗时），支撑历史查询与批量实验
-- 幂等：重复执行无副作用；由主进程按系统版本号变更时统一重放
CREATE TABLE IF NOT EXISTS `simulation_record` (
  `id`                  INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `scenario_id`         INT UNSIGNED NULL                   COMMENT '关联场景（可为空：未保存场景直接仿真）',
  `user_id`             INT UNSIGNED NOT NULL               COMMENT '归属用户',
  `algorithm`           VARCHAR(32)  NOT NULL               COMMENT '算法 id（distanceField/dijkstra/astar/bfs/ca）',
  `stats`               JSON         NOT NULL               COMMENT '统计快照（makespan/平均/最长/不可达/出口分流）',
  `paths`               JSON         NOT NULL               COMMENT 'agentPaths 快照（按 agents 顺序）',
  `computation_time_ms` FLOAT        NULL                   COMMENT '算法计算耗时（毫秒）',
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '仿真时间',
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_scenario` (`scenario_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='仿真记录表';
