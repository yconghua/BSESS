# -*- coding: utf-8 -*-
"""疏散路径算法核心（全部基于 4 邻接等权网格）。

对外只暴露 compute_paths() 一个入口，/simulate 通过它计算全体人员路径。
距离类算法在 4 邻接等权网格上的最短路径「代价一致」，差异仅在计算方式与速度：
  - distanceField 多源距离场：一次反向 BFS 服务所有人员（v1 默认推荐，效率最高）
  - bfs           单源 BFS   ：逐人搜索，教学演示
  - dijkstra      多源 Dijkstra：优先队列版本，有权图通用，等权下与距离场等价
  - astar         多目标 A* ：启发式 = 到最近出口的曼哈顿距离，搜索范围最小
  - ca            CA 元胞自动机（M3）：静态距离场梯度 + 同格冲突消解，呈现排队与绕行
  - sfm           社交力模型（V2）：连续坐标下的 Helbing 简化版，可呈现密度与拥挤现象
"""

from collections import deque
import heapq
import math
import random

# 4 邻接方向：上、右、下、左（固定顺序，保证平局选路时结果确定性）
DIRS = [(-1, 0), (0, 1), (1, 0), (0, -1)]

# 不可达标记：远大于任何真实步数；前端渲染热力图时可把大值视为「不可达」
INF = 10 ** 9


# ---------------------------------------------------------------------------
# 距离场类算法
# ---------------------------------------------------------------------------
def compute_distance_field(rows: int, cols: int, cells: list[list[int]],
                           exits: list[tuple[int, int]]) -> list[list[int]]:
    """多源 BFS 距离场：从所有出口同时出发，计算每个空地格到最近出口的步数。

    出口格本身为 0，障碍格保持 INF，不可达空地格保持 INF。
    一次计算即可服务所有人员，复杂度 O(rows*cols)。
    """
    dist = [[INF] * cols for _ in range(rows)]
    queue = deque()
    for r, c in exits:
        dist[r][c] = 0
        queue.append((r, c))
    while queue:
        r, c = queue.popleft()
        for dr, dc in DIRS:
            nr, nc = r + dr, c + dc
            # 只扩展空地格（cells==0），障碍物天然不可入
            if 0 <= nr < rows and 0 <= nc < cols and cells[nr][nc] == 0 and dist[nr][nc] == INF:
                dist[nr][nc] = dist[r][c] + 1
                queue.append((nr, nc))
    return dist


def dijkstra_distance_field(rows: int, cols: int, cells: list[list[int]],
                            exits: list[tuple[int, int]]) -> list[list[int]]:
    """多源 Dijkstra：与多源 BFS 在等权网格上结果一致，保留作教学对照。

    用优先队列按代价出队，可扩展到非等权（如通道宽度、密度代价）场景。
    """
    dist = [[INF] * cols for _ in range(rows)]
    heap = []
    for r, c in exits:
        dist[r][c] = 0
        heapq.heappush(heap, (0, r, c))
    while heap:
        d, r, c = heapq.heappop(heap)
        if d > dist[r][c]:  # 过期条目，跳过
            continue
        for dr, dc in DIRS:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and cells[nr][nc] == 0:
                nd = d + 1
                if nd < dist[nr][nc]:
                    dist[nr][nc] = nd
                    heapq.heappush(heap, (nd, nr, nc))
    return dist


def extract_path_gradient(rows: int, cols: int, dist: list[list[int]],
                          start: tuple[int, int]) -> list[tuple[int, int]] | None:
    """沿距离场梯度下降取路径：每步走向距离更小的邻居。

    多源 BFS/Dijkstra 的距离场保证：只要可达，最短路径上必有距离 -1 的邻居，
    因此逐格下降即可得到一条最短路径。存在多条等长路径时按 DIRS 固定顺序
    取第一个最小邻居，保证结果确定、可复现。
    返回 None 表示起点不可达（dist 为 INF）。
    """
    r, c = start
    if dist[r][c] == INF:
        return None
    path = [start]
    while dist[r][c] > 0:  # dist==0 即到达出口
        best = None
        for dr, dc in DIRS:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and dist[nr][nc] < dist[r][c]:
                if best is None or dist[nr][nc] < dist[best[0]][best[1]]:
                    best = (nr, nc)
        if best is None:  # 防御性兜底：理论上不会发生
            return None
        path.append(best)
        r, c = best
    return path


# ---------------------------------------------------------------------------
# 逐人搜索类算法
# ---------------------------------------------------------------------------
def bfs_path(rows: int, cols: int, cells: list[list[int]],
             exits_set: set[tuple[int, int]], start: tuple[int, int]) -> list[tuple[int, int]] | None:
    """单源 BFS：从起点逐层扩展，首次碰到任一出口即回溯路径（教学演示用）。

    无权网格下 BFS 得到的就是最短路径（步数最少）。
    """
    r, c = start
    if (r, c) in exits_set:  # 起点即出口，路径只有一格
        return [start]
    queue = deque([(r, c)])
    came: dict[tuple[int, int], tuple[int, int] | None] = {(r, c): None}  # 前驱表
    while queue:
        cr, cc = queue.popleft()
        for dr, dc in DIRS:
            nr, nc = cr + dr, cc + dc
            if 0 <= nr < rows and 0 <= nc < cols and cells[nr][nc] == 0 and (nr, nc) not in came:
                came[(nr, nc)] = (cr, cc)
                if (nr, nc) in exits_set:
                    # 命中出口：沿前驱表回溯生成路径
                    path = [(nr, nc)]
                    cur = (nr, nc)
                    while came[cur] is not None:
                        cur = came[cur]
                        path.append(cur)
                    path.reverse()
                    return path
                queue.append((nr, nc))
    return None  # 队列耗尽仍未命中出口 → 不可达


def astar_path(rows: int, cols: int, cells: list[list[int]],
               exits_set: set[tuple[int, int]], start: tuple[int, int]) -> list[tuple[int, int]] | None:
    """多目标 A*：启发式取「到任一出口的曼哈顿距离」的最小值。

    该启发式可采纳（不高估真实代价），因此首次弹出的出口即最短路径。
    与距离场相比只搜索必要区域，在大网格上更快；多出口时自动选最近出口。
    """
    def heuristic(r: int, c: int) -> int:
        # 到最近出口的曼哈顿距离（4 邻接单步代价为 1，可采纳）
        return min(abs(r - er) + abs(c - ec) for er, ec in exits_set)

    r0, c0 = start
    if (r0, c0) in exits_set:
        return [start]
    # 堆元素：(f, g, r, c)，f = g + h；g 相同时按坐标排序保证确定性
    heap = [(heuristic(r0, c0), 0, r0, c0)]
    g_score = {(r0, c0): 0}
    came: dict[tuple[int, int], tuple[int, int] | None] = {(r0, c0): None}
    while heap:
        _, g_cur, r, c = heapq.heappop(heap)
        if g_cur > g_score.get((r, c), INF):  # 过期条目
            continue
        if (r, c) in exits_set:  # 首次弹出出口即最优
            path = [(r, c)]
            cur = (r, c)
            while came[cur] is not None:
                cur = came[cur]
                path.append(cur)
            path.reverse()
            return path
        for dr, dc in DIRS:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and cells[nr][nc] == 0:
                ng = g_cur + 1
                if ng < g_score.get((nr, nc), INF):
                    g_score[(nr, nc)] = ng
                    came[(nr, nc)] = (r, c)
                    heapq.heappush(heap, (ng + heuristic(nr, nc), ng, nr, nc))
    return None  # 不可达


# ---------------------------------------------------------------------------
# CA 元胞自动机（M3：多智能体实时冲突）
# ---------------------------------------------------------------------------
def ca_simulate(rows: int, cols: int, cells: list[list[int]],
                exits: list[tuple[int, int]], agents: list[tuple[int, int]],
                dist_field: list[list[int]], max_steps_ratio: int = 8,
                seed: int = 42) -> list[list[tuple[int, int]]]:
    """    CA 步进疏散：静态距离场梯度 + 同格冲突消解（M3 基础版）。

    每步每个未撤离人员：
      1. 在 4 邻域中按距离场取「距离更小」的候选格（由近到远，等距随机打乱）；
      2. 依次尝试候选格：选择第一个「本步尚未被占据」的格进入；全部被占则原地等待。
    同格禁止叠人（等待者也占格），每步随机化处理顺序 → 冲突公平消解。
    等待时把当前位置重复记入轨迹：路径长度 = 真实疏散步数（含排队等待），
    前端动画因此能看到「原地不动」的排队效果，统计 makespan 也是真实疏散时长。

    步数上限 = 最长最短路 × max_steps_ratio，防止极端场景死循环；
    超限仍未撤离者返回 None（不可达，由调用方统计）。
    """
    rng = random.Random(seed)  # 固定种子，结果可复现
    pos = {i: list(agents[i]) for i in range(len(agents))}
    done = [False] * len(agents)
    # 每人轨迹：先记录起点；每步移动或等待都追加当前位置
    paths: list[list[tuple[int, int]]] = [[tuple(agents[i])] for i in range(len(agents))]

    max_shortest = max((dist_field[r][c] for r, c in agents), default=0)
    if max_shortest == 0:
        # 全员已在出口
        return paths
    max_steps = max_shortest * max_steps_ratio

    for _ in range(max_steps):
        remaining = [i for i in range(len(agents)) if not done[i]]
        if not remaining:
            break
        # 每步开始时，所有未撤离者的当前位置都视为「被占据」（等待者也占格，禁止叠人）
        occupied: set[tuple[int, int]] = {tuple(pos[i]) for i in remaining}
        rng.shuffle(remaining)  # 随机处理顺序 → 同格冲突公平消解
        for i in remaining:
            r, c = pos[i]
            if dist_field[r][c] == 0:  # 已到出口格 → 撤离（释放格子）
                done[i] = True
                occupied.discard((r, c))
                continue
            # 候选：距离更小的邻格，按 (距离, 随机键) 排序 → 等距候选随机打乱
            candidates = []
            for dr, dc in DIRS:
                nr, nc = r + dr, c + dc
                if 0 <= nr < rows and 0 <= nc < cols and cells[nr][nc] == 0 and dist_field[nr][nc] < dist_field[r][c]:
                    candidates.append((nr, nc))
            if not candidates:
                paths[i].append((r, c))  # 防御兜底：原地
                continue
            candidates.sort(key=lambda p: (dist_field[p[0]][p[1]], rng.random()))
            # 依次尝试：第一个未被占据的候选格进入；全被占则原地等待（继续占住原格）
            moved = False
            for nr, nc in candidates:
                if (nr, nc) not in occupied:
                    occupied.discard((r, c))  # 离开原格
                    occupied.add((nr, nc))    # 占据目标格
                    pos[i] = [nr, nc]
                    paths[i].append((nr, nc))
                    moved = True
                    break
            if not moved:
                paths[i].append((r, c))  # 等待：重复当前位置（计入疏散时间）
    # 超限仍未撤离 → 视为不可达（轨迹丢弃，与其它算法口径一致）
    return [paths[i] if done[i] else None for i in range(len(agents))]
    # 超限未撤离：按不可达处理（调用方统计时计入 unreachableCount）
    return paths


# ---------------------------------------------------------------------------
# SFM 社交力模型（V2：连续空间疏散仿真）
# ---------------------------------------------------------------------------
def sfm_simulate(rows: int, cols: int, cells: list[list[int]],
                 exits: list[tuple[int, int]], agents: list[tuple[int, int]],
                 dist_field: list[list[int]],
                 v0: float = 1.2, tau: float = 0.5, body_r: float = 0.28,
                 A: float = 4.0, B: float = 0.5, dt: float = 0.1,
                 max_time: float = 120.0, seed: int = 7) -> list[list[tuple[float, float]] | None]:
    """社交力模型（Helbing 简化版）：连续坐标下的多智能体疏散仿真。

    每个行人受三种力（坐标直接用 grid 坐标系，1 格 = 1 单位，位置为浮点）：
      - 期望力  F_des = (v0 * 目标方向 - v) / τ：
          目标方向取「距离场负梯度」——即走向距离更小的邻格中心，
          能自动绕开障碍；已在出口格时直接朝出口格中心。
      - 障碍排斥力：行人距障碍格中心过近时产生短程排斥（A·exp(-d/B)）；
      - 人际排斥力：两人距离 < 2·body_r 时互相排斥（避免穿模）。
      另加小随机扰动模拟个体差异。到达出口格（dist==0）中心附近即撤离。

    输出：每人一条连续轨迹（每 2 个仿真步记录一个浮点坐标点，控制体积）；
    超时（max_time）未撤离返回 None。
    """
    rng = random.Random(seed)
    exits_set = set(exits)
    exit_centers = [(c + 0.5, r + 0.5) for r, c in exits]  # 出口格中心 (x, y)

    def nearest_exit_center(x: float, y: float) -> tuple[float, float]:
        return min(exit_centers, key=lambda e: (e[0] - x) ** 2 + (e[1] - y) ** 2)

    def gradient_dir(x: float, y: float) -> tuple[float, float] | None:
        """距离场负梯度方向：指向 4 邻格中 dist 最小的那个格中心；None 表示已在出口格。"""
        r, c = int(y), int(x)
        best = None
        best_d = dist_field[r][c]
        for dr, dc in DIRS:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and dist_field[nr][nc] < best_d:
                best_d = dist_field[nr][nc]
                best = (nr, nc)
        if best is None:
            return None
        return (best[1] + 0.5 - x, best[0] + 0.5 - y)  # (dx, dy)

    # 行人状态：位置 (x, y) 与速度 (vx, vy)
    pos = [[c + 0.5, r + 0.5] for r, c in agents]
    vel = [[0.0, 0.0] for _ in agents]
    done = [False] * len(agents)
    # 轨迹：起点（浮点，统一为 (row, col) 顺序）；每 2 步记录一个点
    paths: list[list[tuple[float, float]]] = [[(pos[i][1], pos[i][0])] for i in range(len(agents))]

    max_steps = int(max_time / dt)
    for step in range(max_steps):
        remaining = [i for i in range(len(agents)) if not done[i]]
        if not remaining:
            break
        for i in remaining:
            x, y = pos[i]
            vx, vy = vel[i]
            r, c = int(y), int(x)
            # 已到出口格中心附近 → 撤离
            if dist_field[r][c] == 0:
                ex, ey = nearest_exit_center(x, y)
                if (x - ex) ** 2 + (y - ey) ** 2 < 0.36:  # 半径 0.6 内
                    done[i] = True
                    continue

            # 1) 期望力
            d = gradient_dir(x, y)
            if d is None:
                ex, ey = nearest_exit_center(x, y)
                d = (ex - x, ey - y)
            dl = (d[0] ** 2 + d[1] ** 2) ** 0.5 or 1.0
            des = (d[0] / dl, d[1] / dl)
            fx = (v0 * des[0] - vx) / tau
            fy = (v0 * des[1] - vy) / tau

            # 2) 障碍排斥：只检查周围 5×5 范围内的障碍格（性能剪枝）
            for oy in range(max(0, r - 2), min(rows, r + 3)):
                for ox in range(max(0, c - 2), min(cols, c + 3)):
                    if cells[oy][ox] != 1:
                        continue
                    oxx, oyy = ox + 0.5, oy + 0.5
                    dx, dy = x - oxx, y - oyy
                    d2 = dx * dx + dy * dy
                    if d2 < 1.0 and d2 > 1e-9:
                        dlen = d2 ** 0.5
                        mag = A * math.exp(-(dlen - body_r) / B)
                        fx += mag * dx / dlen
                        fy += mag * dy / dlen

            # 3) 人际排斥（暴力两两，人数通常 < 500 可接受）
            for j in remaining:
                if j == i or done[j]:
                    continue
                dx = x - pos[j][0]
                dy = y - pos[j][1]
                d2 = dx * dx + dy * dy
                if d2 < (2 * body_r) ** 2 and d2 > 1e-9:
                    dlen = d2 ** 0.5
                    mag = A * math.exp(-(dlen - 2 * body_r) / B)
                    fx += mag * dx / dlen
                    fy += mag * dy / dlen

            # 4) 随机扰动（个体差异）
            fx += rng.uniform(-0.2, 0.2)
            fy += rng.uniform(-0.2, 0.2)

            # 5) 更新速度与位置（欧拉积分），并约束在网格范围内
            vx = vx + fx * dt
            vy = vy + fy * dt
            x = min(max(x + vx * dt, 0.0), cols)
            y = min(max(y + vy * dt, 0.0), rows)
            pos[i] = [x, y]
            vel[i] = [vx, vy]

            # 每 2 个仿真步记录一个轨迹点（dt=0.1 → 每 0.2s 一点），统一 (row, col) 顺序
            if step % 2 == 0:
                paths[i].append((y, x))

    return [paths[i] if done[i] else None for i in range(len(agents))]


# ---------------------------------------------------------------------------
# 统一入口
# ---------------------------------------------------------------------------
def compute_paths(rows: int, cols: int, cells: list[list[int]],
                  exits: list[tuple[int, int]], agents: list[tuple[int, int]],
                  algorithm: str) -> tuple[list[list[tuple[int, int]] | None], list[list[int]]]:
    """计算全体人员路径，并附带多源距离场（供热力图叠加）。

    返回 (agent_paths, dist_field)：
      agent_paths[i] = [(row,col), ...]（含起点与出口格）或 None（不可达）
      dist_field     = 多源 BFS 距离场，所有算法统一返回
    """
    # 距离场始终计算一次：既供 distanceField 算法本身使用，也供热力图展示
    dist_field = compute_distance_field(rows, cols, cells, exits)
    exits_set = set(exits)

    if algorithm == "distanceField":
        paths = [extract_path_gradient(rows, cols, dist_field, a) for a in agents]
    elif algorithm == "bfs":
        paths = [bfs_path(rows, cols, cells, exits_set, a) for a in agents]
    elif algorithm == "dijkstra":
        dfield = dijkstra_distance_field(rows, cols, cells, exits)
        paths = [extract_path_gradient(rows, cols, dfield, a) for a in agents]
    elif algorithm == "astar":
        paths = [astar_path(rows, cols, cells, exits_set, a) for a in agents]
    elif algorithm == "ca":
        paths = ca_simulate(rows, cols, cells, exits, agents, dist_field)
    elif algorithm == "sfm":
        paths = sfm_simulate(rows, cols, cells, exits, agents, dist_field)
    else:  # 请求体的 Literal 已约束，此处仅防御
        raise ValueError(f"未知算法: {algorithm}")
    return paths, dist_field
