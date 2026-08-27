# main.py
"""
==========================================
疏散仿真系统后端 - FastAPI 服务
==========================================

运行步骤：
1. 进入 backend 目录：
   cd D:................\BSESS\backend

2. 安装依赖（首次运行）：
   pip install -r requirements.txt

3. 启动服务：
   uvicorn main:app --reload --host 127.0.0.1 --port 8000

4. 访问 API 文档：
   http://127.0.0.1:8000/docs

5. 统一测试接口（检查所有功能是否正常）：
   http://127.0.0.1:8000/test
"""

from fastapi import FastAPI, HTTPException
from models import SimulationRequest, SimulationResult
from simulation import EvacuationSimulator
import logging
import time
import numpy as np
from typing import Dict, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="疏散仿真系统 API",
    description="基于社会力模型和 A* 算法的网格疏散仿真后端",
    version="1.0"
)

# ============================================
# 核心仿真接口
# ============================================
@app.post("/simulate", response_model=SimulationResult)
async def simulate(request: SimulationRequest):
    """
    主仿真接口：
    - 输入：网格地图、出口坐标、人员列表（含期望速度和释放延迟）
    - 输出：每个人的轨迹、总疏散时间、出口流量、密度热力图、瓶颈节点
    """
    try:
        logger.info(f"收到仿真请求，人员数量: {len(request.persons)}")
        simulator = EvacuationSimulator(request)
        result = simulator.run()
        return result
    except Exception as e:
        logger.error(f"仿真失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "疏散仿真后端服务正常运行"}

# ============================================
# 统一测试路由（检查所有功能是否正常）
# ============================================
@app.get("/test")
async def test_all() -> Dict[str, Any]:
    """
    统一自检接口：
    依次检查：配置加载、模型导入、地图解析、A* 路径、社会力仿真、结果组装
    返回详细测试报告
    """
    report = {
        "status": "ok",
        "checks": {},
        "summary": ""
    }

    # ---- 1. 检查配置加载 ----
    try:
        from config import SIMULATION_CONFIG
        report["checks"]["config_load"] = {
            "status": "ok",
            "message": f"成功加载配置，时间步长={SIMULATION_CONFIG['time_step']}s"
        }
    except Exception as e:
        report["checks"]["config_load"] = {"status": "fail", "message": str(e)}
        report["status"] = "fail"

    # ---- 2. 检查模型导入 ----
    try:
        from models import SimulationRequest, PersonStart, SimulationResult
        report["checks"]["model_import"] = {"status": "ok", "message": "数据模型导入成功"}
    except Exception as e:
        report["checks"]["model_import"] = {"status": "fail", "message": str(e)}
        report["status"] = "fail"

    # ---- 3. 检查仿真器实例化（使用最小地图） ----
    try:
        test_grid = [[0, 0], [0, 0]]   # 2x2 空地
        test_exits = [(1.5, 1.5)]      # 出口在右下
        test_persons = [PersonStart(x=0.5, y=0.5, desired_speed=1.0, release_delay=0.0)]
        req = SimulationRequest(grid=test_grid, exits=test_exits, persons=test_persons)
        sim = EvacuationSimulator(req)
        report["checks"]["simulator_init"] = {"status": "ok", "message": f"仿真器初始化成功，{len(sim.persons)} 人"}
    except Exception as e:
        report["checks"]["simulator_init"] = {"status": "fail", "message": str(e)}
        report["status"] = "fail"

    # ---- 4. 检查 A* 路径计算 ----
    try:
        path = sim._astar_path((0, 0), (1, 1))
        if path and len(path) >= 2:
            report["checks"]["astar"] = {"status": "ok", "message": f"A* 路径生成成功，路径点数量 {len(path)}"}
        else:
            report["checks"]["astar"] = {"status": "fail", "message": "A* 未返回有效路径"}
            report["status"] = "fail"
    except Exception as e:
        report["checks"]["astar"] = {"status": "fail", "message": str(e)}
        report["status"] = "fail"

    # ---- 5. 检查仿真运行（快速仿真，仅几步） ----
    try:
        # 运行 0.5 秒的仿真，看是否能正常推进
        sim.time = 0.0
        for _ in range(10):  # 10 步
            sim.time += sim.dt
            # 释放人员
            for p in sim.persons:
                if not p["released"] and sim.time >= p["release_delay"]:
                    p["released"] = True
            density = sim._compute_density_grid()
            speed_factor = sim._compute_speed_factor_grid(density)
            for p in sim.persons:
                sim._single_social_force_step(p, density, speed_factor)
        report["checks"]["simulation_run"] = {"status": "ok", "message": "仿真推进 10 步无异常"}
    except Exception as e:
        report["checks"]["simulation_run"] = {"status": "fail", "message": str(e)}
        report["status"] = "fail"

    # ---- 6. 检查结果组装（调用 run 但限制最大时间以避免长时间运行） ----
    try:
        # 创建一个新的模拟器，用完整 run 但设置小地图和短超时
        small_grid = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
        small_exits = [(2.5, 2.5)]
        small_persons = [PersonStart(x=0.5, y=0.5, desired_speed=1.2, release_delay=0.0)]
        req_small = SimulationRequest(grid=small_grid, exits=small_exits, persons=small_persons)
        sim_small = EvacuationSimulator(req_small)
        # 缩短最大时间以快速结束
        sim_small.max_time = 5.0
        result = sim_small.run()
        if result.status == "success" and result.total_evacuation_time >= 0:
            report["checks"]["result_assembly"] = {
                "status": "ok",
                "message": f"结果组装成功，疏散时间 {result.total_evacuation_time:.2f}s，轨迹点总数 {sum(len(p.trajectory) for p in result.person_results)}"
            }
        else:
            report["checks"]["result_assembly"] = {"status": "fail", "message": "结果状态异常"}
            report["status"] = "fail"
    except Exception as e:
        report["checks"]["result_assembly"] = {"status": "fail", "message": str(e)}
        report["status"] = "fail"

    # ---- 汇总 ----
    passed = sum(1 for c in report["checks"].values() if c["status"] == "ok")
    total = len(report["checks"])
    report["summary"] = f"通过 {passed}/{total} 项检查"
    if report["status"] == "ok":
        report["summary"] += " ✅ 所有核心功能正常"
    else:
        report["summary"] += " ⚠️ 部分检查未通过，请查看详情"

    return report