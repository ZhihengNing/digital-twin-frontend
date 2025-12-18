<template>
  <div id="app">
    <div class="chat-page">
      <el-row class="full-row row-gap">
        <el-col :span="17" class="full-col">
          <Graph class="full-content" :nodes="nodes" :relations="relations" :categories="categories" />
        </el-col>

        <el-col :span="7" class="full-col">
          <Chat class="full-content" />
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script>
import Chat from "@/components/Chat.vue";
import Graph from "@/components/Graph.vue";

export default {
  name: 'App',
  components: {
    Graph,
    Chat,
  },
  data() {
    return {
      categories: [{ name: "设备" }, { name: "人员" }, { name: "地点" }],
      nodes: [
        { id: "d1", name: "空调机组-A", category: 0, brand: "XX", status: "RUNNING" },
        { id: "p1", name: "运维-张三", category: 1, phone: "138xxxx" },
        { id: "l1", name: "机房-3F", category: 2 }
      ],
      relations: [
        { source: "p1", target: "d1", name: "负责" },
        { source: "d1", target: "l1", name: "位于" }
      ]
    };
  }
}
</script>

<style>
/* ===== 全局：必须放在非 scoped 里 ===== */
html, body {
  height: 100%;
  margin: 0;
  overflow: hidden; /* ✅ 禁止浏览器滚动 */
}

#app {
  height: 100%;
  margin: 0;
  overflow: hidden;

  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  /* 不要 text-align:center，会让一些布局看起来怪 */
  text-align: left;

  /* 统一深色底 */
  background: #0f172a;
  color: rgba(255,255,255,0.88);
}

/* 页面容器：占满视口 */
.chat-page {
  height: 100%;
  width: 100%;
  overflow: hidden;

  /* 深色工作台背景（比纯黑更高级） */
  background:
      radial-gradient(1200px 600px at 20% 10%, rgba(96,165,250,0.10) 0%, rgba(96,165,250,0) 60%),
      radial-gradient(1000px 600px at 80% 20%, rgba(139,92,246,0.10) 0%, rgba(139,92,246,0) 55%),
      linear-gradient(180deg, #0b1220 0%, #0f172a 100%);
}

/* el-row：改成 flex 用 gap 做中间缝隙 */
.full-row {
  height: 100%;
  width: 100%;
  margin: 0 !important;

  display: flex;       /* ✅ 让 gap 生效 */
  gap: 12px;           /* ✅ 图谱和聊天中间缝隙 */
  padding: 12px;       /* ✅ 整体留一点边距（不想要就改 0） */
  box-sizing: border-box;
}

/* el-col：必须能撑满高度 + flex 让内部组件撑满 */
.full-col {
  height: 100%;
  min-height: 0;
  display: flex;
  box-sizing: border-box;
}

/* 组件占满列 */
.full-content {
  flex: 1;
  height: 100%;
  min-height: 0;
}

</style>
