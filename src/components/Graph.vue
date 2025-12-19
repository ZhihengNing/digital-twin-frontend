<template>
  <div class="rg-wrap">
    <!-- 顶部标题栏 -->
    <div class="rg-header">
      <div class="rg-title">
        <span class="rg-dot"></span>
        <span>{{ title }}</span>
      </div>
      <div class="rg-actions">
        <button class="rg-btn" @click="fitView">自适应</button>
        <button class="rg-btn" @click="reLayout">重排</button>
      </div>
    </div>

    <!-- 图表容器 -->
    <div ref="chart" class="rg-chart"></div>

    <!-- Drawer -->
    <el-drawer
        :visible.sync="drawerVisible"
        :with-header="false"
        :size="drawerSize"
        custom-class="rg-drawer"
        :append-to-body="true"
    >
      <div class="rg-drawer-head">
        <div class="rg-drawer-title">
          <div class="rg-avatar">{{ (selectedNode && selectedNode.name || '?').slice(0, 1) }}</div>
          <div class="rg-drawer-meta">
            <div class="rg-name">{{ selectedNode ? selectedNode.name : '' }}</div>
            <div class="rg-sub">
              <span class="rg-pill">ID: {{ selectedNode ? selectedNode.id : '' }}</span>
              <span class="rg-pill" v-if="selectedNode && selectedNode.category != null">
                分类: {{ selectedNode.category }}
              </span>
            </div>
          </div>
        </div>

        <div class="rg-head-actions">
          <button class="rg-mini-btn" @click="copyJsonTop" :disabled="!selectedNode">复制上面JSON</button>
          <button class="rg-mini-btn" @click="copyJsonBottom" :disabled="bottomLoading">复制下面JSON</button>
          <i class="el-icon-close rg-close" @click="drawerVisible = false"></i>
        </div>
      </div>

      <div class="rg-drawer-body">
        <!-- 两个 JSON 框：上 4 / 下 6（可调） -->
        <div class="rg-json-stack" :style="stackStyle">
          <!-- TOP JSON -->
          <div class="rg-json-panel">
            <div class="rg-json-top">
              <span class="rg-json-badge">节点 JSON（原始）</span>
              <span class="rg-json-hint">点击节点即更新</span>
            </div>
            <pre class="rg-json-view">{{ topJsonText }}</pre>
          </div>

          <!-- BOTTOM JSON：模拟请求加载 -->
          <div class="rg-json-panel">
            <div class="rg-json-top">
              <span class="rg-json-badge">本体的 DTDL 定义 </span>
              <span class="rg-json-hint" v-if="bottomLoading">加载中…</span>
              <span class="rg-json-hint" v-else>已加载</span>
            </div>

            <div class="rg-json-loading" v-if="bottomLoading">
              <el-skeleton :rows="6" animated />
            </div>

            <pre class="rg-json-view" v-else>{{ bottomJsonText }}</pre>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script>
import * as echarts from "echarts";

export default {
  name: "RelationGraph",
  props: {
    title: { type: String, default: "关系图谱" },
    nodes: { type: Array, required: true },
    relations: { type: Array, required: true },
    categories: { type: Array, default: () => [{ name: "默认" }] }
  },
  data() {
    return {
      chart: null,
      drawerVisible: false,
      selectedNode: null,
      drawerSize: "33.2vw",

      // ✅ 两个 JSON 框高度比例：4 : 6（想改就改这两个数）
      ratioTop: 4,
      ratioBottom: 6,

      // ✅ Bottom 模拟请求数据
      bottomLoading: false,
      bottomData: null,

      // 防止快速点多个节点导致“旧请求回写”
      _reqToken: 0
    };
  },
  computed: {
    stackStyle() {
      // 用 CSS grid 控制两个面板高度比例
      return {
        gridTemplateRows: `${this.ratioTop}fr ${this.ratioBottom}fr`
      };
    },
    topJsonText() {
      return this.selectedNode ? this.pretty(this.selectedNode.raw || this.selectedNode) : "{}";
    },
    bottomJsonText() {
      return this.bottomData ? this.pretty(this.bottomData) : "{}";
    }
  },
  mounted() {
    this.initChart();
    window.addEventListener("resize", this.onResize);
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.onResize);
    if (this.chart) this.chart.dispose();
  },
  watch: {
    nodes: { deep: true, handler() { this.render(); } },
    relations: { deep: true, handler() { this.render(); } }
  },
  methods: {
    onResize() {
      if (this.chart) this.chart.resize();
    },
    pretty(obj) {
      try {
        return JSON.stringify(obj, null, 2);
      } catch (e) {
        return String(obj);
      }
    },

    async copyText(str) {
      try {
        await navigator.clipboard.writeText(str);
        this.$message && this.$message.success("已复制");
      } catch (e) {
        this.$message && this.$message.error("复制失败（浏览器权限限制）");
      }
    },
    copyJsonTop() {
      this.copyText(this.topJsonText);
    },
    copyJsonBottom() {
      this.copyText(this.bottomJsonText);
    },

    initChart() {
      this.chart = echarts.init(this.$refs.chart);
      this.render();

      this.chart.on("click", (params) => {
        if (params && params.dataType === "node") {
          this.selectedNode =
              params.data && params.data.__rawNode ? params.data.__rawNode : (params.data || null);

          this.drawerVisible = true;

          // ✅ 点击节点后：触发“模拟请求”加载 bottom 数据
          this.loadBottomDataMock(this.selectedNode);
        }
      });
    },

    // ✅ 模拟请求：根据节点生成一份“扩展数据”
    async loadBottomDataMock(node) {
      const token = ++this._reqToken;
      this.bottomLoading = true;
      this.bottomData = null;

      // 模拟网络延迟
      await new Promise((r) => setTimeout(r, 600));

      // 如果期间又点了别的节点，丢弃旧结果
      if (token !== this._reqToken) return;

      const now = new Date();
      this.bottomData = {
        request: {
          url: "/api/node/detail",
          method: "GET",
          params: { id: node ? node.id : null }
        },
        response: {
          nodeId: node ? node.id : null,
          name: node ? node.name : null,
          category: node ? node.category : null,
          updatedAt: now.toISOString(),
          metrics: {
            healthScore: Math.round(70 + Math.random() * 29),
            temperature: +(18 + Math.random() * 12).toFixed(1),
            vibration: +(0.1 + Math.random() * 0.8).toFixed(2)
          },
          alarms: [
            { level: "INFO", code: "A-1001", message: "例行巡检通过", ts: now.toISOString() }
          ],
          tags: ["digital-twin", "monitoring", "mock-data"]
        }
      };

      this.bottomLoading = false;
    },

    fitView() {
      if (!this.chart) return;
      this.chart.dispatchAction({ type: "restore" });
      this.chart.resize();
    },
    reLayout() {
      this.render(true);
    },

    calcNodeSize(n) {
      const v = Number(n.value != null ? n.value : 1);
      return 28 + Math.min(26, Math.max(0, Math.log(v + 1) * 10));
    },

    buildSeriesData() {
      const seriesNodes = (this.nodes || []).map((n) => {
        const id = String(n.id);
        const name = n.name != null ? String(n.name) : id;
        const category = n.category != null ? n.category : 0;

        return {
          id,
          name,
          category,
          symbolSize: this.calcNodeSize(n),
          value: n.value != null ? n.value : 1,
          draggable: true,
          __rawNode: { ...n, id, name, category, raw: n }
        };
      });

      const seriesLinks = (this.relations || []).map((r) => {
        const source = String(r.source);
        const target = String(r.target);
        const name = r.name != null ? String(r.name) : "";
        return { source, target, name, __rawRel: r };
      });

      return { seriesNodes, seriesLinks };
    },

    render(forceReLayout = false) {
      if (!this.chart) return;

      const { seriesNodes, seriesLinks } = this.buildSeriesData();

      const option = {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "item",
          confine: true,
          formatter: (p) => {
            if (p.dataType === "node") {
              const d = p.data && p.data.__rawNode ? p.data.__rawNode : p.data;
              return `
                <div style="min-width:180px">
                  <div style="font-weight:700;font-size:13px;margin-bottom:6px;">${d.name}</div>
                  <div style="opacity:.85;font-size:12px;">ID: ${d.id}</div>
                </div>
              `;
            }
            if (p.dataType === "edge") {
              return `
                <div style="min-width:180px">
                  <div style="font-weight:700;font-size:13px;margin-bottom:6px;">${p.data.name || "关系"}</div>
                  <div style="opacity:.85;font-size:12px;">${p.data.source} → ${p.data.target}</div>
                </div>
              `;
            }
            return "";
          }
        },
        legend: {
          top: 10,
          left: 16,
          icon: "circle",
          textStyle: { color: "rgba(255,255,255,0.75)" },
          data: (this.categories || []).map((c) => c.name)
        },
        animationDurationUpdate: 600,
        series: [
          {
            type: "graph",
            layout: "force",
            roam: true,
            focusNodeAdjacency: true,
            data: seriesNodes,
            links: seriesLinks,
            categories: this.categories,
            force: {
              repulsion: 280,
              gravity: 0.06,
              edgeLength: [90, 160],
              friction: 0.25
            },
            label: {
              show: true,
              position: "right",
              color: "rgba(255,255,255,0.88)",
              fontSize: 12,
              padding: [3, 6, 3, 6],
              backgroundColor: "rgba(0,0,0,0.25)",
              borderRadius: 999
            },
            edgeLabel: {
              show: true,
              formatter: (p) => (p.data && p.data.name ? p.data.name : ""),
              color: "rgba(255,255,255,0.65)",
              fontSize: 11,
              backgroundColor: "rgba(0,0,0,0.22)",
              padding: [2, 6],
              borderRadius: 999
            },
            itemStyle: {
              borderColor: "rgba(255,255,255,0.22)",
              borderWidth: 1,
              shadowBlur: 18,
              shadowColor: "rgba(0,0,0,0.45)"
            },
            lineStyle: {
              color: "rgba(255,255,255,0.22)",
              width: 1.6,
              curveness: 0.22
            },
            edgeSymbol: ["none", "arrow"],
            edgeSymbolSize: 10,
            emphasis: {
              scale: true,
              label: { show: true },
              lineStyle: { width: 2.4, opacity: 0.8 }
            }
          }
        ]
      };

      this.chart.setOption(option, { notMerge: !forceReLayout, lazyUpdate: true });
    }
  }
};
</script>

<style scoped>
/* 统一卡片风格 */
.rg-wrap {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;

  border-radius: var(--card-radius);
  background: var(--card-bg-grad);
  box-shadow: var(--card-shadow);
  overflow: hidden;
  border: var(--card-border);
}

.rg-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;

  border-bottom: var(--divider);
  background: var(--header-bg);
}

.rg-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--t-strong);
  font-weight: 900;
  letter-spacing: 0.2px;
}

.rg-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: var(--accent);
  box-shadow:
      0 0 0 2px rgba(96, 165, 250, 0.20),
      0 0 18px rgba(96, 165, 250, 0.55);
}

.rg-actions { display: flex; gap: 10px; }

/* 统一按钮 */
.rg-btn,
.rg-mini-btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  border: var(--ctl-border);
  color: rgba(255, 255, 255, 0.82);
  background: var(--ctl-bg);
  cursor: pointer;
  outline: none;
  transition: all 0.18s ease;
  font-weight: 500;
}
.rg-btn:hover,
.rg-mini-btn:hover {
  background: var(--ctl-bg-hover);
  transform: translateY(-1px);
}
.rg-mini-btn {
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
}
.rg-mini-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.rg-chart { flex: 1; min-height: 0; }

/* Drawer 美化 */
::v-deep .rg-drawer {
  background: var(--card-bg-grad);
  border-left: var(--divider);
}

/* drawer 头 */
.rg-drawer-head {
  padding: 18px 16px 10px 16px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  border-bottom: var(--divider);
  background: var(--header-bg);
}

.rg-drawer-title {
  display: flex;
  gap: 12px;
  align-items: center;
}

.rg-avatar {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.92);
  font-weight: 900;

  background: var(--accent-soft);
  border: 1px solid var(--accent-border);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}

.rg-drawer-meta .rg-name {
  color: var(--t-strong);
  font-size: 16px;
  font-weight: 900;
}

.rg-sub {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rg-pill {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 3px 8px;
  border-radius: 999px;
}

.rg-head-actions { display: flex; align-items: center; gap: 10px; }

.rg-close {
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 6px;
  border-radius: 10px;
}
.rg-close:hover { background: rgba(255, 255, 255, 0.08); }

.rg-drawer-body {
  padding: 14px 16px 18px 16px;
  height: calc(100% - 0px);
}

/* ✅ 两个 JSON 框容器：用 grid 做 4:6 比例 */
.rg-json-stack {
  height: calc(100vh - 56px - 64px); /* 大致可用高度，不精确也没关系 */
  min-height: 420px;
  display: grid;
  gap: 12px;
}

/* JSON Panel */
.rg-json-panel {
  border-radius: 14px;
  overflow: hidden;
  border: var(--ctl-border);
  background: rgba(0, 0, 0, 0.18);

  display: flex;
  flex-direction: column;
  min-height: 0; /* 关键：允许内部滚动 */
}

.rg-json-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: var(--divider);
  background: var(--header-bg);
}

.rg-json-badge {
  font-size: 12px;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.78);
  background: rgba(255, 255, 255, 0.06);
  border: var(--ctl-border);
  padding: 4px 8px;
  border-radius: 999px;
}

.rg-json-hint { font-size: 12px; color: var(--t-sub); }

.rg-json-loading{
  padding: 12px;
}

.rg-json-view {
  margin: 0;
  padding: 12px;
  flex: 1;
  min-height: 0;
  overflow: auto;

  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
  "Courier New", monospace;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.86);
  background: rgba(0, 0, 0, 0.22);

  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.22) var(--sb-track);
}

.rg-json-view::-webkit-scrollbar { width: 10px; }
.rg-json-view::-webkit-scrollbar-track {
  background: var(--sb-track);
  border-radius: 999px;
  margin: 8px 0;
}
.rg-json-view::-webkit-scrollbar-thumb {
  background: var(--sb-thumb-grad);
  border-radius: 999px;
  border: 2px solid rgba(15, 23, 42, 0.85);
}
.rg-json-view::-webkit-scrollbar-thumb:hover {
  background: var(--sb-thumb-grad-hover);
}
</style>
