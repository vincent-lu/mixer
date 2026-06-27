import { readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { dialog, ipcMain, shell } from 'electron'
import { validateFfmpeg } from '../ffmpeg/validate'

const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v']
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma']

export function registerPlatformHandlers(): void {
  ipcMain.handle('platform:ping', async (): Promise<string> => {
    return 'pong'
  })

  ipcMain.handle('platform:selectDirectory', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Select directory',
      properties: ['openDirectory'],
    })
    if (result.canceled) return null
    return result.filePaths[0] ?? null
  })

  ipcMain.handle('platform:selectVideoFiles', async (): Promise<string[]> => {
    const result = await dialog.showOpenDialog({
      title: 'Select video files',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Video files',
          extensions: VIDEO_EXTENSIONS,
        },
      ],
    })
    if (result.canceled) return []
    return result.filePaths
  })

  ipcMain.handle('platform:selectAudioFile', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Select audio or video file',
      properties: ['openFile'],
      filters: [
        {
          name: 'Audio / Video files',
          extensions: [...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS],
        },
      ],
    })
    if (result.canceled) return null
    return result.filePaths[0] ?? null
  })

  ipcMain.handle(
    'platform:ffmpegVersion',
    async (): Promise<{ ffmpeg: string; ffprobe: string }> => {
      return validateFfmpeg()
    },
  )

  ipcMain.handle('platform:openPath', async (_event, path: string): Promise<string> => {
    return shell.openPath(path)
  })

  ipcMain.handle('platform:showItemInFolder', async (_event, path: string): Promise<void> => {
    shell.showItemInFolder(path)
  })

  ipcMain.handle(
    'platform:listMediaFiles',
    async (
      _event,
      input: { dir: string; type: 'video' | 'audio' },
    ): Promise<string[]> => {
      const extensions = input.type === 'video'
        ? VIDEO_EXTENSIONS
        : [...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS]
      try {
        const entries = await readdir(input.dir, { withFileTypes: true })
        return entries
          .filter((e) => {
            if (!e.isFile()) return false
            const ext = extname(e.name).slice(1).toLowerCase()
            return extensions.includes(ext)
          })
          .map((e) => join(input.dir, e.name))
          .sort()
      } catch {
        return []
      }
    },
  )
}
