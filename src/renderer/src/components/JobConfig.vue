<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { platform } from '@renderer/platform'
import type { MixJobConfig } from '@renderer/platform'
import { DEFAULT_STYLE_LOOKAHEAD } from '@shared/types'
import { useJobsStore } from '@renderer/stores/jobs'
import { allocateVideos } from '@renderer/batch/allocate'
import FormRow from './config/FormRow.vue'

const store = useJobsStore()

const styleHints: Record<NonNullable<MixJobConfig['mixStyle']>, string> = {
  chill: 'Long, lingering shots (5–12s)',
  relaxed: 'Gentle pacing (3.5–9s)',
  balanced: 'Follows the music (1.5–5s)',
  energetic: 'Fast, energy-reactive (0.75–3s)',
  hyperkinetic: 'Rapid-fire, sub-second drops (0.35–1.5s)',
  frenetic: 'Near-greedy, sub-beat everywhere (0.2–0.75s)',
  chaos: 'Every beat, no scoring (0.12–0.35s)',
}

const bgmPath = ref('')
const sourceVideoPaths = ref<string[]>([])
const outputDir = ref('')
const outputFormat = ref<MixJobConfig['outputFormat']>('mp4')
const videoResolution = ref<MixJobConfig['videoResolution']>('1080p')
const sceneDetection = ref<MixJobConfig['sceneDetection']>('random')
const mixStyle = ref<NonNullable<MixJobConfig['mixStyle']>>('balanced')
const transitionDensity = ref(30)
const transitionEffect = ref<NonNullable<MixJobConfig['transitionEffect']>>('cut')
const clipEffect = ref<NonNullable<MixJobConfig['clipEffect']>>('none')
const effectChance = ref(0)
const lookahead = ref(DEFAULT_STYLE_LOOKAHEAD.balanced)
const outputFilename = ref('')
const maxConcurrency = ref(1)

const batchMode = ref(false)
const bgmFolderPath = ref('')
const bgmFiles = ref<string[]>([])
const videoFolderPath = ref('')
const videoFiles = ref<string[]>([])
const videosPerJob = ref(5)
const bgmAudioOnly = ref(true)

const canStart = ref(true)

const canStartBatch = computed(() =>
  bgmFiles.value.length > 0
  && videoFiles.value.length > 0
  && videosPerJob.value > 0
  && !!outputDir.value
  && canStart.value,
)

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

watch(mixStyle, (val) => {
  lookahead.value = DEFAULT_STYLE_LOOKAHEAD[val]
})

watch(batchMode, (isBatch) => {
  if (isBatch) {
    bgmPath.value = ''
    sourceVideoPaths.value = []
    outputFilename.value = ''
  } else {
    bgmFolderPath.value = ''
    bgmFiles.value = []
    videoFolderPath.value = ''
    videoFiles.value = []
    videosPerJob.value = 5
    bgmAudioOnly.value = true
  }
})

watch(bgmAudioOnly, async () => {
  await scanBgmFolder()
})

watch(clipEffect, (val, oldVal) => {
  if (oldVal === 'none' && val !== 'none' && effectChance.value === 0) {
    effectChance.value = 50
  }
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

async function scanBgmFolder(): Promise<void> {
  if (!bgmFolderPath.value) return
  bgmFiles.value = await platform.listMediaFiles({
    dir: bgmFolderPath.value,
    type: bgmAudioOnly.value ? 'audio-only' : 'audio',
  })
}

async function pickBgmFolder(): Promise<void> {
  const dir = await platform.selectDirectory()
  if (dir) {
    bgmFolderPath.value = dir
    await scanBgmFolder()
  }
}

async function pickVideoFolder(): Promise<void> {
  const dir = await platform.selectDirectory()
  if (dir) {
    videoFolderPath.value = dir
    videoFiles.value = await platform.listMediaFiles({ dir, type: 'video' })
  }
}

async function generateBatch(): Promise<void> {
  if (!canStartBatch.value) return
  canStart.value = false
  try {
    const allocated = allocateVideos(videoFiles.value, bgmFiles.value.length, videosPerJob.value)
    const inputs = bgmFiles.value.map((bgm, i) => {
      const bgmName = baseNameWithoutExt(bgm)
      const name = `Mix — ${bgmName} #${i + 1}`
      const config: MixJobConfig = {
        bgmPath: bgm,
        sourceVideoPaths: allocated[i]!,
        outputDir: outputDir.value,
        outputFormat: outputFormat.value,
        sceneDetection: sceneDetection.value,
        videoResolution: videoResolution.value,
        mixStyle: mixStyle.value,
        transitionDensity: transitionDensity.value,
        transitionEffect: transitionEffect.value,
        clipEffect: clipEffect.value,
        effectChance: effectChance.value,
        lookahead: lookahead.value,
        outputFilename: bgmName,
      }
      return { name, config }
    })
    await store.createBatch(inputs)
  } finally {
    canStart.value = true
  }
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
      transitionDensity: transitionDensity.value,
      transitionEffect: transitionEffect.value,
      clipEffect: clipEffect.value,
      effectChance: effectChance.value,
      lookahead: lookahead.value,
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
    <div class="header-row">
      <h2 class="text-lg font-semibold">New Mix</h2>
      <div class="mode-toggle">
        <button
          class="toggle-btn"
          :class="{ active: !batchMode }"
          @click="batchMode = false"
        >Single</button>
        <button
          class="toggle-btn"
          :class="{ active: batchMode }"
          @click="batchMode = true"
        >Batch</button>
      </div>
    </div>

    <div class="fields">
      <!-- Single mode: BGM file picker -->
      <FormRow v-if="!batchMode" label="Background Music">
        <div class="file-picker">
          <button class="picker-btn" @click="pickBgm">
            <FaIcon :icon="['fasr', 'music']" />
            <span>Select file</span>
          </button>
          <span class="file-path">{{ bgmPath || 'No file selected' }}</span>
        </div>
      </FormRow>

      <!-- Batch mode: BGM folder picker -->
      <FormRow v-if="batchMode" label="BGM Folder">
        <div class="file-picker">
          <button class="picker-btn" @click="pickBgmFolder">
            <FaIcon :icon="['fasr', 'folder-music']" />
            <span>Select folder</span>
          </button>
          <span class="file-path">{{ bgmFolderPath || 'No folder selected' }}</span>
          <span v-if="bgmFolderPath" class="file-count">{{ bgmFiles.length }} file{{ bgmFiles.length !== 1 ? 's' : '' }}</span>
        </div>
        <label class="checkbox-label">
          <input v-model="bgmAudioOnly" type="checkbox" class="checkbox" />
          <span>Audio files only</span>
        </label>
        <span v-if="bgmFolderPath && bgmFiles.length === 0" class="warning-hint">No audio files found in this folder</span>
      </FormRow>

      <!-- Single mode: video file picker -->
      <FormRow v-if="!batchMode" label="Source Videos">
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

      <!-- Batch mode: video folder picker + videos per mix -->
      <FormRow v-if="batchMode" label="Video Folder">
        <div class="file-picker">
          <button class="picker-btn" @click="pickVideoFolder">
            <FaIcon :icon="['fasr', 'folder-open']" />
            <span>Select folder</span>
          </button>
          <span class="file-path">{{ videoFolderPath || 'No folder selected' }}</span>
          <span v-if="videoFolderPath" class="file-count">{{ videoFiles.length }} file{{ videoFiles.length !== 1 ? 's' : '' }}</span>
        </div>
        <span v-if="videoFolderPath && videoFiles.length === 0" class="warning-hint">No video files found in this folder</span>
      </FormRow>

      <FormRow v-if="batchMode" label="Videos per Mix">
        <div class="number-input">
          <input
            v-model.number="videosPerJob"
            type="number"
            class="input"
            min="1"
            :max="videoFiles.length || 1"
            step="1"
          />
        </div>
        <span v-if="bgmFiles.length > 0 && videoFiles.length > 0" class="style-hint">
          {{ bgmFiles.length }} job{{ bgmFiles.length !== 1 ? 's' : '' }} &times; {{ videosPerJob }} video{{ videosPerJob !== 1 ? 's' : '' }}
          = {{ bgmFiles.length * videosPerJob }} draws from {{ videoFiles.length }}
          <template v-if="bgmFiles.length * videosPerJob <= videoFiles.length"> (no overlap)</template>
          <template v-else> (each video used ~{{ (bgmFiles.length * videosPerJob / videoFiles.length).toFixed(1) }}&times;)</template>
        </span>
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

      <FormRow v-if="!batchMode" label="Output Filename">
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
          <option value="frenetic" title="Near-greedy, sub-beat everywhere. Cuts every 0.2–0.75s depending on energy.">Frenetic</option>
          <option value="chaos" title="Every beat, no scoring. Cuts every 0.12–0.35s depending on energy.">Chaos</option>
        </select>
        <span class="style-hint">{{ styleHints[mixStyle] }}</span>
      </FormRow>

      <FormRow label="Lookahead">
        <div class="lookahead-row">
          <input
            :value="lookahead"
            type="number"
            class="input lookahead-input"
            min="0"
            max="2"
            step="0.1"
            @input="lookahead = Math.max(0, Math.min(2, Number(($event.target as HTMLInputElement).value)))"
          />
          <span class="lookahead-unit">s</span>
        </div>
        <span class="style-hint">Scoring window past min gap (0 = greedy first-eligible beat)</span>
      </FormRow>

      <FormRow label="Transition Effect">
        <select v-model="transitionEffect" class="select" title="Visual transition between scenes">
          <option value="cut">Cut (instant switch)</option>
          <option value="circleopen">Circle Open</option>
          <option value="fadewhite">Fade White</option>
          <option value="horzopen">Horizontal Open</option>
          <option value="vertopen">Vertical Open</option>
          <option value="acid">Acid</option>
          <option value="doublevision">Double Vision</option>
          <option value="solarize">Solarize</option>
          <option value="strobe">Strobe (Black)</option>
          <option value="strobe_white">Strobe (White)</option>
        </select>
      </FormRow>

      <FormRow v-if="transitionEffect !== 'cut'" label="Transition Density">
        <div class="density-row">
          <input
            v-model.number="transitionDensity"
            type="range"
            class="density-slider"
            min="0"
            max="100"
            step="5"
          />
          <span class="density-value">{{ transitionDensity }}%</span>
        </div>
        <span class="style-hint">{{ transitionDensity === 0 ? 'Hard cuts only (faster encoding)' : `${transitionDensity}% of cuts get transitions` }}</span>
      </FormRow>

      <FormRow label="Clip Effect">
        <select v-model="clipEffect" class="select" title="Per-segment visual effect">
          <option value="none">None</option>
          <option value="shake">Shake</option>
          <option value="shake_hard">Shake (Hard)</option>
          <option value="shake_blur">Shake + Blur</option>
          <option value="zoompulse">Zoom Pulse</option>
          <option value="kenburns">Ken Burns</option>
          <option value="drift">Drift</option>
          <option value="vignette_pulse">Vignette Pulse</option>
          <option value="hueshift">Hue Shift</option>
          <option value="flashpulse">Flash Pulse</option>
          <option value="negflash">Negative Flash</option>
          <option value="chromatic">Chromatic Aberration</option>
        </select>
      </FormRow>

      <FormRow v-if="clipEffect !== 'none'" label="Effect Chance">
        <div class="density-row">
          <input
            v-model.number="effectChance"
            type="range"
            class="density-slider"
            min="0"
            max="100"
            step="5"
          />
          <span class="density-value">{{ effectChance }}%</span>
        </div>
        <span class="style-hint">{{ effectChance === 0 ? 'No segments get the effect' : `${effectChance}% chance per segment` }}</span>
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
        :disabled="batchMode ? !canStartBatch : (!bgmPath || sourceVideoPaths.length === 0 || !outputDir || !canStart)"
        @click="batchMode ? generateBatch() : startMix()"
      >
        <FaIcon :icon="['fasr', batchMode ? 'layer-group' : 'plus']" />
        <span>{{ batchMode ? (bgmFiles.length > 0 ? `Generate ${bgmFiles.length} Job${bgmFiles.length !== 1 ? 's' : ''}` : 'Generate Batch') : 'Start Mix' }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.config-root {
  max-width: 560px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.mode-toggle {
  display: flex;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 6px;
  overflow: hidden;
}

.toggle-btn {
  padding: 4px 14px;
  background: transparent;
  border: none;
  color: #9ca3af;
  font-size: 13px;
  cursor: pointer;
}

.toggle-btn.active {
  background: #2563eb;
  color: #fff;
}

.toggle-btn:hover:not(.active) {
  background: #374151;
}

.file-count {
  font-size: 12px;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.15);
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #9ca3af;
  cursor: pointer;
}

.checkbox {
  accent-color: #2563eb;
}

.warning-hint {
  font-size: 13px;
  color: #ef4444;
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

.lookahead-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.input.lookahead-input {
  width: 72px;
}

.lookahead-unit {
  font-size: 13px;
  color: #9ca3af;
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

.density-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.density-slider {
  flex: 1;
  accent-color: #2563eb;
  height: 4px;
}

.density-value {
  font-size: 13px;
  color: #d1d5db;
  min-width: 36px;
  text-align: right;
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
