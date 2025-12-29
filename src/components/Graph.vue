<template>
  <div class="rg-wrap">
    <!-- 顶部标题栏 -->
    <div class="rg-header">
      <div class="rg-title">
        <span class="rg-dot"></span>
        <span class="rg-title-text">数字孪生场景 {{ scene }}</span>
      </div>

      <div class="rg-actions">
        <!-- 本体按钮 -->
        <button
            class="rg-btn rg-ont-btn"
            :class="{ 'rg-ont-btn-active': ontologyMode }"
            @click="toggleOntology"
        >
          {{ ontologyMode ? '实例' : '本体' }}
        </button>

        <button class="rg-btn" @click="fitView">自适应</button>
        <button class="rg-btn" @click="reLayout">重排</button>
      </div>
    </div>

    <!-- 本体模式：独立组件 -->
    <OntologyPanel
        v-if="ontologyMode"
        :scene="scene"
    />

    <!-- 图表容器：本体模式下隐藏 -->
    <div
        ref="chart"
        class="rg-chart"
        v-show="!ontologyMode"
    ></div>

    <!-- 节点详情 Drawer 组件 -->
    <NodeDetailDrawer
        v-if="!ontologyMode && drawerVisible"
        :visible.sync="drawerVisible"
        :scene="scene"
        :node="selectedNode"
        :categories="categories"
    />
  </div>
</template>

<script>
import * as echarts from "echarts";

import { getAllGraph } from "@/api/graph";
import OntologyPanel from "@/components/graph/OntologyPanel.vue";
import NodeDetailDrawer from "@/components/graph/NodeDetailDrawer.vue";

export default {
  name: "RelationGraph",
  components: {
    OntologyPanel,
    NodeDetailDrawer
  },
  props: {
    scene: { type: String, default: "test_scene" },
    title: { type: String, default: "关系图谱" }
  },
  data() {
    return {
      chart: null,

      nodes: [],
      relations: [],
      categories: [],

      drawerVisible: false,
      selectedNode: null,

      graphLoading: false,
      ontologyMode: false,

      _reqToken: 0
    };
  },
  async mounted() {
    await this.loadAllGraph();
    this.initChart();
    window.addEventListener("resize", this.onResize);
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.onResize);
    if (this.chart) this.chart.dispose();
  },
  watch: {
    async scene() {
      await this.loadAllGraph(true);
      this.render(true);
    }
  },
  methods: {
    onResize() {
      if (this.chart) this.chart.resize();
    },

    /* ==================== 本体模式开关 ==================== */
    toggleOntology() {
      const to = !this.ontologyMode;
      this.ontologyMode = to;

      if (!to) {
        // 退出本体模式：重新计算图谱尺寸
        this.$nextTick(() => {
          if (this.chart) this.chart.resize();
        });
      }
    },

    /* ==================== 图谱加载逻辑 ==================== */
    async loadAllGraph(force = false) {
      if (!force && (this.nodes.length || this.relations.length)) return;

      this.graphLoading = true;
      try {
        const data = await getAllGraph(this.scene);

        const hasNodes =
            data && Array.isArray(data.nodes) && data.nodes.length > 0;

        this.nodes = hasNodes ? data.nodes : [];
        this.relations =
            hasNodes && (data.relations || data.links)
                ? data.relations || data.links
                : [];

        if (hasNodes && data.categories && data.categories.length) {
          this.categories = data.categories;
        } else {
          this.categories = [];
        }
      } catch (e) {
        this.$message && this.$message.error("getAllGraph 加载失败");
        this.nodes = [];
        this.relations = [];
        this.categories = [];
      } finally {
        this.graphLoading = false;
      }
    },

    initChart() {
      this.chart = echarts.init(this.$refs.chart);
      this.render(true);

      this.chart.on("click", (params) => {
        // 本体模式不弹 Drawer
        if (this.ontologyMode) return;

        if (params && params.dataType === "node") {
          this.selectedNode =
              params.data && params.data.__rawNode
                  ? params.data.__rawNode
                  : params.data || null;

          this.drawerVisible = true;
          // 具体的详情加载交给 NodeDetailDrawer 自己完成
        }
      });
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
      const hasNodes = seriesNodes.length > 0;
      const hasLegendCategories =
          hasNodes && this.categories && this.categories.length > 0;

      const option = {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "item",
          confine: true,
          formatter: (p) => {
            if (p.dataType === "node") {
              const d =
                  p.data && p.data.__rawNode ? p.data.__rawNode : p.data;
              return `
                <div style="min-width:180px">
                  <div style="font-weight:700;font-size:13px;margin-bottom:6px;">${d.name}</div>
                </div>
              `;
            }
            if (p.dataType === "edge") {
              return `
                <div style="min-width:180px">
                  <div style="font-weight:700;font-size:13px;margin-bottom:6px;">${
                  p.data.name || "关系"
              }</div>
                  <div style="opacity:.85;font-size:12px;">${
                  p.data.source
              } → ${p.data.target}</div>
                </div>
              `;
            }
            return "";
          }
        },
        legend: {
          show: hasLegendCategories,
          top: 10,
          left: 16,
          icon: "circle",
          textStyle: { color: "rgba(241,245,249,0.9)", fontSize: 12 },
          data: hasLegendCategories
              ? (this.categories || []).map((c) => c.name)
              : []
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
            categories: hasLegendCategories ? this.categories : [],
            force: {
              repulsion: 280,
              gravity: 0.06,
              edgeLength: [90, 160],
              friction: 0.25
            },
            label: {
              show: true,
              position: "right",
              color: "rgba(241,245,249,0.92)",
              fontSize: 12,
              padding: [3, 6, 3, 6],
              backgroundColor: "rgba(15,23,42,0.75)",
              borderRadius: 999
            },
            edgeLabel: {
              show: true,
              formatter: (p) =>
                  p.data && p.data.name ? p.data.name : "",
              color: "rgba(209,213,219,0.88)",
              fontSize: 11,
              backgroundColor: "rgba(15,23,42,0.72)",
              padding: [2, 6],
              borderRadius: 999
            },
            itemStyle: {
              borderColor: "rgba(148,163,184,0.55)",
              borderWidth: 1,
              shadowBlur: 18,
              shadowColor: "rgba(0,0,0,0.45)"
            },
            lineStyle: {
              color: "rgba(148,163,184,0.45)",
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

      this.chart.setOption(option, {
        notMerge: !forceReLayout,
        lazyUpdate: true
      });
    }
  }
};
</script>

<style scoped>
/* ========== 外层卡片 ========== */
.rg-wrap {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;

  border-radius: 18px;
  background:
      radial-gradient(800px 400px at 10% 0%, rgba(56, 189, 248, 0.15), transparent 60%),
      radial-gradient(800px 400px at 90% 0%, rgba(129, 140, 248, 0.18), transparent 60%),
      #020617;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.9);
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.35);
}

/* 顶部标题栏 */
.rg-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;

  border-bottom: 1px solid rgba(148, 163, 184, 0.32);
  background: rgba(15, 23, 42, 0.96);
}

.rg-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rg-title-text {
  color: rgba(248, 250, 252, 0.98);
  font-weight: 900;
  letter-spacing: 0.2px;
}

.rg-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #60a5fa;
  box-shadow:
      0 0 0 2px rgba(96, 165, 250, 0.22),
      0 0 18px rgba(96, 165, 250, 0.65);
}

.rg-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 通用按钮（用 deep，让子组件的 .rg-mini-btn 也继承） */
.rg-wrap ::v-deep .rg-btn,
.rg-wrap ::v-deep .rg-mini-btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  color: rgba(248, 250, 252, 0.9);
  background: rgba(15, 23, 42, 0.96);
  cursor: pointer;
  outline: none;
  transition: all 0.18s ease;
  font-weight: 500;
}
.rg-wrap ::v-deep .rg-btn:hover,
.rg-wrap ::v-deep .rg-mini-btn:hover {
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  border-color: rgba(129, 140, 248, 0.95);
  transform: translateY(-1px);
}
.rg-wrap ::v-deep .rg-mini-btn {
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
}
.rg-wrap ::v-deep .rg-mini-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

/* 本体按钮（在外层就能影响到 header 里的按钮） */
.rg-ont-btn {
  font-size: 12px;
}
.rg-ont-btn-active {
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  border-color: rgba(129, 140, 248, 1);
  box-shadow: 0 0 0 1px rgba(129, 140, 248, 0.6);
}

.rg-chart {
  flex: 1;
  min-height: 0;
}

/* ========== JSON 面板 & 滚动条（Drawer + Dialog 共用） ========== */

/* JSON 面板改成明显的“卡片”样式，和底色区分开 */
.rg-wrap ::v-deep .rg-json-stack {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: 12px;
  overflow: hidden;
}

.rg-wrap ::v-deep .rg-json-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  background: rgba(15, 23, 42, 0.94);
  border-radius: 14px;
  border: 1px solid rgba(30, 64, 175, 0.7);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.9);
}

/* 顶部条和卡片背景衔接顺滑一点 */
.rg-wrap ::v-deep .rg-json-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(30, 64, 175, 0.6);
  background: linear-gradient(
      135deg,
      rgba(15, 23, 42, 0.98),
      rgba(15, 23, 42, 0.94)
  );
}

.rg-wrap ::v-deep .rg-json-right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.rg-wrap ::v-deep .rg-json-badge {
  font-size: 12px;
  font-weight: 900;
  color: rgba(248, 250, 252, 0.9);
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.6);
  padding: 4px 8px;
  border-radius: 999px;
}

.rg-wrap ::v-deep .rg-json-hint {
  font-size: 12px;
  color: rgba(148, 163, 184, 0.85);
}

.rg-wrap ::v-deep .rg-json-loading {
  padding: 12px;
}

/* JSON 文本区域，比 Drawer 背景稍微亮一点，形成层次但不突兀 */
.rg-wrap ::v-deep .rg-json-view {
  margin: 0;
  padding: 12px;
  flex: 1;
  min-height: 0;
  overflow: auto;

  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
  "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(226, 232, 240, 0.96);
  background: linear-gradient(
      180deg,
      rgba(15, 23, 42, 0.98),
      rgba(15, 23, 42, 0.94)
  );

  scrollbar-width: thin;
  scrollbar-color: rgba(96, 165, 250, 0.9) rgba(15, 23, 42, 0.96);
}

.rg-wrap ::v-deep .rg-json-view::-webkit-scrollbar {
  width: 10px;
}
.rg-wrap ::v-deep .rg-json-view::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.96);
  border-radius: 999px;
  margin: 8px 0;
}
.rg-wrap ::v-deep .rg-json-view::-webkit-scrollbar-thumb {
  background: linear-gradient(
      180deg,
      rgba(37, 99, 235, 0.8),
      rgba(30, 64, 175, 0.78)
  );
  border-radius: 999px;
  border: 2px solid rgba(6, 10, 18, 0.98);
}
.rg-wrap ::v-deep .rg-json-view::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(
      180deg,
      rgba(96, 165, 250, 0.98),
      rgba(59, 130, 246, 0.96)
  );
  border-color: rgba(15, 23, 42, 0.85);
}
</style>


