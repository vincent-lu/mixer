import { ipcMain } from 'electron'
import type { AppSettings, MixJobConfig, Preset } from '../../shared/types'
import { createPreset, deletePreset, listPresets, updatePreset } from '../db/presets'
import {
  getAppSettings,
  setDefaultOutputDir,
  setLastUsedPresetId,
  setMaxConcurrency,
} from '../db/state'

export function registerPresetsHandlers(): void {
  ipcMain.handle('presets:list', async (): Promise<Preset[]> => {
    return listPresets()
  })

  ipcMain.handle(
    'presets:create',
    async (_event, input: { name: string; config: MixJobConfig }): Promise<Preset> => {
      return createPreset(input)
    },
  )

  ipcMain.handle(
    'presets:update',
    async (_event, id: number, input: { name?: string; config?: MixJobConfig }): Promise<void> => {
      updatePreset(id, input)
    },
  )

  ipcMain.handle('presets:delete', async (_event, id: number): Promise<void> => {
    deletePreset(id)
  })

  ipcMain.handle('state:getSettings', async (): Promise<AppSettings> => {
    return getAppSettings()
  })

  ipcMain.handle(
    'state:setMaxConcurrency',
    async (_event, concurrency: number): Promise<void> => {
      setMaxConcurrency(concurrency)
    },
  )

  ipcMain.handle(
    'state:setDefaultOutputDir',
    async (_event, dir: string | null): Promise<void> => {
      setDefaultOutputDir(dir)
    },
  )

  ipcMain.handle(
    'state:setLastUsedPresetId',
    async (_event, id: number | null): Promise<void> => {
      setLastUsedPresetId(id)
    },
  )
}
