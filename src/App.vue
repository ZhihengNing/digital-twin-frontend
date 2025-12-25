<template>
  <div id="app">
    <div class="root-layout">
      <!-- ✅ 左侧：数字孪生场景（可收缩） -->
      <div class="scene-sider" :class="{ collapsed: sceneSiderCollapsed }">
        <div class="sider-header">
          <div class="header-title" v-if="!sceneSiderCollapsed">数字孪生场景</div>

          <div class="header-actions">
            <!-- ✅ 展开状态：显示“添加(小 Popover) + 收起” -->
            <template v-if="!sceneSiderCollapsed">
              <!-- Popover：紧凑输入框 -->
              <el-popover
                  v-model="createScenePopoverVisible"
                  placement="bottom-end"
                  trigger="click"
                  popper-class="ws-dark-popper ws-mini-popper"
                  :append-to-body="true"
              >
                <div class="mini-pop">
                  <div class="mini-pop-title">添加场景</div>

                  <el-input
                      ref="sceneNameInput"
                      v-model="newSceneName"
                      placeholder="输入场景名称"
                      maxlength="64"
                      clearable
                      class="ws-dark-input ws-mini-input"
                      @keyup.enter.native="submitCreateScene"
                  />

                  <div class="mini-pop-actions">
                    <button class="mini-link" @click="closeCreatePopover">取消</button>
                    <el-button
                        size="mini"
                        type="primary"
                        class="ws-btn-primary"
                        :loading="creatingScene"
                        @click="submitCreateScene"
                    >
                      创建
                    </el-button>
                  </div>
                </div>

                <!-- reference：加号按钮 -->
                <el-tooltip slot="reference" content="添加场景" placement="right">
                  <button class="icon-btn" @click="onClickAddBtn">
                    <i class="el-icon-plus"></i>
                  </button>
                </el-tooltip>
              </el-popover>

              <el-tooltip content="收起" placement="right">
                <button class="icon-btn" @click="sceneSiderCollapsed = true">
                  <i class="el-icon-s-fold"></i>
                </button>
              </el-tooltip>
            </template>

            <!-- ✅ 收起状态：只显示“展开” -->
            <template v-else>
              <el-tooltip content="展开" placement="right">
                <button class="icon-btn" @click="sceneSiderCollapsed = false">
                  <i class="el-icon-s-unfold"></i>
                </button>
              </el-tooltip>
            </template>
          </div>
        </div>

        <div class="sider-body">
          <div v-if="sceneLoading" class="sider-loading">
            <i class="el-icon-loading"></i>
            <span v-if="!sceneSiderCollapsed">加载中…</span>
          </div>

          <div v-else class="scene-list">
            <!-- 展开：仅显示场景名字 -->
            <template v-if="!sceneSiderCollapsed">
              <div
                  v-for="s in normalizedScenes"
                  :key="s.sceneId"
                  class="scene-item"
                  :class="{ active: s.sceneId === scene }"
                  @click="onSelectScene(s.sceneId)"
              >
                <span class="scene-name">{{ s.name || s.sceneId }}</span>
              </div>

              <div v-if="normalizedScenes.length === 0" class="empty">暂无场景</div>
            </template>

            <!-- 收缩：仅显示小点 + tooltip -->
            <template v-else>
              <el-tooltip
                  v-for="s in normalizedScenes"
                  :key="s.sceneId"
                  :content="s.name || s.sceneId"
                  placement="right"
              >
                <div
                    class="mini-item"
                    :class="{ active: s.sceneId === scene }"
                    @click="onSelectScene(s.sceneId)"
                />
              </el-tooltip>
            </template>
          </div>
        </div>
      </div>

      <!-- ✅ 右侧：原来的工作台（三列） -->
      <div class="workbench">
        <div class="chat-page">
          <el-row class="full-row" :gutter="12">
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
                  class="full-content side-panel"
                  :groups="currentSessionLogs"
                  :session-id="activeSessionId"
                  @close="sideOpen = false"
              />
            </el-col>
          </el-row>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Chat from "@/components/Chat.vue";
import Graph from "@/components/Graph.vue";
import SidePanel from "@/components/SidePanel.vue";
import { getHistoryLog } from "@/api/chat";
import { listScenes, createScene } from "@/api/scene";

export default {
  name: "App",
  components: { Graph, Chat, SidePanel },

  data() {
    return {
      scene: "test_scene",

      // 左侧场景栏
      sceneSiderCollapsed: false,
      sceneLoading: false,
      scenes: [],

      // 添加场景：Popover
      createScenePopoverVisible: false,
      newSceneName: "",
      creatingScene: false,

      // 右侧 SidePanel
      sideOpen: false,

      // 当前会话
      activeSessionId: null,

      // 控制 Chat 重建
      chatKey: 1,

      logGroupsBySession: {},
      unreadBySession: {}
    };
  },

  computed: {
    normalizedScenes() {
      return (this.scenes || [])
          .map((x) => {
            if (typeof x === "string") return { sceneId: x, name: "" };
            if (!x) return null;
            return { sceneId: x.sceneId, name: x.name || "" };
          })
          .filter((s) => s && s.sceneId);
    },

    currentSessionLogs() {
      const sid = this.activeSessionId;
      return this.logGroupsBySession[sid] || [];
    },

    currentSideDot() {
      const sid = this.activeSessionId;
      return !!(sid && this.unreadBySession[sid]);
    },

    leftSpan() {
      return this.sideOpen ? 11 : 16;
    },
    chatSpan() {
      return this.sideOpen ? 7 : 8;
    },
    sideSpan() {
      return 6;
    }
  },

  async created() {
    // session 恢复
    const saved = window.localStorage.getItem("sessionId");
    this.activeSessionId = saved && String(saved).trim() ? String(saved).trim() : null;

    if (this.activeSessionId) {
      if (!this.logGroupsBySession[this.activeSessionId]) {
        this.$set(this.logGroupsBySession, this.activeSessionId, []);
      }
      this.$set(this.unreadBySession, this.activeSessionId, false);
      this.loadHistoryLogsForActiveSession().catch(() => {});
    }

    // scene 恢复
    const savedScene = window.localStorage.getItem("scene");
    if (savedScene && String(savedScene).trim()) {
      this.scene = String(savedScene).trim();
    }

    await this.loadScenesAndInit();
  },

  methods: {
    async loadScenesAndInit() {
      this.sceneLoading = true;
      try {
        const res = await listScenes();
        const list = res?.data?.scenes || res?.data || res || [];
        this.scenes = Array.isArray(list) ? list : [];

        const scenes = this.normalizedScenes;
        if (!scenes.length) {
          window.localStorage.setItem("scene", this.scene);
          return;
        }

        const exists = scenes.some((s) => s.sceneId === this.scene);
        this.scene = exists ? this.scene : scenes[0].sceneId;
        window.localStorage.setItem("scene", this.scene);
      } catch (e) {
        window.localStorage.setItem("scene", this.scene);
      } finally {
        this.sceneLoading = false;
      }
    },

    onSelectScene(sceneId) {
      const sid = sceneId && String(sceneId).trim() ? String(sceneId).trim() : null;
      if (!sid) return;
      if (sid === this.scene) return;

      this.scene = sid;
      window.localStorage.setItem("scene", this.scene);

      // 切场景重建 Chat，避免上下文漂移
      this.chatKey += 1;
    },

    // ===== 添加场景：Popover 逻辑 =====
    onClickAddBtn() {
      // 点击 reference 也会触发 popover 打开，这里用于“打开后聚焦”
      this.$nextTick(() => {
        const inp = this.$refs.sceneNameInput;
        if (inp && typeof inp.focus === "function") inp.focus();
      });
    },

    closeCreatePopover() {
      this.createScenePopoverVisible = false;
      this.newSceneName = "";
    },

    async submitCreateScene() {
      const name = this.newSceneName && String(this.newSceneName).trim();
      if (!name) {
        this.$message.warning("请输入场景名称");
        return;
      }
      if (name.length > 64) {
        this.$message.warning("场景名称过长（最多 64 字符）");
        return;
      }

      // ✅ 新增：与现有场景重名校验（不区分大小写）
      const exists = this.normalizedScenes.some((s) => {
        const sid = String(s.sceneId || "").trim().toLowerCase();
        const sname = String(s.name || "").trim().toLowerCase();
        const input = name.toLowerCase();
        return sid === input || sname === input;
      });

      if (exists) {
        this.$message.warning(`场景「${name}」已存在`);
        return;
      }

      this.creatingScene = true;
      try {
        const response=await createScene(name);
        if(response.code!==200){
          this.$message.error("创建失败");
          return;
        }

        this.$message.success("创建成功");

        // 关闭 popover
        this.createScenePopoverVisible = false;
        this.newSceneName = "";

        // 重新拉取并选中
        await this.loadScenesAndInit();

        // 尝试选中新场景
        const found = this.normalizedScenes.find(
            (s) => s.sceneId === name || (s.name && s.name === name)
        );
        if (found) this.onSelectScene(found.sceneId);
      } catch (e) {
        this.$message.error("创建失败");
      } finally {
        this.creatingScene = false;
      }
    },

    onToggleSide() {
      this.sideOpen = !this.sideOpen;
      if (this.sideOpen && this.activeSessionId) {
        this.$set(this.unreadBySession, this.activeSessionId, false);
      }
    },

    async loadHistoryLogsForActiveSession() {
      const sid =
          this.activeSessionId && String(this.activeSessionId).trim()
              ? String(this.activeSessionId).trim()
              : null;
      if (!sid) return;

      if (!this.logGroupsBySession[sid]) this.$set(this.logGroupsBySession, sid, []);

      const res = await getHistoryLog();
      const list = res?.data || res || [];
      const arr = Array.isArray(list) ? list : [];

      const groupsFromHistory = arr
          .filter((s) => s != null && String(s).trim() !== "")
          .map((text, idx) => ({
            id: `hist_${idx + 1}`,
            ts: Date.now(),
            sessionId: sid,
            text: String(text),
            source: "history"
          }));

      this.$set(this.logGroupsBySession, sid, groupsFromHistory);
      this.$set(this.unreadBySession, sid, false);
    },

    async onSessionChange(sessionId) {
      const sid = sessionId && String(sessionId).trim() ? String(sessionId).trim() : null;
      this.activeSessionId = sid;

      if (sid) window.localStorage.setItem("sessionId", sid);
      else window.localStorage.removeItem("sessionId");

      if (sid && !this.logGroupsBySession[sid]) {
        this.$set(this.logGroupsBySession, sid, []);
      }
      if (sid && this.unreadBySession[sid] == null) {
        this.$set(this.unreadBySession, sid, false);
      }

      if (sid) {
        await this.loadHistoryLogsForActiveSession();
      }

      if (this.sideOpen && sid) {
        this.$set(this.unreadBySession, sid, false);
      }
    },

    onToolEvent(evt) {
      if (!evt) return;
      if (evt.type !== "tool.log") return;

      const sid = evt.sessionId || this.activeSessionId || "default";
      const groupId = evt.logGroupId != null ? String(evt.logGroupId) : "unknown";
      const msg = evt?.data?.message != null ? String(evt.data.message) : "";

      if (!this.logGroupsBySession[sid]) this.$set(this.logGroupsBySession, sid, []);
      if (this.unreadBySession[sid] == null) this.$set(this.unreadBySession, sid, false);

      const arr = this.logGroupsBySession[sid];

      let g = arr.find((x) => String(x.id) === groupId);
      if (!g) {
        g = { id: groupId, ts: evt.ts || Date.now(), sessionId: sid, text: "", source: "stream" };
        arr.push(g);
      }

      g.text += msg + "\n";

      if (!this.sideOpen && sid === this.activeSessionId) {
        this.$set(this.unreadBySession, sid, true);
      }
    }
  }
};
</script>

<style>
html,
body {
  height: 100%;
  margin: 0;
  overflow: hidden;
}

#app {
  height: 100%;
  overflow: hidden;
  text-align: left;
}

/* ========= Design Tokens (保持你原来的) ========= */
:root {
  --ws-workbench-grad: radial-gradient(
      1200px 600px at 20% 10%,
      rgba(96, 165, 250, 0.10) 0%,
      rgba(96, 165, 250, 0) 60%
  ),
  radial-gradient(
      1000px 600px at 80% 20%,
      rgba(139, 92, 246, 0.10) 0%,
      rgba(139, 92, 246, 0) 55%
  ),
  linear-gradient(180deg, #0b1220 0%, #0f172a 100%);
}

/* ✅ 外层布局 */
.root-layout {
  height: 100%;
  width: 100%;
  display: flex;
  overflow: hidden;
}

/* ===== Sidebar：数字孪生场景（无圆角，深色蓝紫主题） ===== */
.scene-sider {
  width: 200px;
  min-width: 200px;
  max-width: 200px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  background:
      radial-gradient(900px 520px at 20% 10%, rgba(96,165,250,0.12), rgba(96,165,250,0) 60%),
      radial-gradient(900px 520px at 85% 15%, rgba(139,92,246,0.10), rgba(139,92,246,0) 58%),
      linear-gradient(180deg, rgba(10,16,30,0.98), rgba(9,14,26,0.99));

  border-right: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(10px);
  box-shadow: 14px 0 46px rgba(0,0,0,0.38);
}

.scene-sider.collapsed {
  width: 56px;
  min-width: 56px;
  max-width: 56px;
}

.sider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 10px;
  background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.header-title {
  color: rgba(255,255,255,0.92);
  font-weight: 900;
  font-size: 13px;
  letter-spacing: 0.2px;
  user-select: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* 顶部 icon 按钮 */
.icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.90);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform .12s ease, background .12s ease, border-color .12s ease, box-shadow .12s ease;
}
.icon-btn:hover {
  background: rgba(255,255,255,0.10);
  border-color: rgba(255,255,255,0.14);
  transform: translateY(-1px);
  box-shadow: 0 12px 26px rgba(0,0,0,0.30);
}

.sider-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 10px;
}

.sider-body::-webkit-scrollbar { width: 8px; }
.sider-body::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); }
.sider-body::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(96,165,250,0.40), rgba(255,255,255,0.14));
  border-radius: 999px;
}
.sider-body::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(96,165,250,0.60), rgba(255,255,255,0.18));
}

.sider-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  color: rgba(255,255,255,0.72);
}

.scene-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scene-item {
  position: relative;
  padding: 10px 12px;
  border-radius: 12px;
  cursor: pointer;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  transition: transform .12s ease, background .12s ease, border-color .12s ease, box-shadow .12s ease;
}
.scene-item:hover {
  background: rgba(255,255,255,0.055);
  border-color: rgba(255,255,255,0.10);
  transform: translateY(-1px);
  box-shadow: 0 14px 30px rgba(0,0,0,0.25);
}
.scene-item.active {
  background: linear-gradient(180deg, rgba(96,165,250,0.16), rgba(139,92,246,0.10));
  border-color: rgba(96,165,250,0.24);
  box-shadow: 0 16px 34px rgba(0,0,0,0.28);
}
.scene-item.active::before {
  content: "";
  position: absolute;
  left: 8px;
  top: 9px;
  bottom: 9px;
  width: 3px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(96,165,250,0.95), rgba(139,92,246,0.85));
  box-shadow: 0 0 0 2px rgba(96,165,250,0.12);
}
.scene-name {
  display: block;
  padding-left: 8px;
  color: rgba(255,255,255,0.90);
  font-weight: 800;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty {
  padding: 10px;
  color: rgba(255,255,255,0.55);
  font-size: 12px;
}

.mini-item {
  height: 40px;
  border-radius: 12px;
  cursor: pointer;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  position: relative;
  transition: transform .12s ease, background .12s ease, border-color .12s ease, box-shadow .12s ease;
}
.mini-item:hover {
  background: rgba(255,255,255,0.055);
  transform: translateY(-1px);
  box-shadow: 0 14px 26px rgba(0,0,0,0.22);
}
.mini-item::after {
  content: "";
  width: 10px;
  height: 10px;
  border-radius: 999px;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255,255,255,0.22);
}
.mini-item.active {
  background: rgba(96,165,250,0.12);
  border-color: rgba(96,165,250,0.22);
}
.mini-item.active::after {
  background: linear-gradient(180deg, rgba(96,165,250,0.95), rgba(139,92,246,0.85));
  box-shadow: 0 0 0 2px rgba(96,165,250,0.12);
}

/* ✅ 右侧工作台 */
.workbench {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.chat-page {
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--ws-workbench-grad);
  color: rgba(255, 255, 255, 0.86);
}

.full-row {
  height: 100%;
  width: 100%;
  margin: 0 !important;
  padding: 12px;
  box-sizing: border-box;
  display: flex;
  min-width: 0;
}
.full-col {
  height: 100%;
  min-height: 0;
  display: flex;
  box-sizing: border-box;
  min-width: 0;
}
.full-content {
  flex: 1;
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

/* ✅ SidePanel 内容常出现长 JSON / 日志，强制可换行 */
.side-panel,
.side-panel * {
  max-width: 100%;
}
.side-panel pre,
.side-panel code {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

/* ====== Popover Dark Theme ====== */
.ws-dark-popper {
  background:
      radial-gradient(900px 520px at 20% 10%, rgba(96,165,250,0.10), rgba(96,165,250,0) 60%),
      radial-gradient(900px 520px at 85% 15%, rgba(139,92,246,0.08), rgba(139,92,246,0) 58%),
      linear-gradient(180deg, rgba(10,16,30,0.98), rgba(9,14,26,0.99)) !important;
  border: 1px solid rgba(255,255,255,0.10) !important;
  box-shadow: 0 22px 70px rgba(0,0,0,0.55) !important;
  color: rgba(255,255,255,0.86) !important;
  padding: 10px !important; /* Element 默认 padding 偏大 */
}

/* popover 箭头也变暗 */
.ws-dark-popper[x-placement^="bottom"] .popper__arrow::after,
.ws-dark-popper[x-placement^="top"] .popper__arrow::after,
.ws-dark-popper[x-placement^="left"] .popper__arrow::after,
.ws-dark-popper[x-placement^="right"] .popper__arrow::after {
  border-bottom-color: rgba(10,16,30,0.98) !important;
  border-top-color: rgba(10,16,30,0.98) !important;
  border-left-color: rgba(10,16,30,0.98) !important;
  border-right-color: rgba(10,16,30,0.98) !important;
}

.ws-mini-popper {
  min-width: 260px;
  max-width: 280px;
}

.mini-pop {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mini-pop-title {
  font-size: 12px;
  font-weight: 900;
  color: rgba(255,255,255,0.92);
  letter-spacing: 0.2px;
}

.ws-dark-input .el-input__inner {
  background: rgba(255,255,255,0.06) !important;
  border: 1px solid rgba(255,255,255,0.12) !important;
  color: rgba(255,255,255,0.90) !important;
}
.ws-dark-input .el-input__inner::placeholder {
  color: rgba(255,255,255,0.45);
}
.ws-dark-input .el-input__inner:focus {
  border-color: rgba(96,165,250,0.55) !important;
  box-shadow: 0 0 0 2px rgba(96,165,250,0.18);
}
.ws-mini-input .el-input__inner {
  height: 32px !important;
  line-height: 32px !important;
  padding: 0 10px !important;
  border-radius: 10px !important;
  font-size: 13px !important;
}

.mini-pop-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 2px;
}
.mini-link {
  border: 0;
  background: transparent;
  padding: 6px 6px;
  cursor: pointer;
  color: rgba(255,255,255,0.68);
}
.mini-link:hover {
  color: rgba(255,255,255,0.90);
}

.ws-btn-primary.el-button--primary {
  background: rgba(96,165,250,0.22);
  border-color: rgba(96,165,250,0.35);
  color: rgba(255,255,255,0.92);
}
.ws-btn-primary.el-button--primary:hover {
  background: rgba(96,165,250,0.30);
  border-color: rgba(96,165,250,0.45);
}
</style>
