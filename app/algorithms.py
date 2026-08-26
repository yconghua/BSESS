# -*- coding: utf-8 -*-
"""疏散路径算法核心（全部基于 4 邻接等权网格）。

对外只暴露 compute_paths() 一个入口，/simulate 通过它计算全体人员路径。
四种算法在 4 邻接等权网格上的最短路径「代价一致」，差异仅在计算方式与速度：
  - distanceField 多源距离场：一次反向 BFS 服务所有人员（v1 默认推荐，效率最高）
  - bfs           单源 BFS   ：逐人搜索，教学演示
  - dijkstra      多源 Dijkstra：优先队列版本，有权图通用，等权下与距离场等价
  - astar         多目标 A* ：启发式 = 到最近出口的曼哈顿距离，搜索范围最小
"""

from collections import deque
import heapq

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
# 统一入口
# ---------------------------------------------------------------------------
def compute_paths(rows: int, cols: int, cells: list[list[int]],
                  exits: list[tuple[int, int]], agents: list[tuple[int, int]],
                  algorithm: str) -> tuple[list[list[tuple[int, int]] | None], list[list[int]]]:
    """计算全体人员路径，并附带多源距离场（供热力图叠加）。

    返回 (agent_paths, dist_field)：
      agent_paths[i] = [(row,col), ...]（含起点与出口格）或 None（不可达）
      dist_field     = 多源 BFS 距离场，四种算法统一返回
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
    else:  # 请求体的 Literal 已约束，此处仅防御
        raise ValueError(f"未知算法: {algorithm}")
    return paths, dist_field
