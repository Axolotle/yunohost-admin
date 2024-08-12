<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const slots = defineSlots<{
  'top-bar-group-left': any
  'top-bar-group-right': any
  'top-bar': any
  top: any
  default: any
  bot: any
  skeleton: any
}>()
</script>

<template>
  <div>
    <TopBar v-if="slots['top-bar-group-left'] || slots['top-bar-group-right']">
      <template #group-left>
        <slot name="top-bar-group-left" />
      </template>
      <template #group-right>
        <slot name="top-bar-group-right" />
      </template>
    </TopBar>
    <slot v-else name="top-bar" />

    <slot name="top" />

    <slot name="default" />

    <slot name="bot" />
  </div>
</template>
