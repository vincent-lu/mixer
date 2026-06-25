import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { platform } from '@renderer/platform'
import type { MixJob, MixJobConfig, ProgressStage } from '@renderer/platform'

function ipcClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export const useJobsStore = defineStore('jobs', () => {
  const jobs = ref<MixJob[]>([])
  const loading = ref(false)

  const unsubs: Array<() => void> = []

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

  async function retry(id: number): Promise<void> {
    try {
      await platform.retryJob(id)
      await load()
    } catch (e) {
      console.error('[jobs] retry failed:', e)
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

  function subscribe(): void {
    if (unsubs.length > 0) return
    unsubs.push(
      platform.onJobProgress((data: { id: number; progress: number; stage: ProgressStage }) => {
        const job = jobs.value.find((j) => j.id === data.id)
        if (job) {
          job.progress = data.progress
          job.progressStage = data.stage
        }
      }),
      platform.onJobStatusChange((updated: MixJob) => {
        const idx = jobs.value.findIndex((j) => j.id === updated.id)
        if (idx !== -1) {
          jobs.value[idx] = updated
        }
      }),
    )
  }

  function unsubscribe(): void {
    for (const fn of unsubs) fn()
    unsubs.length = 0
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
    retry,
    remove,
    subscribe,
    unsubscribe,
  }
})
