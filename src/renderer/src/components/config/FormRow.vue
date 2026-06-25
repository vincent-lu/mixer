<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div class="form-row">
    <label class="form-row-label">{{ label }}</label>
    <div class="form-row-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-row-label {
  font-size: 12px;
  font-weight: 500;
  color: #aaa;
}

.form-row-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
