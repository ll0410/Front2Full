<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { withBase } from 'vitepress'
import { columns, countArticles, topicPath } from '../../data/catalog'

const columnEls = ref<HTMLElement[]>([])

// 鼠标悬停或键盘聚焦的专栏优先；否则取滚动后最靠近视口中心的专栏。
// 同一时刻只允许一个专栏标题可见。
const manualSlug = ref<string | null>(null)
const centeredSlug = ref<string | null>(null)
const activeSlug = computed(() => manualSlug.value ?? centeredSlug.value)

let frame = 0

// 视口上下各收 40%，只保留中层 20% 窄带；在带内取中心最接近视口中线的专栏
const pickCentered = () => {
  frame = 0
  const viewportHeight = window.innerHeight
  const bandTop = viewportHeight * 0.4
  const bandBottom = viewportHeight * 0.6
  let best: HTMLElement | undefined
  let bestDistance = Infinity

  columnEls.value.forEach((el) => {
    const rect = el.getBoundingClientRect()
    if (rect.bottom < bandTop || rect.top > bandBottom) return
    const distance = Math.abs((rect.top + rect.bottom) / 2 - viewportHeight / 2)
    if (distance < bestDistance) {
      bestDistance = distance
      best = el
    }
  })

  centeredSlug.value = best?.dataset.slug ?? null
}

const onScroll = () => {
  if (frame) return
  frame = requestAnimationFrame(pickCentered)
}

const clearManual = (slug: string) => {
  if (manualSlug.value === slug) manualSlug.value = null
}

// 焦点在专栏内部移动时不清除，只有焦点真正离开才回落到居中判定
const onFocusOut = (event: FocusEvent) => {
  const next = event.relatedTarget as Node | null
  if (next && (event.currentTarget as HTMLElement).contains(next)) return
  manualSlug.value = null
}

onMounted(() => {
  // 首屏不计算，只有用户真正滚动后才判定居中专栏
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  if (frame) cancelAnimationFrame(frame)
})

const sections = columns.map((column) => ({
  slug: column.slug,
  title: column.title,
  topics: column.topics.map((topic) => ({
    slug: topic.slug,
    title: topic.title,
    description: topic.description,
    link:
      topic.status === 'published' ? withBase(topicPath(column.slug, topic.slug)) : undefined,
    meta: topic.parts?.length ? `${topic.parts.length} 个部分 · ${countArticles(topic)} 篇文章` : ''
  }))
}))
</script>

<template>
  <div class="home-columns">
    <section
      v-for="section in sections"
      :key="section.slug"
      ref="columnEls"
      class="home-column"
      :class="{ 'home-column--active': activeSlug === section.slug }"
      :data-slug="section.slug"
      @mouseenter="manualSlug = section.slug"
      @mouseleave="clearManual(section.slug)"
      @focusin="manualSlug = section.slug"
      @focusout="onFocusOut"
    >
      <div class="home-column__head">
        <h2 class="home-column__title">{{ section.title }}</h2>
        <span class="home-column__count">{{ section.topics.length }} 个专题</span>
      </div>
      <ul class="home-column__list">
        <li v-for="topic in section.topics" :key="topic.slug">
          <component
            :is="topic.link ? 'a' : 'div'"
            class="home-topic"
            :class="{ 'home-topic--planned': !topic.link }"
            :href="topic.link"
          >
            <span class="home-topic__title">
              {{ topic.title }}
              <span v-if="!topic.link" class="home-topic__badge">筹备中</span>
            </span>
            <span class="home-topic__desc">{{ topic.description }}</span>
            <span v-if="topic.meta" class="home-topic__meta">{{ topic.meta }}</span>
          </component>
        </li>
      </ul>
    </section>
  </div>
</template>
