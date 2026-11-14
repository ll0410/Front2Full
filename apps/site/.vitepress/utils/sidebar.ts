import type { DefaultTheme } from 'vitepress'
import { articlePath, topicPath, type Column, type Topic } from '../data/catalog'

function buildTopicSidebar(column: Column, topic: Topic): DefaultTheme.SidebarItem[] {
  const entry: DefaultTheme.SidebarItem = {
    text: topic.title,
    link: topicPath(column.slug, topic.slug)
  }

  if (!topic.parts?.length) {
    return [entry]
  }

  let index = 0
  const groups = topic.parts.map(part => ({
    text: part.title,
    collapsed: false,
    items: part.articles.map(article => {
      index += 1
      return {
        text: `${index}. ${article.title}`,
        link: articlePath(column.slug, topic.slug, article.slug)
      }
    })
  }))

  return [entry, ...groups]
}

export function buildSidebar(columns: Column[]): DefaultTheme.SidebarMulti {
  const sidebar: DefaultTheme.SidebarMulti = {}

  for (const column of columns) {
    for (const topic of column.topics) {
      if (topic.status !== 'published') continue
      sidebar[topicPath(column.slug, topic.slug)] = buildTopicSidebar(column, topic)
    }
  }

  return sidebar
}
