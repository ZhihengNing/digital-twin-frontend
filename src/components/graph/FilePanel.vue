<template>
  <div class="rg-file-panel">
    <!-- 顶部 -->
    <div class="rg-file-header">
      <div class="rg-file-title">
        <span class="rg-file-badge">FILE</span>
        <span class="rg-file-title-text">场景文件 · {{ scene }}</span>
      </div>

      <div class="rg-file-actions">
        <el-upload
            class="rg-file-upload"
            :action="uploadAction"
            :auto-upload="false"
            :show-file-list="false"
            :before-upload="beforeUpload"
            :on-change="handleFileChange"
        >
          <button type="button" class="rg-mini-btn">
            上传文件
          </button>
        </el-upload>

        <button
            type="button"
            class="rg-mini-btn"
            @click="loadFiles"
            :disabled="loading"
        >
          刷新
        </button>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="rg-file-body">
      <div v-if="loading" class="rg-file-loading">
        加载中...
      </div>

      <div v-else-if="!files.length" class="rg-file-empty">
        暂无文件，可以点击右上角「上传文件」添加
      </div>

      <el-table
          v-else
          :data="files"
          size="mini"
          border
          height="100%"
          class="rg-file-table"
      >
        <el-table-column
            prop="name"
            label="文件名"
            min-width="180"
            show-overflow-tooltip
        />
        <el-table-column
            prop="size"
            label="大小"
            width="100"
        >
          <template slot-scope="scope">
            {{ formatSize(scope.row.size) }}
          </template>
        </el-table-column>
        <el-table-column
            prop="type"
            label="类型"
            width="120"
            show-overflow-tooltip
        />
        <el-table-column
            prop="updatedAt"
            label="更新时间"
            min-width="160"
        >
          <template slot-scope="scope">
            {{ formatTime(scope.row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column
            label="操作"
            width="140"
        >
          <template slot-scope="scope">
            <button
                type="button"
                class="rg-mini-btn"
                @click="previewFile(scope.row)"
            >
              预览
            </button>
            <button
                type="button"
                class="rg-mini-btn"
                style="margin-left: 6px"
                @click="downloadFile(scope.row)"
            >
              下载
            </button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script>
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
      files: []
    };
  },
  computed: {
    // 这里的 action 只是占位，因为 auto-upload=false 实际不会自动发请求
    uploadAction() {
      return "#";
    }
  },
  created() {
    this.loadFiles();
  },
  methods: {
    async loadFiles() {
      this.loading = true;
      try {
        // TODO: 在这里换成你真实的后端接口
        // 示例：const res = await getSceneFiles(this.scene);
        // this.files = res.data || [];

        // Mock 数据，保证样式可见
        const now = new Date();
        this.files = [
          {
            id: "1",
            name: "设备清单.xlsx",
            size: 234567,
            type: "application/vnd.ms-excel",
            updatedAt: now.toISOString()
          },
          {
            id: "2",
            name: "机房拓扑.json",
            size: 98765,
            type: "application/json",
            updatedAt: new Date(now.getTime() - 3600 * 1000).toISOString()
          }
        ];
      } catch (e) {
        this.$message && this.$message.error("文件加载失败");
      } finally {
        this.loading = false;
      }
    },

    beforeUpload(file) {
      // 你可以在这里校验大小/类型
      // 返回 false 可以阻止选中
      return true;
    },

    handleFileChange(file) {
      const raw = file && file.raw;
      if (!raw) return;

      // 先本地插一条记录，实际上传逻辑你可以放到父组件或这里
      const now = new Date();
      const newItem = {
        id: `${now.getTime()}-${raw.name}`,
        name: raw.name,
        size: raw.size,
        type: raw.type || "未知",
        updatedAt: now.toISOString()
      };
      this.files = [newItem, ...this.files];

      // 抛事件给父组件，如果你想在外面接手上传
      this.$emit("file-selected", {
        scene: this.scene,
        file: raw
      });
    },

    previewFile(row) {
      this.$emit("preview-file", {
        scene: this.scene,
        file: row
      });
      this.$message && this.$message.info(`预览：${row.name}`);
    },

    downloadFile(row) {
      this.$emit("download-file", {
        scene: this.scene,
        file: row
      });
      this.$message && this.$message.info(`下载：${row.name}`);
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
      const pad = (n) => (n < 10 ? "0" + n : "" + n);
      const y = d.getFullYear();
      const m = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const h = pad(d.getHours());
      const min = pad(d.getMinutes());
      const s = pad(d.getSeconds());
      return `${y}-${m}-${day} ${h}:${min}:${s}`;
    }
  }
};
</script>

<style scoped>
.rg-file-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px 14px 14px 14px;
  box-sizing: border-box;
}

.rg-file-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.rg-file-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.rg-file-badge {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: rgba(248, 250, 252, 0.9);
  background: rgba(15, 23, 42, 0.96);
  border-radius: 999px;
  padding: 3px 8px;
  border: 1px solid rgba(148, 163, 184, 0.7);
}

.rg-file-title-text {
  font-size: 14px;
  font-weight: 700;
  color: rgba(226, 232, 240, 0.96);
}

.rg-file-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.rg-file-upload {
  display: inline-block;
}

/* 主体区域 */
.rg-file-body {
  flex: 1;
  min-height: 0;
  border-radius: 14px;
  border: 1px solid rgba(30, 64, 175, 0.7);
  background: radial-gradient(
      400px 260px at 0% 0%,
      rgba(37, 99, 235, 0.18),
      transparent 60%
  ),
  radial-gradient(
      400px 260px at 100% 100%,
      rgba(79, 70, 229, 0.18),
      transparent 60%
  ),
  rgba(15, 23, 42, 0.96);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.9);
  padding: 8px 10px 10px 10px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.rg-file-loading,
.rg-file-empty {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: rgba(148, 163, 184, 0.9);
}

/* 表格样式微调以适应暗色主题 */
.rg-file-table ::v-deep .el-table__header-wrapper th {
  background: rgba(15, 23, 42, 0.98);
  color: rgba(226, 232, 240, 0.9);
}

.rg-file-table ::v-deep .el-table__row {
  background-color: rgba(15, 23, 42, 0.96);
}

.rg-file-table ::v-deep .el-table__body tr:hover > td {
  background-color: rgba(30, 64, 175, 0.45);
}

.rg-file-table ::v-deep .el-table {
  background: transparent;
  color: rgba(226, 232, 240, 0.96);
}

.rg-file-table ::v-deep .el-table td,
.rg-file-table ::v-deep .el-table th.is-leaf {
  border-bottom-color: rgba(30, 64, 175, 0.7);
}
</style>
