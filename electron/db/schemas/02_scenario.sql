-- 疏散场景表：用户自定义的空间（地形 / 出口 / 人员叠加层），按用户隔离
-- 幂等：重复执行无副作用；由主进程按系统版本号变更时统一重放
CREATE TABLE IF NOT EXISTS `scenario` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`     INT UNSIGNED NOT NULL                COMMENT '归属用户（外键逻辑关联 user.id）',
  `name`        VARCHAR(128) NOT NULL                COMMENT '场景名称',
  `description` VARCHAR(512) NOT NULL DEFAULT ''     COMMENT '场景描述',
  `grid_data`   JSON         NOT NULL                COMMENT '地形 {rows, cols, cells: 0/1 矩阵}',
  `exits`       JSON         NOT NULL                COMMENT '出口叠加层 [{row, col}]',
  `agents`      JSON         NOT NULL                COMMENT '人员起点叠加层 [{row, col}]',
  `settings`    JSON         NULL                    COMMENT '可选设置（算法、网格尺寸等）',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='疏散场景表';
