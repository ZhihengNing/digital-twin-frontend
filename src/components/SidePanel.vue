<template>
  <div class="sp-card">
    <div class="sp-header">
      <div class="sp-title">
        <span class="sp-dot"></span>
        <span>辅助面板</span>
      </div>
      <button class="sp-close" @click="$emit('close')">退出</button>
    </div>

    <div class="sp-body">
      <div class="sp-hint">这里放你想展示的内容（节点详情/工具面板/日志/提示词等）。</div>
    </div>
  </div>
</template>

<script>
export default {
  name: "SidePanel"
};
</script>

<style scoped>
.sp-card{
  height: 100%;
  width: 100%;
  border-radius: 18px;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  background: linear-gradient(180deg, rgba(17,24,39,0.96), rgba(15,23,42,0.98));
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 18px 60px rgba(0,0,0,0.45);
}

.sp-header{
  height: 56px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;

  border-bottom: 1px solid rgba(255,255,255,0.08);
  background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
}

.sp-title{
  display: flex;
  gap: 10px;
  align-items: center;
  font-weight: 900;
  color: rgba(255,255,255,0.9);
}

.sp-dot{
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(96,165,250,0.95);
  box-shadow: 0 0 18px rgba(96,165,250,0.55);
}

.sp-close{
  height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.10);
  color: rgba(255,255,255,0.82);
  background: rgba(255,255,255,0.06);
  cursor: pointer;
}
.sp-close:hover{ background: rgba(255,255,255,0.10); }

.sp-body{
  flex: 1;
  min-height: 0;
  padding: 14px;
  color: rgba(255,255,255,0.75);
}

.sp-hint{
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
}
</style>
