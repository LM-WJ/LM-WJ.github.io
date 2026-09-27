"""
曼德尔球 (Mandelbulb) Python 渲染器
====================================
依赖：pip install numpy matplotlib scipy

用法：
    python mandelbulb_renderer.py
    python mandelbulb_renderer.py --power 8 --iters 10 --res 200
"""

import argparse
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap

# ─────────────────────────────────────────────
# 核心数学：曼德尔球 SDF（有符号距离函数）
# ─────────────────────────────────────────────

def mandelbulb_escape(cx, cy, cz, power=8, max_iter=10, bailout=2.0):
    """
    计算每个点的逃逸迭代次数（向量化版本）。
    返回值：0 = 内部（属于集合），>0 = 逃逸步数（用于着色）
    """
    x, y, z = cx.copy(), cy.copy(), cz.copy()
    escape = np.zeros_like(cx, dtype=np.float32)
    active = np.ones_like(cx, dtype=bool)

    for i in range(1, max_iter + 1):
        r = np.sqrt(x**2 + y**2 + z**2)
        theta = np.arctan2(np.sqrt(x**2 + y**2), z)
        phi   = np.arctan2(y, x)

        rn     = r ** power
        theta_n = theta * power
        phi_n   = phi   * power

        # 新坐标 = 迭代值 + 初始点（类似曼德布洛特集）
        x_new = rn * np.sin(theta_n) * np.cos(phi_n) + cx
        y_new = rn * np.sin(theta_n) * np.sin(phi_n) + cy
        z_new = rn * np.cos(theta_n)                 + cz

        x = np.where(active, x_new, x)
        y = np.where(active, y_new, y)
        z = np.where(active, z_new, z)

        # 检测逃逸
        r_new = np.sqrt(x**2 + y**2 + z**2)
        just_escaped = active & (r_new > bailout)

        # 平滑逃逸着色（避免色带断层）
        smooth_i = i - np.log2(np.log2(np.maximum(r_new, 1.0001)))
        escape[just_escaped] = smooth_i[just_escaped]

        active[r_new > bailout] = False
        if not active.any():
            break

    return escape  # 0 = 内部，>0 = 外部


# ─────────────────────────────────────────────
# 光线步进渲染（俯视切片 or 完整 3D 投影）
# ─────────────────────────────────────────────

def render_slice(power=8, max_iter=10, res=300, z_plane=0.0):
    """
    渲染 XY 平面的截面（最快，适合调试）。
    """
    lin = np.linspace(-1.5, 1.5, res)
    xx, yy = np.meshgrid(lin, lin)
    zz = np.full_like(xx, z_plane)
    esc = mandelbulb_escape(xx, yy, zz, power=power, max_iter=max_iter)
    return esc


def render_projection(power=8, max_iter=10, res=300, slices=60):
    """
    沿 Z 轴做多层切片，投影到 XY 平面（深度合成）。
    生成类似"俯视图"的分形图像。
    """
    print(f"  渲染参数: power={power}, iters={max_iter}, res={res}, slices={slices}")
    composite = np.zeros((res, res), dtype=np.float32)
    z_vals = np.linspace(-1.2, 1.2, slices)

    for idx, z_val in enumerate(z_vals):
        print(f"  切片 {idx+1}/{slices}  z={z_val:.3f}", end='\r')
        layer = render_slice(power=power, max_iter=max_iter, res=res, z_plane=z_val)
        # 内部点(escape=0)不贡献；外部点越早逃逸 = 越靠近表面
        mask_surface = (layer > 0) & (layer < max_iter * 0.5)
        composite = np.maximum(composite, mask_surface.astype(np.float32) * layer)

    print()  # 换行
    return composite


def render_depth_map(power=8, max_iter=10, res=300, slices=80):
    """
    光线从 Z=+2 向 -Z 方向步进，记录第一个命中点的深度。
    生成真正的 3D 深度图，适合伪立体感着色。
    """
    print(f"  深度图参数: power={power}, iters={max_iter}, res={res}, slices={slices}")
    lin = np.linspace(-1.5, 1.5, res)
    xx, yy = np.meshgrid(lin, lin)
    depth = np.full((res, res), -1.0, dtype=np.float32)
    hit   = np.zeros((res, res), dtype=bool)

    z_vals = np.linspace(1.5, -1.5, slices)
    for idx, z_val in enumerate(z_vals):
        print(f"  深度步进 {idx+1}/{slices}", end='\r')
        zz = np.full_like(xx, z_val)
        esc = mandelbulb_escape(xx, yy, zz, power=power, max_iter=max_iter)
        # 内部点（escape=0）= 命中
        inside = (esc == 0) & ~hit
        depth[inside] = z_val
        hit[inside] = True

    print()
    # 未命中的点设为背景
    depth[depth < 0] = np.nan
    return depth


# ─────────────────────────────────────────────
# 可视化
# ─────────────────────────────────────────────

def make_colormap():
    """创建自定义宇宙风配色。"""
    colors = [
        (0.02, 0.02, 0.08),   # 深空黑
        (0.05, 0.15, 0.45),   # 深蓝
        (0.10, 0.50, 0.70),   # 青蓝
        (0.90, 0.55, 0.10),   # 橙金
        (0.98, 0.92, 0.75),   # 亮白
    ]
    return LinearSegmentedColormap.from_list("mandelbulb", colors, N=512)


def plot_all(power=8, max_iter=10, res=200):
    cmap = make_colormap()
    fig, axes = plt.subplots(1, 3, figsize=(16, 5.5))
    fig.patch.set_facecolor('#080810')

    titles = ["XY 截面 (z=0)", "Z 轴投影", "深度图"]
    for ax in axes:
        ax.set_facecolor('#080810')
        ax.tick_params(colors='#555566', labelsize=8)
        for spine in ax.spines.values():
            spine.set_edgecolor('#333344')

    # 1. 截面
    print("[1/3] 渲染 XY 截面...")
    sl = render_slice(power=power, max_iter=max_iter, res=res)
    axes[0].imshow(sl, cmap=cmap, origin='lower', extent=[-1.5,1.5,-1.5,1.5])
    axes[0].set_title(titles[0], color='#aaaacc', fontsize=11, pad=8)

    # 2. 投影
    print("[2/3] 渲染 Z 轴投影...")
    proj = render_projection(power=power, max_iter=max_iter, res=res, slices=50)
    axes[1].imshow(proj, cmap=cmap, origin='lower', extent=[-1.5,1.5,-1.5,1.5])
    axes[1].set_title(titles[1], color='#aaaacc', fontsize=11, pad=8)

    # 3. 深度图
    print("[3/3] 渲染深度图...")
    depth = render_depth_map(power=power, max_iter=max_iter, res=res, slices=60)
    im = axes[2].imshow(depth, cmap=cmap, origin='lower', extent=[-1.5,1.5,-1.5,1.5])
    axes[2].set_title(titles[2], color='#aaaacc', fontsize=11, pad=8)

    for ax, t in zip(axes, titles):
        ax.set_xlabel('X', color='#555566', fontsize=8)
        ax.set_ylabel('Y', color='#555566', fontsize=8)

    fig.suptitle(f'Mandelbulb  |  power={power}  |  iterations={max_iter}',
                 color='#ccccee', fontsize=13, y=1.01)
    plt.tight_layout()

    out_path = f"mandelbulb_p{power}_i{max_iter}.png"
    plt.savefig(out_path, dpi=150, bbox_inches='tight',
                facecolor=fig.get_facecolor())
    print(f"\n✓ 已保存到: {out_path}")
    plt.show()


# ─────────────────────────────────────────────
# 主程序
# ─────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="曼德尔球渲染器")
    parser.add_argument("--power", type=float, default=8,   help="幂次 n（默认 8）")
    parser.add_argument("--iters", type=int,   default=8,   help="最大迭代次数（默认 8）")
    parser.add_argument("--res",   type=int,   default=200, help="分辨率（默认 200，高质量用 400+）")
    args = parser.parse_args()

    print("=" * 50)
    print("  曼德尔球渲染器  Mandelbulb Renderer")
    print("=" * 50)
    print(f"  power={args.power}  iters={args.iters}  res={args.res}")
    print()

    plot_all(power=args.power, max_iter=args.iters, res=args.res)
