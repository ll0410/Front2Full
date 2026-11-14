<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { getColumn, getTopic, topicPath } from '../../data/catalog'

const { page } = useData()

const current = computed(() => {
  const segments = (page.value.relativePath || '').replace(/\.md$/, '').split('/')
  // 只渲染专题页与文章页（/manual/<column>/<topic>/...），专栏页与首页不需要面包屑。
  if (segments[0] !== 'manual' || segments.length < 4) {
    return null
  }
  const columnSlug = segments[1]
  const topicSlug = segments[2]
  const column = getColumn(columnSlug)
  const topic = getTopic(columnSlug, topicSlug)
  if (!column || !topic) return null
  return {
    column: { title: column.title, link: withBase(`/manual/${columnSlug}/`) },
    topic: { title: topic.title, link: withBase(topicPath(columnSlug, topicSlug)) }
  }
})
</script>

<template>
  <nav v-if="current" class="doc-breadcrumb" aria-label="面包屑">
    <span class="doc-breadcrumb__label">专栏</span>
    <a :href="current.column.link">{{ current.column.title }}</a>
    <span class="doc-breadcrumb__sep" aria-hidden="true">›</span>
    <a :href="current.topic.link">{{ current.topic.title }}</a>
  </nav>
</template>
