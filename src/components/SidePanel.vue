<template>
  <div class="sp-card">
    <div class="sp-header">
      <div class="sp-title">
        <span class="sp-dot"></span>
        <span>思考过程展示</span>
      </div>

      <button class="sp-close" @click="$emit('close')">退出</button>
    </div>

    <div class="sp-body">
      <div class="sp-hint">
        这里放你想展示的内容（节点详情/工具面板/日志/提示词等）。
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "SidePanel"
};
</script>

<style scoped>
.sp-card {
  height: 100%;
  width: 100%;
  border-radius: var(--card-radius);
  overflow: hidden;
  display: flex;
  flex-direction: column;

  background: var(--card-bg-grad);
  border: var(--card-border);
  box-shadow: var(--card-shadow);
}

.sp-header {
  height: 56px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;

  border-bottom: var(--divider);
  background: var(--header-bg);
}

.sp-title {
  display: flex;
  gap: 10px;
  align-items: center;
  font-weight: 900;
  color: var(--t-strong);
  letter-spacing: 0.2px;
}

.sp-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 18px rgba(96, 165, 250, 0.55);
}

.sp-close {
  height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  border: var(--ctl-border);
  color: rgba(255, 255, 255, 0.82);
  background: var(--ctl-bg);
  cursor: pointer;
  transition: all 0.18s ease;
  font-weight: 800;
}
.sp-close:hover {
  background: var(--ctl-bg-hover);
  transform: translateY(-1px);
}

.sp-body {
  flex: 1;
  min-height: 0;
  padding: 14px;
  color: var(--t-main);
}

.sp-hint {
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: var(--t-sub);
}
</style>
