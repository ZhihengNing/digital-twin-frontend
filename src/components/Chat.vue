<template>
  <div class="chat-card">
    <!-- Header -->
    <div class="chat-header">
      <div class="header-row">
        <div class="left-group">
          <!-- 会话切换下拉 -->
          <el-dropdown
              trigger="click"
              @command="onSessionCommand"
              placement="bottom-start"
              :hide-on-click="true"
              :disabled="!hasSessionList || sending"
          >
            <div
                class="session-pill"
                :class="{ disabled: !hasSessionList }"
                title="切换对话"
            >
              <span class="dot"></span>
              <span class="session-name">
                {{ hasSession ? activeSessionId : "请先新建/选择对话" }}
              </span>
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

          <!-- ✅ 新建对话：小 Popover 输入框 -->
          <el-popover
              v-model="createSessionPopoverVisible"
              placement="bottom-start"
              trigger="manual"
              popper-class="ws-dark-popper ws-mini-popper"
              :append-to-body="true"
          >
            <div class="mini-pop">
              <div class="mini-pop-title">新建对话</div>

              <el-input
                  ref="createInput"
                  v-model="createName"
                  placeholder="输入对话名称"
                  maxlength="40"
                  clearable
                  size="mini"
                  class="ws-dark-input ws-mini-input"
                  @keyup.enter.native="confirmCreateInline"
              />

              <div class="mini-pop-actions">
                <button class="mini-link" @click="cancelCreateInline">
                  取消
                </button>
                <el-button
                    size="mini"
                    type="primary"
                    class="ws-btn-primary"
                    :loading="creatingSession"
                    @click="confirmCreateInline"
                >
                  创建
                </el-button>
              </div>
            </div>

            <!-- reference：加号按钮 -->
            <el-tooltip slot="reference" content="新建对话" placement="bottom">
              <button
                  class="icon-btn"
                  :disabled="sending"
                  @click="openCreateInline"
                  title="新建对话"
              >
                <i class="el-icon-plus"></i>
              </button>
            </el-tooltip>
          </el-popover>

          <!-- 删除当前会话 -->
          <el-popconfirm
              v-if="hasSession"
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
          <div
              v-for="(msg, index) in messages"
              :key="index"
              class="message-item"
          >
            <!-- Assistant -->
            <div v-if="!msg.isUser" class="robot-message">
              <div class="bubble-wrap">
                <div class="message-bubble robot-bubble">
                  <div v-if="msg.loading" class="loading-row">
                    <i class="el-icon-loading spin"></i>
                    <span class="loading-text">思考中…</span>
                  </div>

                  <!-- ✅ Markdown 安全渲染 -->
                  <div
                      v-else
                      class="message-text md"
                      v-html="msg.html || ''"
                  ></div>

                  <!-- 流式打字光标 -->
                  <span
                      v-if="sending && !msg.loading && msg.isStreaming"
                      class="typing-caret"
                  ></span>
                </div>
              </div>
            </div>

            <!-- User -->
            <div v-else class="user-message">
              <div class="bubble-wrap user-wrap">
                <div class="message-bubble user-bubble">
                  <div class="message-text raw-text">{{ msg.raw }}</div>
                </div>
              </div>
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
import DOMPurify from "dompurify";

// ✅ Markdown 渲染器：禁用原始 HTML，保留换行/链接
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true
});

// ✅ 安全链接：让 linkify 的链接在新窗口打开
const defaultLinkOpen =
    md.renderer.rules.link_open ||
    function (tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };

md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const aIndex = tokens[idx].attrIndex("target");
  if (aIndex < 0) tokens[idx].attrPush(["target", "_blank"]);
  else tokens[idx].attrs[aIndex][1] = "_blank";

  const rIndex = tokens[idx].attrIndex("rel");
  if (rIndex < 0) tokens[idx].attrPush(["rel", "noopener noreferrer"]);
  else tokens[idx].attrs[rIndex][1] = "noopener noreferrer";

  return defaultLinkOpen(tokens, idx, options, env, self);
};

export default {
  name: "ChatGPTLikeDialog",
  props: {
    sideDot: { type: Boolean, default: false }
  },
  data() {
    return {
      inputContent: "",
      messages: [],
      assistants: [],

      activeSessionId: null,
      sending: false,

      // ✅ 新建对话 Popover 状态
      createName: "",
      createSessionPopoverVisible: false,
      creatingSession: false,

      logAbortCtl: null,
      bizAbortCtl: null,
      requestToken: 0,

      // ✅ 流式 Markdown 渲染节流
      _mdFlushTimer: null,
      _mdFlushIntervalMs: 60
    };
  },
  computed: {
    hasSession() {
      return !!(this.activeSessionId && String(this.activeSessionId).trim());
    },
    hasSessionList() {
      return (this.assistants || []).length > 0;
    },
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
    try {
      this.logAbortCtl?.abort();
    } catch (e) {}
    try {
      this.bizAbortCtl?.abort();
    } catch (e) {}
    try {
      if (this._mdFlushTimer) clearTimeout(this._mdFlushTimer);
    } catch (e) {}
    this._mdFlushTimer = null;
  },
  methods: {
    // ✅ 把 Markdown 文本渲染成安全 HTML
    renderMdSafe(text) {
      const src = String(text || "");
      const html = md.render(src);
      return DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["style", "script", "iframe"],
        FORBID_ATTR: ["style", "onerror", "onclick", "onload"]
      });
    },

    // ✅ 节流刷新（避免 token 太碎导致每 token render 一次）
    scheduleMdFlush(msg) {
      if (this._mdFlushTimer) return;
      this._mdFlushTimer = setTimeout(() => {
        this._mdFlushTimer = null;
        try {
          if (!msg || msg.isUser) return;
          msg.html = this.renderMdSafe(msg.raw);
          this.scrollToBottom();
        } catch (e) {}
      }, this._mdFlushIntervalMs);
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
          saved &&
          this.assistants.some(
              x =>
                  String(x.value).toLowerCase() ===
                  String(saved).toLowerCase()
          );

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
      this.$emit("session-change", val);
    },

    async fetchChatHistory() {
      if (!this.hasSession) return;

      this.messages = [
        {
          isUser: false,
          raw: "",
          html: "",
          loading: true,
          isStreaming: false
        }
      ];

      const res = await getHistoryMessages();
      const list = res?.data || res || [];

      this.messages = (list || []).map(x => {
        const isUser = (x.role || "").toUpperCase() === "USER";
        const raw = x.content || "";
        if (isUser) return { isUser: true, raw, loading: false };
        return {
          isUser: false,
          raw,
          html: this.renderMdSafe(raw),
          loading: false,
          isStreaming: false
        };
      });

      this.scrollToBottom();
    },

    // ✅ 安全 blur 输入框，避免 aria-hidden + focus 警告
    blurCreateInput() {
      try {
        const comp = this.$refs.createInput;
        if (!comp) return;
        const el = comp.$el
            ? comp.$el.querySelector("input")
            : null;
        if (el && typeof el.blur === "function") {
          el.blur();
        }
      } catch (e) {}
    },

    // 打开 Popover + 聚焦输入框
    openCreateInline() {
      if (this.sending) return;
      this.createName = "";
      this.createSessionPopoverVisible = true;
      this.creatingSession = false;

      this.$nextTick(() => {
        try {
          const comp = this.$refs.createInput;
          const el = comp?.$el?.querySelector("input");
          el && el.focus && el.focus();
        } catch (e) {}
      });
    },

    // 关闭 Popover，清理状态
    cancelCreateInline() {
      this.blurCreateInput();
      this.createName = "";
      this.createSessionPopoverVisible = false;
      this.creatingSession = false;
    },

    // 确认创建对话
    confirmCreateInline() {
      const name = (this.createName || "").trim();
      if (!name) {
        this.$message.warning("请输入对话名称");
        return;
      }

      if (
          this.assistants.some(
              x => String(x.value).toLowerCase() === name.toLowerCase()
          )
      ) {
        this.$message.warning("对话名称已存在");
        return;
      }

      this.creatingSession = true;

      this.assistants.unshift({ label: name, value: name });
      this.activeSessionId = name;
      window.localStorage.setItem("sessionId", name);
      this.messages = [];

      this.blurCreateInput();
      this.createSessionPopoverVisible = false;
      this.creatingSession = false;

      this.$emit("session-change", name);
    },

    async handleDeleteSession() {
      if (!this.hasSession) return;
      if (this.sending)
        return this.$message.warning("正在请求中，请先终止再删除");

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

      try {
        this.logAbortCtl?.abort();
      } catch (e) {}
      this.logAbortCtl = null;

      try {
        this.bizAbortCtl?.abort();
      } catch (e) {}
      this.bizAbortCtl = null;

      try {
        if (this._mdFlushTimer) clearTimeout(this._mdFlushTimer);
      } catch (e) {}
      this._mdFlushTimer = null;

      let idx = -1;
      for (let i = this.messages.length - 1; i >= 0; i--) {
        if (this.messages[i] && this.messages[i].loading) {
          idx = i;
          break;
        }
      }
      if (idx >= 0) this.messages.splice(idx, 1);

      const last = this.messages[this.messages.length - 1];
      if (last && !last.isUser) last.isStreaming = false;

      this.sending = false;
      this.scrollToBottom();
    },

    async startLogStream(tokenAtStart) {
      if (!this.hasSession) return;

      this.logAbortCtl =
          typeof AbortController !== "undefined"
              ? new AbortController()
              : null;

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
      this.messages.push({
        isUser: true,
        raw: content,
        loading: false
      });
      this.inputContent = "";
      this.scrollToBottom();

      // AI 占位
      const aiIdx =
          this.messages.push({
            isUser: false,
            raw: "",
            html: "",
            loading: true,
            isStreaming: true
          }) - 1;

      try {
        // 日志流
        this.startLogStream(myToken).catch(e => {
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
        this.bizAbortCtl =
            typeof AbortController !== "undefined"
                ? new AbortController()
                : null;

        await resolveQueryStream(content, {
          signal: this.bizAbortCtl?.signal,

          onToken: t => {
            try {
              if (myToken !== this.requestToken) return;
              if (aiIdx < 0 || aiIdx >= this.messages.length) return;

              const msg = this.messages[aiIdx];
              if (!msg || msg.isUser) return;

              if (msg.loading) msg.loading = false;

              msg.raw = (msg.raw || "") + String(t);
              this.scheduleMdFlush(msg);

              this.scrollToBottom();
            } catch (err) {
              console.error("onToken failed:", err);
            }
          },

          onDone: () => {
            try {
              if (myToken !== this.requestToken) return;
              if (aiIdx < 0 || aiIdx >= this.messages.length) return;

              const msg = this.messages[aiIdx];
              if (!msg) return;

              msg.loading = false;
              msg.isStreaming = false;

              msg.html = this.renderMdSafe(msg.raw);

              try {
                this.logAbortCtl?.abort();
              } catch (e) {}
              this.logAbortCtl = null;

              try {
                if (this._mdFlushTimer)
                  clearTimeout(this._mdFlushTimer);
              } catch (e) {}
              this._mdFlushTimer = null;

              this.scrollToBottom();
            } catch (err) {
              console.error("onDone failed:", err);
            }
          }
        });

        this.bizAbortCtl = null;
      } catch (e) {
        const aborted = isAbortError(e);

        if (myToken !== this.requestToken || aborted) {
          if (
              aiIdx >= 0 &&
              aiIdx < this.messages.length &&
              this.messages[aiIdx]?.loading
          ) {
            this.messages.splice(aiIdx, 1);
          }
          return;
        }

        if (aiIdx >= 0 && aiIdx < this.messages.length) {
          const old = this.messages[aiIdx];
          const oldText = old?.raw || "";
          const raw = oldText ? oldText + "\n\n请求失败" : "请求失败";

          this.messages.splice(aiIdx, 1, {
            isUser: false,
            raw,
            html: this.renderMdSafe(raw),
            loading: false,
            isStreaming: false
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

          try {
            this.bizAbortCtl?.abort();
          } catch (e) {}
          this.bizAbortCtl = null;

          try {
            if (this._mdFlushTimer)
              clearTimeout(this._mdFlushTimer);
          } catch (e) {}
          this._mdFlushTimer = null;
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
:root {
  --font-ui: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
  "Helvetica Neue", Arial, "Noto Sans", "PingFang SC",
  "Hiragino Sans GB", "Microsoft YaHei", "Apple Color Emoji",
  "Segoe UI Emoji";
}

/* 纯文本样式 */
.raw-text {
  white-space: pre-wrap !important;
  word-break: break-word !important;
  font-size: 14px !important;
  line-height: 1.8 !important;
}

.message-text {
  word-break: break-word;
}
.user-bubble .message-text {
  white-space: pre-wrap;
}

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
.sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--t-sub);
}

/* 会话 pill */
.session-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border-radius: 999px;
  cursor: pointer;
  user-select: none;
  background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.06),
      rgba(255, 255, 255, 0.035)
  );
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28),
  inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.session-pill:hover {
  background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.085),
      rgba(255, 255, 255, 0.045)
  );
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
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.22),
  0 0 22px rgba(34, 197, 94, 0.2);
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

/* 会话下拉 */
::v-deep .session-dropdown {
  background: rgba(10, 16, 28, 0.98) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 14px !important;
  padding: 8px 6px !important;
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.55),
  inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
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
  background: linear-gradient(
      180deg,
      rgba(96, 165, 250, 0.2),
      rgba(96, 165, 250, 0.12)
  ) !important;
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

/* 通用 icon 按钮 */
.icon-btn {
  background: rgba(255, 255, 255, 0.06) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  color: rgba(255, 255, 255, 0.78) !important;
  border-radius: 999px;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.16s ease, box-shadow 0.16s ease,
  transform 0.08s ease;
}
.icon-btn:hover {
  background: rgba(255, 255, 255, 0.09) !important;
  color: #fff !important;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.7);
  transform: translateY(-0.5px);
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

/* Popover 小输入框样式 */
::v-deep .ws-dark-popper {
  background: rgba(15, 23, 42, 0.98) !important;
  border-radius: 14px !important;
  border: 1px solid rgba(148, 163, 184, 0.35) !important;
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.6),
  inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
  padding: 10px 10px 8px 10px !important;
}
::v-deep .ws-mini-popper {
  min-width: 220px !important;
  max-width: 260px !important;
}

.mini-pop {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mini-pop-title {
  font-size: 13px;
  font-weight: 800;
  color: rgba(248, 250, 252, 0.95);
}
.ws-dark-input.ws-mini-input ::v-deep .el-input__inner {
  height: 28px !important;
  line-height: 28px !important;
  border-radius: 10px !important;
  background: rgba(15, 23, 42, 0.92) !important;
  border: 1px solid rgba(148, 163, 184, 0.4) !important;
  color: rgba(248, 250, 252, 0.95) !important;
  font-size: 13px !important;
  font-weight: 600 !important;
}
.ws-dark-input.ws-mini-input ::v-deep .el-input__inner::placeholder {
  color: rgba(148, 163, 184, 0.8) !important;
}

.mini-pop-actions {
  margin-top: 6px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  align-items: center;
}
.mini-link {
  border: none;
  background: rgba(15, 23, 42, 0.9);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(148, 163, 184, 0.92);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease,
  box-shadow 0.15s ease, border-color 0.15s ease;
  border: 1px solid rgba(148, 163, 184, 0.5);
}
.mini-link:hover {
  color: rgba(248, 250, 252, 0.98);
  background: rgba(30, 64, 175, 0.85);
  border-color: rgba(129, 140, 248, 0.85);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.7);
}
.ws-btn-primary {
  border-radius: 999px !important;
  border: none !important;
  height: 32px !important;
  padding: 0 16px !important;
  font-size: 13px !important;
  font-weight: 800 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: linear-gradient(
      180deg,
      rgba(96, 165, 250, 0.98),
      rgba(37, 99, 235, 0.92)
  ) !important;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.95) !important;
}
.ws-btn-primary:hover {
  background: linear-gradient(
      180deg,
      rgba(129, 140, 248, 1),
      rgba(59, 130, 246, 1)
  ) !important;
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.98) !important;
}

/* 内容区域 */
.chat-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 16px;
  background: radial-gradient(
      900px 500px at 20% 0%,
      rgba(96, 165, 250, 0.1),
      transparent 55%
  ),
  linear-gradient(180deg, rgba(11, 18, 32, 0.85), rgba(15, 23, 42, 0.95));
}
.chat-content {
  scrollbar-width: thin;
  scrollbar-color: rgba(96, 165, 250, 0.45)
  rgba(15, 23, 42, 0.6);
}
.chat-content::-webkit-scrollbar {
  width: 10px;
}
.chat-content::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.6);
  border-radius: 10px;
}
.chat-content::-webkit-scrollbar-thumb {
  background: linear-gradient(
      180deg,
      rgba(96, 165, 250, 0.45),
      rgba(96, 165, 250, 0.25)
  );
  border-radius: 10px;
  border: 2px solid rgba(15, 23, 42, 0.6);
}

.empty-chat {
  height: 100%;
  display: grid;
  place-items: center;
}
.message-list {
  display: flex;
  flex-direction: column;
  gap: 13px;
}
.message-item {
  width: 100%;
}

/* ✅ 行容器：左右对齐，宽度 100% */
.robot-message,
.user-message {
  display: flex;
  align-items: flex-start;
  width: 100%;
}
.robot-message {
  justify-content: flex-start; /* AI 靠左 */
}
.user-message {
  justify-content: flex-end;   /* 用户靠右 */
}

/* ✅ 气泡轨道：最大宽度 95%，内容自适应 */
.bubble-wrap {
  display: flex;
  max-width: 100%;
}
.robot-message .bubble-wrap {
  justify-content: flex-start;
}
.user-message .bubble-wrap {
  justify-content: flex-end;
}

/* ✅ 气泡：宽度由文字决定，但不超过 95% 轨道 */
.message-bubble {
  position: relative;
  display: inline-block;
  max-width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.8;
  border: var(--bubble-border);
  box-shadow: var(--bubble-shadow);
  font-family: var(--font-ui);
}

/* AI 气泡：左侧小尾巴 */
.robot-bubble {
  background: radial-gradient(circle at 0 0,
  rgba(148, 163, 184, 0.25),
  rgba(15, 23, 42, 0.96));
  color: var(--t-main);
  border-radius: 20px 18px 18px 6px;
}
.robot-bubble::before {
  content: "";
  position: absolute;
  left: -4px;
  bottom: 8px;
  width: 10px;
  height: 10px;
  background: inherit;
  border-bottom-left-radius: 10px;
  transform: rotate(35deg);
}

/* 用户气泡：蓝青渐变，无尾巴 */
.user-bubble {
  background: linear-gradient(
      135deg,
      #0ea5e9,
      #3b82f6,
      #6366f1
  );
  color: rgba(255, 255, 255, 0.96);
  border-radius: 18px 20px 6px 20px;
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

/* Markdown 宽度控制：尽量不出现横向滚动条 */
.md {
  max-width: 100%;
}
.md ::v-deep * {
  max-width: 100%;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
.md ::v-deep pre {
  margin: 8px 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.1);
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-x: hidden;
}
.md ::v-deep pre code {
  padding: 0;
  border: none;
  background: transparent;
}

/* 输入区 */
.chat-input-area {
  padding: 12px 12px 14px;
  border-top: var(--divider);
  background: rgba(17, 24, 39, 0.98);
}

/* 输入壳：高亮用蓝色系，保持暗底 */
.chat-input-shell {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 10px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28),
  inset 0 1px 0 rgba(255, 255, 255, 0.04);
  overflow: hidden;
  transition: border-color 0.18s ease, box-shadow 0.18s ease,
  background 0.18s ease, transform 0.08s ease;
}
.chat-input-shell:focus-within {
  border-color: rgba(59, 130, 246, 0.9);
  background: rgba(15, 23, 42, 0.96);
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.4),
  0 18px 40px rgba(15, 23, 42, 0.98);
  transform: translateY(-0.5px);
}

.input-box {
  flex: 1;
}
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
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.12);
  outline: none;
  resize: none !important;
  overflow: hidden !important;
  overflow-y: hidden !important;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.input-box ::v-deep textarea:focus {
  border-color: rgba(59, 130, 246, 0.95);
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.55);
}
.input-box ::v-deep textarea::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
}

/* 发送按钮：粉紫主按钮，作为“用户色”点缀 */
.send-btn {
  height: 38px;
  padding: 0 16px;
  border-radius: 999px;
  font-weight: 900;
  border: none;
  color: #fff;
  background: linear-gradient(
      135deg,
      rgba(244, 114, 182, 0.98),
      rgba(168, 85, 247, 0.95)
  );
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.25);
  transition: transform 0.08s ease, box-shadow 0.16s ease,
  opacity 0.16s ease, background 0.16s ease;
}
.send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 14px 26px rgba(15, 23, 42, 0.9);
}
.send-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.9);
}
.send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.send-btn.is-stop {
  background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.95),
      rgba(220, 38, 38, 0.88)
  );
}

.more-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.notify-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #ef4444;
  box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.95),
  0 0 14px rgba(239, 68, 68, 0.55);
  pointer-events: none;
}

.typing-caret {
  display: inline-block;
  width: 8px;
  height: 16px;
  margin-left: 4px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.65);
  vertical-align: -2px;
  animation: blink 1s infinite;
}
@keyframes blink {
  0%,
  49% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}

/* Markdown 基本排版 */
.md ::v-deep p {
  margin: 0 0 8px;
}
.md ::v-deep ul,
.md ::v-deep ol {
  margin: 6px 0 10px 18px;
  padding: 0;
}
.md ::v-deep li {
  margin: 4px 0;
}
.md ::v-deep strong {
  font-weight: 900;
}
.md ::v-deep code {
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
  "Liberation Mono", monospace;
  font-size: 13px;
}
</style>
