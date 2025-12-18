<template>
    <div class="chat-card">
      <!-- 标头 -->
      <div class="chat-header">
        <div class="title">
          <span class="dot" />

          <!-- ✅ 智能助手：下拉框 -->
          <el-select
              v-model="activeAssistant"
              size="mini"
              class="assistant-select"
              popper-class="assistant-popper"
              @change="onAssistantChange"
          >
            <el-option
                v-for="item in assistants"
                :key="item.value"
                :label="item.label"
                :value="item.value"
            />
          </el-select>

          <!-- ✅ 旁边按钮：打开第三栏（你之前的 toggle-side 逻辑继续用） -->
          <el-button
              class="chat-side-btn"
              icon="el-icon-more"
              circle
              size="mini"
              @click="$emit('toggle-side')"
          />
        </div>

        <div class="sub">切换助手会加载对应历史记录</div>
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

      <!-- ✅ 输入区域：底部固定（不悬浮），更现代排版 -->
      <div class="chat-input-area">
        <div class="chat-input-shell">
          <el-input
              v-model="inputContent"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 6 }"
              placeholder="输入消息…  Enter 发送 · Shift+Enter 换行"
              class="input-box"
              @keydown.native="onKeyDown"
          />

          <el-button
              type="primary"
              icon="el-icon-position"
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
// 移除错误的图标导入语句
export default {
  name: 'ChatGPTLikeDialog',
  data() {
    return {
      // 输入框内容
      inputContent: '',
      // 消息列表：isUser区分用户/机器人，content是内容，loading是加载状态
      messages: [],
      // ✅ 下拉框数据（你可改成真实助手列表）
      assistants: [
        { label: "智能对话助手", value: "default" },
        { label: "运维助手", value: "ops" },
        { label: "知识库助手", value: "kb" }
      ],
      activeAssistant: "default"
    }
  },
  methods: {
    async onAssistantChange(val) {
      // 每次切换下拉框就拉取新的聊天记录
      await this.fetchChatHistory(val);
    },

    async fetchChatHistory(assistantKey) {
      // ✅ 这里写你的真实接口请求
      // 你可以用 axios / fetch，这里用伪代码示例

      // 1) 先清空并显示 loading（可选）
      this.messages = [{
        isUser: false,
        content: "",
        loading: true
      }];

      // 2) 模拟请求：换成你的接口调用即可
      // const res = await axios.get("/api/chat/history", { params: { assistant: assistantKey }})
      // const list = res.data;  // 期望返回 [{role:'user'|'assistant', content:'...'}]

      await new Promise(r => setTimeout(r, 400));

      // 3) 模拟不同助手历史（替换成接口返回）
      const mock = assistantKey === "ops"
          ? [
            { role: "assistant", content: "我是运维助手：你可以问我 Redis/Neo4j/服务器问题。" },
            { role: "user", content: "neo4j 远程连不上怎么办？" },
            { role: "assistant", content: "先检查 7687/7474 端口监听、防火墙、docker 端口映射。" }
          ]
          : assistantKey === "kb"
              ? [
                { role: "assistant", content: "我是知识库助手：我可以从你的本体/文档里检索答案。" }
              ]
              : [
                { role: "assistant", content: "我是智能对话助手：我们从这里开始对话吧。" }
              ];

      // 4) 转换成你当前 messages 结构
      this.messages = mock.map(x => ({
        isUser: x.role === "user",
        content: x.content,
        loading: false
      }));

      // 5) 滚动到底部
      this.scrollToBottom();
    },

    onKeyDown(e) {
      // Enter 发送，Shift+Enter 换行
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    },
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
  padding: 12px 12px 14px;
  border-top: 1px solid rgba(255,255,255,0.08);
  background: rgba(17,24,39,0.98);
}

/* 输入框 */
.input-box {
  flex: 1;
}

/* Vue2 + Element UI 深度选择器 */
.input-box /deep/ textarea {
  /* 字体（重点） */
  font-family:
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      Inter,
      "Helvetica Neue",
      Arial,
      "PingFang SC",
      "Hiragino Sans GB",
      "Microsoft YaHei",
      sans-serif;

  font-size: 14px;        /* 聊天最舒服的字号 */
  font-weight: 500;       /* 比默认 400 更有质感 */
  letter-spacing: 0.2px;  /* 轻微字距，现代感 */
  line-height: 1.6;

  /* 你原来的样式继续保留 */
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.90);
}


.input-box /deep/ textarea::placeholder {
  color: rgba(255,255,255,0.45);
}

.input-box /deep/ textarea:focus {
  border-color: rgba(96,165,250,0.7);
  box-shadow: 0 0 0 2px rgba(96,165,250,0.22);
}
.chat-input-shell{
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 10px;

  padding: 10px;
  border-radius: 16px;

  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow:
      0 10px 30px rgba(0,0,0,0.28),
      inset 0 1px 0 rgba(255,255,255,0.04);
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
/* 输入框占满 */
.input-box{
  flex: 1;
}

/* textarea 深色、圆角、无突兀边框 */
.input-box /deep/ textarea{
  width: 100%;
  border-radius: 14px;
  resize: none;
  padding: 10px 12px;

  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.90);
  border: 1px solid rgba(255,255,255,0.10);
  outline: none;

  line-height: 1.55;
}

.input-box /deep/ textarea::placeholder{
  color: rgba(255,255,255,0.45);
}

/* 聚焦态更“高级” */
.input-box /deep/ textarea:focus{
  border-color: rgba(96,165,250,0.70);
  box-shadow: 0 0 0 2px rgba(96,165,250,0.18);
}

/* 发送按钮：更紧凑更现代 */
.send-btn{
  height: 38px;
  padding: 0 16px;
  border-radius: 12px;
  font-weight: 900;
  border: none;

  background: linear-gradient(180deg, rgba(96,165,250,0.95), rgba(96,165,250,0.72));
  box-shadow: 0 10px 22px rgba(0,0,0,0.25);
}

.send-btn:hover{
  filter: brightness(1.05);
}

.send-btn:disabled{
  opacity: 0.45;
  cursor: not-allowed;
  filter: none;
}

.chat-side-btn {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  color: rgba(255,255,255,0.75);
}

.chat-side-btn:hover {
  background: rgba(255,255,255,0.12);
  color: #fff;
}

/* header 内部排版 */
.title {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 下拉框宽度 */
.assistant-select {
  width: 160px;
}

/* 让 el-select 在深色里更协调（Vue2 Element 用 /deep/） */
.assistant-select /deep/ .el-input__inner{
  height: 28px;
  line-height: 28px;
  border-radius: 10px;

  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.88);
  border: 1px solid rgba(255,255,255,0.10);
}

.assistant-select /deep/ .el-input__suffix,
.assistant-select /deep/ .el-select__caret {
  color: rgba(255,255,255,0.65);
}

/* 下拉面板（popper）深色 */
::v-deep .assistant-popper {
  background: rgba(17,24,39,0.98);
  border: 1px solid rgba(255,255,255,0.10);
}

::v-deep .assistant-popper .el-select-dropdown__item {
  color: rgba(255,255,255,0.78);
}

::v-deep .assistant-popper .el-select-dropdown__item.hover,
::v-deep .assistant-popper .el-select-dropdown__item:hover {
  background: rgba(255,255,255,0.06);
}

::v-deep .assistant-popper .el-select-dropdown__item.selected {
  color: rgba(96,165,250,0.95);
}

/* 旁边按钮（你之前那套也可继续用） */
.chat-side-btn {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  color: rgba(255,255,255,0.75);
}
.chat-side-btn:hover {
  background: rgba(255,255,255,0.12);
  color: #fff;
}

</style>