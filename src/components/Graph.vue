<template>
  <div class="rg-wrap">
    <!-- 顶部标题栏 -->
    <div class="rg-header">
      <div class="rg-title">
        <span class="rg-dot"></span>
        <span class="rg-title-text">数字孪生场景 {{ scene }}</span>
      </div>

      <div class="rg-actions">
        <!-- 模式切换胶囊：文件 / 实例 / 本体 -->
        <div class="rg-mode-pill">
          <button
              class="rg-mode-item"
              :class="{ 'is-active': viewMode === 'file' }"
              @click="setMode('file')"
          >
            文件
          </button>
          <span class="rg-mode-divider"></span>
          <button
              class="rg-mode-item"
              :class="{ 'is-active': viewMode === 'instance' }"
              @click="setMode('instance')"
          >
            实例
          </button>
          <span class="rg-mode-divider"></span>
          <button
              class="rg-mode-item"
              :class="{ 'is-active': viewMode === 'ontology' }"
              @click="setMode('ontology')"
          >
            本体
          </button>
        </div>
      </div>
    </div>

    <!-- 本体模式：独立组件 -->
    <OntologyPanel
        v-if="viewMode === 'ontology'"
        :scene="scene"
    />

    <!-- 实例模式：图表 + 浮动工具条 -->
    <div
        v-show="viewMode === 'instance'"
        class="rg-chart-wrap"
    >
      <div
          ref="chart"
          class="rg-chart"
      ></div>

      <!-- 自然悬浮按钮 -->
      <button type="button" class="rg-chart-btn" @click="fitView">自适应</button>
      <button type="button" class="rg-chart-btn" style="margin-left: 8px" @click="reLayout">重排</button>

    </div>

    <!-- 文件模式：文件面板 -->
    <FilePanel
        v-if="viewMode === 'file'"
        :scene="scene"
    />

    <!-- 节点详情 Drawer 组件：仅在实例模式下可见 -->
    <NodeDetailDrawer
        v-if="viewMode === 'instance' && drawerVisible"
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
import FilePanel from "@/components/graph/FilePanel.vue";

export default {
  name: "RelationGraph",
  components: {
    OntologyPanel,
    NodeDetailDrawer,
    FilePanel
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

      // 三种模式：file | instance | ontology
      viewMode: "instance",

      _reqToken: 0
    };
  },
  computed: {
    // 兼容旧逻辑用到 ontologyMode 的地方
    ontologyMode() {
      return this.viewMode === "ontology";
    }
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

    /* ==================== 模式切换 ==================== */
    setMode(mode) {
      if (this.viewMode === mode) return;

      this.viewMode = mode;

      // 切换出实例模式时，关闭节点详情 Drawer
      if (mode !== "instance") {
        this.drawerVisible = false;
      }

      // 切回实例时，重算图尺寸
      if (mode === "instance") {
        this.$nextTick(() => {
          if (this.chart) this.chart.resize();
        });
      }
    },

    // 兼容旧用法：本体/实例之间切换
    toggleOntology() {
      this.setMode(this.viewMode === "ontology" ? "instance" : "ontology");
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
      if (!this.$refs.chart) return;

      this.chart = echarts.init(this.$refs.chart);
      this.render(true);

      this.chart.on("click", (params) => {
        // 本体 / 文件模式不弹 Drawer
        if (this.viewMode !== "instance") return;

        if (params && params.dataType === "node") {
          this.selectedNode =
              params.data && params.data.__rawNode
                  ? params.data.__rawNode
                  : params.data || null;

          this.drawerVisible = true;
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

/* 模式切换胶囊 */
.rg-mode-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border-radius: 999px;
  background:
      radial-gradient(
          200px 120px at 0% 0%,
          rgba(37, 99, 235, 0.22),
          transparent 60%
      ),
      radial-gradient(
          200px 120px at 100% 100%,
          rgba(129, 140, 248, 0.22),
          transparent 60%
      );
  border: 1px solid rgba(148, 163, 184, 0.5);
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.8);
}

.rg-mode-item {
  border: none;
  outline: none;
  padding: 4px 14px;
  border-radius: 999px;
  background: transparent;
  color: rgba(226, 232, 240, 0.8);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s ease;
  min-width: 48px;
}

.rg-mode-item:hover {
  background: rgba(15, 23, 42, 0.85);
  color: rgba(248, 250, 252, 0.95);
}

.rg-mode-item.is-active {
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  color: rgba(248, 250, 252, 0.98);
  box-shadow:
      0 0 0 1px rgba(191, 219, 254, 0.65),
      0 8px 18px rgba(15, 23, 42, 0.95);
}

.rg-mode-divider {
  width: 1px;
  height: 16px;
  background: rgba(148, 163, 184, 0.45);
  margin: 0 2px;
}

/* 实例模式中的图容器 + 悬浮工具条 */
.rg-chart-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
}

.rg-chart {
  flex: 1;
  min-height: 0;
}

/* 悬浮在图右上角的小工具条 */
.rg-chart-tools {
  position: absolute;
  top: 12px;
  right: 14px;
  display: inline-flex;
  align-items: center;
  padding: 4px 6px;
  border-radius: 999px;
  background: radial-gradient(
      140px 90px at 0% 0%,
      rgba(15, 23, 42, 0.92),
      transparent 70%
  ),
  rgba(15, 23, 42, 0.92);
  box-shadow:
      0 10px 25px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(30, 64, 175, 0.7);
}

/* 通用按钮（以及子组件中的 .rg-mini-btn） */
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

/* ========== JSON 面板 & 滚动条（Drawer + Dialog 共用） ========== */

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

/* 自然悬浮 + 更靠右上 + 轻微边框 */
.rg-chart-btn {
  position: absolute;
  top: 6px;     /* -> 更贴近顶部 */
  right: 8px;   /* -> 更贴近右侧 */

  display: inline-flex;
  align-items: center;

  border: 1px solid rgba(255, 255, 255, 0.10); /* ✨ 轻微边框 */
  outline: none;
  background: rgba(15, 23, 42, 0.20); /* ✨ 极轻暗底增强可读性但仍趋近透明 */

  color: rgba(248, 250, 252, 0.92);
  font-size: 13px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 6px;

  backdrop-filter: blur(3px); /* ✨ 极轻柔处理，让按钮融入背景 */
  transition: all 0.18s ease;
  cursor: pointer;
}

/* 兄弟按钮向左偏移，距离更紧密、更整体 */
.rg-chart-btn + .rg-chart-btn {
  right: 70px; /* 根据按钮内容自动调整，一般 62~78 都行 */
}

/* hover：稍亮、边框更显、渐变唤醒 */
.rg-chart-btn:hover {
  background: linear-gradient(135deg,
  rgba(37, 99, 235, 0.35),
  rgba(79, 70, 229, 0.35)
  );
  border-color: rgba(255, 255, 255, 0.25);
  color: rgba(255, 255, 255, 1);
  transform: translateY(-1px);
}

/* active：按下微回弹 */
.rg-chart-btn:active {
  transform: translateY(0);
  background: linear-gradient(135deg,
  rgba(37,99,235,0.55),
  rgba(79,70,229,0.55)
  );
}

</style>
