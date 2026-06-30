import { readdir, rename, stat, unlink } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { BrowserWindow, ipcMain, shell } from 'electron'
import type { ConvertResult, DuplicateGroup, NormalizeFileStatus } from '../../shared/types'
import { probeVideo } from '../mixer/probe'
import { buildNormalizeArgs, DEFAULT_PRESET, isLocalPath, needsNormalization } from '../mixer/normalize'
import { runFfmpeg } from '../mixer/encode'

const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v']
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma']

function broadcast(channel: string, data: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, data)
  }
}

function normalizeForComparison(name: string): string {
  let n = name.replace(/\.[^.]+$/, '')
  n = n.replace(/\s*\(\d+\)\s*$/, '')
  n = n.replace(/\s*-\s*copy\s*(\d+)?\s*$/i, '')
  n = n.replace(/\s+copy\s*(\d+)?\s*$/i, '')
  n = n.replace(/[_-]copy\s*(\d+)?\s*$/i, '')
  n = n.trim().toLowerCase()
  return n
}

export function registerToolsHandlers(): void {
  ipcMain.handle(
    'tools:convert-mp4-to-mp3',
    async (_event, dir: string): Promise<ConvertResult[]> => {
      const entries = await readdir(dir, { withFileTypes: true, recursive: true })
      const mp4Files = entries
        .filter((e) => e.isFile() && extname(e.name).toLowerCase() === '.mp4')
        .map((e) => join(e.parentPath, e.name))
        .sort()

      const total = mp4Files.length
      const results: ConvertResult[] = []

      for (let i = 0; i < mp4Files.length; i++) {
        const mp4 = mp4Files[i]!
        const mp3 = mp4.replace(/\.mp4$/i, '.mp3')

        broadcast('tools:convert-progress', { current: i + 1, total, currentFile: mp4, filePercent: 0 })

        try {
          const exists = await stat(mp3).then(() => true, () => false)
          if (exists) {
            results.push({ file: mp4, ok: true, skipped: true })
            continue
          }

          let duration = 300
          try { duration = (await probeVideo(mp4)).duration } catch { /* use fallback */ }

          const tempMp3 = mp3 + '.tmp'
          try {
            const args = ['-y', '-i', mp4, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', '-f', 'mp3', tempMp3]
            await runFfmpeg(args, duration, (percent) => {
              broadcast('tools:convert-progress', { current: i + 1, total, currentFile: mp4, filePercent: percent })
            })
            await rename(tempMp3, mp3)
          } catch (err) {
            await unlink(tempMp3).catch(() => {})
            throw err
          }
          await unlink(mp4)
          results.push({ file: mp4, ok: true })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          results.push({ file: mp4, ok: false, error: message })
        }
      }

      return results
    },
  )

  ipcMain.handle(
    'tools:find-duplicates',
    async (_event, dir: string): Promise<DuplicateGroup[]> => {
      const entries = await readdir(dir, { withFileTypes: true, recursive: true })
      const audioFiles: Array<{ path: string; name: string; size: number }> = []

      for (const e of entries) {
        if (!e.isFile()) continue
        const ext = extname(e.name).slice(1).toLowerCase()
        if (!AUDIO_EXTENSIONS.includes(ext)) continue
        const fullPath = join(e.parentPath, e.name)
        try {
          const s = await stat(fullPath)
          audioFiles.push({ path: fullPath, name: e.name, size: s.size })
        } catch {
          // skip inaccessible files
        }
      }

      const groups: DuplicateGroup[] = []
      const usedInSizeGroup = new Set<string>()

      // Group by exact filesize
      const sizeMap = new Map<number, typeof audioFiles>()
      for (const f of audioFiles) {
        const existing = sizeMap.get(f.size)
        if (existing) {
          existing.push(f)
        } else {
          sizeMap.set(f.size, [f])
        }
      }
      for (const [size, files] of sizeMap) {
        if (files.length < 2) continue
        groups.push({
          reason: 'size',
          matchValue: String(size),
          files: files.map((f) => ({ path: f.path, size: f.size })),
        })
        for (const f of files) usedInSizeGroup.add(f.path)
      }

      // Group by fuzzy filename (skip files already in a size group)
      const nameMap = new Map<string, typeof audioFiles>()
      for (const f of audioFiles) {
        if (usedInSizeGroup.has(f.path)) continue
        const normalized = normalizeForComparison(f.name)
        const existing = nameMap.get(normalized)
        if (existing) {
          existing.push(f)
        } else {
          nameMap.set(normalized, [f])
        }
      }
      for (const [normalized, files] of nameMap) {
        if (files.length < 2) continue
        groups.push({
          reason: 'name',
          matchValue: normalized,
          files: files.map((f) => ({ path: f.path, size: f.size })),
        })
      }

      return groups
    },
  )

  ipcMain.handle(
    'tools:delete-files',
    async (_event, paths: string[]): Promise<ConvertResult[]> => {
      const results: ConvertResult[] = []
      for (const p of paths) {
        try {
          await shell.trashItem(p)
          results.push({ file: p, ok: true })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          results.push({ file: p, ok: false, error: message })
        }
      }
      return results
    },
  )

  ipcMain.handle(
    'tools:scan-normalize',
    async (_event, dir: string): Promise<NormalizeFileStatus[]> => {
      const entries = await readdir(dir, { withFileTypes: true, recursive: true })
      const videoFiles = entries
        .filter((e) => e.isFile() && VIDEO_EXTENSIONS.includes(extname(e.name).slice(1).toLowerCase()))
        .map((e) => join(e.parentPath, e.name))
        .sort()

      const results: NormalizeFileStatus[] = []
      for (const path of videoFiles) {
        try {
          const probe = await probeVideo(path)
          const nonMp4 = extname(path).toLowerCase() !== '.mp4'
          results.push({
            path,
            needsWork: needsNormalization(probe, DEFAULT_PRESET) || nonMp4,
            codec: probe.codec,
            width: probe.width,
            height: probe.height,
            fps: probe.fps,
            duration: probe.duration,
          })
        } catch (err) {
          results.push({
            path,
            needsWork: false,
            codec: 'unknown',
            width: 0,
            height: 0,
            fps: 0,
            duration: 0,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
      return results
    },
  )

  ipcMain.handle(
    'tools:normalize-videos',
    async (_event, paths: string[]): Promise<ConvertResult[]> => {
      const results: ConvertResult[] = []
      const total = paths.length

      for (let i = 0; i < paths.length; i++) {
        const videoPath = paths[i]!
        broadcast('tools:normalize-progress', { current: i + 1, total, currentFile: videoPath, filePercent: 0 })

        try {
          if (!isLocalPath(videoPath)) {
            results.push({ file: videoPath, ok: false, error: 'File is on a network or external drive' })
            continue
          }

          const probe = await probeVideo(videoPath)
          const isMp4 = extname(videoPath).toLowerCase() === '.mp4'
          if (!needsNormalization(probe, DEFAULT_PRESET) && isMp4) {
            results.push({ file: videoPath, ok: true })
            continue
          }

          const finalPath = isMp4 ? videoPath : videoPath.replace(/\.[^.]+$/, '.mp4')
          if (!isMp4 && await stat(finalPath).then(() => true, () => false)) {
            results.push({ file: videoPath, ok: false, error: 'Target .mp4 already exists' })
            continue
          }

          const tempPath = join(dirname(videoPath), `.mixer-norm-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`)

          try {
            const args = buildNormalizeArgs(videoPath, tempPath, DEFAULT_PRESET)
            await runFfmpeg(args, probe.duration, (percent) => {
              broadcast('tools:normalize-progress', { current: i + 1, total, currentFile: videoPath, filePercent: percent })
            })
            await rename(tempPath, finalPath)
          } catch (err) {
            await unlink(tempPath).catch(() => {})
            throw err
          }
          if (!isMp4) await unlink(videoPath).catch(() => {})
          results.push({ file: videoPath, ok: true })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          results.push({ file: videoPath, ok: false, error: message })
        }
      }

      return results
    },
  )
}
