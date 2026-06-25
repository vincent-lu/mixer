import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { closeDatabase, openDatabase } from './db/client'
import { runMigrations } from './db/migrator'
import { registerIpcHandlers } from './ipc'
import { validateFfmpeg } from './ffmpeg/validate'
import { startRunner, stopRunner } from './runner'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.rocketmen.mixer')

  openDatabase()
  runMigrations()

  validateFfmpeg()
    .then((versions) => {
      console.log(`[main] ffmpeg ${versions.ffmpeg}, ffprobe ${versions.ffprobe}`)
    })
    .catch((err) => {
      console.error('[main] ffmpeg validation failed:', err instanceof Error ? err.message : err)
    })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()

  createWindow()

  startRunner()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopRunner()
  closeDatabase()
})
