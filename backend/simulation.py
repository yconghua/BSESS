# simulation.py
# 功能：实现完整的疏散仿真算法，包括：
#   - 多源 BFS 距离场
#   - A* 路径规划（8 邻域）
#   - 速度场（密度影响速度）
#   - 社会力模型（自驱、人际排斥、墙壁排斥）
#   - 分批释放
#   - 统计输出（疏散时间、流量、热力图、瓶颈）

import math
import heapq
import numpy as np
from typing import List, Tuple, Dict
from models import (
    SimulationRequest, SimulationResult, PersonResult,
    TrajectoryPoint, ExitFlowCurve
)
from config import SIMULATION_CONFIG

class EvacuationSimulator:
    """
    疏散仿真器主类
    接收仿真请求，执行仿真并返回结果
    """

    def __init__(self, request: SimulationRequest):
        """初始化：复制地图、初始化人员、计算距离场和路径"""
        self.request = request
        self.grid = [row[:] for row in request.grid]          # 深拷贝地图
        self.rows = len(self.grid)
        self.cols = len(self.grid[0]) if self.rows > 0 else 0
        self.cell_size = request.grid_cell_size or SIMULATION_CONFIG["grid_cell_size"]
        self.exits = request.exits

        # ---------- 内部状态 ----------
        self.persons = []                 # 存储每个人员的内部状态（字典）
        self.flow_data = {f"exit_{i}": {"times": [], "counts": 0} for i in range(len(self.exits))}
        self.time = 0.0                   # 当前仿真时间
        self.dt = SIMULATION_CONFIG["time_step"]
        self.max_time = SIMULATION_CONFIG["max_simulation_time"]
        self.exit_threshold = SIMULATION_CONFIG["exit_reach_threshold"]
        self.social_params = SIMULATION_CONFIG["social_force"]
        self.speed_params = SIMULATION_CONFIG["speed_field"]
        self.bottleneck_params = SIMULATION_CONFIG["bottleneck"]

        # 初始化人员并分配最近出口
        self._init_persons()
        # 计算距离场（用于引导和速度场）
        self.distance_field = self._compute_distance_field()
        # 为每个人员计算 A* 路径
        self._compute_all_paths()

    # ---------- 初始化 ----------
    def _init_persons(self):
        """将请求中的人员数据转换为内部字典，并分配最近的出口"""
        for idx, p in enumerate(self.request.persons):
            # 计算到各个出口的距离，选择最近的
            distances = [math.hypot(p.x - ex[0], p.y - ex[1]) for ex in self.exits]
            assigned_idx = min(range(len(distances)), key=lambda i: distances[i])
            assigned_exit = self.exits[assigned_idx]
            self.persons.append({
                "id": idx,
                "pos": np.array([p.x, p.y], dtype=float),      # 当前位置
                "vel": np.array([0.0, 0.0], dtype=float),      # 当前速度
                "desired_speed": p.desired_speed if p.desired_speed is not None else SIMULATION_CONFIG["default_desired_speed"],
                "release_delay": p.release_delay,              # 释放延迟
                "assigned_exit_idx": assigned_idx,
                "assigned_exit_coord": assigned_exit,
                "path": None,                                  # 路径点列表（物理坐标）
                "path_index": 0,                               # 当前目标点索引
                "exit_time": -1.0,                             # 到达出口时间，-1未到达
                "trajectory": [],                              # 轨迹记录 [(time, x, y), ...]
                "released": False,                             # 是否已释放
            })

    # ---------- 距离场（多源 BFS） ----------
    def _compute_distance_field(self) -> np.ndarray:
        """
        使用多源广度优先搜索，计算每个网格到最近出口的步数距离
        返回值：二维数组，值为距离（网格数），无穷大表示不可达
        """
        dist = np.full((self.rows, self.cols), np.inf)
        queue = []
        # 将所有出口映射到网格坐标并作为初始源
        for ex in self.exits:
            gx = int(round(ex[0] / self.cell_size))
            gy = int(round(ex[1] / self.cell_size))
            if 0 <= gx < self.cols and 0 <= gy < self.rows and self.grid[gy][gx] == 0:
                dist[gy][gx] = 0
                queue.append((0, gy, gx))
        # 四方向 BFS（因为距离场只需要步数，不要求斜向）
        dirs = [(1,0),(-1,0),(0,1),(0,-1)]
        while queue:
            d, y, x = heapq.heappop(queue)
            if d > dist[y][x]:
                continue
            for dy, dx in dirs:
                ny, nx = y+dy, x+dx
                if 0 <= ny < self.rows and 0 <= nx < self.cols and self.grid[ny][nx] == 0:
                    nd = d + 1
                    if nd < dist[ny][nx]:
                        dist[ny][nx] = nd
                        heapq.heappush(queue, (nd, ny, nx))
        return dist

    # ---------- A* 路径规划 ----------
    def _astar_path(self, start_grid: Tuple[int, int], goal_grid: Tuple[int, int]) -> List[Tuple[float, float]]:
        """
        A* 算法，返回从起点到终点的物理坐标路径（平滑点序列）
        支持 8 邻域移动，启发式函数为欧几里得距离
        """
        sy, sx = start_grid
        gy, gx = goal_grid
        # 校验起点终点是否合法
        if not (0 <= sy < self.rows and 0 <= sx < self.cols and self.grid[sy][sx] == 0):
            return []
        if not (0 <= gy < self.rows and 0 <= gx < self.cols and self.grid[gy][gx] == 0):
            return []

        open_set = []
        heapq.heappush(open_set, (0, sy, sx))
        came_from = {}
        g_score = {(sy, sx): 0}
        f_score = {(sy, sx): math.hypot(sy-gy, sx-gx)}

        dirs = [(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)]
        while open_set:
            _, y, x = heapq.heappop(open_set)
            if (y, x) == (gy, gx):
                # 重建路径（网格坐标）
                path_grid = []
                cur = (gy, gx)
                while cur in came_from:
                    path_grid.append(cur)
                    cur = came_from[cur]
                path_grid.append((sy, sx))
                path_grid.reverse()
                # 转换为物理坐标（网格中心）
                phys_path = []
                for py, px in path_grid:
                    phys_path.append((px * self.cell_size + self.cell_size/2,
                                      py * self.cell_size + self.cell_size/2))
                return phys_path

            for dy, dx in dirs:
                ny, nx = y+dy, x+dx
                if 0 <= ny < self.rows and 0 <= nx < self.cols and self.grid[ny][nx] == 0:
                    move_cost = math.hypot(dy, dx)   # 对角线代价 √2
                    tentative_g = g_score[(y,x)] + move_cost
                    if tentative_g < g_score.get((ny,nx), float('inf')):
                        came_from[(ny,nx)] = (y,x)
                        g_score[(ny,nx)] = tentative_g
                        f = tentative_g + math.hypot(ny-gy, nx-gx)
                        f_score[(ny,nx)] = f
                        heapq.heappush(open_set, (f, ny, nx))
        return []   # 无路径

    def _compute_all_paths(self):
        """为所有人员计算 A* 路径，若失败则用直线降级"""
        for p in self.persons:
            sx = int(p["pos"][0] / self.cell_size)
            sy = int(p["pos"][1] / self.cell_size)
            ex, ey = p["assigned_exit_coord"]
            gx = int(ex / self.cell_size)
            gy = int(ey / self.cell_size)
            path = self._astar_path((sy, sx), (gy, gx))
            if not path:
                # 降级：起点到出口的直线（保证至少有两个点）
                path = [(float(p["pos"][0]), float(p["pos"][1])), (ex, ey)]
            p["path"] = path
            p["path_index"] = 0

    # ---------- 密度与速度场 ----------
    def _compute_density_grid(self) -> np.ndarray:
        """计算当前每个网格的人员密度（人/平方米）"""
        density = np.zeros((self.rows, self.cols))
        cell_area = self.cell_size * self.cell_size
        for p in self.persons:
            if p["exit_time"] >= 0 or not p["released"]:
                continue
            x, y = p["pos"]
            gx = int(x / self.cell_size)
            gy = int(y / self.cell_size)
            if 0 <= gy < self.rows and 0 <= gx < self.cols:
                density[gy][gx] += 1.0 / cell_area
        return density

    def _compute_speed_factor_grid(self, density_grid: np.ndarray) -> np.ndarray:
        """根据密度计算速度衰减因子网格"""
        sigma = self.speed_params["sigma"]
        min_factor = self.speed_params["min_speed_factor"]
        factor = np.exp(-density_grid * sigma)
        factor = np.maximum(factor, min_factor)
        return factor

    # ---------- 单步社会力更新 ----------
    def _single_social_force_step(self, p: dict, density_grid: np.ndarray, speed_factor_grid: np.ndarray):
        """
        对单个人员执行一步社会力模型更新（欧拉积分）
        包括：自驱动力、人际排斥力、墙壁排斥力
        """
        if p["exit_time"] >= 0 or not p["released"]:
            return

        pos = p["pos"]
        vel = p["vel"]
        dt = self.dt
        desired_speed = p["desired_speed"]

        # ----- 1. 速度场影响（根据所在网格密度） -----
        gx = int(pos[0] / self.cell_size)
        gy = int(pos[1] / self.cell_size)
        if 0 <= gy < self.rows and 0 <= gx < self.cols:
            speed_factor = speed_factor_grid[gy][gx]
        else:
            speed_factor = 0.5

        # ----- 2. 路径跟随（目标点） -----
        path = p["path"]
        target_idx = min(p["path_index"], len(path)-1)
        target = np.array(path[target_idx])

        # 如果已到达最后一个点（出口），检查是否到达出口
        if target_idx == len(path)-1:
            dist_to_exit = np.linalg.norm(pos - target)
            if dist_to_exit < self.exit_threshold:
                p["exit_time"] = self.time
                exit_idx = p["assigned_exit_idx"]
                self.flow_data[f"exit_{exit_idx}"]["times"].append(self.time)
                self.flow_data[f"exit_{exit_idx}"]["counts"] += 1
                return

        # 计算指向目标点的方向
        dir_vec = target - pos
        dist_to_target = np.linalg.norm(dir_vec)
        if dist_to_target < 1e-6:   # 到达当前目标点，切换到下一个
            if p["path_index"] < len(path)-1:
                p["path_index"] += 1
            target_idx = min(p["path_index"], len(path)-1)
            target = np.array(path[target_idx])
            dir_vec = target - pos
            dist_to_target = np.linalg.norm(dir_vec)

        if dist_to_target > 0:
            desired_dir = dir_vec / dist_to_target
        else:
            desired_dir = np.array([0.0, 0.0])

        # ----- 3. 自驱动力（期望速度与实际速度之差 / 松弛时间） -----
        desired_vel = desired_dir * desired_speed * speed_factor
        force_drive = (desired_vel - vel) / 0.5   # 松弛时间 0.5s

        # ----- 4. 人际排斥力（社会力模型） -----
        force_social = np.array([0.0, 0.0])
        A = self.social_params["A"]
        B = self.social_params["B"]
        rep_threshold = self.social_params["repulsion_threshold"]
        for other in self.persons:
            if other["id"] == p["id"] or other["exit_time"] >= 0 or not other["released"]:
                continue
            delta = pos - other["pos"]
            dist = np.linalg.norm(delta)
            if dist < rep_threshold and dist > 1e-6:
                magnitude = A * math.exp(-dist / B)
                force_social += magnitude * (delta / dist)

        # ----- 5. 墙壁排斥力（基于最近障碍物） -----
        force_wall = np.array([0.0, 0.0])
        wall_strength = self.social_params["wall_repulsion_strength"]
        wall_scale = self.social_params["wall_distance_scale"]
        min_wall_dist = float('inf')
        wall_dir = np.array([0.0, 0.0])
        gx = int(pos[0] / self.cell_size)
        gy = int(pos[1] / self.cell_size)
        # 检查周围 3x3 邻域是否有障碍物
        for dy in [-1, 0, 1]:
            for dx in [-1, 0, 1]:
                if dy == 0 and dx == 0:
                    continue
                ny, nx = gy+dy, gx+dx
                if 0 <= ny < self.rows and 0 <= nx < self.cols:
                    if self.grid[ny][nx] == 1:
                        obs_center = np.array([nx*self.cell_size + self.cell_size/2,
                                               ny*self.cell_size + self.cell_size/2])
                        delta = pos - obs_center
                        dist = np.linalg.norm(delta)
                        if dist < min_wall_dist:
                            min_wall_dist = dist
                            wall_dir = delta / (dist + 1e-6)
        if min_wall_dist < wall_scale and np.linalg.norm(wall_dir) > 0:
            magnitude = wall_strength * math.exp(-min_wall_dist / wall_scale)
            force_wall = magnitude * wall_dir

        # ----- 6. 合力和更新 -----
        total_force = force_drive + force_social + force_wall
        new_vel = vel + total_force * dt
        # 限制速度上限（不超过期望速度的 1.3 倍）
        speed = np.linalg.norm(new_vel)
        max_speed = desired_speed * 1.3
        if speed > max_speed:
            new_vel = new_vel / speed * max_speed

        new_pos = pos + new_vel * dt

        # 碰撞检测：若新位置进入障碍物，则回退并速度归零
        test_gx = int(new_pos[0] / self.cell_size)
        test_gy = int(new_pos[1] / self.cell_size)
        if 0 <= test_gy < self.rows and 0 <= test_gx < self.cols and self.grid[test_gy][test_gx] == 1:
            new_pos = pos
            new_vel = np.array([0.0, 0.0])

        p["pos"] = new_pos
        p["vel"] = new_vel

        # 记录轨迹（每 0.1 秒记录一次，减少数据量）
        if len(p["trajectory"]) == 0 or self.time - p["trajectory"][-1][0] >= 0.1:
            p["trajectory"].append((self.time, float(new_pos[0]), float(new_pos[1])))

    # ---------- 瓶颈提取（简化版） ----------
    def _extract_bottlenecks(self) -> List[Tuple[int, int]]:
        """返回最终密度超过阈值的网格坐标（最多10个），作为潜在瓶颈"""
        density_grid = self._compute_density_grid()
        threshold = self.bottleneck_params["density_threshold"]
        nodes = []
        for y in range(self.rows):
            for x in range(self.cols):
                if density_grid[y][x] > threshold:
                    nodes.append((y, x))
        return nodes[:10]

    # ---------- 主仿真循环 ----------
    def run(self) -> SimulationResult:
        """
        执行完整的仿真循环，直到所有人员到达出口或超时。
        返回 SimulationResult 对象。
        """
        # 记录初始位置
        for p in self.persons:
            p["trajectory"].append((0.0, float(p["pos"][0]), float(p["pos"][1])))

        active_count = len(self.persons)
        density_snapshots = []      # 存储密度快照用于热力图
        last_snapshot_time = -1.0

        while self.time < self.max_time and active_count > 0:
            self.time += self.dt

            # 检查人员释放（分批释放）
            for p in self.persons:
                if not p["released"] and self.time >= p["release_delay"]:
                    p["released"] = True

            # 计算密度和速度场
            density_grid = self._compute_density_grid()
            speed_factor_grid = self._compute_speed_factor_grid(density_grid)

            # 每秒记录一张密度快照
            if self.time - last_snapshot_time >= 1.0:
                density_snapshots.append({
                    "time": self.time,
                    "data": density_grid.tolist()
                })
                last_snapshot_time = self.time

            # 更新所有活跃人员
            for p in self.persons:
                self._single_social_force_step(p, density_grid, speed_factor_grid)

            # 更新活跃人数
            active_count = sum(1 for p in self.persons if p["exit_time"] < 0 and p["released"])

        # 处理未到达的人员（标记为 -1）
        for p in self.persons:
            if p["exit_time"] < 0:
                p["exit_time"] = -1.0

        # 计算总疏散时间
        arrived_times = [p["exit_time"] for p in self.persons if p["exit_time"] >= 0]
        total_time = max(arrived_times) if arrived_times else -1.0

        # 构造出口流量曲线
        flow_curves = {}
        for key, data in self.flow_data.items():
            times = data["times"]
            cum = []
            cnt = 0
            for t in sorted(times):
                cnt += 1
                cum.append(cnt)
            flow_curves[key] = ExitFlowCurve(
                times=sorted(times),
                cumulative_counts=cum
            )

        # 构造人员结果
        person_results = []
        for p in self.persons:
            traj = [TrajectoryPoint(time=t, x=x, y=y) for t, x, y in p["trajectory"]]
            person_results.append(PersonResult(
                person_id=p["id"],
                trajectory=traj,
                exit_time=p["exit_time"]
            ))

        bottlenecks = self._extract_bottlenecks()

        return SimulationResult(
            status="success",
            total_evacuation_time=total_time,
            person_results=person_results,
            exit_flow_curves=flow_curves,
            density_heatmaps=density_snapshots if density_snapshots else None,
            bottleneck_nodes=bottlenecks,
            message="Simulation completed"
        )