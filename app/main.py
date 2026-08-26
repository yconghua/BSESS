# -*- coding: utf-8 -*-
"""BSESS 后端计算服务入口（FastAPI）。

独立于 Electron 运行，职责单一：网格 + 出口 + 人员 → 疏散路径/统计/距离场。
不依赖 Electron 任何模块、不读取外部资源、不写任何文件，全部在内存中完成。

接口：
  GET  /health      健康检查（Electron 启动时轮询就绪）
  GET  /algorithms  可用算法列表（含适用场景标注，供前端下拉菜单）
  POST /simulate    执行疏散计算

本地启动（开发，虚拟环境在项目根目录 .venv，命令在项目根目录执行）：
  .venv\\Scripts\\python -m pip install -r requirements.txt
  .venv\\Scripts\\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
"""

import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import algorithms as algo
from .schemas import (
    AlgorithmInfo,
    AlgorithmsResponse,
    ExitCount,
    Position,
    SimulateRequest,
    SimulateResponse,
    Stats,
)

app = FastAPI(title="BSESS 疏散计算服务", version="0.1.0", description="有界空间疏散仿真系统 · 后端计算服务（v1 路径级）")

# 服务只监听本机，供 Electron 渲染进程 / Vite 开发服务器调用；
# 开发期来源不固定，放开跨域（无敏感数据，仅本地计算）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 网格尺寸边界（设计文档第八节校验规则）
MIN_SIZE = 3
MAX_SIZE = 300

# 算法目录：/algorithms 的数据源，也是前端下拉菜单的选项
ALGORITHM_CATALOG = [
    AlgorithmInfo(
        id="distanceField", label="多源距离场", recommended=True,
        scenario="多出口 / 大网格",
        description="多源 BFS 一次计算，全体人员自动分流到最近出口，v1 默认推荐",
    ),
    AlgorithmInfo(
        id="dijkstra", label="Dijkstra", recommended=False,
        scenario="有权图 / 教学对照",
        description="优先队列版本，等权网格下结果与距离场一致，保留作算法对照",
    ),
    AlgorithmInfo(
        id="astar", label="A*", recommended=False,
        scenario="单出口 / 大体量",
        description="多目标 A*，启发式取到最近出口的曼哈顿距离，搜索范围最小",
    ),
    AlgorithmInfo(
        id="bfs", label="BFS", recommended=False,
        scenario="无权图 / 教学演示",
        description="单源 BFS 逐人搜索；固定 4 邻接（与对角 √2 代价语义冲突）",
    ),
    AlgorithmInfo(
        id="ca", label="CA 元胞自动机", recommended=False,
        scenario="多智能体 / 拥堵演示",
        description="M3：每步按距离场梯度移动 + 同格冲突消解，可呈现出口排队与绕行",
    ),
    AlgorithmInfo(
        id="sfm", label="社交力模型", recommended=False,
        scenario="连续空间 / 密度研究",
        description="V2：Helbing 社交力模型（期望力 + 障碍/人际排斥），连续坐标仿真",
    ),
]


def _check_position(pos: Position, rows: int, cols: int, grid: list[list[int]],
                    label: str, idx: int) -> dict | None:
    """校验单个出口/人员坐标：界内 + 落在空地格上。非法时返回错误体，否则 None。

    请求中的出口/人员坐标必须是网格格点，统一取整（SFM 等连续坐标只出现在响应路径里）。
    """
    r, c = int(pos.row), int(pos.col)
    if not (0 <= r < rows and 0 <= c < cols):
        return {"code": "INVALID_POSITION",
                "message": f"{label} #{idx} ({r},{c}) 超出网格范围 {rows}x{cols}"}
    if grid[r][c] != 0:
        return {"code": "INVALID_POSITION",
                "message": f"{label} #{idx} ({r},{c}) 落在障碍格上，不可通行"}
    return None


@app.get("/health")
def health() -> dict:
    """健康检查：Electron 启动后轮询此接口确认服务就绪。"""
    return {"status": "ok", "service": "bsess-backend", "version": app.version}


@app.get("/algorithms", response_model=AlgorithmsResponse)
def list_algorithms() -> AlgorithmsResponse:
    """返回可用算法列表（含适用场景标注）。"""
    return AlgorithmsResponse(algorithms=ALGORITHM_CATALOG)


@app.post("/simulate", response_model=SimulateResponse)
def simulate(req: SimulateRequest) -> SimulateResponse:
    """执行疏散计算：校验输入 → 算法算路径 → 汇总统计 → 返回结果。"""
    # 1) 网格尺寸校验（设计文档：行/列 3~300）
    rows = len(req.grid)
    if rows < MIN_SIZE or rows > MAX_SIZE:
        raise HTTPException(status_code=400, detail={"code": "INVALID_SIZE",
                                                     "message": f"行数必须在 {MIN_SIZE}~{MAX_SIZE} 之间，当前为 {rows}"})
    cols = len(req.grid[0]) if rows else 0
    if cols < MIN_SIZE or cols > MAX_SIZE:
        raise HTTPException(status_code=400, detail={"code": "INVALID_SIZE",
                                                     "message": f"列数必须在 {MIN_SIZE}~{MAX_SIZE} 之间，当前为 {cols}"})
    # 行长度一致性 + 格值校验（cells 只允许 0/1）
    for r, row in enumerate(req.grid):
        if len(row) != cols:
            raise HTTPException(status_code=400, detail={"code": "INVALID_SIZE",
                                                         "message": f"第 {r} 行长度为 {len(row)}，与列数 {cols} 不一致"})
        for c, v in enumerate(row):
            if v not in (0, 1):
                raise HTTPException(status_code=400, detail={"code": "INVALID_CELL",
                                                             "message": f"({r},{c}) 格值 {v} 非法，只能为 0（空地）或 1（障碍）"})

    # 2) 出口校验：至少一个、位置合法
    if not req.exits:
        raise HTTPException(status_code=400, detail={"code": "NO_EXIT", "message": "至少需要一个出口"})
    exits: list[tuple[int, int]] = []
    for i, p in enumerate(req.exits):
        err = _check_position(p, rows, cols, req.grid, "出口", i)
        if err:
            raise HTTPException(status_code=400, detail=err)
        exits.append((int(p.row), int(p.col)))

    # 3) 人员校验：至少一个、位置合法、密度不超过空地数
    if not req.agents:
        raise HTTPException(status_code=400, detail={"code": "NO_AGENT", "message": "至少需要一名人员"})
    free_cells = sum(v == 0 for row in req.grid for v in row)
    if len(req.agents) > free_cells:
        raise HTTPException(status_code=400, detail={"code": "OVERCROWDED",
                                                     "message": f"人员数 {len(req.agents)} 超过空地格数 {free_cells}"})
    agents: list[tuple[int, int]] = []
    for i, p in enumerate(req.agents):
        err = _check_position(p, rows, cols, req.grid, "人员", i)
        if err:
            raise HTTPException(status_code=400, detail=err)
        agents.append((int(p.row), int(p.col)))

    # 4) 计算路径 + 距离场（只统计算法耗时，不含校验）
    t0 = time.perf_counter()
    agent_paths, dist_field = algo.compute_paths(rows, cols, req.grid, exits, agents, req.algorithm)
    cost_ms = (time.perf_counter() - t0) * 1000.0

    # 5) 汇总统计：不可达者路径为空数组；平均/最长路径只统计可达人员
    paths_out: list[list[dict]] = []
    lengths: list[int] = []
    exit_counts: dict[tuple[int, int], int] = {}
    for path in agent_paths:
        if path is None:
            paths_out.append([])
            continue
        paths_out.append([{"row": r, "col": c} for r, c in path])
        lengths.append(len(path) - 1)  # 步数 = 格子数 - 1
        # 出口归属：路径终点归到「最近的出口格」（SFM 终点为连续浮点坐标，需就近归并）
        last = path[-1]
        exit_key = min(exits, key=lambda e: abs(e[0] - last[0]) + abs(e[1] - last[1]))
        exit_counts[exit_key] = exit_counts.get(exit_key, 0) + 1

    reachable = len(lengths)
    stats = Stats(
        totalSteps=max(lengths) if lengths else 0,  # makespan：最后一人撤离步数
        avgPathLength=round(sum(lengths) / reachable, 2) if lengths else 0.0,
        maxPathLength=max(lengths) if lengths else 0,
        unreachableCount=len(agents) - reachable,
        # 全部出口都返回（未使用的 count=0），便于前端完整展示分流
        exitDistribution=[ExitCount(row=r, col=c, count=exit_counts.get((r, c), 0))
                          for r, c in sorted(exits)],
    )
    return SimulateResponse(
        agentPaths=paths_out,
        stats=stats,
        distanceField=dist_field,
        computationTime=round(cost_ms, 2),
    )


if __name__ == "__main__":
    # 直接 `python -m app.main` 启动调试（等价于 uvicorn 命令）
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
