<template>
  <div class="grid-wrap">
    <div class="grid-toolbar">
      <div class="left">
        <div class="title">数字孪生本体</div>
        <div class="sub">共 {{ filteredTwins.length }} 个</div>
      </div>

      <div class="right">
        <el-input
            size="mini"
            class="search"
            v-model="keyword"
            placeholder="搜索 instanceId / name / model"
            clearable
        />
        <el-select size="mini" class="sel" v-model="statusFilter" placeholder="状态" clearable>
          <el-option label="OK" value="ok" />
          <el-option label="WARN" value="warn" />
          <el-option label="ERROR" value="error" />
          <el-option label="OFFLINE" value="offline" />
        </el-select>
      </div>
    </div>

    <div class="grid" v-if="filteredTwins.length">
      <TwinCard
          v-for="t in filteredTwins"
          :key="t.instanceId"
          :twin="t"
          @click="$emit('select', t)"
      />
    </div>

    <div v-else class="empty">
      <div class="t1">暂无本体</div>
      <div class="t2">请检查场景数据 / 接口返回</div>
    </div>
  </div>
</template>

<script>
import TwinCard from "./TwinCard.vue";

export default {
  name: "TwinCardGrid",
  components: { TwinCard },
  props: {
    twins: { type: Array, default: () => [] }
  },
  data() {
    return {
      keyword: "",
      statusFilter: ""
    };
  },
  computed: {
    filteredTwins() {
      const kw = (this.keyword || "").trim().toLowerCase();
      const st = this.statusFilter || "";
      return (this.twins || []).filter(t => {
        if (st && (t.status || "ok") !== st) return false;
        if (!kw) return true;
        const hay = [
          t.instanceId,
          t.instanceName,
          t.modelId
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(kw);
      });
    }
  }
};
</script>

<style scoped>
.grid-wrap{
  height: 100%;
  display:flex;
  flex-direction:column;
  min-height: 0;
  overflow:hidden;
}

.grid-toolbar{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap: 12px;
  padding: 10px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
}

.left .title{
  color: rgba(255,255,255,0.90);
  font-weight: 800;
  font-size: 14px;
}
.left .sub{
  margin-top: 2px;
  color: rgba(255,255,255,0.50);
  font-size: 12px;
}

.right{
  display:flex;
  align-items:center;
  gap: 8px;
}
.search{ width: 220px; }
.sel{ width: 120px; }

.grid{
  flex:1;
  min-height:0;
  overflow:auto;
  padding: 12px;
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.empty{
  flex:1;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  color: rgba(255,255,255,0.55);
}
.t1{ font-weight: 700; }
.t2{ margin-top: 6px; font-size: 12px; opacity: .9; }
</style>
