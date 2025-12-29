<template>
  <!-- 右侧 Drawer：节点详情 -->
  <el-drawer
      :visible.sync="innerVisible"
      :with-header="false"
      :size="drawerSize"
      custom-class="rg-drawer"
      :append-to-body="false"
  >
    <div class="rg-drawer-head">
      <div class="rg-drawer-title">
        <div class="rg-avatar">
          {{ avatarText }}
        </div>
        <div class="rg-drawer-meta">
          <div class="rg-name">
            {{ nodeName }}
          </div>

          <div class="rg-sub">
            <span
                class="rg-pill"
                v-if="categoryName"
            >
              分类: {{ categoryName }}
            </span>
          </div>
        </div>
      </div>

      <div class="rg-head-actions">
        <i class="el-icon-close rg-close" @click="onClose"></i>
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
</template>

<script>
import { getInstance } from "@/api/instance";
import { getModelById } from "@/api/model";

export default {
  name: "NodeDetailDrawer",
  props: {
    // 父组件的 v-model：:visible.sync
    visible: {
      type: Boolean,
      default: false
    },
    // 场景 ID
    scene: {
      type: String,
      required: true
    },
    // 选中节点（RelationGraph 传进来的 raw node）
    node: {
      type: Object,
      default: null
    },
    // 分类数组，用来计算分类名称
    categories: {
      type: Array,
      default: () => []
    },
    // 上下 JSON 面板的高度比例
    ratioTop: {
      type: Number,
      default: 4
    },
    ratioBottom: {
      type: Number,
      default: 6
    },
    // 抽屉宽度
    drawerSize: {
      type: String,
      default: "33.2vw"
    }
  },
  data() {
    return {
      innerVisible: this.visible,

      topLoading: false,
      bottomLoading: false,
      topData: null,
      bottomData: null
    };
  },
  computed: {
    stackStyle() {
      // 两个 JSON 面板等高
      return {
        gridTemplateRows: "4fr 6fr"
      };
    },
    nodeName() {
      return this.node && this.node.name ? this.node.name : "";
    },
    avatarText() {
      return (this.nodeName || "?").slice(0, 1);
    },
    categoryName() {
      if (!this.node) return "";
      if (!this.categories || !this.categories.length) return "";
      const idx = this.node.category;
      const c = this.categories[idx];
      if (!c || !c.name) return "";
      return String(c.name);
    },
    topJsonText() {
      return this.topData ? this.pretty(this.topData) : "{}";
    },
    bottomJsonText() {
      return this.bottomData ? this.pretty(this.bottomData) : "{}";
    }
  },
  watch: {
    // 父 prop -> 内部状态
    visible: {
      immediate: true,
      handler(val) {
        this.innerVisible = val;
        if (val && this.node) {
          this.loadNodeDetail();
        }
      }
    },
    // 内部状态 -> 父 prop（.sync）
    innerVisible(val) {
      this.$emit("update:visible", val);
    },
    // 当选中节点变化时，如果当前抽屉是打开的，就重新加载详情
    node: {
      immediate: false,
      handler() {
        if (this.innerVisible && this.node) {
          this.loadNodeDetail();
        } else {
          this.topData = null;
          this.bottomData = null;
        }
      }
    }
  },
  methods: {
    pretty(obj) {
      try {
        return JSON.stringify(obj, null, 2);
      } catch (e) {
        return String(obj);
      }
    },

    onClose() {
      this.innerVisible = false;
    },

    async copyJsonTop() {
      if (!this.topData) {
        this.$message && this.$message.warning("没有可复制的实例数据");
        return;
      }
      await this.safeCopy(this.topJsonText);
    },

    async copyJsonBottom() {
      if (!this.bottomData) {
        this.$message && this.$message.warning("没有可复制的模型数据");
        return;
      }
      await this.safeCopy(this.bottomJsonText);
    },

    async safeCopy(text) {
      const str = String(text || "");

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

    async loadNodeDetail() {
      if (!this.node) return;

      this.topLoading = true;
      this.bottomLoading = true;
      this.topData = null;
      this.bottomData = null;

      const category =
          this.node &&
          this.categories &&
          this.categories[this.node.category]
              ? this.categories[this.node.category].name
              : null;
      const name = this.node ? this.node.name : null;

      try {
        const [insRes, modelRes] = await Promise.all([
          getInstance(this.scene, category, name),
          getModelById(this.scene, category)
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
    }
  }
};
</script>

<style scoped>
/* ========== Drawer 外观（NodeDetailDrawer 专用） ========== */
.rg-drawer {
  overflow: hidden; /* 让整个抽屉本身不出现滚动条 */
  background:
      radial-gradient(900px 500px at 80% 0%, rgba(56, 189, 248, 0.28), transparent 60%),
      radial-gradient(900px 500px at 0% 0%, rgba(79, 70, 229, 0.22), transparent 60%),
      linear-gradient(180deg, #020617, #020617);
  border-left: 1px solid rgba(148, 163, 184, 0.4);
}

/* el-drawer 内部 body：填满 & 不滚动，滚动交给 JSON 卡片 */
::v-deep .el-drawer__body {
  height: 100%;
  overflow: hidden !important;
  display: flex;
  flex-direction: column;
  padding: 0;
}

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

/* Drawer 内容区域，不滚动，仅作为 JSON 栈容器 */
.rg-drawer-body {
  padding: 14px 16px 18px 16px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  background:
      radial-gradient(800px 400px at 0% 0%, rgba(56, 189, 248, 0.13), transparent 60%),
      radial-gradient(800px 400px at 100% 0%, rgba(79, 70, 229, 0.16), transparent 60%),
      #020617;
}

/* 确保复制按钮在本组件中也有统一样式 */
.rg-mini-btn {
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  color: rgba(248, 250, 252, 0.9);
  background: rgba(15, 23, 42, 0.96);
  cursor: pointer;
  outline: none;
  transition: all 0.18s ease;
  font-weight: 500;
}
.rg-mini-btn:hover {
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  border-color: rgba(129, 140, 248, 0.95);
  transform: translateY(-1px);
}
.rg-mini-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}
</style>


