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
            </div>
          </div>

          <!-- ✅ 不换行：超长横向滚动 -->
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
    groups: { type: Array, default: () => [] }
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
/* ✅ 代码字体栈：更像 Source Code */
.sp-card{
  --code-font: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
  "JetBrains Mono", "Fira Code", "Source Code Pro", "Cascadia Mono",
  "Roboto Mono", "Ubuntu Mono", "Courier New", monospace;

  /* ✅ 滚动条主题变量（和主聊天区域统一） */
  --sb-track: rgba(15, 23, 42, 0.90);
  --sb-thumb-grad: linear-gradient(
      180deg,
      rgba(96, 165, 250, 0.45),
      rgba(96, 165, 250, 0.25)
  );
  --sb-thumb-grad-hover: linear-gradient(
      180deg,
      rgba(129, 140, 248, 0.95),
      rgba(59, 130, 246, 0.85)
  );

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

.sp-header{
  height: 56px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;

  border-bottom: var(--divider);
  background: var(--header-bg);
}

.sp-title{
  display: flex;
  gap: 10px;
  align-items: center;
  font-weight: 900;
  color: var(--t-strong);
  letter-spacing: 0.2px;
}

.sp-dot{
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 18px rgba(96, 165, 250, 0.55);
}

.sp-close{
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
.sp-close:hover{
  background: var(--ctl-bg-hover);
  transform: translateY(-1px);
}

.sp-body{
  flex: 1;
  min-height: 0;
  padding: 14px;
  color: var(--t-main);
  overflow-y: auto;

  /* ✅ Firefox 滚动条：暗背景 + 蓝色 thumb */
  scrollbar-width: thin;
  scrollbar-color: rgba(96, 165, 250, 0.65) var(--sb-track);
}

/* ✅ WebKit 纵向滚动条（侧边栏整体） */
.sp-body::-webkit-scrollbar{
  width: 10px;
}
.sp-body::-webkit-scrollbar-track{
  background: var(--sb-track);
  border-radius: 999px;
  margin: 8px 0;
}
.sp-body::-webkit-scrollbar-thumb{
  background: var(--sb-thumb-grad);
  border-radius: 999px;
  border: 2px solid rgba(15, 23, 42, 0.95);
}
.sp-body::-webkit-scrollbar-thumb:hover{
  background: var(--sb-thumb-grad-hover);
}

.sp-hint{
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: var(--t-sub);
}

.sp-group-list{
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sp-group{
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

/* ✅ 日志代码块：不换行 + 横向滚动 + 主题滚动条 */
.g-body{
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.28);
  color: rgba(255,255,255,0.88);

  font-family: var(--code-font);
  font-size: 12px;
  line-height: 1.65;
  font-variant-ligatures: contextual;
  letter-spacing: 0.15px;

  white-space: pre; /* 不换行 */
  overflow-x: auto;
  overflow-y: hidden;

  /* Firefox 横向滚动条颜色（会同时影响纵向，但这里只开横向） */
  scrollbar-width: thin;
  scrollbar-color: rgba(96, 165, 250, 0.65) rgba(15, 23, 42, 0.92);
}

/* WebKit 横向滚动条 */
.g-body::-webkit-scrollbar{
  height: 10px;
}
.g-body::-webkit-scrollbar-track{
  background: rgba(15, 23, 42, 0.92);
  border-radius: 999px;
}
.g-body::-webkit-scrollbar-thumb{
  background: var(--sb-thumb-grad);
  border-radius: 999px;
  border: 2px solid rgba(15, 23, 42, 0.95);
}
.g-body::-webkit-scrollbar-thumb:hover{
  background: var(--sb-thumb-grad-hover);
}
</style>
