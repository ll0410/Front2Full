import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import { Button, Input, Select, Dialog } from '@vcl/components'
import DocBreadcrumb from './components/DocBreadcrumb.vue'
import HomeColumns from './components/HomeColumns.vue'
import TopicGrid from './components/TopicGrid.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'doc-before': () => h(DocBreadcrumb)
    }),
  enhanceApp({ app }: { app: import('vue').App }) {
    app.component('HomeColumns', HomeColumns)
    app.component('TopicGrid', TopicGrid)
    app.component('Button', Button)
    app.component('Input', Input)
    app.component('Select', Select)
    app.component('Dialog', Dialog)
  }
}
