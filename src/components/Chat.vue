<template>
  <div class="chat-card">
    <!-- Header -->
    <div class="chat-header">
      <div class="header-row">
        <div class="left-group">
          <span class="dot" />

          <el-select
              v-model="activeSessionId"
              size="mini"
              class="assistant-select"
              popper-class="assistant-popper"
              @change="onUserSessionChange"
          >
            <el-option
                v-for="item in assistants"
                :key="item.value"
                :label="item.label"
                :value="item.value"
            />
          </el-select>
        </div>

        <el-button
            class="icon-btn"
            icon="el-icon-more"
            circle
            size="mini"
            @click="$emit('toggle-side')"
        />
      </div>

      <div class="sub">切换助手会加载对应历史记录</div>
    </div>

    <!-- Content -->
    <div class="chat-content" ref="chatContent">
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
                <div v-if="msg.loading" class="loading">
                  <el-skeleton :rows="3" animated />
                </div>
                <div v-else class="message-text">{{ msg.content }}</div>
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
    </div>

    <!-- Input -->
    <div class="chat-input-area">
      <div class="chat-input-shell">
        <el-input
            v-model="inputContent"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 6 }"
            placeholder="输入消息…   Enter发送 Shift+Enter 换行"
            class="input-box"
            @keydown.native="onKeyDown"
        />

        <el-button
            type="primary"
            icon="el-icon-position"
            @click="handleSend"
            :disabled="!inputContent.trim()"
            class="send-btn"
        >
          发送
        </el-button>
      </div>
    </div>
  </div>
</template>

<script>
import {getAllSessions, getHistoryMessages, resolveQuery} from "@/api/chat";

export default {
  name: "ChatGPTLikeDialog",
  data() {
    return {
      inputContent: "",
      messages: [],
      assistants: [],
      activeSessionId: ""
    };
  },
  async mounted() {
    const assistants = await getAllSessions();
    if(assistants && assistants.code===200 && assistants.data){
      this.assistants=assistants.data.map((t) => {
        return {
          label: t,
          value: t
        }
      });
    }
    if(this.assistants.length===0) {
      this.assistants.push({
        label: "default",
        value: "default"
      })
    }
    this.activeSessionId = this.assistants[0].label;
    window.localStorage.setItem("sessionId",this.activeSessionId);
    await this.fetchChatHistory(this.activeSessionId);
  },
  methods: {
    async onUserSessionChange(val) {
      window.localStorage.setItem("sessionId",val);
      await this.fetchChatHistory(val);
    },

    async fetchChatHistory(sessionId) {
      this.messages = [{isUser: false, content: "", loading: true}]
      let res = await getHistoryMessages(sessionId)
      if (res && res.code === 200 && res.data) {
        this.messages = res.data.map((x) => ({
          isUser: x.role === "USER",
          content: x.content,
          loading: false
        }));
      }
      this.scrollToBottom();
    },

    onKeyDown(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    },

    async handleSend() {
      const content = this.inputContent.trim();
      if (!content) return;

      this.messages.push({isUser: true, content});
      this.inputContent = "";
      this.scrollToBottom();

      const loadingIndex = this.messages.push({isUser: false, content: "", loading: true}) - 1;

      let finalQuery = await resolveQuery(content);
      if(finalQuery && finalQuery.code===200) {
        finalQuery = finalQuery.data;
      }else{
        return;
      }

      this.messages.splice(loadingIndex, 1, {
        isUser: false,
        content: finalQuery,
        loading: false
      });

      this.scrollToBottom();
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
/* ========== Card ========== */
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
}

/* ========== Header ========== */
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

.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;

  background: rgba(34, 197, 94, 0.95); /* emerald-500 */
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.22);
}

.assistant-select {
  width: 180px;
}

/* 统一小圆按钮 */
.icon-btn {
  background: var(--ctl-bg) !important;
  border: var(--ctl-border) !important;
  color: rgba(255, 255, 255, 0.75) !important;
}
.icon-btn:hover {
  background: var(--ctl-bg-hover) !important;
  color: #fff !important;
}

.sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--t-sub);
}

/* ========== el-select 深色一致（输入框） ========== */
::v-deep .assistant-select .el-input__inner {
  height: 28px !important;
  line-height: 28px !important;
  border-radius: 10px !important;

  background: var(--input-bg) !important;
  color: var(--t-main) !important;
  border: var(--input-border) !important;
  box-shadow: none !important;
}
::v-deep .assistant-select .el-input__inner::placeholder {
  color: var(--t-muted) !important;
}
::v-deep .assistant-select .el-input__inner:hover {
  background: rgba(255, 255, 255, 0.08) !important;
}
::v-deep .assistant-select .el-input.is-focus .el-input__inner {
  border-color: var(--focus-border) !important;
  box-shadow: var(--focus-ring) !important;
}
::v-deep .assistant-select .el-select__caret {
  color: rgba(255, 255, 255, 0.65) !important;
}

/* ========== 下拉弹层深色 ========== */
::v-deep .assistant-popper {
  background: rgba(17, 24, 39, 0.98) !important;
  border: var(--ctl-border) !important;
  border-radius: 12px !important;
  padding: 6px 0 !important;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
}
::v-deep .assistant-popper .el-select-dropdown__item {
  height: 34px;
  line-height: 34px;
  padding: 0 14px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.78) !important;
  border-radius: 8px;
  margin: 2px 6px;
}
::v-deep .assistant-popper .el-select-dropdown__item:hover,
::v-deep .assistant-popper .el-select-dropdown__item.hover {
  background: rgba(255, 255, 255, 0.08) !important;
}
::v-deep .assistant-popper .el-select-dropdown__item.selected {
  background: rgba(96, 165, 250, 0.16) !important;
  color: var(--accent) !important;
  font-weight: 700;
}

/* ========== Content ========== */
.chat-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 16px;

  background:
      radial-gradient(900px 500px at 20% 0%, rgba(96, 165, 250, 0.10), transparent 55%),
      linear-gradient(180deg, rgba(11, 18, 32, 0.85), rgba(15, 23, 42, 0.95));

  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.22) var(--sb-track);
}

.chat-content::-webkit-scrollbar {
  width: 10px;
}
.chat-content::-webkit-scrollbar-track {
  background: var(--sb-track);
  border-radius: 999px;
  margin: 8px 0;
}
.chat-content::-webkit-scrollbar-thumb {
  background: var(--sb-thumb-grad);
  border-radius: 999px;
  border: 2px solid rgba(15, 23, 42, 0.85);
}
.chat-content::-webkit-scrollbar-thumb:hover {
  background: var(--sb-thumb-grad-hover);
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

.message-item {
  display: flex;
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
  line-height: 1.6;

  border: var(--bubble-border);
  box-shadow: var(--bubble-shadow);
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

.message-text {
  white-space: pre-wrap;
  word-break: break-word;
  color: inherit;
}

.loading {
  padding: 6px 0;
}

/* ========== Input ========== */
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
}

.input-box {
  flex: 1;
}

/* textarea 深色 */
.input-box /deep/ textarea {
  width: 100%;
  border-radius: 14px;
  resize: none;
  padding: 10px 12px;

  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, "Helvetica Neue",
  Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;

  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.2px;
  line-height: 1.6;

  background: var(--input-bg);
  color: rgba(255, 255, 255, 0.90);
  border: var(--input-border);
  outline: none;

  overflow-y: hidden !important;
  resize: none !important;
}

.input-box /deep/ textarea::placeholder {
  color: var(--t-muted);
}

.input-box /deep/ textarea:focus {
  border-color: var(--focus-border);
  box-shadow: var(--focus-ring);
}

/* send button */
.send-btn {
  height: 38px;
  padding: 0 16px;
  border-radius: 12px;
  font-weight: 900;
  border: none;

  background: linear-gradient(180deg, rgba(96, 165, 250, 0.95), rgba(96, 165, 250, 0.72));
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.25);
}

.send-btn:hover {
  filter: brightness(1.05);
}
.send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  filter: none;
}

.chat-input-area,
.chat-input-shell,
.input-box,
.input-box /deep/ textarea {
  min-width: 0;
}
</style>
