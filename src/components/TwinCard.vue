<template>
  <div class="twin-card" @click="$emit('click', twin)">
    <div class="top">
      <div class="title">
        <span class="name">{{ twin.instanceName || twin.instanceId }}</span>
        <span class="badge" :class="statusClass">{{ statusText }}</span>
      </div>
      <div class="sub">
        <span class="mono">{{ twin.instanceId }}</span>
      </div>
    </div>

    <div class="mid">
      <div class="row">
        <span class="k">model</span>
        <span class="v mono">{{ twin.modelId || "-" }}</span>
      </div>
      <div class="row" v-if="twin.updatedAt">
        <span class="k">updated</span>
        <span class="v">{{ formatTime(twin.updatedAt) }}</span>
      </div>
    </div>

    <div class="bottom" v-if="(twin.tags && twin.tags.length) || hasProps">
      <div class="tags" v-if="twin.tags && twin.tags.length">
        <el-tag
            v-for="(t, idx) in twin.tags.slice(0, 4)"
            :key="idx"
            size="mini"
            class="tag"
            effect="plain"
        >{{ t }}</el-tag>
      </div>

      <div class="props" v-if="hasProps">
        <div class="prop" v-for="(v,k) in previewProps" :key="k">
          <span class="pk">{{ k }}</span>
          <span class="pv">{{ String(v) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "TwinCard",
  props: {
    twin: { type: Object, required: true }
  },
  computed: {
    statusText() {
      const s = this.twin.status || "ok";
      return ({
        ok: "OK",
        warn: "WARN",
        error: "ERROR",
        offline: "OFFLINE"
      }[s] || String(s).toUpperCase());
    },
    statusClass() {
      const s = this.twin.status || "ok";
      return `s-${s}`;
    },
    hasProps() {
      return this.twin.props && typeof this.twin.props === "object" && Object.keys(this.twin.props).length > 0;
    },
    previewProps() {
      if (!this.hasProps) return {};
      const keys = Object.keys(this.twin.props).slice(0, 3);
      const out = {};
      keys.forEach(k => out[k] = this.twin.props[k]);
      return out;
    }
  },
  methods: {
    formatTime(ms) {
      const d = new Date(ms);
      const pad = (n) => (n < 10 ? "0" + n : "" + n);
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }
};
</script>

<style scoped>
.twin-card{
  cursor:pointer;
  border-radius: 16px;
  padding: 12px 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 10px 26px rgba(0,0,0,0.22);
  transition: transform .12s ease, background .12s ease, border-color .12s ease;
  min-width: 0;
}
.twin-card:hover{
  transform: translateY(-1px);
  background: rgba(255,255,255,0.06);
  border-color: rgba(96,165,250,0.25);
}

.top .title{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}
.name{
  color: rgba(255,255,255,0.92);
  font-weight: 700;
  font-size: 14px;
  min-width: 0;
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge{
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.85);
}

.s-ok{ border-color: rgba(34,197,94,0.30); background: rgba(34,197,94,0.12); }
.s-warn{ border-color: rgba(245,158,11,0.30); background: rgba(245,158,11,0.12); }
.s-error{ border-color: rgba(239,68,68,0.30); background: rgba(239,68,68,0.12); }
.s-offline{ border-color: rgba(148,163,184,0.30); background: rgba(148,163,184,0.10); }

.sub{
  margin-top: 6px;
  color: rgba(255,255,255,0.50);
  font-size: 12px;
}
.mono{
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.mid{
  margin-top: 10px;
  display:flex;
  flex-direction:column;
  gap:6px;
}
.row{ display:flex; gap:10px; }
.k{
  width: 56px;
  color: rgba(255,255,255,0.45);
  font-size: 12px;
}
.v{
  flex:1;
  color: rgba(255,255,255,0.75);
  font-size: 12px;
  min-width: 0;
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bottom{ margin-top: 10px; display:flex; flex-direction:column; gap:8px; }
.tags{ display:flex; flex-wrap:wrap; gap:6px; }
.tag :deep(.el-tag){
  border-radius: 999px;
}
.tag{
  border-color: rgba(96,165,250,0.25) !important;
  color: rgba(255,255,255,0.82) !important;
  background: rgba(96,165,250,0.12) !important;
}

.props{
  display:flex;
  flex-direction:column;
  gap:4px;
}
.prop{
  display:flex;
  gap:8px;
  font-size: 12px;
}
.pk{ color: rgba(255,255,255,0.45); }
.pv{
  color: rgba(255,255,255,0.75);
  min-width: 0;
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
