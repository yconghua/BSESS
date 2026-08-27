# models.py
# 功能：定义前后端通信的数据结构，使用 Pydantic 进行自动校验和序列化

from pydantic import BaseModel
from typing import List, Optional, Tuple, Dict

# ---------- 请求模型 ----------
class PersonStart(BaseModel):
    """单个人员的初始状态"""
    x: float                          # 初始 x 坐标（物理坐标，单位：米）
    y: float                          # 初始 y 坐标
    desired_speed: Optional[float] = None  # 期望速度（m/s），若为 None 则使用全局默认值
    release_delay: float = 0.0        # 延迟释放时间（秒），用于分批释放

class SimulationRequest(BaseModel):
    """仿真请求体，由前端 POST 发送"""
    grid: List[List[int]]             # 二维网格地图：0 表示空地，1 表示障碍物
    exits: List[Tuple[float, float]]  # 出口物理坐标列表（可多个）
    persons: List[PersonStart]        # 所有待模拟人员
    grid_cell_size: Optional[float] = None  # 覆盖全局网格尺寸（可选）

# ---------- 响应模型 ----------
class TrajectoryPoint(BaseModel):
    """轨迹点：某一时刻的位置"""
    time: float
    x: float
    y: float

class PersonResult(BaseModel):
    """单个人员的仿真结果"""
    person_id: int                    # 人员在请求列表中的索引
    trajectory: List[TrajectoryPoint] # 完整运动轨迹（时间序列）
    exit_time: float                  # 到达出口的时刻，-1 表示未到达

class ExitFlowCurve(BaseModel):
    """单个出口的流量曲线"""
    times: List[float]                # 通过时刻列表
    cumulative_counts: List[int]      # 累计通过人数（与 times 一一对应）

class SimulationResult(BaseModel):
    """仿真结果响应体"""
    status: str                       # "success" / "partial" / "failed"
    total_evacuation_time: float      # 所有人员疏散完毕所需总时间（秒）
    person_results: List[PersonResult]
    exit_flow_curves: Dict[str, ExitFlowCurve]  # 每个出口的流量曲线
    density_heatmaps: Optional[List[Dict]] = None   # 密度快照列表（每 1 秒一张）
    bottleneck_nodes: List[Tuple[int, int]]         # 瓶颈网格坐标（行, 列）
    message: str                      # 附加信息