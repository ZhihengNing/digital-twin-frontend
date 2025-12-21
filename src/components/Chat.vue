<template>
  <div class="chat-card">
    <!-- Header -->
    <div class="chat-header">
      <div class="header-row">
        <div class="left-group">
          <!-- Session 触发器：未开启会话时禁用 -->
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

          <!-- ✅ 输入框：只有点击加号(createMode=true)才显示 -->
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

          <!-- 删除对话：只有有 activeSessionId 时显示 -->
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

        <!-- 三个点 -->
        <el-button class="icon-btn" icon="el-icon-more" circle size="mini" @click="$emit('toggle-side')" />
      </div>

      <div class="sub">
        <span v-if="!hasSession">请先新建一个对话名称，再开始聊天</span>
        <span v-else>点击左侧绿色标签切换对话</span>
      </div>
    </div>

    <!-- Content -->
    <div class="chat-content" ref="chatContent">
      <!-- ✅ 未开启 session：提示状态（绝不自动弹输入框） -->
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
              <el-avatar class="avatar assistant" size="36">AI</el-avatar>

              <div class="bubble-wrap">
                <div class="message-bubble robot-bubble">
                  <div v-if="msg.loading" class="loading-row">
                    <i class="el-icon-loading spin"></i>
                    <span class="loading-text">思考中…</span>
                  </div>
                  <div v-else class="message-text">
                    {{ msg.content }}
                  </div>
                </div>
              </div>
            </div>

            <!-- User -->
            <div v-else class="user-message">
              <div class="bubble-wrap user-wrap">
                <div class="message-bubble user-bubble">
                  <div class="message-text">{{ msg.content }}</div>
                </div>
              </div>
              <el-avatar class="avatar user" size="36">你</el-avatar>
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
import { getAllSessions, getHistoryMessages, resolveQuery, delSession } from "@/api/chat";

/** 日志流：按行读取（兼容纯文本行 & SSE 的 data: 前缀） */
async function streamLogLines({ url, headers, body, signal, onLine }) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "text/event-stream, text/plain, */*",
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body || {}),
    signal
  });

  if (!res.ok) throw new Error(`logStream HTTP ${res.status}`);
  if (!res.body) throw new Error("logStream: response.body is null");

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";

  const emitLine = (lineRaw) => {
    if (!lineRaw) return;
    let line = String(lineRaw).trim();
    if (!line) return;

    if (line.startsWith("data:")) line = line.slice(5).trim();
    if (!line) return;

    if (line.startsWith("event:") || line.startsWith("id:") || line.startsWith("retry:")) return;
    onLine && onLine(line);
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    buf += chunk;
    buf = buf.replace(/\r\n/g, "\n");

    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      emitLine(line);
    }
  }

  const tail = buf.trim();
  if (tail) emitLine(tail);
}

export default {
  name: "ChatGPTLikeDialog",
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
      requestToken: 0
    };
  },
  computed: {
    hasSession() {
      return !!(this.activeSessionId && String(this.activeSessionId).trim());
    },
    hasSessionList() {
      return (this.assistants || []).length > 0;
    }
  },
  async mounted() {
    this.cancelCreateInline();
    await this.refreshSessionsAndInit();
    if (this.hasSession) this.$emit("session-change", this.activeSessionId);
  },
  beforeDestroy() {
    try {
      this.logAbortCtl?.abort();
    } catch (e) {}
  },
  methods: {
    async refreshSessionsAndInit() {
      // 每次刷新都强制关闭输入框（避免自动弹）
      this.cancelCreateInline();

      const res = await getAllSessions();
      const arr = res?.data || res || [];
      this.assistants = (arr || []).map((t) => ({ label: t, value: t }));

      // 没有 session：清空状态
      if (!this.assistants.length) {
        this.activeSessionId = null;
        window.localStorage.removeItem("sessionId");
        this.messages = [];
        this.cancelCreateInline();
        return;
      }

      // 有列表：优先恢复 saved；否则默认选第一个
      const saved = window.localStorage.getItem("sessionId");
      const exists =
          saved && this.assistants.some((x) => String(x.value).toLowerCase() === String(saved).toLowerCase());

      if (exists) {
        this.activeSessionId = saved;
      } else {
        // ✅ 默认选第一个 session
        const first = this.assistants[0]?.value;
        this.activeSessionId = first || null;
        if (first) window.localStorage.setItem("sessionId", first);
        else window.localStorage.removeItem("sessionId");
      }

      // 拉取历史
      if (this.hasSession) {
        await this.fetchChatHistory();
      } else {
        this.messages = [];
      }

      // 最后再关一次，保证不冒出输入框
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
      this.$emit("session-change", val);
    },

    async fetchChatHistory() {
      if (!this.hasSession) return;

      this.messages = [{ isUser: false, content: "", loading: true }];

      const res = await getHistoryMessages();
      const list = res?.data || res || [];
      this.messages = (list || []).map((x) => ({
        isUser: (x.role || "").toUpperCase() === "USER",
        content: x.content || "",
        loading: false
      }));

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

      if (this.assistants.some((x) => String(x.value).toLowerCase() === name.toLowerCase())) {
        return this.$message.warning("对话名称已存在");
      }

      // 只做前端新增：用户发话才会在后台保存
      this.assistants.unshift({ label: name, value: name });
      this.activeSessionId = name;
      window.localStorage.setItem("sessionId", name);

      this.messages = [];
      this.cancelCreateInline();
      this.$emit("session-change", name);
    },

    async handleDeleteSession() {
      if (!this.hasSession) return;
      if (this.sending) return this.$message.warning("正在请求中，请先终止再删除");

      // ⚠️ 删除前不要清 sessionId（否则后端可能定位不到要删哪个）
      const deletingId = this.activeSessionId;

      const res = await delSession(); // 由后端从 sessionId header 或上下文取
      if (!res) return this.$message.error("删除失败");

      this.$message.success("删除成功");

      // ✅ 删除成功后再刷新列表，并默认选第一个
      await this.refreshSessionsAndInit();

      if (this.activeSessionId === deletingId) {
        // refresh 后还一样：可能后端没删掉或 refresh 未更新，这里不强行改，避免误伤
      }

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
      try {
        this.logAbortCtl?.abort();
      } catch (e) {}
      this.logAbortCtl = null;

      let idx = -1;
      for (let i = this.messages.length - 1; i >= 0; i--) {
        if (this.messages[i] && this.messages[i].loading) {
          idx = i;
          break;
        }
      }
      if (idx >= 0) this.messages.splice(idx, 1);

      this.sending = false;
      this.scrollToBottom();
    },

    async startLogStream(content, tokenAtStart) {
      if (!this.hasSession) return;

      this.logAbortCtl = typeof AbortController !== "undefined" ? new AbortController() : null;

      const headers = {
        sessionId: window.localStorage.getItem("sessionId"),
        scene: window.localStorage.getItem("scene")
      };

      await streamLogLines({
        url: "/agent/logStream",
        headers,
        body: { message: content },
        signal: this.logAbortCtl?.signal,
        onLine: (line) => {
          if (tokenAtStart !== this.requestToken) return;

          this.$emit("tool-event", {
            type: "tool.log",
            ts: Date.now(),
            sessionId: this.activeSessionId,
            data: { message: line }
          });
        }
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

      this.messages.push({ isUser: true, content });
      this.inputContent = "";
      this.scrollToBottom();

      const aiIdx = this.messages.push({ isUser: false, content: "", loading: true }) - 1;

      try {
        this.startLogStream(content, myToken).catch((e) => {
          const msg = String(e?.message || "").toLowerCase();
          const isAbort =
              e?.name === "AbortError" || msg.includes("aborted") || msg.includes("canceled") || msg.includes("cancelled");

          if (!isAbort && myToken === this.requestToken) {
            this.$emit("tool-event", {
              type: "error",
              ts: Date.now(),
              sessionId: this.activeSessionId,
              data: { message: e?.message || "日志流异常" }
            });
          }
        });

        const res = await resolveQuery(content);
        if (myToken !== this.requestToken) return;

        const answer = res?.data || res || "请求失败";

        if (aiIdx >= 0 && aiIdx < this.messages.length && this.messages[aiIdx]?.loading) {
          this.messages.splice(aiIdx, 1, {
            isUser: false,
            content: String(answer),
            loading: false
          });
        }

        try {
          this.logAbortCtl?.abort();
        } catch (e) {}
        this.logAbortCtl = null;
      } catch (e) {
        const msg = String(e?.message || "").toLowerCase();
        const isAbort =
            e?.name === "AbortError" || msg.includes("aborted") || msg.includes("canceled") || msg.includes("cancelled");

        if (myToken !== this.requestToken || isAbort) {
          if (aiIdx >= 0 && aiIdx < this.messages.length && this.messages[aiIdx]?.loading) {
            this.messages.splice(aiIdx, 1);
          }
          return;
        }

        if (aiIdx >= 0 && aiIdx < this.messages.length && this.messages[aiIdx]?.loading) {
          this.messages.splice(aiIdx, 1, {
            isUser: false,
            content: "请求失败",
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
          try {
            this.logAbortCtl?.abort();
          } catch (e) {}
          this.logAbortCtl = null;
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
/* ========== 主题变量 ========== */
:root {
  --card-bg-grad: linear-gradient(180deg, #111827, #0f172a);
  --card-border: 1px solid rgba(255, 255, 255, 0.08);
  --card-radius: 16px;
  --card-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);

  --header-bg: rgba(17, 24, 39, 0.95);
  --divider: 1px solid rgba(255, 255, 255, 0.08);

  --t-main: rgba(255, 255, 255, 0.92);
  --t-sub: rgba(255, 255, 255, 0.6);
  --t-muted: rgba(255, 255, 255, 0.45);

  --sb-track: rgba(15, 23, 42, 0.8);
  --sb-thumb-grad: linear-gradient(180deg, rgba(96, 165, 250, 0.42), rgba(255, 255, 255, 0.18));
  --sb-thumb-grad-hover: linear-gradient(180deg, rgba(96, 165, 250, 0.6), rgba(255, 255, 255, 0.22));

  --bubble-radius: 14px;
  --bubble-border: 1px solid rgba(255, 255, 255, 0.08);
  --bubble-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  --bubble-ai: rgba(15, 23, 42, 0.85);
  --bubble-user-grad: linear-gradient(180deg, #3b82f6, #2563eb);

  --input-bg: rgba(15, 23, 42, 0.9);
  --input-border: 1px solid rgba(255, 255, 255, 0.12);

  --accent: #3b82f6;
  --accent2: #10b981;

  /* ✅ 更舒服的字体栈（中英都好看） */
  --font-ui: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial,
  "Noto Sans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Apple Color Emoji",
  "Segoe UI Emoji";
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
  "PingFang SC", "Microsoft YaHei";
}

.message-text {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-ui);
}

/* Card */
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

/* Header */
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
.sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--t-sub);
}

/* Session pill */
.session-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border-radius: 999px;
  cursor: pointer;
  user-select: none;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.035));
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.session-pill:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.085), rgba(255, 255, 255, 0.045));
  border-color: rgba(255, 255, 255, 0.14);
}
.session-pill.disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.95);
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.22), 0 0 22px rgba(34, 197, 94, 0.2);
}
.session-name {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.2px;
  color: rgba(255, 255, 255, 0.9);
}
.caret {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}
.session-pill:hover .caret {
  color: rgba(255, 255, 255, 0.72);
}

/* Dropdown */
::v-deep .session-dropdown {
  background: rgba(10, 16, 28, 0.98) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 14px !important;
  padding: 8px 6px !important;
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
  backdrop-filter: blur(10px) !important;
  color: rgba(255, 255, 255, 0.92) !important;
}
::v-deep .session-dropdown .el-dropdown-menu__item {
  height: 34px !important;
  line-height: 34px !important;
  padding: 0 12px !important;
  margin: 2px 0 !important;
  border-radius: 10px !important;
  font-size: 13px !important;
  font-weight: 700 !important;
  color: rgba(255, 255, 255, 0.8) !important;
  background: transparent !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}
::v-deep .session-dropdown .el-dropdown-menu__item:hover {
  background: rgba(255, 255, 255, 0.07) !important;
  color: rgba(255, 255, 255, 0.92) !important;
}
::v-deep .session-dropdown .el-dropdown-menu__item.active {
  background: linear-gradient(180deg, rgba(96, 165, 250, 0.2), rgba(96, 165, 250, 0.12)) !important;
  border: 1px solid rgba(96, 165, 250, 0.22) !important;
  color: rgba(255, 255, 255, 0.95) !important;
  font-weight: 900 !important;
}
::v-deep .session-dropdown .el-dropdown-menu {
  max-height: 300px !important;
  overflow-y: auto !important;
}
.menu-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.95);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
}

/* Icon buttons */
.icon-btn {
  background: rgba(255, 255, 255, 0.06) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  color: rgba(255, 255, 255, 0.78) !important;
}
.icon-btn:hover {
  background: rgba(255, 255, 255, 0.09) !important;
  color: #fff !important;
}
.danger-btn {
  background: rgba(239, 68, 68, 0.1) !important;
  border: 1px solid rgba(239, 68, 68, 0.22) !important;
  color: rgba(255, 255, 255, 0.84) !important;
}
.danger-btn:hover {
  background: rgba(239, 68, 68, 0.16) !important;
  border-color: rgba(239, 68, 68, 0.3) !important;
}

/* Create inline */
.create-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  flex: 0 1 auto;
  min-width: 0;
}
.create-input {
  width: 140px;
  max-width: 200px;
}
::v-deep .create-input .el-input__inner {
  height: 28px !important;
  line-height: 28px !important;
  border-radius: 10px !important;
  background: rgba(255, 255, 255, 0.06) !important;
  color: rgba(255, 255, 255, 0.9) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  font-family: var(--font-ui) !important;
  font-weight: 700 !important;
  -webkit-font-smoothing: antialiased;
}
::v-deep .create-input .el-input__inner::placeholder {
  color: rgba(255, 255, 255, 0.45) !important;
}
.create-ok {
  height: 28px;
  border-radius: 10px;
  font-weight: 900;
  border: none !important;
  color: #fff !important;
  background: linear-gradient(180deg, rgba(96, 165, 250, 0.95), rgba(96, 165, 250, 0.72)) !important;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.25) !important;
  padding: 0 10px !important;
}
.create-ok:hover {
  filter: brightness(1.05);
}
.create-cancel {
  height: 28px;
  border-radius: 10px;
  font-weight: 900;
  background: rgba(255, 255, 255, 0.06) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  color: rgba(255, 255, 255, 0.82) !important;
  padding: 0 10px !important;
}
.create-cancel:hover {
  background: rgba(255, 255, 255, 0.09) !important;
  color: rgba(255, 255, 255, 0.95) !important;
}

/* Content */
.chat-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 16px;
  background: radial-gradient(900px 500px at 20% 0%, rgba(96, 165, 250, 0.1), transparent 55%),
  linear-gradient(180deg, rgba(11, 18, 32, 0.85), rgba(15, 23, 42, 0.95));
}

/* ========== ✅ 深色主题滚动条：聊天内容区 ========== */
.chat-content {
  scrollbar-width: thin; /* Firefox */
  scrollbar-color: rgba(96, 165, 250, 0.45) rgba(15, 23, 42, 0.6);
}
.chat-content::-webkit-scrollbar {
  width: 10px;
}
.chat-content::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.6);
  border-radius: 10px;
}
.chat-content::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(96, 165, 250, 0.45), rgba(96, 165, 250, 0.25));
  border-radius: 10px;
  border: 2px solid rgba(15, 23, 42, 0.6);
}
.chat-content::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(96, 165, 250, 0.65), rgba(96, 165, 250, 0.35));
}

.empty-chat {
  height: 100%;
  display: grid;
  place-items: center;
}
.message-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.robot-message,
.user-message {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  width: 100%;
}
.user-message {
  justify-content: flex-end;
}
.avatar {
  font-weight: 900;
}
.avatar.user {
  background: var(--accent);
  color: #fff;
}
.avatar.assistant {
  background: var(--accent2);
  color: #fff;
}
.bubble-wrap {
  max-width: 78%;
  display: flex;
}
.user-wrap {
  justify-content: flex-end;
}
.message-bubble {
  padding: 10px 12px;
  border-radius: var(--bubble-radius);
  font-size: 14px;
  line-height: 1.8;
  border: var(--bubble-border);
  box-shadow: var(--bubble-shadow);
  font-family: var(--font-ui);
}
.robot-bubble {
  background: var(--bubble-ai);
  color: var(--t-main);
  border-bottom-left-radius: 6px;
}
.user-bubble {
  background: var(--bubble-user-grad);
  color: rgba(255, 255, 255, 0.92);
  border-bottom-right-radius: 6px;
}
.loading-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.82);
}
.spin {
  font-size: 16px;
}
.loading-text {
  font-size: 13px;
  opacity: 0.9;
}

/* Input */
.chat-input-area {
  padding: 12px 12px 14px;
  border-top: var(--divider);
  background: rgba(17, 24, 39, 0.98);
}
.chat-input-shell {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 10px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  overflow: hidden; /* 保险：容器也不要溢出产生滚动条 */
}
.input-box {
  flex: 1;
}

/* ✅ 输入框字体：更干净、更像 ChatGPT，并且不白 */
.input-box ::v-deep textarea {
  width: 100%;
  border-radius: 14px;
  padding: 10px 12px;

  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
  line-height: 1.7;

  background: var(--input-bg);
  color: rgba(255, 255, 255, 0.9);
  border: var(--input-border);
  outline: none;

  resize: none !important;

  /* ✅ 输入框不出现滚动条（侧边栏出现时也不出现） */
  overflow: hidden !important;
  overflow-y: hidden !important;
  scrollbar-width: none;
  -ms-overflow-style: none;

  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.input-box ::v-deep textarea::placeholder {
  color: rgba(255, 255, 255, 0.38) !important;
  font-weight: 600;
}

.input-box ::v-deep textarea[readonly] {
  background: var(--input-bg) !important;
  color: rgba(255, 255, 255, 0.82) !important;
  border: var(--input-border) !important;
  opacity: 0.95 !important;
  cursor: not-allowed;
}

/* Chrome / Safari：彻底隐藏输入框滚动条 */
.input-box ::v-deep textarea::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
}

.send-btn {
  height: 38px;
  padding: 0 16px;
  border-radius: 12px;
  font-weight: 900;
  border: none;
  color: #fff;
  background: linear-gradient(180deg, rgba(96, 165, 250, 0.95), rgba(96, 165, 250, 0.72));
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.25);
}
.send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.send-btn.is-stop {
  background: linear-gradient(180deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.78));
}

/* ========== ✅ 深色主题滚动条：Session 下拉菜单（Element UI 默认会白） ========== */
::v-deep .session-dropdown .el-dropdown-menu {
  scrollbar-width: thin;
  scrollbar-color: rgba(34, 197, 94, 0.45) rgba(10, 16, 28, 0.9);
}
::v-deep .session-dropdown .el-dropdown-menu::-webkit-scrollbar {
  width: 8px;
}
::v-deep .session-dropdown .el-dropdown-menu::-webkit-scrollbar-track {
  background: rgba(10, 16, 28, 0.9);
  border-radius: 10px;
}
::v-deep .session-dropdown .el-dropdown-menu::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(34, 197, 94, 0.55), rgba(34, 197, 94, 0.3));
  border-radius: 10px;
}
::v-deep .session-dropdown .el-dropdown-menu::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(34, 197, 94, 0.75), rgba(34, 197, 94, 0.45));
}
</style>
