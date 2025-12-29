<template>
  <!-- 本体区域背景：和图谱一样，铺满 header 以下所有高度 -->
  <div class="rg-ontology">
    <div class="rg-ontology-head">
      <span class="rg-ontology-title">场景本体列表</span>
      <span class="rg-ontology-hint" v-if="ontologyLoading">
        加载中…
      </span>
      <span class="rg-ontology-hint" v-else>
        共 {{ ontologyCards.length }} 个模型
      </span>
    </div>

    <div
        class="rg-ontology-empty"
        v-if="!ontologyLoading && !ontologyCards.length"
    >
      当前场景暂无本体模型
    </div>

    <!-- 背景区域填满 header 下方高度，卡片自身高度恒定 -->
    <div v-else class="rg-ontology-grid">
      <div
          v-for="card in ontologyCards"
          :key="card.key"
          class="rg-ontology-card"
          @click="onClickOntologyCard(card)"
      >
        <div class="rg-ontology-card-head">
          <div class="rg-ontology-avatar">
            {{ card.avatarText }}
          </div>
          <div class="rg-ontology-meta">
            <div class="rg-ontology-name" :title="card.modelId">
              {{ card.displayName }}
            </div>

            <!-- 统一的 Model ID 行布局：左 label，右内容单行省略号 -->
            <div class="rg-ontology-sub" :title="card.modelId">
              <span class="rg-ontology-sub-label">Model ID</span>
              <span class="rg-ontology-sub-value">
                {{ card.shortModelId }}
              </span>
            </div>
          </div>
        </div>

        <div class="rg-ontology-body">
          <div class="rg-ontology-label">
            点击查看模型 JSON
          </div>
        </div>
      </div>
    </div>

    <!-- 模型 JSON 弹框（点击本体卡片时用） -->
    <el-dialog
        :visible.sync="modelDialogVisible"
        width="720px"
        custom-class="rg-model-dialog"
        :close-on-click-modal="true"
        :append-to-body="true"
    >
      <div slot="title" class="rg-model-dialog-title">
        模型 JSON
        <span class="rg-model-dialog-sub" v-if="currentModelId">
          {{ currentModelId }}
        </span>
      </div>

      <div class="rg-model-dialog-body">
        <div v-if="modelDialogLoading" class="rg-json-loading">
          <el-skeleton :rows="8" animated />
        </div>
        <pre v-else class="rg-json-view rg-json-view-dialog">
{{ modelDialogJson }}
        </pre>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { getModelsByScene, getModelById } from "@/api/model";

export default {
  name: "OntologyPanel",
  props: {
    // 场景 ID，由父组件 RelationGraph 传入
    scene: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      ontologyLoading: false,
      ontologyModelIds: [],

      // 模型弹框
      modelDialogVisible: false,
      modelDialogLoading: false,
      modelDialogData: null,
      currentModelId: ""
    };
  },
  computed: {
    // 本体卡片数据
    ontologyCards() {
      return (this.ontologyModelIds || []).map((m, idx) => {
        const modelId = String(m);
        const shortModelId =
            modelId.length > 64 ? modelId.slice(0, 61) + "..." : modelId;

        let displayName = modelId;
        const parts = modelId.split(";");
        if (parts.length > 1) {
          displayName = parts[0];
        }
        const nameSegments = displayName.split(":");
        displayName = nameSegments[nameSegments.length - 1] || modelId;

        const avatarText = displayName.trim().charAt(0).toUpperCase() || "M";

        return {
          key: `model-${idx}`,
          modelId,
          displayName,
          shortModelId,
          avatarText
        };
      });
    },
    // 弹框里的 JSON 文本
    modelDialogJson() {
      return this.modelDialogData ? this.pretty(this.modelDialogData) : "{}";
    }
  },
  watch: {
    // 场景变化时自动重新加载本体
    scene: {
      immediate: true,
      handler() {
        this.loadOntologyModels();
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

    // 加载场景下所有模型 ID
    async loadOntologyModels() {
      this.ontologyLoading = true;
      this.ontologyModelIds = [];
      try {
        const res = await getModelsByScene(this.scene);
        if (res && res.code === 200 && res.data && Array.isArray(res.data.modelIds)) {
          this.ontologyModelIds = res.data.modelIds;
        } else {
          this.ontologyModelIds = [];
        }
      } catch (e) {
        this.ontologyModelIds = [];
        this.$message && this.$message.error("本体列表加载失败");
      } finally {
        this.ontologyLoading = false;
      }
    },

    // 点击本体卡片：根据 modelId 拉取模型 JSON 并弹框展示
    async onClickOntologyCard(card) {
      if (!card || !card.modelId) return;
      this.currentModelId = card.modelId;
      this.modelDialogVisible = true;
      this.modelDialogLoading = true;
      this.modelDialogData = null;

      try {
        const res = await getModelById(this.scene, card.modelId);
        if (res && res.code === 200 && res.data) {
          this.modelDialogData = res.data.model || res.data;
        } else {
          this.modelDialogData = null;
          this.$message && this.$message.warning("未获取到模型数据");
        }
      } catch (e) {
        this.modelDialogData = null;
        this.$message && this.$message.error("模型详情加载失败");
      } finally {
        this.modelDialogLoading = false;
      }
    }
  }
};
</script>

<style scoped>
/* ========== 本体区域（OntologyPanel 自己的 DOM） ========== */
.rg-ontology {
  flex: 1;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 8px 14px 10px 14px;
  background: transparent;
}

.rg-ontology-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.rg-ontology-title {
  font-size: 13px;
  font-weight: 700;
  color: rgba(248, 250, 252, 0.96);
}

.rg-ontology-hint {
  font-size: 11px;
  color: rgba(148, 163, 184, 0.9);
}

.rg-ontology-empty {
  font-size: 12px;
  color: rgba(148, 163, 184, 0.9);
  padding: 6px 0 2px 0;
}

.rg-ontology-grid {
  flex: 1;
  min-height: 0;

  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  align-items: stretch;

  gap: 10px;
  overflow: auto;
  padding-top: 4px;
}

/* 卡片高度恒定 + 宽度约 1/3 */
.rg-ontology-card {
  flex: 0 0 calc(33.333% - 10px);
  max-width: calc(33.333% - 10px);
  min-width: 240px;

  height: 100px;

  box-sizing: border-box;
  border-radius: 14px;
  padding: 10px 12px;
  background: radial-gradient(
      500px 260px at 0% 0%,
      rgba(59, 130, 246, 0.16),
      rgba(15, 23, 42, 0.96)
  );
  border: 1px solid rgba(129, 140, 248, 0.4);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.8);
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  transition:
      transform 0.15s ease,
      box-shadow 0.15s ease,
      border-color 0.15s ease,
      background 0.15s ease;
}

.rg-ontology-card:hover {
  transform: translateY(-2px);
  border-color: rgba(129, 140, 248, 0.9);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.95);
  background: radial-gradient(
      500px 260px at 0% 0%,
      rgba(96, 165, 250, 0.2),
      rgba(15, 23, 42, 0.98)
  );
}

.rg-ontology-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rg-ontology-avatar {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 800;
  color: rgba(248, 250, 252, 0.98);
  background: linear-gradient(135deg, #3b82f6, #22c55e);
  border: 1px solid rgba(191, 219, 254, 0.85);
}

.rg-ontology-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rg-ontology-name {
  font-size: 13px;
  font-weight: 700;
  color: rgba(248, 250, 252, 0.97);
  max-width: 200px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

/* 统一 Model ID 行布局 */
.rg-ontology-sub {
  display: flex;
  align-items: center;
  max-width: 200px;
  font-size: 11px;
  color: rgba(148, 163, 184, 0.9);
}

.rg-ontology-sub-label {
  flex: 0 0 auto;
  margin-right: 4px;
  opacity: 0.9;
}

.rg-ontology-sub-value {
  flex: 1 1 auto;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.rg-ontology-body {
  margin-top: 2px;
}

.rg-ontology-label {
  font-size: 11px;
  color: rgba(148, 163, 184, 0.9);
}

/* ========== JSON 文本区域 & 滚动条（弹框里的那块） ========== */
/* 这里直接用 ::v-deep，保证无论挂到 body 还是哪里都能套到 */
::v-deep .rg-json-view {
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

/* 滚动条样式 */
::v-deep .rg-json-view::-webkit-scrollbar {
  width: 10px;
}
::v-deep .rg-json-view::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.96);
  border-radius: 999px;
  margin: 8px 0;
}
::v-deep .rg-json-view::-webkit-scrollbar-thumb {
  background: linear-gradient(
      180deg,
      rgba(37, 99, 235, 0.8),
      rgba(30, 64, 175, 0.78)
  );
  border-radius: 999px;
  border: 2px solid rgba(6, 10, 18, 0.98);
}
::v-deep .rg-json-view::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(
      180deg,
      rgba(96, 165, 250, 0.98),
      rgba(59, 130, 246, 0.96)
  );
  border-color: rgba(15, 23, 42, 0.85);
}

/* 限制弹框里 JSON 的最高高度，超出就出现滚动条 */
::v-deep .rg-json-view-dialog {
  max-height: 440px;
}

/* ========== 模型 JSON 弹框皮肤（关键：一定要 ::v-deep） ========== */
::v-deep .rg-model-dialog {
  background: radial-gradient(
      800px 400px at 0% 0%,
      rgba(56, 189, 248, 0.16),
      #020617
  );
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.5);
}

/* 覆盖 ElementUI 内部 body 间距 */
::v-deep .rg-model-dialog .el-dialog__body {
  padding: 10px 16px 16px 16px;
}

.rg-model-dialog-title {
  font-size: 14px;
  font-weight: 700;
  color: rgba(248, 250, 252, 0.98);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rg-model-dialog-sub {
  font-size: 11px;
  font-weight: 400;
  color: rgba(148, 163, 184, 0.9);
  word-break: break-all;
}

.rg-model-dialog-body {
  max-height: 480px;
  overflow: hidden;
}
</style>


