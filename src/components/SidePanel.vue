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
      <div v-if="displayLogs.length === 0" class="sp-hint">
        当前会话暂无工具日志。
      </div>

      <div v-else class="sp-log-list">
        <div
            v-for="item in displayLogs"
            :key="item.__id"
            class="sp-log-item"
            :class="item.type"
        >
          <div class="row1">
            <span class="badge">{{ badgeText(item.type) }}</span>
            <span class="tool" v-if="toolName(item)">{{ toolName(item) }}</span>
            <span class="ts">{{ formatTime(item.ts) }}</span>
          </div>

          <div v-if="titleOf(item)" class="row2 title">{{ titleOf(item) }}</div>
          <pre v-if="payloadOf(item)" class="row3 code">{{ payloadOf(item) }}</pre>
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
    events: { type: Array, default: () => [] } // ✅ 直接展示 App 传过来的
  },
  computed: {
    displayLogs() {
      // 给每条事件补一个稳定 key（避免你后端没带 id）
      return (this.events || []).map((e, i) => ({
        ...e,
        __id: e.id || e.requestId || `${e.ts || Date.now()}_${i}`
      }));
    }
  },
  watch: {
    displayLogs() {
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

    toolName(ev) {
      const d = ev?.data || {};
      return d.tool || d.name || "";
    },
    titleOf(ev) {
      const t = ev?.type || "";
      if (t === "tool.start") return "调用开始";
      if (t === "tool.end") return "调用结束";
      if (t === "tool.log") return d(ev)?.level ? `日志(${d(ev).level})` : "日志";
      if (t === "error") return "错误";
      if (t === "done") return "完成";
      return t;
      function d(x){ return x?.data || {}; }
    },
    payloadOf(ev) {
      const t = ev?.type || "";
      const d = ev?.data || {};
      if (t === "tool.start") return this.prettyJSON(d.args ?? d.input ?? d);
      if (t === "tool.end") return this.prettyJSON({ costMs: d.costMs ?? d.latencyMs, result: d.result ?? d.output ?? d });
      if (t === "tool.log") return typeof d.message === "string" ? d.message : this.prettyJSON(d);
      if (t === "error") return String(d.message ?? d.error ?? "error");
      return "";
    },

    badgeText(type) {
      if (type === "tool.start") return "TOOL START";
      if (type === "tool.end") return "TOOL END";
      if (type === "tool.log") return "LOG";
      if (type === "assistant.delta") return "DELTA";
      if (type === "error") return "ERROR";
      if (type === "done") return "DONE";
      return String(type || "EVENT").toUpperCase();
    },

    formatTime(ts) {
      const d = new Date(ts || Date.now());
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const ss = String(d.getSeconds()).padStart(2, "0");
      return `${hh}:${mm}:${ss}`;
    },

    prettyJSON(obj) {
      if (obj == null) return "";
      if (typeof obj === "string") return obj;
      try { return JSON.stringify(obj, null, 2); } catch (e) { return String(obj); }
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

.sp-log-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sp-log-item {
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  padding: 10px 12px;
}

.sp-log-item.tool\.start { border-color: rgba(96,165,250,0.25); }
.sp-log-item.tool\.end   { border-color: rgba(16,185,129,0.22); }
.sp-log-item.error       { border-color: rgba(239,68,68,0.28); }

.row1{
  display:flex;
  align-items:center;
  gap: 10px;
  justify-content: space-between;
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
.tool{
  flex: 1;
  font-weight: 900;
  color: rgba(255,255,255,0.92);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ts{
  font-size: 12px;
  color: rgba(255,255,255,0.55);
  flex: 0 0 auto;
}

.row2.title{
  margin-top: 6px;
  font-size: 12px;
  font-weight: 800;
  color: rgba(255,255,255,0.75);
}

.row3.code{
  margin-top: 8px;
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

.sp-footer{
  height: 34px;
  display:flex;
  align-items:center;
  gap: 10px;
  padding: 0 14px;
  border-top: var(--divider);
  background: rgba(17,24,39,0.92);
}
.sp-footer .dot{
  width: 8px;
  height: 8px;
  border-radius: 99px;
  background: rgba(255,255,255,0.4);
}
.sp-footer .dot.streaming{ background: rgba(16,185,129,0.95); box-shadow: 0 0 10px rgba(16,185,129,0.35); }
.sp-footer .dot.done{ background: rgba(148,163,184,0.9); }
.sp-footer .dot.error{ background: rgba(239,68,68,0.95); box-shadow: 0 0 10px rgba(239,68,68,0.35); }
.sp-footer .txt{
  color: rgba(255,255,255,0.70);
  font-size: 12px;
  font-weight: 700;
}
</style>
