<template>
  <div class="sp-card">
    <div class="sp-header">
      <div class="sp-title">
        <span class="sp-dot"></span>
        <span>思考过程展示</span>
      </div>

      <button class="sp-close" @click="$emit('close')">退出</button>
    </div>

    <div class="sp-body" ref="body">
      <div v-if="displayGroups.length === 0" class="sp-hint">
        当前会话暂无工具日志。
      </div>

      <div v-else class="sp-group-list">
        <div
            v-for="g in displayGroups"
            :key="g.__id"
            class="sp-group"
        >
          <div class="g-head">
            <div class="g-left">
              <span class="badge">QUERY LOG</span>
              <span class="gid">#{{ g.__id }}</span>
            </div>
            <span class="ts">{{ formatTime(g.ts) }}</span>
          </div>

          <pre class="g-body">{{ g.text }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "SidePanel",
  props: {
    sessionId: { type: String, default: "" },
    groups: { type: Array, default: () => [] } // ✅ App 传过来的“框框”
  },
  computed: {
    displayGroups() {
      return (this.groups || [])
          .filter(g => g && String(g.text || "").trim() !== "")
          .map((g, i) => ({
            ...g,
            __id: g.id != null ? String(g.id) : `g_${i + 1}`
          }));
    }
  },
  watch: {
    displayGroups() {
      this.scrollToBottom();
    }
  },
  mounted() {
    this.scrollToBottom();
  },
  methods: {
    scrollToBottom() {
      this.$nextTick(() => {
        const el = this.$refs.body;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
      });
    },

    formatTime(ts) {
      const d = new Date(ts || Date.now());
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const ss = String(d.getSeconds()).padStart(2, "0");
      return `${hh}:${mm}:${ss}`;
    }
  }
};
</script>

<style scoped>
.sp-card {
  height: 100%;
  width: 100%;
  border-radius: var(--card-radius);
  overflow: hidden;
  display: flex;
  flex-direction: column;

  background: var(--card-bg-grad);
  border: var(--card-border);
  box-shadow: var(--card-shadow);
}

.sp-header {
  height: 56px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;

  border-bottom: var(--divider);
  background: var(--header-bg);
}

.sp-title {
  display: flex;
  gap: 10px;
  align-items: center;
  font-weight: 900;
  color: var(--t-strong);
  letter-spacing: 0.2px;
}

.sp-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 18px rgba(96, 165, 250, 0.55);
}

.sp-close {
  height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  border: var(--ctl-border);
  color: rgba(255, 255, 255, 0.82);
  background: var(--ctl-bg);
  cursor: pointer;
  transition: all 0.18s ease;
  font-weight: 800;
}
.sp-close:hover {
  background: var(--ctl-bg-hover);
  transform: translateY(-1px);
}

.sp-body {
  flex: 1;
  min-height: 0;
  padding: 14px;
  color: var(--t-main);
  overflow-y: auto;

  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.22) var(--sb-track);
}
.sp-body::-webkit-scrollbar { width: 10px; }
.sp-body::-webkit-scrollbar-track {
  background: var(--sb-track);
  border-radius: 999px;
  margin: 8px 0;
}
.sp-body::-webkit-scrollbar-thumb {
  background: var(--sb-thumb-grad);
  border-radius: 999px;
  border: 2px solid rgba(15, 23, 42, 0.85);
}
.sp-body::-webkit-scrollbar-thumb:hover {
  background: var(--sb-thumb-grad-hover);
}

.sp-hint {
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: var(--t-sub);
}

.sp-group-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ✅ 每个“框框” */
.sp-group {
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.04);
  padding: 10px 12px;
}

.g-head{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 10px;
}

.g-left{
  display:flex;
  align-items:center;
  gap: 10px;
  min-width: 0;
}

.badge{
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.3px;
  color: rgba(255,255,255,0.8);
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(0,0,0,0.18);
}

.gid{
  font-size: 12px;
  font-weight: 900;
  color: rgba(255,255,255,0.86);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ts{
  font-size: 12px;
  color: rgba(255,255,255,0.55);
  flex: 0 0 auto;
}

.g-body{
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.28);
  color: rgba(255,255,255,0.86);
  font-size: 12px;
  line-height: 1.6;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
