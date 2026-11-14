<script setup lang="ts">
import { withBase } from 'vitepress'
import { columns, countArticles, topicPath } from '../../data/catalog'

const icons: Record<string, string[]> = {
  agent: [
    'M12 8V4H8',
    'M4 8h16v12H4z',
    'M2 14h2',
    'M20 14h2',
    'M15 13v2',
    'M9 13v2'
  ],
  llm: [
    'M4 4h16v16H4z',
    'M9 9h6v6H9z',
    'M15 2v2',
    'M15 20v2',
    'M2 15h2',
    'M2 9h2',
    'M20 15h2',
    'M20 9h2',
    'M9 2v2',
    'M9 20v2'
  ],
  math: ['M18 6V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.6 6.2a2 2 0 0 1 0 2.4L6.1 19.2a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-1'],
  'computer-programming': ['m16 18 6-6-6-6', 'm8 6-6 6 6 6'],
  tools: [
    'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z'
  ],
  frameworks: [
    'm12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z',
    'm22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65',
    'm22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65'
  ],
  'engineering-practice': [
    'm7.5 4.27 9 5.15',
    'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z',
    'm3.3 7 8.7 5 8.7-5',
    'M12 22V12'
  ]
}

const sections = columns.map((column) => ({
  slug: column.slug,
  title: column.title,
  icon: icons[column.slug] ?? icons.tools,
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
    <section v-for="section in sections" :key="section.slug" class="home-column">
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
            <span class="home-topic__icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path v-for="(d, index) in section.icon" :key="index" :d="d" />
              </svg>
            </span>
            <span class="home-topic__body">
              <span class="home-topic__title">
                {{ topic.title }}
                <span v-if="!topic.link" class="home-topic__badge">筹备中</span>
              </span>
              <span class="home-topic__desc">{{ topic.description }}</span>
              <span v-if="topic.meta" class="home-topic__meta">{{ topic.meta }}</span>
            </span>
          </component>
        </li>
      </ul>
    </section>
  </div>
</template>
