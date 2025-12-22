<template>
  <div class="chat-card">
    <!-- Header -->
    <div class="chat-header">
      <div class="header-row">
        <div class="left-group">
          <el-dropdown
              trigger="click"
              @command="onSessionCommand"
              placement="bottom-start"
              :hide-on-click="true"
              :disabled="!hasSessionList || sending"
          >
            <div class="session-pill" :class="{ disabled: !hasSessionList }" title="切换对话">
              <span class="dot"></span>
              <span class="session-name">{{ hasSession ? activeSessionId : "请先新建/选择对话" }}</span>
              <i class="el-icon-arrow-down caret"></i>
            </div>

            <el-dropdown-menu slot="dropdown" class="session-dropdown">
              <el-dropdown-item
                  v-for="item in assistants"
                  :key="item.value"
                  :command="item.value"
                  :class="{ active: item.value === activeSessionId }"
              >
                <span class="menu-dot" v-if="item.value === activeSessionId"></span>
                <span>{{ item.label }}</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>

          <el-button
              v-if="!createMode"
              class="icon-btn"
              icon="el-icon-plus"
              circle
              size="mini"
              :disabled="sending"
              @click="openCreateInline"
              title="新建对话"
          />

          <div v-if="createMode" class="create-inline">
            <el-input
                ref="createInput"
                v-model="createName"
                size="mini"
                class="create-input"
                placeholder="新对话名称…"
                maxlength="40"
                @keyup.enter.native="confirmCreateInline"
                @keyup.esc.native="cancelCreateInline"
            />
            <el-button size="mini" class="create-ok" @click="confirmCreateInline">确定</el-button>
            <el-button size="mini" class="create-cancel" @click="cancelCreateInline">取消</el-button>
          </div>

          <el-popconfirm
              v-if="!createMode && hasSession"
              title="确认删除当前对话吗？删除后不可恢复"
              confirm-button-text="删除"
              cancel-button-text="取消"
              @confirm="handleDeleteSession"
          >
            <el-button
                slot="reference"
                class="icon-btn danger-btn"
                icon="el-icon-delete"
                circle
                size="mini"
                :disabled="sending"
                title="删除当前对话"
            />
          </el-popconfirm>
        </div>

        <!-- 三个点（带红点） -->
        <div class="more-wrap">
          <span v-if="showSideDot" class="notify-dot"></span>
          <el-button
              class="icon-btn"
              icon="el-icon-more"
              circle
              size="mini"
              :disabled="activeSessionId == null"
              @click="$emit('toggle-side')"
          />
        </div>
      </div>

      <div class="sub">
        <span v-if="!hasSession">请先新建一个对话名称，再开始聊天</span>
        <span v-else>点击左侧绿色标签切换对话</span>
      </div>
    </div>

    <!-- Content -->
    <div class="chat-content" ref="chatContent">
      <div v-if="!hasSession" class="empty-chat">
        <el-empty description="请先新建/选择一个对话名称，然后开始聊天 🚀" />
      </div>

      <template v-else>
        <div v-if="messages.length === 0" class="empty-chat">
          <el-empty description="开始你的对话吧 🚀" />
        </div>

        <div v-else class="message-list">
          <div v-for="(msg, index) in messages" :key="index" class="message-item">
            <!-- Assistant -->
            <div v-if="!msg.isUser" class="robot-message">
              <el-avatar class="avatar assistant" :size="36">AI</el-avatar>

              <div class="bubble-wrap">
                <div class="message-bubble robot-bubble">
                  <div v-if="msg.loading" class="loading-row">
                    <i class="el-icon-loading spin"></i>
                    <span class="loading-text">思考中…</span>
                  </div>

                  <!-- ✅ Markdown 渲染（流式节流刷新） -->
                  <div v-else class="message-text md" v-html="msg.rendered"></div>

                  <!-- ✅ 流式打字光标（更像 ChatGPT） -->
                  <span v-if="sending && !msg.loading" class="typing-caret"></span>
                </div>
              </div>
            </div>

            <!-- User -->
            <div v-else class="user-message">
              <div class="bubble-wrap user-wrap">
                <div class="message-bubble user-bubble">
                  <div class="message-text">{{ msg.raw }}</div>
                </div>
              </div>
              <el-avatar class="avatar user" :size="36">你</el-avatar>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Input -->
    <div class="chat-input-area">
      <div class="chat-input-shell">
        <el-input
            v-model="inputContent"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 6 }"
            placeholder="输入消息… Enter发送 / Shift+Enter换行"
            class="input-box"
            @keydown.native="onKeyDown"
            :readonly="sending || !hasSession"
        />

        <el-button
            class="send-btn"
            :class="{ 'is-stop': sending }"
            :icon="sending ? 'el-icon-close' : 'el-icon-position'"
            @click="sending ? abortRequest() : handleSend()"
            :disabled="(!hasSession) || (!sending && !inputContent.trim())"
        >
          {{ sending ? "终止" : "发送" }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script>
import {
  getAllSessions,
  getHistoryMessages,
  resolveQueryStream,
  delSession,
  startAgentLogStream,
  isAbortError
} from "@/api/chat";

import MarkdownIt from "markdown-it";
import hljs from "highlight.js";

// ✅ 可选：更安全（防 XSS）
// import DOMPurify from "dompurify";

const md = new MarkdownIt({
  html: false, // ✅ 不允许原始 HTML，避免注入
  linkify: true,
  breaks: true,
  highlight: (str, lang) => {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`;
      }
    } catch (e) {}
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  }
});

export default {
  name: "ChatGPTLikeDialog",
  props: {
    // ✅ App 控制：当前 session 有未读日志/需要亮红点
    sideDot: { type: Boolean, default: false }
  },
  data() {
    return {
      inputContent: "",
      messages: [],
      assistants: [],

      activeSessionId: null,
      sending: false,

      createMode: false,
      createName: "",

      logAbortCtl: null,
      bizAbortCtl: null,
      requestToken: 0,

      // ✅ Markdown 渲染节流
      _renderTimer: null,
      _renderQueue: new Set()
    };
  },
  computed: {
    hasSession() {
      return !!(this.activeSessionId && String(this.activeSessionId).trim());
    },
    hasSessionList() {
      return (this.assistants || []).length > 0;
    },
    // ✅ 红点：业务流 sending 或 App 标记未读
    showSideDot() {
      return this.sending || this.sideDot;
    }
  },
  async mounted() {
    this.cancelCreateInline();
    await this.refreshSessionsAndInit();
    if (this.hasSession) this.$emit("session-change", this.activeSessionId);
  },
  beforeDestroy() {
    try { this.logAbortCtl?.abort(); } catch (e) {}
    try { this.bizAbortCtl?.abort(); } catch (e) {}
    try {
      if (this._renderTimer) clearTimeout(this._renderTimer);
      this._renderTimer = null;
      this._renderQueue && this._renderQueue.clear();
    } catch (e) {}
  },
  methods: {
    // ✅ 流式时如果 ``` 没闭合，会导致渲染吞内容：这里补齐
    safeMarkdownSource(text) {
      const s = String(text || "");
      const fenceCount = (s.match(/```/g) || []).length;
      if (fenceCount % 2 === 1) return s + "\n```";
      return s;
    },

    // ✅ 渲染失败降级：纯文本转 HTML（用于 v-html）
    plainToSafeHtml(text) {
      return String(text || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br/>");
    },

    // ✅ 节流渲染：避免每 token 都 heavy re-render
    scheduleRender(idx) {
      // ✅ 任何异常都不允许影响业务流：必须吞掉
      try {
        if (!this._renderQueue) this._renderQueue = new Set();
        this._renderQueue.add(idx);
      } catch (e) {
        return;
      }

      if (this._renderTimer) return;

      this._renderTimer = setTimeout(() => {
        let list = [];
        try {
          list = Array.from(this._renderQueue || []);
          this._renderQueue && this._renderQueue.clear();
        } catch (e) {
          try { this._renderQueue = new Set(); } catch (e2) {}
        } finally {
          this._renderTimer = null;
        }

        list.forEach(i => {
          const msg = this.messages[i];
          if (!msg || msg.isUser) return;

          try {
            const src = this.safeMarkdownSource(msg.raw || "");
            let html = md.render(src);

            // ✅ 可选：更安全（防 XSS）
            // html = DOMPurify.sanitize(html);

            this.$set(msg, "rendered", html);
          } catch (e) {
            // ✅ 渲染失败：降级纯文本，不影响流
            this.$set(msg, "rendered", this.plainToSafeHtml(msg.raw || ""));
          }
        });

        this.scrollToBottom();
      }, 60);
    },

    async refreshSessionsAndInit() {
      this.cancelCreateInline();

      const res = await getAllSessions();
      const arr = res?.data || res || [];
      this.assistants = (arr || []).map(t => ({ label: t, value: t }));

      if (!this.assistants.length) {
        this.activeSessionId = null;
        window.localStorage.removeItem("sessionId");
        this.messages = [];
        this.cancelCreateInline();
        return;
      }

      const saved = window.localStorage.getItem("sessionId");
      const exists =
          saved && this.assistants.some(x => String(x.value).toLowerCase() === String(saved).toLowerCase());

      if (exists) {
        this.activeSessionId = saved;
      } else {
        const first = this.assistants[0]?.value;
        this.activeSessionId = first || null;
        if (first) window.localStorage.setItem("sessionId", first);
        else window.localStorage.removeItem("sessionId");
      }

      if (this.hasSession) {
        await this.fetchChatHistory();
      } else {
        this.messages = [];
      }

      this.cancelCreateInline();
    },

    async onSessionCommand(val) {
      if (this.sending) {
        this.$message.warning("正在请求中，请先终止再切换会话");
        return;
      }
      this.activeSessionId = val;
      window.localStorage.setItem("sessionId", val);
      this.cancelCreateInline();

      await this.fetchChatHistory();

      // ✅ 通知 App：切 session（App 会在这里拉 historyLog）
      this.$emit("session-change", val);
    },

    async fetchChatHistory() {
      if (!this.hasSession) return;

      // loading 占位
      this.messages = [{ isUser: false, raw: "", rendered: "", loading: true }];

      const res = await getHistoryMessages();
      const list = res?.data || res || [];

      this.messages = (list || []).map(x => {
        const isUser = (x.role || "").toUpperCase() === "USER";
        const raw = x.content || "";
        return isUser
            ? { isUser: true, raw, loading: false }
            : {
              isUser: false,
              raw,
              rendered: (() => {
                try {
                  return md.render(this.safeMarkdownSource(raw));
                } catch (e) {
                  return this.plainToSafeHtml(raw);
                }
              })(),
              loading: false
            };
      });

      this.scrollToBottom();
    },

    openCreateInline() {
      if (this.sending) return;
      this.createMode = true;
      this.createName = "";
      this.$nextTick(() => this.$refs.createInput?.focus());
    },
    cancelCreateInline() {
      this.createMode = false;
      this.createName = "";
    },
    confirmCreateInline() {
      const name = this.createName.trim();
      if (!name) return this.$message.warning("请输入对话名称");

      if (this.assistants.some(x => String(x.value).toLowerCase() === name.toLowerCase())) {
        return this.$message.warning("对话名称已存在");
      }

      this.assistants.unshift({ label: name, value: name });
      this.activeSessionId = name;
      window.localStorage.setItem("sessionId", name);

      this.messages = [];
      this.cancelCreateInline();

      // ✅ 通知 App：切到新 session（App 会拉 historyLog；此时可能为空）
      this.$emit("session-change", name);
    },

    async handleDeleteSession() {
      if (!this.hasSession) return;
      if (this.sending) return this.$message.warning("正在请求中，请先终止再删除");

      const res = await delSession();
      if (!res) return this.$message.error("删除失败");

      this.$message.success("删除成功");
      await this.refreshSessionsAndInit();
      this.$emit("session-change", this.activeSessionId);
    },

    onKeyDown(e) {
      if (!this.hasSession) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    },

    abortRequest() {
      if (!this.sending) return;

      this.requestToken++;

      try { this.logAbortCtl?.abort(); } catch (e) {}
      this.logAbortCtl = null;

      try { this.bizAbortCtl?.abort(); } catch (e) {}
      this.bizAbortCtl = null;

      let idx = -1;
      for (let i = this.messages.length - 1; i >= 0; i--) {
        if (this.messages[i] && this.messages[i].loading) { idx = i; break; }
      }
      if (idx >= 0) this.messages.splice(idx, 1);

      this.sending = false;
      this.scrollToBottom();
    },

    async startLogStream(tokenAtStart) {
      if (!this.hasSession) return;

      this.logAbortCtl = typeof AbortController !== "undefined" ? new AbortController() : null;

      await startAgentLogStream({
        signal: this.logAbortCtl?.signal,
        isActive: () => tokenAtStart === this.requestToken,
        getSessionId: () => this.activeSessionId,
        getLogGroupId: () => tokenAtStart,
        emit: (evtName, payload) => this.$emit(evtName, payload)
      });
    },

    async handleSend() {
      if (!this.hasSession) {
        this.$message.warning("请先新建/选择一个对话名称");
        return;
      }

      const content = this.inputContent.trim();
      if (!content || this.sending) return;

      this.sending = true;
      const myToken = ++this.requestToken;

      // 用户消息
      this.messages.push({ isUser: true, raw: content, loading: false });
      this.inputContent = "";
      this.scrollToBottom();

      // AI 占位（raw/rendered 分离）
      const aiIdx = this.messages.push({
        isUser: false,
        raw: "",
        rendered: "",
        loading: true
      }) - 1;

      try {
        // 日志流（解耦）
        this.startLogStream(myToken).catch((e) => {
          if (isAbortError(e)) return;
          if (myToken !== this.requestToken) return;

          this.$emit("tool-event", {
            type: "error",
            ts: Date.now(),
            sessionId: this.activeSessionId,
            data: { message: e?.message || "日志流异常" }
          });
        });

        // 业务流（流式输出）
        this.bizAbortCtl = typeof AbortController !== "undefined" ? new AbortController() : null;

        await resolveQueryStream(content, {
          signal: this.bizAbortCtl?.signal,

          onToken: (t) => {
            // ✅ 任何异常都必须吞掉，否则会被外层 catch 当成“请求失败”
            try {
              if (myToken !== this.requestToken) return;
              if (aiIdx < 0 || aiIdx >= this.messages.length) return;

              const msg = this.messages[aiIdx];
              if (!msg || msg.isUser) return;

              if (msg.loading) msg.loading = false;

              msg.raw = (msg.raw || "") + String(t);

              // ✅ 节流渲染
              this.scheduleRender(aiIdx);
            } catch (err) {
              // 不要 throw！只记录
              // eslint-disable-next-line no-console
              console.error("onToken failed:", err);
            }
          },

          onDone: () => {
            try {
              if (myToken !== this.requestToken) return;
              if (aiIdx < 0 || aiIdx >= this.messages.length) return;

              const msg = this.messages[aiIdx];
              if (msg) msg.loading = false;

              // ✅ 最终强制渲染一次
              this.scheduleRender(aiIdx);

              try { this.logAbortCtl?.abort(); } catch (e) {}
              this.logAbortCtl = null;
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error("onDone failed:", err);
            }
          }
        });

        this.bizAbortCtl = null;
      } catch (e) {
        const aborted = isAbortError(e);

        if (myToken !== this.requestToken || aborted) {
          if (aiIdx >= 0 && aiIdx < this.messages.length && this.messages[aiIdx]?.loading) {
            this.messages.splice(aiIdx, 1);
          }
          return;
        }

        if (aiIdx >= 0 && aiIdx < this.messages.length) {
          const old = this.messages[aiIdx];
          const oldText = old?.raw || "";
          const raw = oldText ? (oldText + "\n\n请求失败") : "请求失败";

          let rendered = "";
          try {
            rendered = md.render(this.safeMarkdownSource(raw));
          } catch (err) {
            rendered = this.plainToSafeHtml(raw);
          }

          this.messages.splice(aiIdx, 1, {
            isUser: false,
            raw,
            rendered,
            loading: false
          });
        }

        this.$emit("tool-event", {
          type: "error",
          ts: Date.now(),
          sessionId: this.activeSessionId,
          data: { message: e?.message || "请求失败" }
        });
      } finally {
        if (myToken === this.requestToken) {
          this.sending = false;

          try { this.logAbortCtl?.abort(); } catch (e) {}
          this.logAbortCtl = null;

          try { this.bizAbortCtl?.abort(); } catch (e) {}
          this.bizAbortCtl = null;
        }
        this.scrollToBottom();
      }
    },

    scrollToBottom() {
      this.$nextTick(() => {
        const el = this.$refs.chatContent;
        if (el) el.scrollTop = el.scrollHeight;
      });
    }
  }
};
</script>

<style scoped>
:root{
  --font-ui: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial,
  "Noto Sans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Apple Color Emoji",
  "Segoe UI Emoji";
}

.message-text { white-space: pre-wrap; word-break: break-word; }

.chat-card {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  background: var(--card-bg-grad);
  border: var(--card-border);
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: var(--font-ui);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.chat-header {
  padding: 14px 16px 10px 16px;
  border-bottom: var(--divider);
  background: var(--header-bg);
}
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.left-group {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.sub { margin-top: 6px; font-size: 12px; color: var(--t-sub); }

.session-pill{
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border-radius: 999px;
  cursor: pointer;
  user-select: none;
  background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.035));
  border: 1px solid rgba(255,255,255,0.10);
  box-shadow: 0 10px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05);
}
.session-pill:hover{
  background: linear-gradient(180deg, rgba(255,255,255,0.085), rgba(255,255,255,0.045));
  border-color: rgba(255,255,255,0.14);
}
.session-pill.disabled{ opacity: 0.65; cursor: not-allowed; }
.dot{
  width: 10px; height: 10px; border-radius: 999px;
  background: rgba(34, 197, 94, 0.95);
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.22), 0 0 22px rgba(34, 197, 94, 0.20);
}
.session-name{
  max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 13px; font-weight: 900; letter-spacing: 0.2px;
  color: rgba(255,255,255,0.90);
}
.caret{ color: rgba(255,255,255,0.50); font-size: 12px; }
.session-pill:hover .caret{ color: rgba(255,255,255,0.72); }

::v-deep .session-dropdown {
  background: rgba(10, 16, 28, 0.98) !important;
  border: 1px solid rgba(255,255,255,0.10) !important;
  border-radius: 14px !important;
  padding: 8px 6px !important;
  box-shadow: 0 22px 70px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05) !important;
  backdrop-filter: blur(10px) !important;
  color: rgba(255,255,255,0.92) !important;
}
::v-deep .session-dropdown .el-dropdown-menu__item {
  height: 34px !important;
  line-height: 34px !important;
  padding: 0 12px !important;
  margin: 2px 0 !important;
  border-radius: 10px !important;
  font-size: 13px !important;
  font-weight: 700 !important;
  color: rgba(255,255,255,0.80) !important;
  background: transparent !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}
::v-deep .session-dropdown .el-dropdown-menu__item:hover {
  background: rgba(255,255,255,0.07) !important;
  color: rgba(255,255,255,0.92) !important;
}
::v-deep .session-dropdown .el-dropdown-menu__item.active {
  background: linear-gradient(180deg, rgba(96,165,250,0.20), rgba(96,165,250,0.12)) !important;
  border: 1px solid rgba(96,165,250,0.22) !important;
  color: rgba(255,255,255,0.95) !important;
  font-weight: 900 !important;
}
::v-deep .session-dropdown .el-dropdown-menu { max-height: 300px !important; overflow-y: auto !important; }
.menu-dot{
  width: 8px; height: 8px; border-radius: 999px;
  background: rgba(34, 197, 94, 0.95);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
}

.icon-btn {
  background: rgba(255,255,255,0.06) !important;
  border: 1px solid rgba(255,255,255,0.12) !important;
  color: rgba(255, 255, 255, 0.78) !important;
}
.icon-btn:hover { background: rgba(255,255,255,0.09) !important; color: #fff !important; }
.danger-btn{
  background: rgba(239,68,68,0.10) !important;
  border: 1px solid rgba(239,68,68,0.22) !important;
  color: rgba(255,255,255,0.84) !important;
}
.danger-btn:hover{
  background: rgba(239,68,68,0.16) !important;
  border-color: rgba(239,68,68,0.30) !important;
}

.create-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  flex: 0 1 auto;
  min-width: 0;
}
.create-input { width: 140px; max-width: 200px; }
::v-deep .create-input .el-input__inner{
  height: 28px !important;
  line-height: 28px !important;
  border-radius: 10px !important;
  background: rgba(255,255,255,0.06) !important;
  color: rgba(255,255,255,0.90) !important;
  border: 1px solid rgba(255,255,255,0.12) !important;
  font-family: var(--font-ui) !important;
  font-weight: 700 !important;
}
::v-deep .create-input .el-input__inner::placeholder{ color: rgba(255,255,255,0.45) !important; }
.create-ok{
  height: 28px; border-radius: 10px; font-weight: 900;
  border: none !important; color: #fff !important;
  background: linear-gradient(180deg, rgba(96, 165, 250, 0.95), rgba(96, 165, 250, 0.72)) !important;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.25) !important;
  padding: 0 10px !important;
}
.create-cancel{
  height: 28px; border-radius: 10px; font-weight: 900;
  background: rgba(255,255,255,0.06) !important;
  border: 1px solid rgba(255,255,255,0.12) !important;
  color: rgba(255,255,255,0.82) !important;
  padding: 0 10px !important;
}

.chat-content {
  flex: 1; min-height: 0; overflow-y: auto; padding: 18px 16px;
  background:
      radial-gradient(900px 500px at 20% 0%, rgba(96, 165, 250, 0.10), transparent 55%),
      linear-gradient(180deg, rgba(11, 18, 32, 0.85), rgba(15, 23, 42, 0.95));
}
.chat-content {
  scrollbar-width: thin;
  scrollbar-color: rgba(96,165,250,0.45) rgba(15,23,42,0.6);
}
.chat-content::-webkit-scrollbar { width: 10px; }
.chat-content::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.6);
  border-radius: 10px;
}
.chat-content::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(96, 165, 250, 0.45), rgba(96, 165, 250, 0.25));
  border-radius: 10px;
  border: 2px solid rgba(15, 23, 42, 0.6);
}

.empty-chat { height: 100%; display: grid; place-items: center; }
.message-list { display: flex; flex-direction: column; gap: 14px; }
.robot-message, .user-message { display: flex; gap: 10px; align-items: flex-start; width: 100%; }
.user-message { justify-content: flex-end; }
.avatar { font-weight: 900; }
.avatar.user { background: var(--accent); color: #fff; }
.avatar.assistant { background: rgba(34,197,94,0.9); color: #fff; }
.bubble-wrap { max-width: 78%; display: flex; }
.user-wrap { justify-content: flex-end; }
.message-bubble {
  position: relative;
  padding: 10px 12px;
  border-radius: var(--bubble-radius);
  font-size: 14px;
  line-height: 1.8;
  border: var(--bubble-border);
  box-shadow: var(--bubble-shadow);
  font-family: var(--font-ui);
}
.robot-bubble { background: rgba(15, 23, 42, 0.85); color: var(--t-main); border-bottom-left-radius: 6px; }
.user-bubble { background: linear-gradient(180deg, #3b82f6, #2563eb); color: rgba(255, 255, 255, 0.92); border-bottom-right-radius: 6px; }
.loading-row { display: inline-flex; align-items: center; gap: 8px; color: rgba(255, 255, 255, 0.82); }
.spin { font-size: 16px; }
.loading-text { font-size: 13px; opacity: 0.9; }

.chat-input-area { padding: 12px 12px 14px; border-top: var(--divider); background: rgba(17, 24, 39, 0.98); }
.chat-input-shell {
  display: flex; align-items: flex-end; gap: 10px; padding: 10px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  overflow: hidden;
}
.input-box { flex: 1; }
.input-box ::v-deep textarea {
  width: 100%;
  border-radius: 14px;
  padding: 10px 12px;
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
  line-height: 1.7;
  background: rgba(15, 23, 42, 0.9);
  color: rgba(255, 255, 255, 0.90);
  border: 1px solid rgba(255,255,255,0.12);
  outline: none;
  resize: none !important;
  overflow: hidden !important;
  overflow-y: hidden !important;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.input-box ::v-deep textarea::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
.send-btn{
  height: 38px; padding: 0 16px; border-radius: 12px; font-weight: 900; border: none; color: #fff;
  background: linear-gradient(180deg, rgba(96, 165, 250, 0.95), rgba(96, 165, 250, 0.72));
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.25);
}
.send-btn:disabled{ opacity: 0.45; cursor: not-allowed; }
.send-btn.is-stop{ background: linear-gradient(180deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.78)); }

/* ✅ 三个点红点 */
.more-wrap{
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.notify-dot{
  position: absolute;
  top: -2px;
  right: -2px;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #ef4444;
  box-shadow: 0 0 0 2px rgba(15,23,42,0.95), 0 0 14px rgba(239,68,68,0.55);
  pointer-events: none;
}

/* ✅ 打字光标 */
.typing-caret{
  display: inline-block;
  width: 8px;
  height: 16px;
  margin-left: 4px;
  border-radius: 4px;
  background: rgba(255,255,255,0.65);
  vertical-align: -2px;
  animation: blink 1s infinite;
}
@keyframes blink{
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

/* ✅ Markdown 渲染排版（AI 气泡内） */
.message-text.md {
  font-size: 14px;
  line-height: 1.85;
  letter-spacing: 0.2px;
}

/* 段落间距 */
.message-text.md ::v-deep p { margin: 0.35em 0; }

/* 标题 */
.message-text.md ::v-deep h1,
.message-text.md ::v-deep h2,
.message-text.md ::v-deep h3 {
  margin: 0.7em 0 0.35em;
  font-weight: 900;
  letter-spacing: 0.2px;
}

/* 列表 */
.message-text.md ::v-deep ul,
.message-text.md ::v-deep ol {
  margin: 0.35em 0 0.35em 1.1em;
  padding: 0;
}
.message-text.md ::v-deep li { margin: 0.18em 0; }

/* 行内代码 */
.message-text.md ::v-deep code {
  padding: 0.12em 0.38em;
  border-radius: 8px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.92em;
}

/* 代码块 */
.message-text.md ::v-deep pre.hljs {
  margin: 0.55em 0;
  padding: 12px 12px;
  border-radius: 14px;
  background: rgba(2, 6, 23, 0.72);
  border: 1px solid rgba(255,255,255,0.10);
  overflow: auto;
}
.message-text.md ::v-deep pre.hljs code {
  background: transparent;
  border: none;
  padding: 0;
  font-size: 13px;
  line-height: 1.7;
}

/* 引用 */
.message-text.md ::v-deep blockquote {
  margin: 0.55em 0;
  padding: 0.45em 0.8em;
  border-left: 3px solid rgba(96,165,250,0.55);
  background: rgba(96,165,250,0.10);
  border-radius: 10px;
  color: rgba(255,255,255,0.86);
}

/* 表格 */
.message-text.md ::v-deep table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 0.6em 0;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.10);
}
.message-text.md ::v-deep th,
.message-text.md ::v-deep td {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  vertical-align: top;
}
.message-text.md ::v-deep th {
  background: rgba(255,255,255,0.06);
  font-weight: 900;
}
.message-text.md ::v-deep tr:last-child td { border-bottom: none; }

/* 链接 */
.message-text.md ::v-deep a {
  color: rgba(96,165,250,0.95);
  text-decoration: none;
  font-weight: 800;
}
.message-text.md ::v-deep a:hover { text-decoration: underline; }
</style>
