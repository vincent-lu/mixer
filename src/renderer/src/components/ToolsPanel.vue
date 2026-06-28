<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { platform } from '@renderer/platform'
import type { ConvertResult, DuplicateGroup, NormalizeFileStatus } from '@renderer/platform'
import FormRow from './config/FormRow.vue'

function fileName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path
}

// --- MP4 → MP3 Converter ---
const convertFolder = ref('')
const convertFiles = ref<string[]>([])
const converting = ref(false)
const convertProgress = ref({ current: 0, total: 0, currentFile: '', filePercent: 0 })
const convertResults = ref<ConvertResult[]>([])

let unsubConvertProgress: (() => void) | null = null
let unsubNormProgress: (() => void) | null = null

onMounted(() => {
  unsubConvertProgress = platform.onConvertProgress((data) => {
    convertProgress.value = data
  })
  unsubNormProgress = platform.onNormalizeProgress((data) => {
    normProgress.value = data
  })
})

onUnmounted(() => {
  unsubConvertProgress?.()
  unsubNormProgress?.()
})

async function pickConvertFolder(): Promise<void> {
  const dir = await platform.selectDirectory()
  if (dir) {
    convertFolder.value = dir
    convertResults.value = []
    const files = await platform.listMediaFiles({ dir, type: 'video' })
    convertFiles.value = files.filter((f) => f.toLowerCase().endsWith('.mp4'))
  }
}

async function startConvert(): Promise<void> {
  if (convertFiles.value.length === 0 || converting.value) return
  converting.value = true
  convertResults.value = []
  convertProgress.value = { current: 0, total: convertFiles.value.length, currentFile: '', filePercent: 0 }
  try {
    const results = await platform.convertMp4ToMp3(convertFolder.value)
    convertResults.value = results
  } finally {
    converting.value = false
    convertFiles.value = []
    if (convertFolder.value) {
      const files = await platform.listMediaFiles({ dir: convertFolder.value, type: 'video' })
      convertFiles.value = files.filter((f) => f.toLowerCase().endsWith('.mp4'))
    }
  }
}

// --- Duplicate BGM Finder ---
const dupeFolder = ref('')
const dupeScanning = ref(false)

const dupeGroups = ref<DuplicateGroup[]>([])
const dupeSelections = ref<Set<string>>(new Set())
const dupeDeleteErrors = ref<ConvertResult[]>([])

async function pickDupeFolder(): Promise<void> {
  const dir = await platform.selectDirectory()
  if (dir) {
    dupeFolder.value = dir
    dupeGroups.value = []
    dupeSelections.value = new Set()
    await scanDuplicates()
  }
}

async function scanDuplicates(): Promise<void> {
  if (!dupeFolder.value || dupeScanning.value) return
  dupeScanning.value = true
  try {
    const groups = await platform.findDuplicateBgms(dupeFolder.value)
    dupeGroups.value = groups
    dupeSelections.value = new Set()
  } finally {
    dupeScanning.value = false
  }
}

function toggleDupeSelection(path: string): void {
  const next = new Set(dupeSelections.value)
  if (next.has(path)) {
    next.delete(path)
  } else {
    next.add(path)
  }
  dupeSelections.value = next
}

async function deleteSelectedDupes(): Promise<void> {
  if (dupeSelections.value.size === 0) return
  const paths = [...dupeSelections.value]
  try {
    const results = await platform.deleteFiles(paths)
    dupeDeleteErrors.value = results.filter((r) => !r.ok)
  } finally {
    dupeSelections.value = new Set()
    await scanDuplicates()
  }
}

// --- Pre-Normalize Videos ---
const normFolder = ref('')
const normScanning = ref(false)
const normFiles = ref<NormalizeFileStatus[]>([])
const normalizing = ref(false)
const normProgress = ref({ current: 0, total: 0, currentFile: '', filePercent: 0 })
const normResults = ref<ConvertResult[]>([])

const normNeedWork = computed(() => normFiles.value.filter((f) => f.needsWork && !f.error))
const normAlreadyOk = computed(() => normFiles.value.filter((f) => !f.needsWork && !f.error))
const normErrors = computed(() => normFiles.value.filter((f) => f.error))

async function pickNormFolder(): Promise<void> {
  const dir = await platform.selectDirectory()
  if (dir) {
    normFolder.value = dir
    normResults.value = []
    normFiles.value = []
    normScanning.value = true
    try {
      normFiles.value = await platform.scanNormalize(dir)
    } finally {
      normScanning.value = false
    }
  }
}

async function startNormalize(): Promise<void> {
  const paths = normNeedWork.value.map((f) => f.path)
  if (paths.length === 0 || normalizing.value) return
  normalizing.value = true
  normResults.value = []
  normProgress.value = { current: 0, total: paths.length, currentFile: '', filePercent: 0 }
  try {
    normResults.value = await platform.normalizeVideos(paths)
  } finally {
    normalizing.value = false
    if (normFolder.value) {
      normScanning.value = true
      try {
        normFiles.value = await platform.scanNormalize(normFolder.value)
      } finally {
        normScanning.value = false
      }
    }
  }
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <div class="tools-root">
    <!-- MP4 → MP3 Converter -->
    <section class="tool-section">
      <h3 class="tool-title">MP4 → MP3 Converter</h3>
      <p class="tool-desc">Convert all MP4 files in a folder to MP3 and delete the originals.</p>

      <FormRow label="Target Folder">
        <div class="file-picker">
          <button class="picker-btn" @click="pickConvertFolder">
            <FaIcon :icon="['fasr', 'folder-open']" />
            <span>Select folder</span>
          </button>
          <span class="file-path">{{ convertFolder || 'No folder selected' }}</span>
        </div>
      </FormRow>

      <div v-if="convertFiles.length > 0 && !converting" class="file-count-row">
        <span class="file-count">{{ convertFiles.length }} MP4 file{{ convertFiles.length !== 1 ? 's' : '' }} found</span>
        <button class="action-btn" @click="startConvert">
          <FaIcon :icon="['fasr', 'rotate']" />
          <span>Convert All</span>
        </button>
      </div>

      <div v-if="converting" class="progress-bar-container">
        <div class="progress-label">
          Converting {{ convertProgress.current }}/{{ convertProgress.total }}
          <span v-if="convertProgress.currentFile" class="progress-file">{{ fileName(convertProgress.currentFile) }}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${convertProgress.filePercent}%` }" />
        </div>
      </div>

      <div v-if="convertResults.length > 0" class="results-list">
        <div v-for="r in convertResults" :key="r.file" class="result-item" :class="{ error: !r.ok, skipped: r.skipped }">
          <FaIcon :icon="['fasr', r.skipped ? 'forward' : r.ok ? 'check' : 'xmark']" :class="r.skipped ? 'text-dim' : r.ok ? 'text-green' : 'text-red'" />
          <span class="result-file">{{ fileName(r.file) }}</span>
          <span v-if="r.skipped" class="result-skip">MP3 already exists</span>
          <span v-else-if="r.error" class="result-error">{{ r.error }}</span>
        </div>
      </div>
    </section>

    <!-- Duplicate BGM Finder -->
    <section class="tool-section">
      <h3 class="tool-title">Duplicate BGM Finder</h3>
      <p class="tool-desc">Find audio files with identical filesize or similar filename.</p>

      <FormRow label="Target Folder">
        <div class="file-picker">
          <button class="picker-btn" @click="pickDupeFolder">
            <FaIcon :icon="['fasr', 'folder-open']" />
            <span>Select folder</span>
          </button>
          <span class="file-path">{{ dupeFolder || 'No folder selected' }}</span>
        </div>
      </FormRow>

      <div v-if="dupeScanning" class="scanning-indicator">
        <FaIcon :icon="['fasr', 'spinner-third']" spin />
        <span>Scanning for duplicates...</span>
      </div>

      <div v-if="!dupeScanning && dupeFolder && dupeGroups.length === 0" class="no-results">
        No duplicates found.
      </div>

      <div v-if="dupeGroups.length > 0" class="dupe-groups">
        <div v-for="(group, gi) in dupeGroups" :key="gi" class="dupe-group">
          <div class="dupe-group-header">
            <span class="dupe-reason">{{ group.reason === 'size' ? 'Same filesize' : 'Similar filename' }}</span>
            <span class="dupe-match">{{ group.reason === 'size' ? formatSize(Number(group.matchValue)) : group.matchValue }}</span>
          </div>
          <div v-for="file in group.files" :key="file.path" class="dupe-file" @click="toggleDupeSelection(file.path)">
            <input
              type="checkbox"
              class="checkbox"
              :checked="dupeSelections.has(file.path)"
              @click.stop="toggleDupeSelection(file.path)"
            />
            <span class="dupe-file-name">{{ fileName(file.path) }}</span>
            <span class="dupe-file-size">{{ formatSize(file.size) }}</span>
          </div>
        </div>

        <div v-if="dupeSelections.size > 0" class="delete-bar">
          <button class="action-btn danger" @click="deleteSelectedDupes">
            <FaIcon :icon="['fasr', 'trash']" />
            <span>Delete {{ dupeSelections.size }} file{{ dupeSelections.size !== 1 ? 's' : '' }}</span>
          </button>
        </div>
      </div>

      <div v-if="dupeDeleteErrors.length > 0" class="results-list">
        <div v-for="r in dupeDeleteErrors" :key="r.file" class="result-item error">
          <FaIcon :icon="['fasr', 'xmark']" class="text-red" />
          <span class="result-file">{{ fileName(r.file) }}</span>
          <span v-if="r.error" class="result-error">{{ r.error }}</span>
        </div>
      </div>
    </section>
    <!-- Pre-Normalize Videos -->
    <section class="tool-section">
      <h3 class="tool-title">Pre-Normalize Videos</h3>
      <p class="tool-desc">Re-encode videos to H.264 1920x1080 @ 30fps so mixing skips normalization.</p>

      <FormRow label="Target Folder">
        <div class="file-picker">
          <button class="picker-btn" @click="pickNormFolder">
            <FaIcon :icon="['fasr', 'folder-open']" />
            <span>Select folder</span>
          </button>
          <span class="file-path">{{ normFolder || 'No folder selected' }}</span>
        </div>
      </FormRow>

      <div v-if="normScanning" class="scanning-indicator">
        <FaIcon :icon="['fasr', 'spinner-third']" spin />
        <span>Probing videos...</span>
      </div>

      <div v-if="!normScanning && normFiles.length > 0 && !normalizing" class="norm-summary">
        <div class="norm-counts">
          <span v-if="normNeedWork.length > 0" class="file-count warn">{{ normNeedWork.length }} need{{ normNeedWork.length === 1 ? 's' : '' }} normalization</span>
          <span v-if="normAlreadyOk.length > 0" class="file-count ok">{{ normAlreadyOk.length }} already OK</span>
          <span v-if="normErrors.length > 0" class="file-count error">{{ normErrors.length }} failed to probe</span>
        </div>
        <div v-if="normNeedWork.length > 0" class="norm-file-list">
          <div v-for="f in normNeedWork" :key="f.path" class="norm-file">
            <span class="norm-file-name">{{ fileName(f.path) }}</span>
            <span class="norm-file-meta">{{ f.codec }} {{ f.width }}x{{ f.height }} @ {{ f.fps }}fps · {{ formatDuration(f.duration) }}</span>
          </div>
        </div>
        <button v-if="normNeedWork.length > 0" class="action-btn" @click="startNormalize">
          <FaIcon :icon="['fasr', 'wand-magic-sparkles']" />
          <span>Normalize {{ normNeedWork.length }} Video{{ normNeedWork.length !== 1 ? 's' : '' }}</span>
        </button>
      </div>

      <div v-if="normalizing" class="progress-bar-container">
        <div class="progress-label">
          Normalizing {{ normProgress.current }}/{{ normProgress.total }}
          <span v-if="normProgress.currentFile" class="progress-file">{{ fileName(normProgress.currentFile) }}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${normProgress.filePercent}%` }" />
        </div>
      </div>

      <div v-if="normResults.length > 0" class="results-list">
        <div v-for="r in normResults" :key="r.file" class="result-item" :class="{ error: !r.ok }">
          <FaIcon :icon="['fasr', r.ok ? 'check' : 'xmark']" :class="r.ok ? 'text-green' : 'text-red'" />
          <span class="result-file">{{ fileName(r.file) }}</span>
          <span v-if="r.error" class="result-error">{{ r.error }}</span>
        </div>
      </div>

      <div v-if="!normScanning && normFolder && normFiles.length === 0" class="no-results">
        No video files found.
      </div>
    </section>
  </div>
</template>

<style scoped>
.tools-root {
  display: flex;
  flex-direction: column;
  gap: 32px;
  max-width: 560px;
}

.tool-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tool-title {
  font-size: 15px;
  font-weight: 600;
  color: #f3f4f6;
}

.tool-desc {
  font-size: 13px;
  color: #9ca3af;
  margin: -8px 0 0 0;
}

.file-picker {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-path {
  font-size: 13px;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 6px;
  color: #d1d5db;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.picker-btn:hover {
  background: #374151;
}

.file-count-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.file-count {
  font-size: 12px;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.15);
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #2563eb;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}

.action-btn:hover {
  background: #3b82f6;
}

.action-btn.danger {
  background: #dc2626;
}

.action-btn.danger:hover {
  background: #ef4444;
}

.progress-bar-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-label {
  font-size: 13px;
  color: #d1d5db;
}

.progress-file {
  color: #9ca3af;
  margin-left: 8px;
}

.progress-bar {
  height: 6px;
  background: #1f2937;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #2563eb;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: #1f2937;
  border-radius: 4px;
  font-size: 13px;
}

.result-item.error {
  background: rgba(220, 38, 38, 0.1);
}

.text-green {
  color: #22c55e;
}

.text-red {
  color: #ef4444;
}

.result-file {
  color: #d1d5db;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-item.skipped {
  opacity: 0.6;
}

.result-skip {
  font-size: 12px;
  color: #6b7280;
  margin-left: auto;
}

.result-error {
  color: #ef4444;
  font-size: 12px;
  margin-left: auto;
}

.text-dim {
  color: #6b7280;
}

.scanning-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #9ca3af;
}

.no-results {
  font-size: 13px;
  color: #6b7280;
}

.dupe-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dupe-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dupe-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #374151;
}

.dupe-reason {
  font-size: 12px;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.15);
  padding: 1px 6px;
  border-radius: 8px;
  white-space: nowrap;
}

.dupe-match {
  font-size: 12px;
  color: #9ca3af;
}

.dupe-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: #1f2937;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.dupe-file:hover {
  background: #374151;
}

.checkbox {
  accent-color: #2563eb;
  cursor: pointer;
}

.dupe-file-name {
  color: #d1d5db;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.dupe-file-size {
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
}

.delete-bar {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.norm-summary {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.norm-counts {
  display: flex;
  gap: 8px;
}

.file-count.warn {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.15);
}

.file-count.ok {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.15);
}

.file-count.error {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
}

.norm-file-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.norm-file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
  background: #1f2937;
  border-radius: 4px;
  font-size: 13px;
}

.norm-file-name {
  color: #d1d5db;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.norm-file-meta {
  font-size: 11px;
  color: #6b7280;
  white-space: nowrap;
}
</style>
