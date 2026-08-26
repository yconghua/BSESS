# -*- coding: utf-8 -*-
"""HTTP 接口的数据模型（Pydantic v2）。

约定（与设计文档一致）：
  - 坐标 Position：row 向下、col 向右，原点在左上角 (0,0)
  - cells 只存地形：0=空地 / 1=障碍物；出口、人员为独立叠加层
  - 错误响应统一为 HTTP 400 + {"code": ..., "message": ...}
"""

from typing import Literal

from pydantic import BaseModel


class Position(BaseModel):
    """网格坐标。越界/落障碍等语义校验在 main.py 中统一执行。"""
    row: int
    col: int


class SimulateRequest(BaseModel):
    """POST /simulate 请求体。"""
    grid: list[list[int]]
    exits: list[Position]
    agents: list[Position]
    algorithm: Literal["bfs", "dijkstra", "astar", "distanceField", "ca"] = "distanceField"


class ExitCount(BaseModel):
    """单个出口的疏散人数。"""
    row: int
    col: int
    count: int


class Stats(BaseModel):
    totalSteps: int  # makespan：最后一人撤离的步数（不含不可达者）
    avgPathLength: float  # 平均路径长度（仅统计可达人员）
    maxPathLength: int  # 最长路径长度（仅统计可达人员）
    unreachableCount: int  # 不可达人数
    exitDistribution: list[ExitCount]  # 各出口疏散人数（含未使用的出口，count=0）


class SimulateResponse(BaseModel):
    """POST /simulate 响应体。"""
    agentPaths: list[list[Position]]  # 按请求 agents 顺序返回；不可达者为空数组 []
    stats: Stats
    distanceField: list[list[int]]  # 多源距离场，所有算法均返回（供热力图）
    computationTime: float  # 算法计算耗时（毫秒）


class AlgorithmInfo(BaseModel):
    """单个算法的展示信息（含适用场景标注）。"""
    id: str
    label: str
    recommended: bool
    scenario: str
    description: str


class AlgorithmsResponse(BaseModel):
    """GET /algorithms 响应体。"""
    algorithms: list[AlgorithmInfo]
