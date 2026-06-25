<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useJobsStore } from '@renderer/stores/jobs'
import { platform } from '@renderer/platform'
import type { MixJobStatus } from '@renderer/platform'

const store = useJobsStore()
const { jobs, loading } = storeToRefs(store)

onMounted(() => {
  void store.load()
  store.subscribe()
})

onBeforeUnmount(() => {
  store.unsubscribe()
})

function statusLabel(status: MixJobStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'analyzing':
      return 'Analyzing'
    case 'mixing':
      return 'Mixing'
    case 'done':
      return 'Done'
    case 'failed':
      return 'Failed'
    case 'cancelled':
      return 'Cancelled'
  }
}

function statusClass(status: MixJobStatus): string {
  switch (status) {
    case 'pending':
      return 'badge-gray'
    case 'analyzing':
      return 'badge-blue'
    case 'mixing':
      return 'badge-yellow'
    case 'done':
      return 'badge-green'
    case 'failed':
      return 'badge-red'
    case 'cancelled':
      return 'badge-gray'
  }
}

function isActive(status: MixJobStatus): boolean {
  return status === 'analyzing' || status === 'mixing'
}

function isCancellable(status: MixJobStatus): boolean {
  return status === 'pending' || status === 'analyzing' || status === 'mixing'
}

function isDeletable(status: MixJobStatus): boolean {
  return status === 'done' || status === 'failed' || status === 'cancelled'
}

function showOutput(path: string): void {
  void platform.showItemInFolder(path)
}
</script>

<template>
  <div class="queue-root">
    <h2 class="text-lg font-semibold mb-4">Job Queue</h2>

    <div v-if="loading && jobs.length === 0" class="empty-state">Loading...</div>
    <div v-else-if="jobs.length === 0" class="empty-state">No jobs yet</div>

    <div v-else class="job-list">
      <div v-for="job in jobs" :key="job.id" class="job-card">
        <div class="job-header">
          <span class="job-name">{{ job.name }}</span>
          <span class="badge" :class="statusClass(job.status)">{{ statusLabel(job.status) }}</span>
        </div>

        <div v-if="isActive(job.status)" class="progress-section">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${job.progress}%` }" />
          </div>
          <span class="progress-text">{{ job.progress }}%</span>
        </div>

        <div v-if="job.status === 'failed' && job.error" class="error-text">
          {{ job.error }}
        </div>

        <div class="job-actions">
          <button
            v-if="job.status === 'done' && job.outputPath"
            class="action-btn"
            @click="showOutput(job.outputPath)"
          >
            <FaIcon :icon="['fasr', 'folder-open']" />
          </button>
          <button v-if="isCancellable(job.status)" class="action-btn" @click="store.cancel(job.id)">
            <FaIcon :icon="['fasr', 'stop']" />
          </button>
          <button
            v-if="job.status === 'failed'"
            class="action-btn"
            @click="store.retry(job.id)"
          >
            <FaIcon :icon="['fasr', 'arrow-rotate-right']" />
          </button>
          <button
            v-if="isDeletable(job.status)"
            class="action-btn danger"
            @click="store.remove(job.id)"
          >
            <FaIcon :icon="['fasr', 'trash']" />
          </button>
          <FaIcon
            v-if="isActive(job.status)"
            :icon="['fasr', 'spinner']"
            class="spin-icon"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.queue-root {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.empty-state {
  color: #6b7280;
  font-size: 14px;
  text-align: center;
  margin-top: 40px;
}

.job-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.job-card {
  background: #1f2937;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.job-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.job-name {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.badge-gray {
  background: #374151;
  color: #9ca3af;
}

.badge-blue {
  background: #1e3a5f;
  color: #60a5fa;
}

.badge-yellow {
  background: #422006;
  color: #fbbf24;
}

.badge-green {
  background: #14532d;
  color: #4ade80;
}

.badge-red {
  background: #450a0a;
  color: #f87171;
}

.progress-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #374151;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: #9ca3af;
  min-width: 36px;
  text-align: right;
}

.error-text {
  font-size: 12px;
  color: #f87171;
  line-height: 1.4;
}

.job-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  color: #9ca3af;
  border-radius: 4px;
  font-size: 13px;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #d1d5db;
}

.action-btn.danger:hover {
  color: #ef4444;
}

.spin-icon {
  color: #60a5fa;
  animation: spin 1s linear infinite;
  font-size: 14px;
  margin-left: auto;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
