<template>
  <div class="rg-file-shell">
    <!-- 顶部：标题 + 搜索 + 操作 -->
    <div class="rg-file-header">
      <div class="rg-file-title">
        <span class="rg-file-dot"></span>
        <span class="rg-file-title-text">场景文件</span>
      </div>

      <!-- 顶部区域 actions -->
      <div class="rg-file-header-right">

        <!-- 搜索输入框 -->
        <el-input
            v-model="keyword"
            placeholder="搜索文件..."
            clearable
            size="mini"
            class="rg-file-search"
            prefix-icon="el-icon-search"
        />

        <!-- 类型筛选 -->
        <el-select
            v-model="typeFilter"
            clearable
            placeholder="全部类型"
            size="mini"
            class="rg-file-filter"
            popper-class="file-select-dropdown"
        >
          <el-option label="全部类型" value=""></el-option>
          <el-option label="表格" value="sheet"></el-option>
          <el-option label="JSON / 模型" value="json"></el-option>
          <el-option label="文本" value="text"></el-option>
          <el-option label="其它" value="other"></el-option>
        </el-select>

        <!-- 上传 -->
        <el-upload
            class="rg-file-upload"
            :action="uploadAction"
            :auto-upload="false"
            :show-file-list="false"
            :before-upload="beforeUpload"
            :on-change="handleFileChange"
        >
          <button class="rg-icon-btn" title="上传文件">
            <i class="el-icon-upload2"></i>
          </button>
        </el-upload>

        <!-- 刷新 -->
        <button
            class="rg-icon-btn"
            @click="loadFiles"
            title="刷新文件列表"
            :disabled="loading"
        >
          <i class="el-icon-refresh"></i>
        </button>
      </div>
    </div>

    <!-- 主体内容：只要卡片 -->
    <div class="rg-file-body">
      <!-- 加载 / 空态 -->
      <div v-if="loading" class="rg-file-placeholder">
        <div class="rg-skeleton-line"></div>
        <div class="rg-skeleton-line"></div>
      </div>

      <div v-else-if="!filteredFiles.length" class="rg-file-placeholder">
        <div class="rg-file-empty-icon">📂</div>
        <div class="rg-file-empty-text">暂无文件，可以上传一个试试</div>
      </div>

      <!-- 单列铺满的扁平卡片 -->
      <div v-else class="rg-file-grid">
        <div
            v-for="item in filteredFiles"
            :key="item.id"
            class="rg-file-card"
        >
          <!-- 左侧：图标 + 文件信息 -->
          <div class="rg-file-main">
            <div class="rg-file-icon">
              {{ getFileIconText(item.name) }}
            </div>

            <div class="rg-file-meta">
              <el-tooltip
                  :content="item.name"
                  placement="top"
                  effect="dark"
              >
                <div class="rg-file-name">
                  {{ item.name }}
                </div>
              </el-tooltip>
              <div class="rg-file-sub">
                <span>{{ formatSize(item.size) }}</span>
                <span class="rg-file-dot-sep">·</span>
                <span>{{ formatTime(item.updatedAt) }}</span>
              </div>
            </div>
          </div>

          <!-- 右侧：类型 + 操作按钮 -->
          <div class="rg-file-side">
            <!-- 如需显示类型可解开 -->
            <!--
            <span class="rg-file-type-tag">
              {{ getTypeLabel(item.type, item.name) }}
            </span>
            -->
            <div class="rg-file-card-actions">
              <!-- 预览 -->
              <button
                  class="rg-icon-btn-sm"
                  title="预览"
                  @click="previewFile(item)"
              >
                <i class="el-icon-view"></i>
              </button>

              <!-- 下载 -->
              <button
                  class="rg-icon-btn-sm"
                  title="下载"
                  @click="downloadFile(item)"
              >
                <i class="el-icon-download"></i>
              </button>

              <!-- 删除 -->
              <button
                  class="rg-icon-btn-sm rg-icon-btn-danger"
                  title="删除"
                  @click="confirmDelete(item)"
              >
                <i class="el-icon-delete"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  getAllFilesInScene,
  uploadIngestFile,
  delFileInScene
} from "@/api/file"; // 按你的实际路径修改

export default {
  name: "FilePanel",
  props: {
    scene: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      loading: false,
      files: [],
      keyword: "",
      typeFilter: ""
    };
  },
  computed: {
    uploadAction() {
      // 实际不走 action，而是用 on-change 里自定义上传
      return "#";
    },
    filteredFiles() {
      let list = this.files || [];

      // 关键字过滤
      if (this.keyword) {
        const kw = this.keyword.toLowerCase();
        list = list.filter(f =>
            (f.name || "").toLowerCase().includes(kw)
        );
      }

      // 类型过滤
      if (this.typeFilter) {
        list = list.filter(f => {
          const tag = this.getTypeTag(f.type, f.name);
          return tag === this.typeFilter;
        });
      }

      return list;
    }
  },
  created() {
    this.loadFiles();
  },
  methods: {
    /** ======================== 后端交互 ======================== */

    // 加载当前场景下所有文件
    async loadFiles() {
      this.loading = true;
      try {
        const resp = await getAllFilesInScene();

        // 兼容：直接 List<DTFile> 或 Result{ data: List<DTFile> }
        let rawList = [];
        if(resp.code===200){
          rawList=resp.data.files;
        }

        this.files = (rawList || []).map(f => {
          const name = f.fileName || f.finalName || f.path || "";
          return {
            id: f.id,
            name,
            size: f.size,
            type: this.guessMimeByName(name),
            updatedAt: f.createTime,
            downloadUrl: this.rewriteHost(f.path),
            raw: f
          };
        });
      } catch (e) {
        console.error(e);
        this.$message && this.$message.error("文件列表加载失败");
      } finally {
        this.loading = false;
      }
    },

    // 上传文件 + ingest
    beforeUpload(file) {
      // 可扩展校验逻辑，目前全部放行
      return true;
    },

    async handleFileChange(file) {
      const raw = file && file.raw;
      if (!raw) return;

      this.loading = true;
      try {
        await uploadIngestFile(raw);
        this.$message && this.$message.success("文件上传成功，已加入检索队列");
        await this.loadFiles();
      } catch (e) {
        console.error(e);
        this.$message && this.$message.error("文件上传失败");
      } finally {
        this.loading = false;
      }

      // 保留一下原来的事件通知
      this.$emit("file-selected", {
        scene: this.scene,
        file: raw
      });
    },

    // 删除前确认
    confirmDelete(item) {
      if (!this.$confirm) {
        this.doDelete(item);
        return;
      }
      this.$confirm(
          `确定要删除文件「${item.name}」吗？`,
          "提示",
          {
            type: "warning",
            confirmButtonText: "删除",
            cancelButtonText: "取消"
          }
      )
          .then(() => this.doDelete(item))
          .catch(() => {});
    },

    // 调删除接口
    async doDelete(item) {
      if (!item || !item.id) return;

      this.loading = true;
      try {
        await delFileInScene(item.id);
        this.$message && this.$message.success("删除成功");
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.loadFiles();
      } catch (e) {
        console.error(e);
        this.$message && this.$message.error("删除失败");
      } finally {
        this.loading = false;
      }
    },

    /** ======================== 交互事件 ======================== */

    previewFile(row) {
      this.$emit("preview-file", {
        scene: this.scene,
        file: row
      });
      this.$message && this.$message.info(`预览：${row.name}`);
    },

    async downloadFile(row) {
      // 优先使用前面映射好的 downloadUrl（已替换 host）
      let url = row.downloadUrl || (row.raw && this.rewriteHost(row.raw.path));
      if (!url) {
        this.$message && this.$message.error("未找到文件下载地址");
        return;
      }

      // 再做一次清洗，去掉尾部逗号、空格
      url = url.trim().replace(/,$/, "");

      try {
        // 用 fetch 按二进制拉取，不交给浏览器直接打开
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`下载失败，状态码：${res.status}`);
        }

        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = objectUrl;
        // 下载时使用原始文件名（比如 digitaltwinTree.txt）
        a.download = row.name || "file";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(objectUrl);

        this.$emit("download-file", {
          scene: this.scene,
          file: row
        });
      } catch (e) {
        console.error("文件下载失败：", e);
        this.$message && this.$message.error("文件下载失败");
      }
    },


    /** ======================== 工具方法 ======================== */

    rewriteHost(url = "") {
      return url.replace("127.0.0.1", "100.84.26.208")
    },

    getFileIconText(name = "") {
      const idx = name.lastIndexOf(".");
      if (idx <= 0) return "FILE";
      return name.substring(idx + 1).toUpperCase().slice(0, 3);
    },

    getTypeTag(mime = "", name = "") {
      const lower = (mime || "").toLowerCase();
      const n = (name || "").toLowerCase();

      if (
          lower.includes("sheet") ||
          lower.includes("excel") ||
          n.endsWith(".xls") ||
          n.endsWith(".xlsx") ||
          n.endsWith(".csv")
      ) {
        return "sheet";
      }
      if (
          lower.includes("json") ||
          n.endsWith(".json") ||
          n.endsWith(".dtdl")
      ) {
        return "json";
      }
      if (
          lower.startsWith("text/") ||
          n.endsWith(".txt") ||
          n.endsWith(".log") ||
          n.endsWith(".md")
      ) {
        return "text";
      }
      return "other";
    },

    getTypeLabel(mime = "", name = "") {
      const tag = this.getTypeTag(mime, name);
      switch (tag) {
        case "sheet":
          return "表格";
        case "json":
          return "JSON / 模型";
        case "text":
          return "文本";
        default:
          return "其它";
      }
    },

    // 仅通过文件名猜一个 mime
    guessMimeByName(name = "") {
      const n = name.toLowerCase();
      if (n.endsWith(".xls") || n.endsWith(".xlsx")) {
        return "application/vnd.ms-excel";
      }
      if (n.endsWith(".csv")) {
        return "text/csv";
      }
      if (n.endsWith(".json") || n.endsWith(".dtdl")) {
        return "application/json";
      }
      if (n.endsWith(".txt") || n.endsWith(".log") || n.endsWith(".md")) {
        return "text/plain";
      }
      return "";
    },

    formatSize(size) {
      if (size == null || isNaN(size)) return "-";
      const kb = 1024;
      const mb = kb * 1024;
      const gb = mb * 1024;
      if (size >= gb) {
        return (size / gb).toFixed(2) + " GB";
      } else if (size >= mb) {
        return (size / mb).toFixed(2) + " MB";
      } else if (size >= kb) {
        return (size / kb).toFixed(2) + " KB";
      }
      return size + " B";
    },

    formatTime(isoStr) {
      if (!isoStr) return "-";
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const pad = n => (n < 10 ? "0" + n : "" + n);
      const y = d.getFullYear();
      const m = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const h = pad(d.getHours());
      const min = pad(d.getMinutes());
      return `${y}-${m}-${day} ${h}:${min}`;
    }
  }
};
</script>

<style scoped>
/* ===== 外层容器：贴右侧深色主题 ===== */
.rg-file-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 10px 12px 12px 12px;
  box-sizing: border-box;
  color: rgba(226, 232, 240, 0.96);
}

/* 顶部区域 */
.rg-file-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.rg-file-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.rg-file-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: radial-gradient(circle, #38bdf8, #1d4ed8);
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.8);
}

.rg-file-title-text {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: rgba(226, 232, 240, 0.98);
}

.rg-file-header-right {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* ===== 搜索 & 下拉：暗色胶囊 ===== */
.rg-file-search {
  width: 160px;
}

.rg-file-filter {
  width: 120px;
}

.rg-file-search ::v-deep .el-input__inner,
.rg-file-filter ::v-deep .el-input__inner {
  background: radial-gradient(
      160% 160% at 0% 0%,
      rgba(148, 163, 184, 0.16),
      rgba(15, 23, 42, 0.95)
  );
  border-radius: 999px;
  border: 1px solid rgba(51, 65, 85, 0.9);
  color: rgba(226, 232, 240, 0.96);
  font-size: 12px;
  height: 26px;
  line-height: 26px;
  padding: 0 26px 0 28px;
  box-shadow:
      0 8px 22px rgba(15, 23, 42, 0.9),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.rg-file-search ::v-deep .el-input__icon,
.rg-file-filter ::v-deep .el-input__icon {
  line-height: 26px;
  color: rgba(148, 163, 184, 0.9);
}

.rg-file-search ::v-deep .el-input__inner::placeholder,
.rg-file-filter ::v-deep .el-input__inner::placeholder {
  color: rgba(148, 163, 184, 0.8);
}

/* 下拉弹层：深色玻璃风 */
::v-deep .file-select-dropdown.el-select-dropdown {
  background:
      linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(11, 18, 32, 0.98)),
      radial-gradient(600px 300px at 0% 0%, rgba(96, 165, 250, 0.16), transparent 60%),
      radial-gradient(600px 300px at 100% 0%, rgba(129, 140, 248, 0.16), transparent 60%) !important;
  border-radius: 12px !important;
  border: 1px solid rgba(148, 163, 184, 0.38) !important;
  box-shadow:
      0 16px 40px rgba(0, 0, 0, 0.55),
      inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
  padding: 6px 4px !important;
  min-width: 120px !important;
  max-width: 220px !important;
}

::v-deep .file-select-dropdown .el-select-dropdown__item {
  height: 26px !important;
  line-height: 26px !important;
  padding: 0 10px !important;
  margin: 1px 0 !important;
  border-radius: 9px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  color: rgba(226, 232, 240, 0.9) !important;
  background: transparent !important;
}

::v-deep .file-select-dropdown .el-select-dropdown__item.hover,
::v-deep .file-select-dropdown .el-select-dropdown__item.selected {
  background: rgba(148, 163, 184, 0.16) !important;
  color: rgba(248, 250, 252, 0.98) !important;
}

::v-deep .file-select-dropdown.el-select-dropdown {
  max-height: 220px;
  overflow-y: auto;
  scrollbar-width: none;
}
::v-deep .file-select-dropdown.el-select-dropdown::-webkit-scrollbar {
  width: 0;
  height: 0;
}

/* ===== 主体区域：去掉容器的边框，只保留背景过渡 ===== */
.rg-file-body {
  flex: 1;
  min-height: 0;
  border-radius: 16px;
  border: none;
  background:
      radial-gradient(
          420px 260px at 0% 0%,
          rgba(56, 189, 248, 0.10),
          transparent 55%
      ),
      radial-gradient(
          420px 260px at 100% 100%,
          rgba(129, 140, 248, 0.12),
          transparent 55%
      ),
      #020617;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.9);
  padding: 2px;
  box-sizing: border-box;
  display: flex;
}

/* 骨架 / 空态 */
.rg-file-placeholder {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  font-size: 12px;
  color: rgba(148, 163, 184, 0.9);
}

.rg-file-empty-icon {
  text-align: center;
  font-size: 22px;
}

.rg-file-empty-text {
  text-align: center;
}

.rg-skeleton-line {
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(
      90deg,
      rgba(30, 64, 175, 0.18),
      rgba(148, 163, 184, 0.22),
      rgba(30, 64, 175, 0.18)
  );
  background-size: 200% 100%;
  animation: rg-skeleton 1.3s ease-in-out infinite;
}

@keyframes rg-skeleton {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* ===== 单列铺满、扁平卡片列表 ===== */
.rg-file-grid {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 2px;
  overflow-y: auto;
  scrollbar-width: thin;
}

/* 每张卡片宽度铺满，高度偏矮 —— 完全无边框 */
.rg-file-card {
  width: 100%;
  border-radius: 10px;
  padding: 6px 10px;
  box-sizing: border-box;
  background:
      radial-gradient(
          130% 130% at 0% 0%,
          rgba(56, 189, 248, 0.10),
          rgba(15, 23, 42, 0.96)
      );
  border: none !important;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.65);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  transition: all 0.16s ease-out;
  min-height: 44px;
}

.rg-file-card:hover {
  background:
      radial-gradient(
          130% 130% at 0% 0%,
          rgba(56, 189, 248, 0.16),
          rgba(15, 23, 42, 1)
      );
  box-shadow: 0 6px 16px rgba(129, 140, 248, 0.55);
}

/* 左侧内容 */
.rg-file-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.rg-file-icon {
  width: 24px;
  height: 24px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: rgba(248, 250, 252, 0.98);
  background: linear-gradient(
      145deg,
      rgba(56, 189, 248, 0.9),
      rgba(59, 130, 246, 0.95)
  );
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.8);
}

.rg-file-meta {
  flex: 1;
  min-width: 0;
}

.rg-file-name {
  font-size: 12px;
  font-weight: 500;
  color: rgba(248, 250, 252, 0.96);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rg-file-sub {
  margin-top: 1px;
  font-size: 10px;
  color: rgba(148, 163, 184, 0.9);
  display: flex;
  align-items: center;
  gap: 4px;
}

.rg-file-dot-sep {
  opacity: 0.6;
}

/* 右侧内容 */
.rg-file-side {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rg-file-type-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.7);
  color: rgba(226, 232, 240, 0.9);
  background: rgba(15, 23, 42, 0.93);
}

.rg-file-card-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* ===== 通用图标按钮（中号，顶部用） */
.rg-icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(226, 232, 240, 0.9);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all .15s ease;
}

.rg-icon-btn:hover:not(:disabled) {
  border-color: rgba(129, 140, 248, 0.8);
  background: rgba(129, 140, 248, 0.18);
  box-shadow: 0 0 8px rgba(129,140,248,.4);
  color: #fff;
}

.rg-icon-btn:disabled {
  opacity: .45;
  cursor: not-allowed;
}

/* ===== 小号图标按钮（行内用） */
.rg-icon-btn-sm {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(226, 232, 240, 0.85);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all .15s ease;
}

.rg-icon-btn-sm:hover {
  border-color: rgba(96, 165, 250, 0.9);
  background: rgba(96, 165, 250, 0.18);
  color: #fff;
}

/* 删除按钮额外样式（微红一点点） */
.rg-icon-btn-danger {
  border-color: rgba(248, 113, 113, 0.55);
}

.rg-icon-btn-danger:hover {
  border-color: rgba(248, 113, 113, 0.9);
  background: rgba(248, 113, 113, 0.18);
  box-shadow: 0 0 8px rgba(248, 113, 113, 0.45);
  color: #fee2e2;
}
</style>
