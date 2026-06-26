<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { platform } from '@renderer/platform'
import type { MixJobConfig } from '@renderer/platform'
import { useJobsStore } from '@renderer/stores/jobs'
import FormRow from './config/FormRow.vue'

const store = useJobsStore()

const bgmPath = ref('')
const sourceVideoPaths = ref<string[]>([])
const outputDir = ref('')
const outputFormat = ref<MixJobConfig['outputFormat']>('mp4')
const videoResolution = ref<MixJobConfig['videoResolution']>('1080p')
const sceneDetection = ref<MixJobConfig['sceneDetection']>('random')
const mixStyle = ref<NonNullable<MixJobConfig['mixStyle']>>('balanced')
const enableTransitions = ref(true)
const outputFilename = ref('')
const maxConcurrency = ref(1)

const styleHints: Record<NonNullable<MixJobConfig['mixStyle']>, string> = {
  chill: 'Long, lingering shots (5–12s)',
  relaxed: 'Gentle pacing (3.5–9s)',
  balanced: 'Follows the music (1.5–5s)',
  energetic: 'Fast, energy-reactive (0.75–3s)',
  hyperkinetic: 'Rapid-fire, sub-second drops (0.35–1.5s)',
}

const canStart = ref(true)

onMounted(async () => {
  const settings = await platform.getSettings()
  maxConcurrency.value = settings.maxConcurrency
  if (settings.defaultOutputDir) {
    outputDir.value = settings.defaultOutputDir
  }
})

watch(maxConcurrency, (val) => {
  platform.setMaxConcurrency(val)
})

function baseNameWithoutExt(path: string): string {
  const name = path.split(/[/\\]/).pop() ?? path
  return name.replace(/\.[^.]+$/, '')
}

async function pickBgm(): Promise<void> {
  const path = await platform.selectAudioFile()
  if (path) {
    bgmPath.value = path
    if (!outputFilename.value) {
      outputFilename.value = baseNameWithoutExt(path)
    }
  }
}

async function pickVideos(): Promise<void> {
  const paths = await platform.selectVideoFiles()
  if (paths.length > 0) {
    sourceVideoPaths.value = [...sourceVideoPaths.value, ...paths]
  }
}

async function pickOutputDir(): Promise<void> {
  const path = await platform.selectDirectory()
  if (path) {
    outputDir.value = path
    await platform.setDefaultOutputDir(path)
  }
}

function removeVideo(index: number): void {
  sourceVideoPaths.value = sourceVideoPaths.value.filter((_, i) => i !== index)
}

function fileName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path
}

async function startMix(): Promise<void> {
  if (!bgmPath.value || sourceVideoPaths.value.length === 0 || !outputDir.value) return
  canStart.value = false
  try {
    const config: MixJobConfig = {
      bgmPath: bgmPath.value,
      sourceVideoPaths: [...sourceVideoPaths.value],
      outputDir: outputDir.value,
      outputFormat: outputFormat.value,
      sceneDetection: sceneDetection.value,
      videoResolution: videoResolution.value,
      mixStyle: mixStyle.value,
      enableTransitions: enableTransitions.value,
      outputFilename: outputFilename.value || undefined,
    }
    const name = `Mix — ${outputFilename.value || fileName(bgmPath.value)}`
    await store.create(name, config)
  } finally {
    canStart.value = true
  }
}
</script>

<template>
  <div class="config-root">
    <h2 class="text-lg font-semibold mb-6">New Mix</h2>

    <div class="fields">
      <FormRow label="Background Music">
        <div class="file-picker">
          <button class="picker-btn" @click="pickBgm">
            <FaIcon :icon="['fasr', 'music']" />
            <span>Select file</span>
          </button>
          <span class="file-path">{{ bgmPath || 'No file selected' }}</span>
        </div>
      </FormRow>

      <FormRow label="Source Videos">
        <button class="picker-btn" @click="pickVideos">
          <FaIcon :icon="['fasr', 'film']" />
          <span>Add video files</span>
        </button>
        <div v-if="sourceVideoPaths.length > 0" class="video-list">
          <div v-for="(path, i) in sourceVideoPaths" :key="i" class="video-item">
            <span class="video-name">{{ fileName(path) }}</span>
            <button class="icon-btn danger" @click="removeVideo(i)">
              <FaIcon :icon="['fasr', 'trash']" />
            </button>
          </div>
        </div>
      </FormRow>

      <FormRow label="Output Directory">
        <div class="file-picker">
          <button class="picker-btn" @click="pickOutputDir">
            <FaIcon :icon="['fasr', 'folder']" />
            <span>Select folder</span>
          </button>
          <span class="file-path">{{ outputDir || 'No folder selected' }}</span>
        </div>
      </FormRow>

      <FormRow label="Output Filename">
        <input
          v-model="outputFilename"
          type="text"
          class="input filename-input"
          placeholder="Auto-generated from BGM"
        />
      </FormRow>

      <FormRow label="Output Format">
        <select v-model="outputFormat" class="select">
          <option value="mp4">MP4</option>
          <option value="mkv">MKV</option>
          <option value="mov">MOV</option>
        </select>
      </FormRow>

      <FormRow label="Video Resolution">
        <select v-model="videoResolution" class="select">
          <option value="1080p">1080p</option>
          <option value="720p">720p</option>
          <option value="480p">480p</option>
          <option value="source">Source (no re-encode)</option>
        </select>
      </FormRow>

      <FormRow label="Scene Detection">
        <select v-model="sceneDetection" class="select">
          <option value="random">Random segments</option>
          <option value="ffmpeg">FFmpeg scene detection</option>
        </select>
      </FormRow>

      <FormRow label="Mix Style">
        <select v-model="mixStyle" class="select" title="Controls how frequently scene cuts happen and how they react to musical energy">
          <option value="chill" title="Long, lingering shots. Cuts every 5–12s depending on energy.">Chill</option>
          <option value="relaxed" title="Gentle pacing. Cuts every 3.5–9s depending on energy.">Relaxed</option>
          <option value="balanced" title="Moderate pacing that follows the music. Cuts every 1.5–5s depending on energy.">Balanced</option>
          <option value="energetic" title="Fast cuts that react strongly to energy. Cuts every 0.75–3s depending on energy.">Energetic</option>
          <option value="hyperkinetic" title="Rapid-fire cuts, sub-second during drops. Cuts every 0.35–1.5s depending on energy.">Hyperkinetic</option>
        </select>
        <span class="style-hint">{{ styleHints[mixStyle] }}</span>
      </FormRow>

      <FormRow label="Transitions">
        <label class="toggle-label" title="Add dissolves at section boundaries and flash frames at energy drops. Disabling uses hard cuts only (faster encoding).">
          <input v-model="enableTransitions" type="checkbox" class="toggle-checkbox" />
          <span>{{ enableTransitions ? 'Dissolves & flashes at musical boundaries' : 'Hard cuts only (faster)' }}</span>
        </label>
      </FormRow>

      <FormRow label="Max Concurrent Jobs">
        <div class="number-input">
          <input
            v-model.number="maxConcurrency"
            type="number"
            class="input"
            min="1"
            max="8"
            step="1"
          />
        </div>
      </FormRow>

      <button
        class="start-btn"
        :disabled="!bgmPath || sourceVideoPaths.length === 0 || !outputDir || !canStart"
        @click="startMix"
      >
        <FaIcon :icon="['fasr', 'plus']" />
        <span>Start Mix</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.config-root {
  max-width: 560px;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 20px;
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

.video-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.video-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: #1f2937;
  border-radius: 4px;
  font-size: 13px;
}

.video-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #d1d5db;
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #9ca3af;
  border-radius: 4px;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

.icon-btn.danger:hover {
  color: #ef4444;
}

.select,
.input {
  padding: 6px 10px;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 6px;
  color: #d1d5db;
  font-size: 13px;
}

.select {
  width: 100%;
}

.input {
  width: 80px;
}

.input.filename-input {
  width: 100%;
}

.number-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.style-hint {
  font-size: 13px;
  color: #9ca3af;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #d1d5db;
  cursor: pointer;
}

.toggle-checkbox {
  accent-color: #2563eb;
}

.start-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #2563eb;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  align-self: flex-start;
  margin-top: 4px;
}

.start-btn:hover:not(:disabled) {
  background: #3b82f6;
}

.start-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
