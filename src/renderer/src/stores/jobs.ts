import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { platform } from '@renderer/platform'
import type { MixJob, MixJobConfig } from '@renderer/platform'

function ipcClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export const useJobsStore = defineStore('jobs', () => {
  const jobs = ref<MixJob[]>([])
  const loading = ref(false)

  let pollTimer: ReturnType<typeof setInterval> | null = null

  const activeJobs = computed(() =>
    jobs.value.filter((j) => j.status === 'analyzing' || j.status === 'mixing'),
  )

  const pendingJobs = computed(() => jobs.value.filter((j) => j.status === 'pending'))

  const completedJobs = computed(() =>
    jobs.value.filter(
      (j) => j.status === 'done' || j.status === 'failed' || j.status === 'cancelled',
    ),
  )

  async function load(): Promise<void> {
    loading.value = true
    try {
      jobs.value = await platform.listJobs()
    } catch (e) {
      console.error('[jobs] load failed:', e)
    } finally {
      loading.value = false
    }
  }

  async function create(name: string, config: MixJobConfig): Promise<MixJob | null> {
    try {
      const job = await platform.createJob({ name, config: ipcClone(config) })
      jobs.value = [job, ...jobs.value]
      return job
    } catch (e) {
      console.error('[jobs] create failed:', e)
      return null
    }
  }

  async function cancel(id: number): Promise<void> {
    try {
      await platform.cancelJob(id)
      await load()
    } catch (e) {
      console.error('[jobs] cancel failed:', e)
    }
  }

  async function remove(id: number): Promise<void> {
    try {
      await platform.deleteJob(id)
      jobs.value = jobs.value.filter((j) => j.id !== id)
    } catch (e) {
      console.error('[jobs] remove failed:', e)
    }
  }

  function startPolling(): void {
    if (pollTimer) return
    pollTimer = setInterval(() => {
      if (activeJobs.value.length > 0) {
        void load()
      }
    }, 1000)
  }

  function stopPolling(): void {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  return {
    jobs,
    loading,
    activeJobs,
    pendingJobs,
    completedJobs,
    load,
    create,
    cancel,
    remove,
    startPolling,
    stopPolling,
  }
})
