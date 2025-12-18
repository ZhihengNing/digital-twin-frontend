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

    <!-- 详情面板：宽度大概等于右侧 Chat（1/3屏幕宽） -->
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
          <button class="rg-mini-btn" @click="copyJson" :disabled="!selectedNode">复制JSON</button>
          <i class="el-icon-close rg-close" @click="drawerVisible = false"></i>
        </div>
      </div>

      <div class="rg-drawer-body">
        <div class="rg-section-title">节点 JSON</div>

        <div class="rg-json-panel">
          <div class="rg-json-top">
            <span class="rg-json-badge">application/json</span>
            <span class="rg-json-hint">点击“复制JSON”可直接复制</span>
          </div>

          <pre class="rg-json-view">{{ selectedNode ? pretty(selectedNode.raw || selectedNode) : '{}' }}</pre>
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
    categories: {
      type: Array,
      default: () => ([{ name: "默认" }])
    }
  },
  data() {
    return {
      chart: null,
      drawerVisible: false,
      selectedNode: null,
      drawerSize: "33.2vw" // ✅ 简化：大概等于右侧 chat 的 1/3 宽度
    };
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

    async copyJson() {
      try {
        const jsonStr = this.pretty(this.selectedNode ? (this.selectedNode.raw || this.selectedNode) : {});
        await navigator.clipboard.writeText(jsonStr);
        this.$message && this.$message.success("已复制 JSON");
      } catch (e) {
        this.$message && this.$message.error("复制失败（浏览器权限限制）");
      }
    },

    initChart() {
      this.chart = echarts.init(this.$refs.chart);
      this.render();

      // 点击事件：节点弹详情
      this.chart.on("click", (params) => {
        if (params && params.dataType === "node") {
          this.selectedNode = params.data && params.data.__rawNode
              ? params.data.__rawNode
              : (params.data || null);
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

    calcNodeSize(n) {
      const v = Number(n.value != null ? n.value : 1);
      return 28 + Math.min(26, Math.max(0, Math.log(v + 1) * 10));
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
                </div>`;
            }
            if (p.dataType === "edge") {
              return `
                <div style="min-width:180px">
                  <div style="font-weight:700;font-size:13px;margin-bottom:6px;">${p.data.name || "关系"}</div>
                  <div style="opacity:.85;font-size:12px;">${p.data.source} → ${p.data.target}</div>
                </div>`;
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
              formatter: (p) => p.data && p.data.name ? p.data.name : "",
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
/* 整体现代暗色卡片风 */
.rg-wrap{
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 18px;

  background:
      radial-gradient(1200px 600px at 10% 0%, rgba(96,165,250,0.16), transparent 60%),
      radial-gradient(800px 500px at 90% 20%, rgba(52,211,153,0.10), transparent 55%),
      linear-gradient(180deg, rgba(17, 24, 39, 0.96), rgba(15, 23, 42, 0.98));

  box-shadow: 0 18px 60px rgba(0,0,0,0.45);
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.08);
}

.rg-header{
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
}

.rg-title{
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgba(255,255,255,0.9);
  font-weight: 900;
  letter-spacing: 0.2px;
}

.rg-dot{
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(96,165,250,0.95);
  box-shadow: 0 0 18px rgba(96,165,250,0.55);
}

.rg-actions{ display: flex; gap: 10px; }

.rg-btn{
  height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.10);
  color: rgba(255,255,255,0.82);
  background: rgba(255,255,255,0.06);
  cursor: pointer;
  outline: none;
  transition: all .18s ease;
}
.rg-btn:hover{ background: rgba(255,255,255,0.10); transform: translateY(-1px); }

.rg-chart{ flex: 1; min-height: 0; }

/* Drawer 美化 */
::v-deep .rg-drawer{
  background: linear-gradient(180deg, rgba(17, 24, 39, 0.98), rgba(15, 23, 42, 0.98));
  border-left: 1px solid rgba(255,255,255,0.08);
}

.rg-drawer-head{
  padding: 18px 16px 10px 16px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.rg-drawer-title{
  display: flex;
  gap: 12px;
  align-items: center;
}

.rg-avatar{
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255,255,255,0.92);
  font-weight: 900;
  background: rgba(96,165,250,0.18);
  border: 1px solid rgba(96,165,250,0.25);
  box-shadow: 0 10px 30px rgba(0,0,0,0.35);
}

.rg-drawer-meta .rg-name{
  color: rgba(255,255,255,0.92);
  font-size: 16px;
  font-weight: 900;
}

.rg-sub{
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rg-pill{
  font-size: 12px;
  color: rgba(255,255,255,0.72);
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  padding: 3px 8px;
  border-radius: 999px;
}

.rg-head-actions{
  display:flex;
  align-items:center;
  gap:10px;
}

.rg-mini-btn{
  height: 30px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.10);
  color: rgba(255,255,255,0.82);
  background: rgba(255,255,255,0.06);
  cursor: pointer;
  outline: none;
  transition: all .18s ease;
  font-weight: 800;
  font-size: 12px;
}
.rg-mini-btn:hover{ background: rgba(255,255,255,0.10); }
.rg-mini-btn:disabled{ opacity: .45; cursor: not-allowed; }

.rg-close{
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  padding: 6px;
  border-radius: 10px;
}
.rg-close:hover{ background: rgba(255,255,255,0.08); }

.rg-drawer-body{
  padding: 14px 16px 18px 16px;
}

.rg-section-title{
  color: rgba(255,255,255,0.85);
  font-weight: 900;
  margin: 10px 0 10px;
}

/* JSON 面板（专门显示 JSON） */
.rg-json-panel{
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.18);
}

.rg-json-top{
  display:flex;
  align-items:center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
}

.rg-json-badge{
  font-size: 12px;
  font-weight: 900;
  color: rgba(255,255,255,0.78);
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  padding: 4px 8px;
  border-radius: 999px;
}

.rg-json-hint{
  font-size: 12px;
  color: rgba(255,255,255,0.55);
}

.rg-json-view{
  margin: 0;
  padding: 12px;
  max-height: 70vh;
  overflow: auto;

  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(255,255,255,0.86);
  background: rgba(0,0,0,0.22);

  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.22) rgba(255,255,255,0.06);
}
.rg-json-view::-webkit-scrollbar{ width: 10px; }
.rg-json-view::-webkit-scrollbar-track{
  background: rgba(255,255,255,0.05);
  border-radius: 999px;
  margin: 8px 0;
}
.rg-json-view::-webkit-scrollbar-thumb{
  background: linear-gradient(180deg, rgba(96,165,250,0.42), rgba(255,255,255,0.18));
  border-radius: 999px;
  border: 2px solid rgba(15,23,42,0.85);
}
.rg-json-view::-webkit-scrollbar-thumb:hover{
  background: linear-gradient(180deg, rgba(96,165,250,0.60), rgba(255,255,255,0.22));
}
</style>
