import { dialog, ipcMain, shell } from 'electron'
import { validateFfmpeg } from '../ffmpeg/validate'

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
          extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v'],
        },
      ],
    })
    if (result.canceled) return []
    return result.filePaths
  })

  ipcMain.handle('platform:selectAudioFile', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Select audio file',
      properties: ['openFile'],
      filters: [
        {
          name: 'Audio files',
          extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'],
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
}
