<template>
  <div id="app">
    <div class="chat-page">
      <el-row class="full-row">
        <el-col :span="leftSpan" class="full-col">
          <Graph
              class="full-content"
              :scene="scene"
          />
        </el-col>

        <!-- 中间：Chat -->
        <el-col :span="chatSpan" class="full-col">
          <Chat
              class="full-content"
              @toggle-side="sideOpen = !sideOpen"
          />
        </el-col>

        <!-- 右侧：SidePanel（可展开） -->
        <el-col v-if="sideOpen" :span="sideSpan" class="full-col">
          <SidePanel
              class="full-content"
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

export default {
  name: "App",
  components: { Graph, Chat, SidePanel },
  data() {
    return {
      scene: "test_scene",
      sideOpen: false
    };
  },
  mounted(){
    this.scene= "test_scene"
    window.localStorage.setItem("scene",this.scene)
  },
  methods: {

  },
  computed: {
    leftSpan() {
      return this.sideOpen ? 11 : 16;
    },
    chatSpan() {
      return this.sideOpen ? 7 : 8;
    },
    sideSpan() {
      return 6;
    }
  }
};
</script>

<style>
/* ========= Global Layout ========= */
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
