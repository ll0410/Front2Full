<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description: string
    meta?: string
    href?: string
    plannedLabel?: string
  }>(),
  { meta: '', href: undefined, plannedLabel: '筹备中' }
)
</script>

<template>
  <component
    :is="href ? 'a' : 'div'"
    class="topic-card"
    :class="{ 'topic-card--planned': !href }"
    :href="href"
  >
    <span class="topic-card__title">
      {{ title }}
      <span v-if="!href" class="topic-card__badge">{{ plannedLabel }}</span>
    </span>
    <span class="topic-card__desc">{{ description }}</span>
    <span v-if="meta" class="topic-card__meta">{{ meta }}</span>
  </component>
</template>
