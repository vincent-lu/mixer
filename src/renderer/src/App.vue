<script setup lang="ts">
import JobConfig from './components/JobConfig.vue'
import JobQueue from './components/JobQueue.vue'
</script>

<template>
  <div class="app-layout">
    <div class="config-panel">
      <JobConfig />
    </div>
    <div class="queue-panel">
      <JobQueue />
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  background: #111827;
  color: #f3f4f6;
}

.config-panel {
  flex: 2;
  border-right: 1px solid #374151;
  overflow-y: auto;
  padding: 24px;
}

.queue-panel {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
</style>
