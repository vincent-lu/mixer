import { registerJobsHandlers } from './jobs'
import { registerPresetsHandlers } from './presets'
import { registerPlatformHandlers } from './platform'
import { registerToolsHandlers } from './tools'

export function registerIpcHandlers(): void {
  registerJobsHandlers()
  registerPresetsHandlers()
  registerPlatformHandlers()
  registerToolsHandlers()
}
