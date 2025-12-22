<template>
  <div id="app">
    <div class="chat-page">
      <el-row class="full-row">
        <el-col :span="leftSpan" class="full-col">
          <Graph class="full-content" :scene="scene" />
        </el-col>

        <el-col :span="chatSpan" class="full-col">
          <Chat
              :key="chatKey"
              class="full-content"
              :sideDot="currentSideDot"
              @toggle-side="onToggleSide"
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

      // 当前选中会话
      activeSessionId: null,

      // 控制 Chat 组件重建（按需）
      chatKey: 1,

      /**
       * ✅ 右侧“框框”数据结构（每次 query 一个框）
       * logGroupsBySession: { [sessionId]: Array<{id, ts, sessionId, text, source}> }
       */
      logGroupsBySession: {},

      /**
       * ✅ 未读红点（每个 session）
       * unreadBySession: { [sessionId]: boolean }
       */
      unreadBySession: {}
    };
  },

  created() {
    // ✅ 确保子组件 mounted 前 localStorage 已写好
    this.scene = "test_scene";
    window.localStorage.setItem("scene", this.scene);

    const saved = window.localStorage.getItem("sessionId");
    this.activeSessionId = saved && String(saved).trim() ? String(saved).trim() : null;

    if (this.activeSessionId) {
      if (!this.logGroupsBySession[this.activeSessionId]) {
        this.$set(this.logGroupsBySession, this.activeSessionId, []);
      }
      this.$set(this.unreadBySession, this.activeSessionId, false);

      // ✅ 你希望“选中 session 就拉历史”，所以：启动时有 session 也拉一次
      this.loadHistoryLogsForActiveSession().catch(() => {});
    }
  },

  computed: {
    currentSessionLogs() {
      const sid = this.activeSessionId;
      return (this.logGroupsBySession[sid] || []);
    },

    // ✅ 给 Chat 的红点：当前 session 是否有未读
    currentSideDot() {
      const sid = this.activeSessionId;
      return !!(sid && this.unreadBySession[sid]);
    },

    leftSpan() { return this.sideOpen ? 11 : 16; },
    chatSpan() { return this.sideOpen ? 7 : 8; },
    sideSpan() { return 6; }
  },

  methods: {
    onToggleSide() {
      this.sideOpen = !this.sideOpen;

      // ✅ 打开侧边栏 => 清掉当前 session 未读红点
      if (this.sideOpen && this.activeSessionId) {
        this.$set(this.unreadBySession, this.activeSessionId, false);
      }
    },

    async loadHistoryLogsForActiveSession() {
      const sid = this.activeSessionId && String(this.activeSessionId).trim()
          ? String(this.activeSessionId).trim()
          : null;

      if (!sid) return;

      if (!this.logGroupsBySession[sid]) this.$set(this.logGroupsBySession, sid, []);

      // ✅ 拉取 historyLog：后端返回 List<String>
      const res = await getHistoryLog();
      const list = res?.data || res || [];
      const arr = Array.isArray(list) ? list : [];

      const groupsFromHistory = arr
          .filter(s => s != null && String(s).trim() !== "")
          .map((text, idx) => ({
            id: `hist_${idx + 1}`,
            ts: Date.now(),
            sessionId: sid,
            text: String(text),
            source: "history"
          }));

      // ✅ 切换 session 时：以 history 覆盖（你之前就是这个策略）
      this.$set(this.logGroupsBySession, sid, groupsFromHistory);

      // ✅ 拉完历史 => 当前 session 未读清零
      this.$set(this.unreadBySession, sid, false);
    },

    async onSessionChange(sessionId) {
      const sid = sessionId && String(sessionId).trim() ? String(sessionId).trim() : null;
      this.activeSessionId = sid;

      // localStorage 同步
      if (sid) window.localStorage.setItem("sessionId", sid);
      else window.localStorage.removeItem("sessionId");

      if (sid && !this.logGroupsBySession[sid]) {
        this.$set(this.logGroupsBySession, sid, []);
      }
      if (sid && this.unreadBySession[sid] == null) {
        this.$set(this.unreadBySession, sid, false);
      }

      // ✅ 关键：切 session 就拉历史（不再依赖点三个点）
      if (sid) {
        await this.loadHistoryLogsForActiveSession();
      }

      // ✅ 如果侧边栏开着，切会话后也算“已读”
      if (this.sideOpen && sid) {
        this.$set(this.unreadBySession, sid, false);
      }
    },

    /**
     * ✅ 接收 Chat.vue 的日志流事件（不打开侧边栏也会写入）
     * 约定：evt = { type: "tool.log" | "error" | ... , ts, sessionId, logGroupId, data:{message} }
     */
    onToolEvent(evt) {
      if (!evt) return;

      // 只处理日志事件（你也可以扩展）
      if (evt.type !== "tool.log") return;

      const sid = evt.sessionId || this.activeSessionId || "default";
      const groupId = evt.logGroupId != null ? String(evt.logGroupId) : "unknown";
      const msg = evt?.data?.message != null ? String(evt.data.message) : "";

      if (!this.logGroupsBySession[sid]) this.$set(this.logGroupsBySession, sid, []);
      if (this.unreadBySession[sid] == null) this.$set(this.unreadBySession, sid, false);

      const arr = this.logGroupsBySession[sid];

      // 找到同一个 groupId 的框（一次 query 一个 groupId）
      let g = arr.find(x => String(x.id) === groupId);

      if (!g) {
        g = {
          id: groupId,
          ts: evt.ts || Date.now(),
          sessionId: sid,
          text: "",
          source: "stream"
        };
        arr.push(g);
      }

      // 追加文本
      g.text += (msg + "\n");

      // ✅ 不打开侧边栏也标记未读红点（仅当前 session）
      if (!this.sideOpen && sid === this.activeSessionId) {
        this.$set(this.unreadBySession, sid, true);
      }
    }
  }
};
</script>

<style>
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
  --ws-bg: #0f172a;
  --ws-workbench-grad:
      radial-gradient(1200px 600px at 20% 10%, rgba(96, 165, 250, 0.10) 0%, rgba(96, 165, 250, 0) 60%),
      radial-gradient(1000px 600px at 80% 20%, rgba(139, 92, 246, 0.10) 0%, rgba(139, 92, 246, 0) 55%),
      linear-gradient(180deg, #0b1220 0%, #0f172a 100%);

  --card-bg-grad: linear-gradient(180deg, rgba(17, 24, 39, 0.96), rgba(15, 23, 42, 0.98));
  --card-border: 1px solid rgba(255, 255, 255, 0.08);
  --card-radius: 18px;
  --card-shadow: 0 18px 60px rgba(0, 0, 0, 0.45);

  --header-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
  --divider: 1px solid rgba(255, 255, 255, 0.08);

  --t-strong: rgba(255, 255, 255, 0.92);
  --t-main: rgba(255, 255, 255, 0.86);
  --t-sub: rgba(255, 255, 255, 0.60);
  --t-muted: rgba(255, 255, 255, 0.45);

  --accent: rgba(96, 165, 250, 0.95);
  --accent-soft: rgba(96, 165, 250, 0.18);
  --accent-border: rgba(96, 165, 250, 0.25);

  --accent2: rgba(139, 92, 246, 0.95);

  --ctl-bg: rgba(255, 255, 255, 0.06);
  --ctl-bg-hover: rgba(255, 255, 255, 0.10);
  --ctl-border: 1px solid rgba(255, 255, 255, 0.10);
  --ctl-radius: 12px;

  --input-bg: rgba(255, 255, 255, 0.06);
  --input-border: 1px solid rgba(255, 255, 255, 0.10);
  --focus-border: rgba(96, 165, 250, 0.70);
  --focus-ring: 0 0 0 2px rgba(96, 165, 250, 0.18);

  --bubble-border: 1px solid rgba(255, 255, 255, 0.08);
  --bubble-shadow: 0 10px 26px rgba(0, 0, 0, 0.28);
  --bubble-radius: 14px;
  --bubble-ai: rgba(255, 255, 255, 0.06);
  --bubble-user-grad: linear-gradient(180deg, rgba(96, 165, 250, 0.28) 0%, rgba(96, 165, 250, 0.16) 100%);

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
