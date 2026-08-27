# config.py
# 功能：集中管理仿真物理参数和算法超参数，便于统一调优

SIMULATION_CONFIG = {
    # ---------- 时间与网格 ----------
    "time_step": 0.05,                # 积分步长（秒），越小模拟越精细但计算量越大
    "max_simulation_time": 300.0,     # 最大仿真时长（秒），防止死循环
    "grid_cell_size": 0.5,            # 每个网格代表的物理尺寸（米），影响路径精度
    "default_desired_speed": 1.2,     # 人员默认期望速度（m/s），若人员未指定则使用此值
    "exit_reach_threshold": 0.5,      # 判定人员到达出口的距离阈值（米）

    # ---------- 社会力模型参数 ----------
    "social_force": {
        "A": 2.0,                     # 人际排斥力强度（越大越排斥）
        "B": 0.3,                     # 排斥力衰减范围（米），距离越近作用越强
        "repulsion_threshold": 0.5,   # 开始产生排斥的最近距离（米），超过此距离无排斥
        "wall_repulsion_strength": 5.0,  # 墙壁对人员的排斥系数
        "wall_distance_scale": 0.2,   # 墙壁作用范围（米），距离墙小于此值开始排斥
    },

    # ---------- 速度场（密度影响速度） ----------
    "speed_field": {
        "sigma": 0.8,                 # 密度衰减系数，公式：factor = exp(-density * sigma)
        "min_speed_factor": 0.2,      # 速度衰减因子下限（避免完全停滞）
    },

    # ---------- 瓶颈检测 ----------
    "bottleneck": {
        "density_threshold": 2.0,     # 密度（人/平方米）超过此值视为拥堵
        "duration_threshold": 2.0,    # 拥堵持续时间（秒）超过此值才记为瓶颈（当前简化实现未使用）
    }
}