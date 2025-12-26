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
            <!-- 展开：仅显示场景名字 + hover 三点菜单 -->
            <template v-if="!sceneSiderCollapsed">
              <div
                  v-for="s in normalizedScenes"
                  :key="s.sceneId"
                  class="scene-item"
                  :class="{ active: s.sceneId === scene }"
                  @click="onSelectScene(s.sceneId)"
              >
                <span class="scene-name">{{ s.name || s.sceneId }}</span>

                <!-- 右侧 hover 出现的更多按钮 -->
                <div class="scene-item-more" @click.stop>
                  <el-dropdown @command="handleSceneMoreCommand" placement="bottom-end">
                    <span class="scene-more-trigger">
                      <i class="el-icon-more"></i>
                    </span>
                    <el-dropdown-menu
                        slot="dropdown"
                        class="scene-dropdown-menu"
                    >
                      <el-dropdown-item
                          class="scene-dropdown-item scene-dropdown-item-danger"
                          :command="{ type: 'delete', sceneId: s.sceneId }"
                      >
                        <i class="el-icon-delete danger-icon"></i>
                        <span class="danger-text">删除</span>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </el-dropdown>
                </div>
              </div>

              <div v-if="normalizedScenes.length === 0" class="empty">暂无场景</div>
            </template>

            <!-- 收缩：仅显示小点 + tooltip（收缩态不放更多菜单，免得太挤） -->
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
import { listScenes, createScene, deleteScene } from "@/api/scene";

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

      // 🔒 只允许字母 + 数字
      if (!/^[A-Za-z0-9]+$/.test(name)) {
        this.$message.warning("场景名称仅支持字母和数字");
        return;
      }

      if (name.length > 64) {
        this.$message.warning("场景名称过长（最多 64 字符）");
        return;
      }

      // 🆚 重名校验（保持原逻辑）
      const exists = this.normalizedScenes.some((s) => {
        const sid = String(s.sceneId || "").trim().toLowerCase();
        const sname = String(s.name || "").trim().toLowerCase();
        return sid === name.toLowerCase() || sname === name.toLowerCase();
      });
      if (exists) {
        this.$message.warning(`场景「${name}」已存在`);
        return;
      }

      this.creatingScene = true;
      try {
        const response = await createScene(name);
        if (response.code !== 200) {
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

    // ===== 场景更多操作：当前只有删除 =====
    handleSceneMoreCommand(command) {
      if (!command || !command.type) return;
      if (command.type === "delete" && command.sceneId) {
        this.confirmDeleteScene(command.sceneId);
      }
    },

    async confirmDeleteScene(sceneId) {
      const target = this.normalizedScenes.find((s) => s.sceneId === sceneId);
      const name = (target && (target.name || target.sceneId)) || sceneId;

      // 二次确认 - 使用自定义暗色对话框样式
      try {
        await this.$confirm(
            `确认删除场景「${name}」？删除后不可恢复。`,
            "删除确认",
            {
              type: "warning",
              confirmButtonText: "删除",
              cancelButtonText: "取消",
              customClass: "ws-confirm-box"
            }
        );
      } catch (e) {
        // 用户取消
        return;
      }

      try {
        const res = await deleteScene(sceneId);
        if (res && res.code === 200) {
          this.$message.success(`已删除场景「${name}」`);

          // 本地列表更新
          this.scenes = (this.scenes || []).filter((s) => {
            if (typeof s === "string") return s !== sceneId;
            return s && s.sceneId !== sceneId;
          });

          // 如果当前选中被删了，切换到第一个或空
          if (this.scene === sceneId) {
            const scenes = this.normalizedScenes;
            if (scenes.length > 0) {
              this.scene = scenes[0].sceneId;
              window.localStorage.setItem("scene", this.scene);
            } else {
              this.scene = "test_scene";
              window.localStorage.setItem("scene", this.scene);
            }
            // 切场景重建 Chat
            this.chatKey += 1;
          }
        } else {
          this.$message.error("删除失败");
        }
      } catch (e) {
        this.$message.error("删除失败");
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

/* ========= Design Tokens ========= */
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

/* ✅ 场景 item + 右侧更多按钮 */
.scene-item {
  position: relative;
  padding: 10px 10px;
  border-radius: 12px;
  cursor: pointer;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  transition: transform .12s ease, background .12s ease, border-color .12s ease, box-shadow .12s ease;
  display: flex;
  align-items: center;
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
  flex: 1;
  padding-left: 8px;
  color: rgba(255,255,255,0.90);
  font-weight: 800;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 更多按钮区域：默认透明，hover 才出现 */
.scene-item-more {
  margin-left: 6px;
  opacity: 0;
  transition: opacity 0.15s ease;
  display: flex;
  align-items: center;
}
.scene-item:hover .scene-item-more {
  opacity: 1;
}
.scene-more-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
}
.scene-more-trigger i {
  font-size: 16px;
  color: rgba(255,255,255,0.65);
}
.scene-more-trigger:hover i {
  color: rgba(255,255,255,0.95);
}

/* 下拉菜单：深色 + 渐变 + 圆角 + 更紧凑 */
.scene-dropdown-menu {
  padding: 2px 0;
  border-radius: 16px;
  background:
      radial-gradient(520px 260px at 10% 0%, rgba(96,165,250,0.20), rgba(96,165,250,0) 60%),
      radial-gradient(520px 260px at 90% 0%, rgba(139,92,246,0.20), rgba(139,92,246,0) 60%),
      linear-gradient(180deg, rgba(12,18,36,0.98), rgba(8,12,24,0.98));
  border: 1px solid rgba(255,255,255,0.16);
  box-shadow: 0 16px 40px rgba(0,0,0,0.55);
  min-width: 110px;
  backdrop-filter: blur(12px);
  animation: sceneDropdownScaleIn .14s ease-out;
  transform-origin: top right;
}

.scene-dropdown-menu .el-dropdown-menu__item {
  font-size: 12px;
  color: rgba(255,255,255,0.84);
  padding: 4px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1.3;
}

/* 危险项：垃圾桶图标 + 文本 */
.scene-dropdown-item-danger .danger-icon {
  font-size: 14px;
  color: rgba(248,113,113,0.95);
}
.scene-dropdown-item-danger .danger-text {
  color: rgba(254,242,242,0.96);
}

.scene-dropdown-item-danger:hover,
.scene-dropdown-item-danger:focus {
  background: linear-gradient(
      90deg,
      rgba(248,113,113,0.20),
      rgba(239,68,68,0.28)
  ) !important;
  color: rgba(255,255,255,0.98) !important;
}

/* 预留：普通项 hover（当前只有删除一个） */
.scene-dropdown-menu .el-dropdown-menu__item:hover {
  background: rgba(96,165,250,0.16);
  color: rgba(255,255,255,0.98);
}

/* 下拉菜单微缩放动效 */
@keyframes sceneDropdownScaleIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(-3px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
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

/* ====== Popover Dark Theme（更圆角、更紧凑） ====== */
.ws-dark-popper {
  background:
      radial-gradient(900px 520px at 20% 10%, rgba(96,165,250,0.16), rgba(96,165,250,0) 60%),
      radial-gradient(900px 520px at 85% 15%, rgba(139,92,246,0.12), rgba(139,92,246,0) 58%),
      linear-gradient(180deg, rgba(10,16,30,0.98), rgba(9,14,26,0.99)) !important;
  border: 1px solid rgba(255,255,255,0.18) !important;
  box-shadow: 0 22px 70px rgba(0,0,0,0.55) !important;
  color: rgba(255,255,255,0.86) !important;
  padding: 8px 10px !important;
  border-radius: 18px !important;
  backdrop-filter: blur(14px);
}

.ws-mini-popper {
  min-width: 230px;
  max-width: 260px;
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

.mini-pop {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mini-pop-title {
  font-size: 12px;
  font-weight: 900;
  color: rgba(255,255,255,0.94);
  letter-spacing: 0.3px;
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
  height: 30px !important;
  line-height: 30px !important;
  padding: 0 10px !important;
  border-radius: 12px !important;
  font-size: 13px !important;
}

.mini-pop-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
.mini-link {
  border: 0;
  background: transparent;
  padding: 4px 4px;
  cursor: pointer;
  color: rgba(255,255,255,0.68);
  font-size: 12px;
}
.mini-link:hover {
  color: rgba(255,255,255,0.92);
}

.ws-btn-primary.el-button--primary {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(96,165,250,0.26);
  border-color: rgba(96,165,250,0.40);
  color: rgba(255,255,255,0.94);
}
.ws-btn-primary.el-button--primary:hover {
  background: rgba(96,165,250,0.34);
  border-color: rgba(96,165,250,0.52);
}

/* ====== 删除确认弹框主题 ====== */
.ws-confirm-box {
  background:
      radial-gradient(1000px 520px at 10% 0%, rgba(96,165,250,0.20), rgba(96,165,250,0) 60%),
      radial-gradient(1000px 520px at 90% 0%, rgba(139,92,246,0.18), rgba(139,92,246,0) 60%),
      linear-gradient(180deg, rgba(10,16,30,0.98), rgba(5,10,20,0.99));
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.16);
  box-shadow: 0 26px 80px rgba(0,0,0,0.65);
  color: rgba(255,255,255,0.90);
}
.ws-confirm-box .el-message-box__title {
  color: rgba(255,255,255,0.95);
  font-size: 15px;
  font-weight: 800;
}
.ws-confirm-box .el-message-box__headerbtn .el-message-box__close {
  color: rgba(255,255,255,0.60);
}
.ws-confirm-box .el-message-box__headerbtn:hover .el-message-box__close {
  color: rgba(255,255,255,0.98);
}
.ws-confirm-box .el-message-box__message {
  color: rgba(255,255,255,0.82);
}
.ws-confirm-box .el-message-box__btns {
  padding-top: 10px;
}
.ws-confirm-box .el-button {
  border-radius: 999px;
}
.ws-confirm-box .el-button--default {
  background: rgba(15,23,42,0.9);
  border-color: rgba(148,163,184,0.5);
  color: rgba(226,232,240,0.9);
}
.ws-confirm-box .el-button--default:hover {
  background: rgba(30,41,59,0.95);
  border-color: rgba(148,163,184,0.9);
}
.ws-confirm-box .el-button--primary {
  background: rgba(239,68,68,0.26);
  border-color: rgba(248,113,113,0.68);
  color: rgba(254,242,242,0.98);
}
.ws-confirm-box .el-button--primary:hover {
  background: rgba(239,68,68,0.42);
  border-color: rgba(248,113,113,0.9);
}
</style>
