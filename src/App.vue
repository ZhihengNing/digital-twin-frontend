<template>
  <div id="app">
    <div class="chat-page">
      <el-row class="full-row">
        <el-col :span="leftSpan" class="full-col">
          <Graph class="full-content" :scene="scene" />
        </el-col>

        <el-col :span="chatSpan" class="full-col">
          <!-- ✅ 用 key 硬重置，避免 Chat 组件缓存导致“初始就显示上次的 createMode=true” -->
          <Chat
              :key="chatKey"
              class="full-content"
              @toggle-side="sideOpen = !sideOpen"
              @tool-event="onToolEvent"
              @session-change="onSessionChange"
          />
        </el-col>

        <el-col v-if="sideOpen" :span="sideSpan" class="full-col">
          <SidePanel
              class="full-content"
              :groups="currentSessionLogs"
              :session-id="activeSessionId"
              @close="sideOpen = false"
          />
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script>
import Chat from "@/components/Chat.vue";
import Graph from "@/components/Graph.vue";
import SidePanel from "@/components/SidePanel.vue";
import { getHistoryLog } from "@/api/chat";

export default {
  name: "App",
  components: { Graph, Chat, SidePanel },
  data() {
    return {
      scene: "test_scene",
      sideOpen: false,

      // ✅ 不再默认 default
      activeSessionId: null,

      // ✅ 控制 Chat 组件重建（避免 createMode 等 UI 状态残留）
      chatKey: 1,

      /**
       * ✅ 右侧“框框”数据结构（每次 query 一个框）
       * logGroupsBySession: { [sessionId]: Array<{id, ts, sessionId, text, source}> }
       * source: "history" | "stream"（可选，用于你调试）
       */
      logGroupsBySession: {} // { [sessionId]: Array<group> }
    };
  },

  // ✅ 关键：把 localStorage 写入提前到 created（子组件 mounted 前就能读到正确 scene）
  created() {
    this.scene = "test_scene";
    window.localStorage.setItem("scene", this.scene);

    const saved = window.localStorage.getItem("sessionId");
    this.activeSessionId = saved && String(saved).trim() ? saved : null;

    // 只有真实 session 才初始化日志数组
    if (this.activeSessionId && !this.logGroupsBySession[this.activeSessionId]) {
      this.$set(this.logGroupsBySession, this.activeSessionId, []);
    }
  },

  watch: {
    // ✅ 每次打开侧边栏：先拉一次 historyLog（List<String> -> 多个框）
    async sideOpen(val) {
      if (!val) return;
      await this.loadHistoryLogsForActiveSession();
    }
  },

  computed: {
    currentSessionLogs() {
      const sid = this.activeSessionId;
      return (this.logGroupsBySession[sid] || []);
    },
    leftSpan() { return this.sideOpen ? 11 : 16; },
    chatSpan() { return this.sideOpen ? 7 : 8; },
    sideSpan() { return 6; }
  },

  methods: {
    async loadHistoryLogsForActiveSession() {
      const sid = this.activeSessionId && String(this.activeSessionId).trim()
          ? String(this.activeSessionId).trim()
          : null;

      if (!sid) {
        return;
      }

      // ✅ 确保有数组
      if (!this.logGroupsBySession[sid]) this.$set(this.logGroupsBySession, sid, []);

      // ✅ 拉取 historyLog：后端返回 List<String>
      const res = await getHistoryLog();
      const list = res?.data || res || [];

      // 若不是数组，兜底成空
      const arr = Array.isArray(list) ? list : [];

      // ✅ 转成“框框”
      // 约定：每个 string = 一个 query 的完整日志文本
      const groupsFromHistory = arr
          .filter(s => s != null && String(s).trim() !== "")
          .map((text, idx) => ({
            id: `hist_${idx + 1}`,
            ts: Date.now(), // 你如果后端没有时间戳，只能前端用当前时间
            sessionId: sid,
            text: String(text),
            source: "history"
          }));

      // ✅ 打开侧边栏时：以 history 为准，先覆盖
      // 后续新的 query 实时日志会以 groupId(=token) 追加成新的框
      this.$set(this.logGroupsBySession, sid, groupsFromHistory);
    },

    onSessionChange(sessionId) {
      const sid = sessionId && String(sessionId).trim() ? sessionId : null;
      this.activeSessionId = sid;

      // ✅ 优化：同步写入 localStorage，确保刷新页面后能恢复默认会话
      if (sid) {
        window.localStorage.setItem("sessionId", sid);
      } else {
        window.localStorage.removeItem("sessionId");
      }

      if (sid && !this.logGroupsBySession[sid]) {
        this.$set(this.logGroupsBySession, sid, []);
      }

      // ✅ 如果侧边栏此刻是打开的，切换 session 也要立刻拉取对应 historyLog
      if (this.sideOpen) {
        this.loadHistoryLogsForActiveSession();
      }

      /**
       * ✅ 可选策略：
       * - 如果你希望“切换 session 时 Chat UI 也强制回到干净状态”，打开下面一行
       * - 如果不希望（保留 Chat 里的历史/输入等状态），就保持注释
       */
      // this.chatKey++;
    },

    onToolEvent(evt) {
      if (!evt || evt.type !== "tool.log") return;

      const sid = evt.sessionId || this.activeSessionId || "default";
      const groupId = evt.logGroupId || "unknown";
      const msg = evt?.data?.message || "";

      if (!this.logGroupsBySession[sid]) this.$set(this.logGroupsBySession, sid, []);

      const arr = this.logGroupsBySession[sid];

      // 找到同一个 groupId 的框（一次 query 一个 groupId）
      let g = arr.find(x => String(x.id) === String(groupId));

      if (!g) {
        // ✅ 新建一个框（一次提问一个框）
        g = {
          id: groupId,
          ts: evt.ts || Date.now(),
          sessionId: sid,
          text: "",
          source: "stream"
        };
        arr.push(g);
      }

      // ✅ 追加到同一个框
      g.text += (msg + "\n");
    }
  }
};
</script>

<style>
/* ========= Global Layout ========= */
html, body {
  height: 100%;
  margin: 0;
  overflow: hidden;
}
#app {
  height: 100%;
  overflow: hidden;
  text-align: left;
}

/* ========= Design Tokens (全局主题变量) ========= */
:root {
  /* 基础背景/卡片 */
  --ws-bg: #0f172a;
  --ws-workbench-grad:
      radial-gradient(1200px 600px at 20% 10%, rgba(96, 165, 250, 0.10) 0%, rgba(96, 165, 250, 0) 60%),
      radial-gradient(1000px 600px at 80% 20%, rgba(139, 92, 246, 0.10) 0%, rgba(139, 92, 246, 0) 55%),
      linear-gradient(180deg, #0b1220 0%, #0f172a 100%);

  --card-bg-grad: linear-gradient(180deg, rgba(17, 24, 39, 0.96), rgba(15, 23, 42, 0.98));
  --card-border: 1px solid rgba(255, 255, 255, 0.08);
  --card-radius: 18px;
  --card-shadow: 0 18px 60px rgba(0, 0, 0, 0.45);

  /* Header */
  --header-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
  --divider: 1px solid rgba(255, 255, 255, 0.08);

  /* 文本 */
  --t-strong: rgba(255, 255, 255, 0.92);
  --t-main: rgba(255, 255, 255, 0.86);
  --t-sub: rgba(255, 255, 255, 0.60);
  --t-muted: rgba(255, 255, 255, 0.45);

  /* Accent */
  --accent: rgba(96, 165, 250, 0.95);
  --accent-soft: rgba(96, 165, 250, 0.18);
  --accent-border: rgba(96, 165, 250, 0.25);

  /* Purple accent */
  --accent2: rgba(139, 92, 246, 0.95);

  /* 控件 */
  --ctl-bg: rgba(255, 255, 255, 0.06);
  --ctl-bg-hover: rgba(255, 255, 255, 0.10);
  --ctl-border: 1px solid rgba(255, 255, 255, 0.10);
  --ctl-radius: 12px;

  /* 输入框 */
  --input-bg: rgba(255, 255, 255, 0.06);
  --input-border: 1px solid rgba(255, 255, 255, 0.10);
  --focus-border: rgba(96, 165, 250, 0.70);
  --focus-ring: 0 0 0 2px rgba(96, 165, 250, 0.18);

  /* 气泡 */
  --bubble-border: 1px solid rgba(255, 255, 255, 0.08);
  --bubble-shadow: 0 10px 26px rgba(0, 0, 0, 0.28);
  --bubble-radius: 14px;
  --bubble-ai: rgba(255, 255, 255, 0.06);
  --bubble-user-grad: linear-gradient(180deg, rgba(96, 165, 250, 0.28) 0%, rgba(96, 165, 250, 0.16) 100%);

  /* Scrollbar */
  --sb-track: rgba(255, 255, 255, 0.05);
  --sb-thumb-grad: linear-gradient(180deg, rgba(96, 165, 250, 0.42), rgba(255, 255, 255, 0.18));
  --sb-thumb-grad-hover: linear-gradient(180deg, rgba(96, 165, 250, 0.60), rgba(255, 255, 255, 0.22));
}

/* ========= Workbench ========= */
.chat-page {
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--ws-workbench-grad);
  color: var(--t-main);
}

/* el-row 用 flex + gap */
.full-row {
  height: 100%;
  width: 100%;
  margin: 0 !important;
  display: flex;
  gap: 12px;
  padding: 12px;
  box-sizing: border-box;
}
.full-col {
  height: 100%;
  min-height: 0;
  display: flex;
  box-sizing: border-box;
}
.full-content {
  flex: 1;
  height: 100%;
  min-height: 0;
}
</style>
