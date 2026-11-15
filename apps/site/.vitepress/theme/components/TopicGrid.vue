<script setup lang="ts">
import { computed } from 'vue'
import { withBase } from 'vitepress'
import { countArticles, getColumn, topicPath } from '../../data/catalog'
import TopicCard from './TopicCard.vue'

const props = defineProps<{ column: string }>()

const column = computed(() => getColumn(props.column))
const published = computed(
  () => column.value?.topics.filter((topic) => topic.status === 'published') ?? []
)
const planned = computed(
  () => column.value?.topics.filter((topic) => topic.status === 'planned') ?? []
)

function linkOf(topicSlug: string) {
  return withBase(topicPath(props.column, topicSlug))
}

function metaOf(topic: (typeof published.value)[number]) {
  const parts = topic.parts?.length ?? 0
  return parts ? `${parts} 个部分 · ${countArticles(topic)} 篇文章` : ''
}
</script>

<template>
  <section v-if="column" class="topic-section">
    <h2 class="topic-section__title">已发布专题（{{ published.length }}）</h2>
    <div v-if="published.length" class="topic-grid">
      <TopicCard
        v-for="topic in published"
        :key="topic.slug"
        :title="topic.title"
        :description="topic.description"
        :meta="metaOf(topic)"
        :href="linkOf(topic.slug)"
      />
    </div>
    <p v-else class="topic-section__empty">暂无已发布专题，正在整理中。</p>

    <template v-if="planned.length">
      <h2 class="topic-section__title">筹备中专题（{{ planned.length }}）</h2>
      <div class="topic-grid">
        <TopicCard
          v-for="topic in planned"
          :key="topic.slug"
          :title="topic.title"
          :description="topic.description"
        />
      </div>
    </template>
  </section>
</template>
