/**
 * 独立窗口标题栏颜色跟随站点主题。
 * 读取 --vp-c-bg（浅色 #ffffff / 深色 #111827），随 html.dark 变化同步到所有 theme-color meta。
 */
const FALLBACK = { light: '#ffffff', dark: '#111827' }

export function setupThemeColor() {
  if (typeof document === 'undefined') return

  const apply = () => {
    const isDark = document.documentElement.classList.contains('dark')
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--vp-c-bg').trim()
    const color = bg || (isDark ? FALLBACK.dark : FALLBACK.light)
    // 把所有 theme-color meta 都写成同一颜色：无论浏览器选中的是 media 兜底条还是系统偏好条，结果都正确
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
      if (meta.getAttribute('content') !== color) meta.setAttribute('content', color)
    })
  }

  apply()
  new MutationObserver(apply).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
}
