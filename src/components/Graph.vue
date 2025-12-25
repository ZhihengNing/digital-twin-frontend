<template>
  <div class="rg-wrap">
    <!-- 顶部标题栏 -->
    <div class="rg-header">
      <div class="rg-title">
        <span class="rg-dot"></span>
        <span class="rg-title-text">数字孪生场景{{ scene }}</span>
      </div>
      <div class="rg-actions">
        <button class="rg-btn" @click="fitView">自适应</button>
        <button class="rg-btn" @click="reLayout">重排</button>
      </div>
    </div>

    <!-- 图表容器 -->
    <div ref="chart" class="rg-chart"></div>

    <!-- 右侧 Drawer -->
    <el-drawer
        :visible.sync="drawerVisible"
        :with-header="false"
        :size="drawerSize"
        custom-class="rg-drawer"
        :append-to-body="true"
    >
      <div class="rg-drawer-head">
        <div class="rg-drawer-title">
          <div class="rg-avatar">
            {{ (selectedNode && selectedNode.name || '?').slice(0, 1) }}
          </div>
          <div class="rg-drawer-meta">
            <div class="rg-name">
              {{ selectedNode ? selectedNode.name : "" }}
            </div>

            <div class="rg-sub">
              <!-- 只有真的有命名的分类才显示，不会再有“默认” -->
              <span
                  class="rg-pill"
                  v-if="selectedNode && selectedNode.category != null && categoryName"
              >
                分类: {{ categoryName }}
              </span>
            </div>
          </div>
        </div>

        <div class="rg-head-actions">
          <i class="el-icon-close rg-close" @click="drawerVisible = false"></i>
        </div>
      </div>

      <div class="rg-drawer-body">
        <div class="rg-json-stack" :style="stackStyle">
          <!-- TOP JSON：实例 -->
          <div class="rg-json-panel">
            <div class="rg-json-top">
              <span class="rg-json-badge">实例数据</span>

              <div class="rg-json-right">
                <span class="rg-json-hint" v-if="topLoading">加载中…</span>
                <button
                    v-else
                    class="rg-mini-btn"
                    @click="copyJsonTop"
                    :disabled="!topData"
                    title="复制实例 JSON"
                >
                  复制
                </button>
              </div>
            </div>

            <div class="rg-json-loading" v-if="topLoading">
              <el-skeleton :rows="4" animated />
            </div>
            <pre class="rg-json-view" v-else>{{ topJsonText }}</pre>
          </div>

          <!-- BOTTOM JSON：模型 -->
          <div class="rg-json-panel">
            <div class="rg-json-top">
              <span class="rg-json-badge">本体定义</span>

              <div class="rg-json-right">
                <span class="rg-json-hint" v-if="bottomLoading">加载中…</span>
                <button
                    v-else
                    class="rg-mini-btn"
                    @click="copyJsonBottom"
                    :disabled="!bottomData"
                    title="复制模型 JSON"
                >
                  复制
                </button>
              </div>
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

// 根据你项目路径调整
import { getAllGraph } from "@/api/graph";
import { getInstance } from "@/api/instance";
import { getModelById } from "@/api/model";

export default {
  name: "RelationGraph",
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
      drawerSize: "33.2vw",

      ratioTop: 4,
      ratioBottom: 6,

      topLoading: false,
      bottomLoading: false,
      topData: null,
      bottomData: null,

      graphLoading: false,

      _reqToken: 0
    };
  },
  computed: {
    stackStyle() {
      return { gridTemplateRows: `${this.ratioTop}fr ${this.ratioBottom}fr` };
    },
    topJsonText() {
      return this.topData ? this.pretty(this.topData) : "{}";
    },
    bottomJsonText() {
      return this.bottomData ? this.pretty(this.bottomData) : "{}";
    },
    // 分类：只在 categories 有名字的情况下才返回
    categoryName() {
      if (!this.selectedNode) return "";
      if (!this.categories || !this.categories.length) return "";
      const idx = this.selectedNode.category;
      const c = this.categories[idx];
      if (!c || !c.name) return "";
      return String(c.name);
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
    pretty(obj) {
      try {
        return JSON.stringify(obj, null, 2);
      } catch (e) {
        return String(obj);
      }
    },

    // ✅ 上面按钮调用这个：复制“实例 JSON”
    async copyJsonTop() {
      if (!this.topData) {
        this.$message && this.$message.warning("没有可复制的实例数据");
        return;
      }
      await this.safeCopy(this.topJsonText);
    },

    // ✅ 复制“模型 JSON”
    async copyJsonBottom() {
      if (!this.bottomData) {
        this.$message && this.$message.warning("没有可复制的模型数据");
        return;
      }
      await this.safeCopy(this.bottomJsonText);
    },

    // ✅ 通用安全复制逻辑：优先 Clipboard API，失败回退 textarea + execCommand
    async safeCopy(text) {
      const str = String(text || "");

      // 优先使用 navigator.clipboard
      try {
        if (
            typeof navigator !== "undefined" &&
            navigator.clipboard &&
            typeof navigator.clipboard.writeText === "function"
        ) {
          await navigator.clipboard.writeText(str);
          this.$message && this.$message.success("已复制到剪贴板");
          return;
        }
      } catch (err) {
        console.warn("navigator.clipboard 复制失败，尝试降级方案:", err);
      }

      // 降级方案：textarea + execCommand
      try {
        const ta = document.createElement("textarea");
        ta.value = str;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "0";
        ta.style.opacity = "0";

        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);

        if (ok) {
          this.$message && this.$message.success("已复制到剪贴板");
        } else {
          this.$message && this.$message.error("复制失败，请手动 Ctrl+C");
        }
      } catch (err) {
        console.error("execCommand 复制失败:", err);
        this.$message && this.$message.error("复制失败，请手动 Ctrl+C");
      }
    },

    async loadAllGraph(force = false) {
      if (!force && (this.nodes.length || this.relations.length)) return;

      this.graphLoading = true;
      try {
        const data = await getAllGraph(this.scene);

        const hasNodes = data && Array.isArray(data.nodes) && data.nodes.length > 0;

        this.nodes = hasNodes ? data.nodes : [];
        this.relations =
            hasNodes && (data.relations || data.links)
                ? data.relations || data.links
                : [];

        // ✅ 只有在有节点的情况下才使用 categories；否则清空，避免“默认分类”
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
        if (params && params.dataType === "node") {
          this.selectedNode =
              params.data && params.data.__rawNode
                  ? params.data.__rawNode
                  : params.data || null;

          this.drawerVisible = true;
          this.loadNodeDetail(this.selectedNode);
        }
      });
    },

    async loadNodeDetail(node) {
      this.topLoading = true;
      this.bottomLoading = true;
      this.topData = null;
      this.bottomData = null;

      const category =
          node &&
          this.categories &&
          this.categories[node.category]
              ? this.categories[node.category].name
              : null;
      const name = node ? node.name : null;

      try {
        const [insRes, modelRes] = await Promise.all([
          getInstance(this.scene, category, name),
          getModelById(category)
        ]);

        if (insRes && insRes.code === 200) {
          this.topData = insRes.data.instance;
        } else {
          this.topData = null;
        }

        if (modelRes && modelRes.code === 200) {
          this.bottomData = modelRes.data.model;
        } else {
          this.bottomData = null;
        }
      } catch (e) {
        this.$message && this.$message.error("节点详情加载失败");
      } finally {
        this.topLoading = false;
        this.bottomLoading = false;
      }
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

/* 标题文字 */
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
  gap: 10px;
}

/* 按钮 */
.rg-btn,
.rg-mini-btn {
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
.rg-btn:hover,
.rg-mini-btn:hover {
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  border-color: rgba(129, 140, 248, 0.95);
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

.rg-chart {
  flex: 1;
  min-height: 0;
}

/* ========== Drawer ========== */
::v-deep .rg-drawer {
  background:
      radial-gradient(900px 500px at 80% 0%, rgba(56, 189, 248, 0.25), transparent 60%),
      linear-gradient(180deg, #0b1220, #020617);
  border-left: 1px solid rgba(148, 163, 184, 0.4);
}

::v-deep .rg-drawer .el-drawer__body {
  height: 100%;
  overflow: hidden !important;
  display: flex;
  flex-direction: column;
  padding: 0;
}

/* Drawer 头部 */
.rg-drawer-head {
  padding: 18px 16px 10px 16px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  border-bottom: 1px solid rgba(148, 163, 184, 0.32);
  background: rgba(15, 23, 42, 0.96);
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

  color: rgba(248, 250, 252, 0.96);
  font-weight: 900;

  background: linear-gradient(135deg, #3b82f6, #22c55e);
  border: 1px solid rgba(148, 163, 184, 0.9);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
}

/* Drawer 顶部孪生体名称 */
.rg-drawer-meta .rg-name {
  color: rgba(248, 250, 252, 0.98);
  font-size: 16px;
  font-weight: 900;
  letter-spacing: 0.2px;
}

.rg-sub {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rg-pill {
  font-size: 12px;
  color: rgba(226, 232, 240, 0.92);
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.6);
  padding: 3px 8px;
  border-radius: 999px;
}

.rg-head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rg-close {
  color: rgba(209, 213, 219, 0.85);
  cursor: pointer;
  padding: 6px;
  border-radius: 10px;
}
.rg-close:hover {
  background: rgba(31, 41, 55, 0.9);
}

/* Drawer 内容区域 */
.rg-drawer-body {
  padding: 14px 16px 18px 16px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  background:
      radial-gradient(800px 400px at 0% 0%, rgba(56, 189, 248, 0.15), transparent 60%),
      #020617;
}

/* ========== JSON 面板 & 滚动条 ========== */
.rg-json-stack {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: 12px;
  overflow: hidden;
}

.rg-json-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rg-json-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.32);
  background: rgba(15, 23, 42, 0.96);
}

.rg-json-right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.rg-json-badge {
  font-size: 12px;
  font-weight: 900;
  color: rgba(248, 250, 252, 0.9);
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.6);
  padding: 4px 8px;
  border-radius: 999px;
}

.rg-json-hint {
  font-size: 12px;
  color: rgba(148, 163, 184, 0.85);
}

.rg-json-loading {
  padding: 12px;
}

/* JSON 滚动区域 */
.rg-json-view {
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
  background: rgba(15, 23, 42, 0.96);

  scrollbar-width: thin;
  scrollbar-color: rgba(96, 165, 250, 0.9) rgba(15, 23, 42, 0.96);
}

.rg-json-view::-webkit-scrollbar {
  width: 10px;
}
.rg-json-view::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.96);
  border-radius: 999px;
  margin: 8px 0;
}
.rg-json-view::-webkit-scrollbar-thumb {
  background: linear-gradient(
      180deg,
      rgba(37, 99, 235, 0.8),
      rgba(30, 64, 175, 0.78)
  );
  border-radius: 999px;
  border: 2px solid rgba(6, 10, 18, 0.98);
}
.rg-json-view::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(
      180deg,
      rgba(96, 165, 250, 0.98),
      rgba(59, 130, 246, 0.96)
  );
  border-color: rgba(15, 23, 42, 0.85);
}
</style>
