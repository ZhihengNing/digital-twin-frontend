<template>
    <div class="chat-card">
      <!-- 标头 -->
      <div class="chat-header">
        <div class="title">
          <span class="dot" />
          <span class="header-title">智能对话助手</span>
        </div>
        <div class="sub">ChatGPT 风格 </div>
      </div>

      <!-- 聊天内容区域（滚动） -->
      <div class="chat-content" ref="chatContent">
        <!-- 空状态 -->
        <div v-if="messages.length === 0" class="empty-chat">
          <el-empty description="开始你的对话吧 🚀" />
        </div>

        <!-- 消息列表 -->
        <div v-else class="message-list">
          <div
              v-for="(msg, index) in messages"
              :key="index"
              class="message-item"
          >
            <!-- 机器人消息 -->
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

            <!-- 用户消息 -->
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

      <!-- ✅ 输入区域：固定在底部（不悬浮） -->
      <div class="chat-input-area">
        <el-input
            v-model="inputContent"
            type="textarea"
            :rows="3"
            placeholder="请输入你想发送的内容..."
            @keyup.enter.native="handleSend"
            class="input-box"
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
</template>

<script>
// 移除错误的图标导入语句
export default {
  name: 'ChatGPTLikeDialog',
  data() {
    return {
      // 输入框内容
      inputContent: '',
      // 消息列表：isUser区分用户/机器人，content是内容，loading是加载状态
      messages: []
    }
  },
  methods: {
    // 发送消息
    async handleSend() {
      const content = this.inputContent.trim()
      if (!content) return

      // 1. 添加用户消息到列表
      this.messages.push({
        isUser: true,
        content
      })

      // 2. 清空输入框
      this.inputContent = ''

      // 3. 滚动到底部
      this.scrollToBottom()

      // 4. 添加机器人加载状态
      const loadingIndex = this.messages.push({
        isUser: false,
        content: '',
        loading: true
      }) - 1

      // 5. 模拟接口请求延迟（增强体验）
      await new Promise(resolve => setTimeout(resolve, 800))

      // 6. 更新机器人消息（原样返回）
      this.messages.splice(loadingIndex, 1, {
        isUser: false,
        content,
        loading: false
      })

      // 7. 再次滚动到底部
      this.scrollToBottom()
    },

    // 滚动到消息底部
    scrollToBottom() {
      this.$nextTick(() => {
        const chatContent = this.$refs.chatContent
        if (chatContent) {
          chatContent.scrollTop = chatContent.scrollHeight
        }
      })
    }
  }
}
</script>

<style scoped>

/* ===================== Chat.vue (FULL) ===================== */

/* 卡片：占满右侧列 */
.chat-card {
  width: 100%;
  height: 100%;
  box-sizing: border-box;

  background: linear-gradient(180deg, rgba(17,24,39,0.96), rgba(15,23,42,0.98));
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 18px;
  box-shadow: 0 18px 60px rgba(0,0,0,0.45);
  overflow: hidden;

  display: flex;
  flex-direction: column;
}

/* 标头（深色，不再白） */
.chat-header {
  padding: 14px 16px 10px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
}

.chat-header .title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 900;
  color: rgba(255,255,255,0.9);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(52, 211, 153, 0.95);
  box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.15);
}

.header-title {
  font-size: 16px;
  font-weight: 900;
  color: rgba(255,255,255,0.9);
}

.sub {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(255,255,255,0.6);
}

/* 聊天内容区：唯一滚动区域 */
.chat-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 16px;

  background:
      radial-gradient(900px 500px at 20% 0%, rgba(96,165,250,0.10), transparent 55%),
      linear-gradient(180deg, rgba(11,18,32,0.85), rgba(15,23,42,0.95));

  /* Firefox 滚动条 */
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.22) rgba(255,255,255,0.06);
}

/* Chrome / Edge / Safari 滚动条 */
.chat-content::-webkit-scrollbar {
  width: 10px;
}

.chat-content::-webkit-scrollbar-track {
  background: rgba(255,255,255,0.05);
  border-radius: 999px;
  margin: 8px 0;
}

.chat-content::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(96,165,250,0.42), rgba(255,255,255,0.18));
  border-radius: 999px;
  border: 2px solid rgba(15,23,42,0.85);
}

.chat-content::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(96,165,250,0.60), rgba(255,255,255,0.22));
}

/* 空状态 */
.empty-chat {
  height: 100%;
  display: grid;
  place-items: center;
}

/* 消息列表 */
.message-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.message-item {
  display: flex;
}

/* 机器人消息 */
.robot-message {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  width: 100%;
}

/* 用户消息 */
.user-message {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  align-items: flex-start;
  width: 100%;
}

/* 头像 */
.avatar {
  font-weight: 900;
}
.avatar.user {
  background: rgba(96,165,250,0.95);
  color: #fff;
}
.avatar.assistant {
  background: rgba(139,92,246,0.95);
  color: #fff;
}

/* 气泡容器 */
.bubble-wrap {
  max-width: 78%;
  display: flex;
}
.user-wrap {
  justify-content: flex-end;
}

/* 通用气泡 */
.message-bubble {
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.6;

  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 10px 26px rgba(0,0,0,0.28);
}

/* 机器人气泡：深色卡片 */
.robot-bubble {
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.88);
  border-bottom-left-radius: 6px;
}

/* 用户气泡：主色系淡渐变 */
.user-bubble {
  background: linear-gradient(180deg, rgba(96,165,250,0.28) 0%, rgba(96,165,250,0.16) 100%);
  color: rgba(255,255,255,0.92);
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

/* 输入区域：固定在底部（深色，不再白） */
.chat-input-area {
  padding: 14px 16px;
  border-top: 1px solid rgba(255,255,255,0.08);
  display: flex;
  gap: 12px;
  align-items: flex-end;

  background: rgba(17,24,39,0.98);
}

/* 输入框 */
.input-box {
  flex: 1;
}

/* Vue2 + Element UI 深度选择器 */
.input-box /deep/ textarea {
  border-radius: 10px;
  resize: none;
  padding: 12px;

  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.88);
  border: 1px solid rgba(255,255,255,0.10);
}

.input-box /deep/ textarea::placeholder {
  color: rgba(255,255,255,0.45);
}

.input-box /deep/ textarea:focus {
  border-color: rgba(96,165,250,0.7);
  box-shadow: 0 0 0 2px rgba(96,165,250,0.22);
}

/* 发送按钮：更现代一点 */
.send-btn {
  padding: 12px 22px;
  border-radius: 10px;
  font-weight: 800;
  border: none;

  background: linear-gradient(180deg, rgba(96,165,250,0.95), rgba(96,165,250,0.75));
}
.send-btn:hover {
  filter: brightness(1.05);
}

</style>