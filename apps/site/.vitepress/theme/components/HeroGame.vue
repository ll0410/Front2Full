<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { GUNDAMS, ZAKUS, type MechSprite } from './mechSprites'

/**
 * 首页 hero 区域的像素机甲小游戏：
 * 鼠标在画布内移动时高达跟随，移出后回到待机位置，跟随时持续自动射击。
 * 随机渣古携带技术栈名词从顶部降落，被击中 5 次后炸成像素碎片；每击落 10 台渣古，
 * 高达就在原地爆发一圈光芒并随机变身成另一台，同时弹出 TRANS-AM 高亮文字。
 * 渣古被击落后有 30% 概率掉落站点 logo，高达吃掉 logo 也会触发一次变身。
 * 每次变身射速加快 15%，累计最多加快 200%；加成达到 30%/60%/90% 时各多一条子弹线。
 * 高达与渣古相撞时两台都爆炸（不计入击落数），复活后所有增益清零。
 * 背景有少量像素写字楼向下滚动，用来制造场景移动的速度感；它们也能被子弹击中，
 * 被击中 10 次就会炸掉，每命中一次楼体就缺掉一角。
 * 画布内部以 4px 为一个像素块绘制，机甲 sprite 每个像素按各自的缩放系数换算。
 */

const UNIT = 4
// 高达与渣古的缩放系数会根据画布高度动态计算，保证在不同尺寸的容器里
// 机体占场地的比例稳定，不会在窄屏里过大、宽屏里过小。
// 目标占画布高度的比例：玩家 24%，敌机 17%
const PLAYER_HEIGHT_RATIO = 0.24
const ENEMY_HEIGHT_RATIO = 0.17
// 用于归一化各机型 sprite 高度差异的参考高度
const PLAYER_REF_HEIGHT = 48
const ENEMY_REF_HEIGHT = 45
// 缩放系数的上下限，避免极小/极大屏幕下机体失衡
const PLAYER_SCALE_MIN = 0.3
const PLAYER_SCALE_MAX = 0.9
const ENEMY_SCALE_MIN = 0.22
const ENEMY_SCALE_MAX = 0.7
let playerScale = 0.55
let enemyScale = 0.4
// 初始射击间隔；每次变身射速 +15%，叠加封顶 +200%（最快为初始的 3 倍）
const FIRE_INTERVAL = 0.16
const FIRE_RATE_STEP = 0.15
const FIRE_RATE_MAX_BONUS = 2
// 射速加成达到这些档位时，各增加一条子弹线
const FIRE_RATE_LINE_THRESHOLDS = [0.3, 0.6, 0.9]
const BULLET_SPEED = 46
// 非全屏时画布的典型高度（块），用于把「块/秒」速度按画布高度等比缩放，
// 保证全屏后物体穿越屏幕的耗时不变，游戏节奏不随画布大小变化
const REFERENCE_HEIGHT = 60
let speedScale = 1
const MAX_ENEMIES = 3
// 每击落这么多台渣古才变身一次
const TRANSFORM_KILLS = 10
// 累计变身次数达到该值（及整数倍）时触发一次全屏轰炸
const BOMBARD_TRANSFORM_COUNT = 5
// 全屏轰炸持续时间（秒）
const BOMBARD_DURATION = 5
// 全屏轰炸是否启用红色暗角 vignette（false = 关闭，保留代码以便重新开启）
const BOMBARD_VIGNETTE = false
// 渣古被击落后掉落站点 logo 的概率，高达吃掉 logo 也会变身
const DROP_CHANCE = 0.3
// 掉落的 logo 边长（像素块）
const LOGO_SIZE = 8
// 高达与渣古相撞后：双方爆炸，高达消失这么久再原地复活，复活后短暂无敌
const RESPAWN_DELAY = 0.8
const INVINCIBLE_TIME = 1.2
// 变身光芒的放射光线数量
const RAY_COUNT = 14
// 行走动画帧数与每帧时长（一个左右迈步周期约 0.6s）
const WALK_FRAMES = 4
const WALK_STEP_TIME = 0.15
// 踏步起伏幅度：1 CSS 像素（0.25 块）
const BOB_AMPLITUDE = 1 / UNIT
// 同时出现在画面里的背景建筑数量
const PROP_COUNT = 4
// 建筑物阻挡高达移动的容差：碰撞盒比实际楼体每边缩小这么多块，避免贴边时卡死
const PROP_BLOCK_TOLERANCE = 1.5
// 所有装饰用同一速度向下滚动，模拟画面整体前进而非物体各自掉落
const PROP_SPEED = 7
const PROP_ALPHA = 0.55
// 同一栋楼被子弹击中这么多次后炸掉，每命中一次楼体缺掉一角
const BUILDING_HP = 10
// 渣古被子弹击中这么多次后爆炸
const ENEMY_HP = 5
const CHARSET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

// 渣古随机携带的技术栈名词
const TECH_NAMES = [
  'TypeScript',
  'JavaScript',
  'React',
  'Vue',
  'Angular',
  'Svelte',
  'SolidJS',
  'Next.js',
  'Nuxt',
  'SvelteKit',
  'Astro',
  'Remix',
  'Qwik',
  'TanStack Start',
  'Vite',
  'Rspack',
  'Turbopack',
  'Webpack',
  'Tailwind CSS',
  'shadcn/ui',
  'CSS Grid',
  'Container Queries',
  ':has()',
  'Zustand',
  'Jotai',
  'Redux Toolkit',
  'Pinia',
  'TanStack Query',
  'Cursor',
  'Claude Code',
  'Windsurf',
  'Kiro',
  'NestJS',
  'Fastify',
  'Express',
  'Hono',
  'Gin',
  'Echo',
  'FastAPI',
  'Django',
  'Ruby on Rails',
  'Laravel',
  'PostgreSQL',
  'MySQL',
  'Redis',
  'MongoDB',
  'TiDB',
  'CockroachDB',
  'ClickHouse',
  'Prisma',
  'Drizzle',
  'SQLAlchemy',
  'Auth.js',
  'NextAuth',
  'Clerk',
  'JWT'
]

const MONO_FONT = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
const EXPLOSION_COLORS = ['#ffd859', '#ff8a5c', '#ff5f56', '#ffffff']
// 每帧各部位的位移：腿向上抬 1 像素，手臂向外侧多铺 1 列像素（不用挖空，避免关节出现白缝）
const WALK_OFFSETS = [
  { leftArm: -1, rightArm: 0, leftLeg: -1, rightLeg: 0 }, // 左脚抬起 + 左臂外摆
  { leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 }, // 过渡帧
  { leftArm: 0, rightArm: 1, leftLeg: 0, rightLeg: -1 }, // 右脚抬起 + 右臂外摆
  { leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 } // 过渡帧
]
// 像素分区：0 躯干/头部，1 左臂，2 右臂，3 左腿，4 右腿
const PART_BODY = 0
const PART_LEFT_ARM = 1
const PART_RIGHT_ARM = 2
const PART_LEFT_LEG = 3
const PART_RIGHT_LEG = 4

// 子弹：每台高达有独立武器配置，子弹携带速度、形状、穿透/反弹/追踪等属性
type Bullet = {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  w: number
  h: number
  // 剩余穿透次数（命中后不消失，继续飞行）；0 表示命中即消失
  pierce: number
  // 已命中过的敌人 id，防止穿透弹对同一敌人反复扣血
  hitIds: Set<number>
  // 剩余墙壁反弹次数
  bounces: number
  // 追踪强度（0 不追踪），数值越大转向越激进
  homing: number
  // 每次命中造成的伤害
  damage: number
  // 最大寿命（秒），防止追踪弹无限存活
  life: number
  age: number
  shape: 'rect' | 'round' | 'beam' | 'rocket'
  // 是否绘制拖尾（追踪弹用）
  trail: boolean
}
// 敌机 id 自增器，供穿透弹记录已命中目标
let nextEnemyId = 1
type Enemy = {
  id: number
  x: number
  y: number
  baseX: number
  amp: number
  phase: number
  speed: number
  name: string
  sprite: RenderSprite
  halfW: number
  halfH: number
  walkOffset: number
  // 剩余可承受的子弹数，归零即爆炸
  hp: number
}
type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
  color: string
}
type RenderSprite = {
  width: number
  height: number
  colors: string[]
  grid: number[][]
  // 腿部分界行与左右分界列
  legTop: number
  splitX: number
  part: Uint8Array
}
// 变身时以高达为中心四散的光芒
type Burst = {
  age: number
  life: number
  spin: number
}
// 全屏轰炸：记录已持续时间，期间持续在画面各处引发爆炸并清屏
type Bombard = {
  age: number
  life: number
}
// 击落后掉落的站点 logo，缓慢下落并轻微横摆，高达碰到即吃掉
type Drop = {
  x: number
  y: number
  baseX: number
  phase: number
  speed: number
}
// 背景装饰的像素图：字符为键，查 colors 得到颜色，未命中的字符视为透明
type PropSprite = {
  width: number
  height: number
  colors: Record<string, string>
  rows: string[]
}
type Prop = {
  x: number
  y: number
  speed: number
  sprite: PropSprite
  // 剩余可承受的子弹数，归零即爆炸
  hp: number
}

// 背景装饰：随机大小与高度的长方形城市写字楼，黑色剪影 + 白色窗户镂空
// o 楼体/描边，l 亮窗，d 暗窗（熄灯）
// 颜色随深浅主题切换：浅色模式下用浅灰楼体 + 深色窗洞，避免过重
const BUILDING_COLORS: Record<string, string> = {
  o: '#1a1a1a',
  l: '#ffffff',
  d: '#444444'
}

const BUILDING_PALETTES = {
  dark: { o: '#1a1a1a', l: '#ffffff', d: '#444444' },
  light: { o: '#c2c2c2', l: '#3a3a3a', d: '#9a9a9a' }
}

// 生成一栋写字楼：参考城市剪影风格，黑色楼体上开出规则的白色窗户
// style 'grid' 为方格窗，'strip' 为横向带状窗
const makeBuilding = (w: number, h: number): PropSprite => {
  const style = Math.random() < 0.5 ? 'grid' : 'strip'
  const rows: string[] = []

  // 顶部：随机加一根天线或楼顶机房
  if (Math.random() < 0.5) {
    // 天线：居中 1~2 列高
    const antW = Math.random() < 0.5 ? 1 : 2
    const antLeft = Math.floor((w - antW) / 2)
    let row = ''
    for (let x = 0; x < w; x += 1) {
      row += x >= antLeft && x < antLeft + antW ? 'o' : '.'
    }
    rows.push(row)
  }
  // 楼顶机房：宽度约楼体 1/3，居中，占两行
  const roofW = Math.max(2, Math.floor(w / 3))
  const roofLeft = Math.floor((w - roofW) / 2)
  for (let r = 0; r < 2; r += 1) {
    let row = ''
    for (let x = 0; x < w; x += 1) {
      if (x < roofLeft || x >= roofLeft + roofW) {
        row += '.'
      } else if (x === roofLeft || x === roofLeft + roofW - 1 || r === 0) {
        row += 'o'
      } else {
        row += 'o'
      }
    }
    rows.push(row)
  }

  const bodyTop = rows.length
  const bodyBottom = h - 1
  if (style === 'grid') {
    // 方格窗：每列都可能开窗，每隔几列留一根竖向墙柱；每隔几行留一道楼板
    for (let y = bodyTop; y < bodyBottom; y += 1) {
      const isSlab = (y - bodyTop) % 3 === 2 // 每 3 行一道楼板
      let row = 'o'
      for (let x = 1; x < w - 1; x += 1) {
        const isMullion = x % 4 === 0 // 每 4 列一根竖柱
        if (isSlab || isMullion) {
          row += 'o'
        } else {
          row += Math.random() < 0.75 ? 'l' : 'd'
        }
      }
      row += 'o'
      rows.push(row)
    }
  } else {
    // 横向带状窗：窗行几乎整排亮窗，楼板行整排黑色
    for (let y = bodyTop; y < bodyBottom; y += 1) {
      const isSlab = (y - bodyTop) % 2 === 1
      let row = 'o'
      for (let x = 1; x < w - 1; x += 1) {
        if (isSlab) {
          row += 'o'
        } else {
          const isMullion = x % 6 === 0
          row += isMullion ? 'o' : Math.random() < 0.85 ? 'l' : 'd'
        }
      }
      row += 'o'
      rows.push(row)
    }
  }

  // 底部基座
  rows.push('o'.repeat(w))
  // 若因顶部天线导致总行数超出 h，截掉末尾；不足则补黑色行
  while (rows.length > h) rows.pop()
  while (rows.length < h) rows.push('o'.repeat(w))
  return { width: w, height: h, colors: BUILDING_COLORS, rows }
}

// 预生成一批尺寸各异的写字楼，投放时随机取用
const BUILDINGS: PropSprite[] = Array.from({ length: 12 }, () => {
  const w = 10 + Math.floor(Math.random() * 12) // 10~21
  const h = 12 + Math.floor(Math.random() * 16) // 12~27
  return makeBuilding(w, h)
})
const PROP_SPRITES = BUILDINGS

// 楼顶机房占顶部 2 行，削角只削楼体部分
const BUILDING_BODY_TOP = 2
// 每次命中依次削掉一个角：左上 → 右上 → 右下 → 左下
const DAMAGE_CORNERS: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1]
]

const filledAt = (grid: number[][], x: number, y: number) => {
  const row = grid[y]
  return !!row && x >= 0 && x < row.length && row[x] >= 0
}

// 按双腿之间的空隙定位腿部分界线，再把躯干两侧分离出来的一列列像素标记成手臂
const detectParts = (grid: number[][], width: number, height: number) => {
  const splitX = Math.floor(width / 2)
  const part = new Uint8Array(width * height)

  let legTop = height
  for (let y = height - 1; y >= 0; y -= 1) {
    const split = !filledAt(grid, splitX, y) && !filledAt(grid, splitX - 1, y)
    let left = false
    let right = false
    for (let x = 0; x < splitX - 1 && !left; x += 1) left = filledAt(grid, x, y)
    for (let x = splitX + 1; x < width && !right; x += 1) right = filledAt(grid, x, y)
    if (!split || !left || !right) break
    legTop = y
  }
  // 腿部太矮就不做抬脚动画，避免只挪动一两行像素
  if (height - legTop < 3) legTop = height

  const bandTop = Math.max(0, legTop - 14)
  for (let y = bandTop; y < legTop; y += 1) {
    const runs: [number, number][] = []
    let start = -1
    for (let x = 0; x <= width; x += 1) {
      const on = x < width && filledAt(grid, x, y)
      if (on && start < 0) start = x
      if (!on && start >= 0) {
        runs.push([start, x - 1])
        start = -1
      }
    }
    const torso = runs.find(([from, to]) => from <= splitX && to >= splitX)
    if (!torso) continue
    // 宽度至少 2、与躯干间距不超过 9 的外侧 run 视为手臂
    const leftArm = runs.find(
      ([from, to]) => to < torso[0] - 1 && to - from + 1 >= 2 && torso[0] - to - 1 <= 9
    )
    const rightArm = runs.find(
      ([from, to]) => from > torso[1] + 1 && to - from + 1 >= 2 && from - torso[1] - 1 <= 9
    )
    if (leftArm) {
      for (let x = leftArm[0]; x <= leftArm[1]; x += 1) part[y * width + x] = PART_LEFT_ARM
    }
    if (rightArm) {
      for (let x = rightArm[0]; x <= rightArm[1]; x += 1) part[y * width + x] = PART_RIGHT_ARM
    }
  }

  for (let y = legTop; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!filledAt(grid, x, y)) continue
      part[y * width + x] = x < splitX ? PART_LEFT_LEG : PART_RIGHT_LEG
    }
  }

  return { legTop, splitX, part }
}

const prepare = (sprite: MechSprite): RenderSprite => {
  // 把字符下标预解析成数字，渲染时省去逐像素查找
  const grid = sprite.rows.map((row) =>
    Array.from(row, (ch) => (ch === '.' ? -1 : CHARSET.indexOf(ch)))
  )
  return {
    width: sprite.width,
    height: sprite.height,
    colors: sprite.colors,
    grid,
    ...detectParts(grid, sprite.width, sprite.height)
  }
}

const ALL_GUNDAMS = GUNDAMS.map(prepare)
const ALL_ZAKUS = ZAKUS.map(prepare)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const hintVisible = ref(true)
const isFullscreen = ref(false)
// 连按两次 F 触发全屏的时间窗口（毫秒）
const FULLSCREEN_DOUBLE_TAP_MS = 400
let lastFPressTime = 0

const plane = { x: 0, y: 0 }
const pointer = { x: 0, y: 0 }
const bullets: Bullet[] = []
const enemies: Enemy[] = []
const particles: Particle[] = []
const techQueue: string[] = []
const walkFrames = new Map<RenderSprite, HTMLCanvasElement[]>()
const props: Prop[] = []
const propImages = new Map<PropSprite, HTMLCanvasElement>()
const drops: Drop[] = []

// 站点 logo：原图是单色 SVG，加载后染成主题色再绘制，暗色主题下也清晰
let logoSource: HTMLImageElement | null = null
let logoTinted: HTMLCanvasElement | null = null

// 初始随机使用任意一台高达
let player = ALL_GUNDAMS[Math.floor(Math.random() * ALL_GUNDAMS.length)]
// 距离变身已累计的击落数
let killCount = 0
// 已变身次数，用来逐次提升射速
let transformCount = 0
let burst: Burst | null = null
// 全屏轰炸状态，null 表示未触发
let bombard: Bombard | null = null
// 轰炸内部的下一次爆炸计时
let bombardClock = 0
// 重生倒计时（>0 表示高达已被撞毁）与复活后的无敌倒计时
let respawnClock = 0
let invincibleClock = 0
// 行走动画时钟，待机时也继续推进
let walkClock = 0

const palette = {
  accent: '#18794e',
  bullet: '#18794e',
  label: '#7f8f9c',
  bg: '#ffffff'
}

let ctx: CanvasRenderingContext2D | null = null
let width = 0
let height = 0
let following = false
let fireClock = 0
let spawnClock = 0
let nextSpawn = 0.9
let raf = 0
let last = 0
let inView = true
let resizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null
let themeObserver: MutationObserver | null = null

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

// 根据画布高度（块数）反推机体缩放系数，让机体始终占据固定比例的场地高度
const computeScales = () => {
  playerScale = clamp(
    (height * PLAYER_HEIGHT_RATIO) / PLAYER_REF_HEIGHT,
    PLAYER_SCALE_MIN,
    PLAYER_SCALE_MAX
  )
  enemyScale = clamp(
    (height * ENEMY_HEIGHT_RATIO) / ENEMY_REF_HEIGHT,
    ENEMY_SCALE_MIN,
    ENEMY_SCALE_MAX
  )
}

const playerWidth = () => player.width * playerScale
const playerHeight = () => player.height * playerScale

// 当前射速加成（随变身次数线性累加，封顶 +200%）
const fireRateBonus = () =>
  Math.min(FIRE_RATE_MAX_BONUS, transformCount * FIRE_RATE_STEP)

// 当前射击间隔：射速加成越高间隔越短
const fireInterval = () => FIRE_INTERVAL / (1 + fireRateBonus())

// 射速加成达到 30%/60%/90% 时各多一条子弹线
const extraBulletLines = () =>
  FIRE_RATE_LINE_THRESHOLDS.filter((threshold) => fireRateBonus() >= threshold).length

const readPalette = () => {
  const styles = getComputedStyle(document.documentElement)
  const accent = styles.getPropertyValue('--vp-c-brand-1').trim() || '#18794e'
  palette.accent = accent
  palette.label = styles.getPropertyValue('--vp-c-text-3').trim() || '#7f8f9c'
  // 站点主题背景色，全屏时用它填充画布，保持与页面一致
  palette.bg = styles.getPropertyValue('--vp-c-bg').trim() || '#ffffff'
  // 根据当前深浅主题切换写字楼配色；清空缓存让楼体按新颜色重绘
  const isDark = document.documentElement.classList.contains('dark')
  const bp = isDark ? BUILDING_PALETTES.dark : BUILDING_PALETTES.light
  BUILDING_COLORS.o = bp.o
  BUILDING_COLORS.l = bp.l
  BUILDING_COLORS.d = bp.d
  propImages.clear()
  syncBulletColor()
  tintLogo()
}

const hexToRgb = (hex: string) => {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : value
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  }
}

// 取机甲主色：按像素出现次数统计，排除描边黑、高光白和低饱和灰，只保留机体涂装色
const dominantColor = (sprite: RenderSprite) => {
  const counts = new Array<number>(sprite.colors.length).fill(0)
  sprite.grid.forEach((row) => {
    row.forEach((index) => {
      if (index >= 0 && index < counts.length) counts[index] += 1
    })
  })

  let best = ''
  let bestCount = 0
  sprite.colors.forEach((color, index) => {
    const { r, g, b } = hexToRgb(color)
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const luminance = r * 0.299 + g * 0.587 + b * 0.114
    const saturation = max === 0 ? 0 : (max - min) / max
    if (luminance < 60 || luminance > 235 || saturation < 0.2) return
    if (counts[index] > bestCount) {
      bestCount = counts[index]
      best = color
    }
  })
  return best
}

// 子弹颜色跟随当前高达的主色，变身时同步切换
const syncBulletColor = () => {
  palette.bullet = dominantColor(player) || palette.accent
}

// 把加载好的 logo 染成主题色并缓存；主题切换时 readPalette 会重新调用
const tintLogo = () => {
  if (!logoSource || !logoSource.complete || !logoSource.naturalWidth) return
  const image = document.createElement('canvas')
  image.width = 48
  image.height = 48
  const painter = image.getContext('2d')
  if (!painter) return
  painter.drawImage(logoSource, 0, 0, 48, 48)
  // 只保留原图不透明区域，统一填成主题色
  painter.globalCompositeOperation = 'source-in'
  painter.fillStyle = palette.accent
  painter.fillRect(0, 0, 48, 48)
  logoTinted = image
}

// 预渲染每台机甲的 4 帧行走图
const walkFrameImage = (sprite: RenderSprite, frame: number) => {
  let frames = walkFrames.get(sprite)
  if (!frames) {
    frames = []
    walkFrames.set(sprite, frames)
  }
  const cached = frames[frame]
  if (cached) return cached

  const { width: w, height: h, grid, part, colors } = sprite
  const offsets = WALK_OFFSETS[frame]
  // 先用色号数组拼出整张帧，再统一铺到画布上
  const cells = new Int16Array(w * h).fill(-1)

  // 双腿整体上移，脚底随之离地
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const index = grid[y][x]
      if (index < 0) continue
      const partId = part[y * w + x]
      const dy =
        partId === PART_LEFT_LEG
          ? offsets.leftLeg
          : partId === PART_RIGHT_LEG
            ? offsets.rightLeg
            : 0
      const ty = y + dy
      if (ty >= 0 && ty < h) cells[ty * w + x] = index
    }
  }

  // 手臂向身体外侧补一列像素，靠拉伸表现摆动；只加不减，关节不会出现缺口
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const index = grid[y][x]
      if (index < 0) continue
      const partId = part[y * w + x]
      if (partId === PART_LEFT_ARM && offsets.leftArm < 0 && x > 0) {
        if (part[y * w + x - 1] !== PART_LEFT_ARM && cells[y * w + x - 1] < 0) {
          cells[y * w + x - 1] = index
        }
      } else if (partId === PART_RIGHT_ARM && offsets.rightArm > 0 && x + 1 < w) {
        if (part[y * w + x + 1] !== PART_RIGHT_ARM && cells[y * w + x + 1] < 0) {
          cells[y * w + x + 1] = index
        }
      }
    }
  }

  // 抬腿后胯部可能露出 1px 透明横缝，用原始像素补回；脚底下方没有像素，不会被补掉
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const at = y * w + x
      if (cells[at] >= 0) continue
      const index = grid[y][x]
      if (index < 0) continue
      const partId = part[at]
      if (partId !== PART_LEFT_LEG && partId !== PART_RIGHT_LEG) continue
      if (cells[at - w] >= 0 && cells[at + w] >= 0) cells[at] = index
    }
  }

  const image = document.createElement('canvas')
  image.width = w
  image.height = h
  const painter = image.getContext('2d')
  if (painter) {
    const colorCache = new Map<number, string>()
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const index = cells[y * w + x]
        if (index < 0) continue
        let color = colorCache.get(index)
        if (!color) {
          color = colors[index]
          colorCache.set(index, color)
        }
        painter.fillStyle = color
        painter.fillRect(x, y, 1, 1)
      }
    }
  }
  frames[frame] = image
  return image
}

// 装饰图预渲染成小 canvas，滚动时直接 drawImage
const propImage = (sprite: PropSprite) => {
  const cached = propImages.get(sprite)
  if (cached) return cached

  const image = document.createElement('canvas')
  image.width = sprite.width
  image.height = sprite.height
  const painter = image.getContext('2d')
  if (painter) {
    sprite.rows.forEach((row, y) => {
      Array.from(row).forEach((ch, x) => {
        const color = sprite.colors[ch]
        if (!color) return
        painter.fillStyle = color
        painter.fillRect(x, y, 1, 1)
      })
    })
  }
  propImages.set(sprite, image)
  return image
}

const clampPlane = () => {
  const halfW = playerWidth() / 2
  const halfH = playerHeight() / 2
  plane.x = clamp(plane.x, halfW, width - halfW)
  plane.y = clamp(plane.y, halfH, height - halfH - 2)
}

// 检查高达（以给定中心点）是否与任意建筑碰撞；建筑碰撞盒按容差向内收缩
const collidesWithProps = (x: number, y: number) => {
  const halfW = playerWidth() / 2
  const halfH = playerHeight() / 2
  for (const prop of props) {
    const propHalfW = (prop.sprite.width * speedScale) / 2 - PROP_BLOCK_TOLERANCE
    const propHalfH = (prop.sprite.height * speedScale) / 2 - PROP_BLOCK_TOLERANCE
    if (propHalfW <= 0 || propHalfH <= 0) continue
    if (
      Math.abs(x - prop.x) < halfW + propHalfW &&
      Math.abs(y - prop.y) < halfH + propHalfH
    ) {
      return true
    }
  }
  return false
}

const clampPointer = () => {
  const halfW = playerWidth() / 2
  const halfH = playerHeight() / 2
  pointer.x = clamp(pointer.x, halfW, width - halfW)
  pointer.y = clamp(pointer.y, halfH, height - halfH - 2)
}

const resize = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  width = Math.max(32, Math.round(rect.width / UNIT))
  height = Math.max(32, Math.round(rect.height / UNIT))
  // 按画布高度等比缩放所有运动速度，保持穿越屏幕的耗时恒定
  const prevSpeedScale = speedScale
  speedScale = height / REFERENCE_HEIGHT
  const scaleRatio = speedScale / prevSpeedScale
  if (scaleRatio !== 1) {
    for (const b of bullets) {
      b.vx *= scaleRatio
      b.vy *= scaleRatio
    }
    for (const e of enemies) e.speed *= scaleRatio
    for (const p of props) p.speed *= scaleRatio
    for (const d of drops) d.speed *= scaleRatio
  }
  computeScales()

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(width * UNIT * dpr)
  canvas.height = Math.round(height * UNIT * dpr)

  ctx = canvas.getContext('2d')
  if (!ctx) return
  // 以像素块为坐标单位绘制，backing store 负责高分屏清晰度
  ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0)
  ctx.imageSmoothingEnabled = false

  // 仅在首次加载（指针未初始化）时把指针放到画布中心，之后保留用户最后位置
  if (pointer.x === 0 && pointer.y === 0) {
    pointer.x = width / 2
    pointer.y = height * 0.62
  }
  clampPointer()

  if (plane.x === 0 && plane.y === 0) {
    plane.x = pointer.x
    plane.y = pointer.y
  } else {
    clampPlane()
  }

  // 首次尺寸确定后撒一批装饰，之后的宽高变化只把越界的横向位置拉回来
  if (!props.length && width > 40 && height > 40) {
    for (let i = 0; i < PROP_COUNT; i += 1) spawnProp(true)
  } else {
    props.forEach((prop) => {
      const halfW = (prop.sprite.width * speedScale) / 2
      prop.x = clamp(prop.x, halfW, Math.max(halfW, width - halfW))
    })
  }

  // 尺寸变化后同步更新已在场敌机的碰撞盒，避免与渲染尺寸脱节
  enemies.forEach((enemy) => {
    enemy.halfW = (enemy.sprite.width * enemyScale) / 2
    enemy.halfH = (enemy.sprite.height * enemyScale) / 2
  })
}

const updatePointer = (event: PointerEvent) => {
  const canvas = canvasRef.value
  if (!canvas || !width || !height) return
  const rect = canvas.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  pointer.x = ((event.clientX - rect.left) / rect.width) * width
  pointer.y = ((event.clientY - rect.top) / rect.height) * height
  following = true
  clampPointer()

  if (hintVisible.value) hintVisible.value = false
}

const onPointerLeave = () => {
  following = false
}

// 全屏切换：对 .hero-game 容器调用浏览器全屏 API，ResizeObserver 会自动重算画布尺寸
const toggleFullscreen = async () => {
  const el = containerRef.value
  if (!el) return
  try {
    if (!document.fullscreenElement) {
      await el.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  } catch {
    // 浏览器拒绝全屏请求（权限/策略）时静默失败，不影响游戏
  }
}

// 键盘监听：仅在鼠标正在画布内跟随时，连按两次 F 切换全屏
const onKeydown = (e: KeyboardEvent) => {
  if (!following) return
  if (e.key !== 'f' && e.key !== 'F') return
  if (e.metaKey || e.ctrlKey || e.altKey) return
  const now = performance.now()
  if (now - lastFPressTime < FULLSCREEN_DOUBLE_TAP_MS) {
    toggleFullscreen()
    lastFPressTime = 0
  } else {
    lastFPressTime = now
  }
}

// 同步全屏状态
const onFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
}

// 把角度（度，相对正上方）换算为速度分量
const velFromAngle = (angleDeg: number, speed: number) => {
  const rad = (angleDeg * Math.PI) / 180
  return { vx: Math.sin(rad) * speed, vy: -Math.cos(rad) * speed }
}

// 生成 n 个在 [min, max] 间均匀分布的值
const linspace = (min: number, max: number, n: number) => {
  if (n <= 1) return [(min + max) / 2]
  const step = (max - min) / (n - 1)
  return Array.from({ length: n }, (_, i) => min + step * i)
}

// 构造一颗子弹的公共字段
const makeBullet = (
  x: number,
  y: number,
  vx: number,
  vy: number,
  opts: Partial<Bullet>
): Bullet => {
  const bullet: Bullet = {
    x,
    y,
    vx,
    vy,
    color: palette.bullet,
    w: 1,
    h: 3,
    pierce: 0,
    hitIds: new Set<number>(),
    bounces: 0,
    homing: 0,
    damage: 1,
    life: 3,
    age: 0,
    shape: 'rect',
    trail: false,
    ...opts
  }
  // 子弹尺寸随画布高度等比缩放，与机甲/楼体保持一致比例
  bullet.w *= speedScale
  bullet.h *= speedScale
  return bullet
}

// 6 台高达各自的武器配置：根据当前高达选择弹道形态
// 每个 profile 接收 (plane, player, extraLines) 返回本帧生成的子弹数组
type WeaponProfile = (
  planePos: { x: number; y: number },
  playerSprite: RenderSprite,
  extraLines: number
) => Bullet[]

const WEAPON_PROFILES: WeaponProfile[] = [
  // G0 经典 RX-78：散射光束 — 小角度扇形，标准伤害，均衡型
  (planePos, playerSprite, extraLines) => {
    const y = planePos.y - (playerSprite.height * playerScale) / 2
    const total = 3 + extraLines
    const angles = linspace(-8, 8, total)
    return angles.map((angle) => {
      const { vx, vy } = velFromAngle(angle, BULLET_SPEED * speedScale)
      return makeBullet(planePos.x, y, vx, vy, { shape: 'rect', w: 1, h: 3 })
    })
  },

  // G1 蓝白：穿透光束 — 较粗的直射光束，可穿透多台渣古
  (planePos, playerSprite, extraLines) => {
    const y = planePos.y - (playerSprite.height * playerScale) / 2
    const halfSpan = (playerSprite.width * playerScale * 0.85) / 2
    const total = 2 + extraLines
    const offsets = linspace(-halfSpan, halfSpan, total)
    return offsets.map((offset) =>
      makeBullet(planePos.x + offset, y, 0, -BULLET_SPEED * 1.1 * speedScale, {
        shape: 'beam',
        w: 2,
        h: 5,
        pierce: 2,
        color: palette.bullet
      })
    )
  },

  // G2 灰紫：反弹弹 — 圆形弹，撞左右墙可反弹 2 次
  (planePos, playerSprite, extraLines) => {
    const y = planePos.y - (playerSprite.height * playerScale) / 2
    const total = 4 + extraLines
    const angles = linspace(-20, 20, total)
    return angles.map((angle) => {
      const { vx, vy } = velFromAngle(angle, BULLET_SPEED * 0.9 * speedScale)
      return makeBullet(planePos.x, y, vx, vy, {
        shape: 'round',
        w: 2,
        h: 2,
        bounces: 2
      })
    })
  },

  // G3 红甲：追踪弹 — 慢速弹，会朝最近渣古转向，带拖尾
  (planePos, playerSprite, extraLines) => {
    const y = planePos.y - (playerSprite.height * playerScale) / 2
    const halfSpan = (playerSprite.width * playerScale * 0.6) / 2
    const total = 2 + extraLines
    const offsets = linspace(-halfSpan, halfSpan, total)
    return offsets.map((offset) =>
      makeBullet(planePos.x + offset, y, 0, -BULLET_SPEED * 0.65 * speedScale, {
        shape: 'rocket',
        w: 1.75,
        h: 3.15,
        homing: 3,
        trail: true,
        life: 2.8
      })
    )
  },

  // G4 蓝重：双管重炮 — 机身两翼的大型慢速弹，伤害 2
  (planePos, playerSprite, extraLines) => {
    const y = planePos.y - (playerSprite.height * playerScale) / 2
    const halfSpan = (playerSprite.width * playerScale * 0.9) / 2
    const total = 2 + extraLines
    const offsets = linspace(-halfSpan, halfSpan, total)
    return offsets.map((offset) =>
      makeBullet(planePos.x + offset, y, 0, -BULLET_SPEED * 0.6 * speedScale, {
        shape: 'rect',
        w: 2.5,
        h: 4,
        damage: 2
      })
    )
  },

  // G5 青绿：三向射击 — 正上 + 左右 30°，覆盖范围广
  (planePos, playerSprite, extraLines) => {
    const y = planePos.y - (playerSprite.height * playerScale) / 2
    const total = 3 + extraLines
    const angles = linspace(-30, 30, total)
    return angles.map((angle) => {
      const { vx, vy } = velFromAngle(angle, BULLET_SPEED * 0.96 * speedScale)
      return makeBullet(planePos.x, y, vx, vy, { shape: 'rect', w: 1, h: 3 })
    })
  }
]

const spawnBullets = () => {
  const index = ALL_GUNDAMS.indexOf(player)
  const profile = WEAPON_PROFILES[index] ?? WEAPON_PROFILES[0]
  const newBullets = profile(plane, player, extraBulletLines())
  for (const b of newBullets) bullets.push(b)
}

const nextTechName = () => {
  if (!techQueue.length) {
    techQueue.push(...TECH_NAMES)
    for (let i = techQueue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[techQueue[i], techQueue[j]] = [techQueue[j], techQueue[i]]
    }
  }
  return techQueue.pop() as string
}

// 标签以真实 CSS 像素绘制，需要先把变换还原，量完再恢复
const labelBlocks = (text: string) => {
  const canvas = canvasRef.value
  if (!ctx || !canvas || !width || !height) return text.length * 1.6
  const dpr = canvas.width / (width * UNIT)
  const sx = canvas.width / width
  const sy = canvas.height / height
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.font = `500 ${9 * dpr}px ${MONO_FONT}`
  const blocks = ctx.measureText(text).width / dpr / UNIT
  ctx.setTransform(sx, 0, 0, sy, 0, 0)
  return blocks
}

const spawnEnemy = () => {
  const sprite = ALL_ZAKUS[Math.floor(Math.random() * ALL_ZAKUS.length)]
  const halfW = (sprite.width * enemyScale) / 2
  const halfH = (sprite.height * enemyScale) / 2
  const name = nextTechName()
  const half = Math.max(labelBlocks(name) / 2, halfW)
  const minX = Math.min(half + 2, width / 2)
  const maxX = Math.max(width - half - 2, width / 2)
  const baseX = minX + Math.random() * (maxX - minX)

  enemies.push({
    id: nextEnemyId++,
    x: baseX,
    y: -halfH,
    baseX,
    amp: 2 + Math.random() * 3,
    phase: Math.random() * Math.PI * 2,
    speed: (9 + Math.random() * 7) * speedScale,
    name,
    sprite,
    halfW,
    halfH,
    // 错开步频，多台渣古不会整齐划一地迈步
    walkOffset: Math.random() * WALK_STEP_TIME * WALK_FRAMES,
    hp: ENEMY_HP
  })
}

// 装饰从顶部外沿重生，速度略慢于敌人形成视差
const spawnProp = (seed = false) => {
  const sprite = PROP_SPRITES[Math.floor(Math.random() * PROP_SPRITES.length)]
  const halfW = (sprite.width * speedScale) / 2
  const halfH = (sprite.height * speedScale) / 2
  const minX = Math.min(halfW, width / 2)
  const maxX = Math.max(width - halfW, width / 2)
  props.push({
    sprite,
    x: minX + Math.random() * (maxX - minX),
    y: seed ? Math.random() * height : -halfH - Math.random() * 10,
    speed: PROP_SPEED * speedScale,
    hp: BUILDING_HP
  })
}

// 渣古被击落后原地掉出站点 logo，比渣古落得慢，方便高达去接
const spawnDrop = (x: number, y: number) => {
  drops.push({
    x,
    y,
    baseX: x,
    phase: Math.random() * Math.PI * 2,
    speed: (7 + Math.random() * 3) * speedScale
  })
}

const explode = (x: number, y: number) => {
  for (let i = 0; i < 16; i += 1) {
    const angle = Math.random() * Math.PI * 2
    const speed = (6 + Math.random() * 22) * speedScale
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: 0.3 + Math.random() * 0.35,
      size: Math.random() < 0.28 ? 2 : 1,
      color: EXPLOSION_COLORS[i % EXPLOSION_COLORS.length]
    })
  }
  // 中心白色闪光
  particles.push({ x, y, vx: 0, vy: 0, age: 0, life: 0.12, size: 4, color: '#ffffff' })
}

// 击落渣古累计到一定数量后随机切换成另一台高达，并在原地炸出一圈光芒
const transformPlayer = () => {
  let next = player
  while (next === player) {
    next = ALL_GUNDAMS[Math.floor(Math.random() * ALL_GUNDAMS.length)]
  }
  player = next
  // 每变身一次射速提升 15%
  transformCount += 1
  syncBulletColor()
  burst = { age: 0, life: 0.72, spin: Math.random() * Math.PI }
  // 累计变身次数达到 5 的整数倍时，触发一次全屏轰炸
  if (transformCount % BOMBARD_TRANSFORM_COUNT === 0) {
    bombard = { age: 0, life: BOMBARD_DURATION }
    bombardClock = 0
  }
  clampPointer()
  clampPlane()
}

const handleCollisions = () => {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i]
    let removed = false

    // 命中渣古：支持穿透（同一颗子弹可击中多台，但每台只受一次伤害）
    for (let e = enemies.length - 1; e >= 0; e -= 1) {
      const enemy = enemies[e]
      if (bullet.hitIds.has(enemy.id)) continue
      if (
        Math.abs(bullet.x - enemy.x) <= enemy.halfW + bullet.w / 2 &&
        bullet.y <= enemy.y + enemy.halfH + bullet.h / 2 &&
        bullet.y + bullet.h >= enemy.y - enemy.halfH - bullet.h / 2
      ) {
        bullet.hitIds.add(enemy.id)
        enemy.hp -= bullet.damage
        if (enemy.hp <= 0) {
          enemies.splice(e, 1)
          explode(enemy.x, enemy.y)
          if (Math.random() < DROP_CHANCE) spawnDrop(enemy.x, enemy.y)
          killCount += 1
          if (killCount >= TRANSFORM_KILLS) {
            killCount = 0
            transformPlayer()
          }
        }
        if (bullet.pierce > 0) {
          bullet.pierce -= 1
          // 还有穿透次数则继续检查其他敌人，否则结束本帧对该子弹的敌机判定
          if (bullet.pierce <= 0) break
          continue
        }
        // 无穿透：子弹消失
        bullets.splice(i, 1)
        removed = true
        break
      }
    }
    if (removed) continue

    // 未被敌机消耗时再判定背景建筑：子弹消失，楼体掉血并缺一角，打满次数后炸掉并补一栋新的
    const propIndex = props.findIndex(
      (prop) =>
        Math.abs(bullet.x - prop.x) <= (prop.sprite.width * speedScale) / 2 &&
        bullet.y <= prop.y + (prop.sprite.height * speedScale) / 2 &&
        bullet.y + bullet.h >= prop.y - (prop.sprite.height * speedScale) / 2
    )
    if (propIndex === -1) continue
    bullets.splice(i, 1)
    const prop = props[propIndex]
    prop.hp -= 1
    if (prop.hp > 0) continue
    props.splice(propIndex, 1)
    explode(prop.x, prop.y)
    spawnProp()
  }
}

// 高达与渣古相撞：两台都爆炸，不计入击落数也不掉落 logo，高达稍后原地复活
const handlePlayerCrash = () => {
  if (respawnClock > 0 || invincibleClock > 0) return
  const halfW = playerWidth() / 2
  const halfH = playerHeight() / 2
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i]
    if (
      Math.abs(enemy.x - plane.x) <= enemy.halfW + halfW &&
      Math.abs(enemy.y - plane.y) <= enemy.halfH + halfH
    ) {
      enemies.splice(i, 1)
      explode(enemy.x, enemy.y)
      explode(plane.x, plane.y)
      respawnClock = RESPAWN_DELAY
      fireClock = 0
      // 爆炸后清空全部增益：射速加成与额外子弹线归零
      transformCount = 0
      // 变身光芒与全屏轰炸随爆炸一起消失
      burst = null
      bombard = null
      break
    }
  }
}

const update = (dt: number, now: number) => {
  walkClock += dt

  // 重生与无敌计时
  if (respawnClock > 0) {
    respawnClock = Math.max(0, respawnClock - dt)
    if (respawnClock === 0) invincibleClock = INVINCIBLE_TIME
  } else if (invincibleClock > 0) {
    invincibleClock = Math.max(0, invincibleClock - dt)
  }

  // 鼠标移出后高达停留在最后跟随的位置，不再回到初始待机位
  // （仅在指针完全未初始化时设一个默认中心位置）
  if (pointer.x === 0 && pointer.y === 0) {
    pointer.x = width / 2
    pointer.y = height * 0.62
  }

  // 缓动跟随，让高达有一点惯性而不是死贴光标；
  // 分轴检测与建筑的碰撞，撞楼时只回退该轴，从而可以沿楼体滑动
  const ease = Math.min(1, dt * 16)
  const oldX = plane.x
  const oldY = plane.y
  plane.x += (pointer.x - plane.x) * ease
  if (collidesWithProps(plane.x, plane.y)) plane.x = oldX
  plane.y += (pointer.y - plane.y) * ease
  if (collidesWithProps(plane.x, plane.y)) plane.y = oldY

  // 若滚动的建筑把高达挤进楼体，沿最小穿透轴把高达推出，避免被卡死
  if (collidesWithProps(plane.x, plane.y)) {
    const pHalfW = playerWidth() / 2
    const pHalfH = playerHeight() / 2
    for (const prop of props) {
      const propHalfW = (prop.sprite.width * speedScale) / 2 - PROP_BLOCK_TOLERANCE
      const propHalfH = (prop.sprite.height * speedScale) / 2 - PROP_BLOCK_TOLERANCE
      if (propHalfW <= 0 || propHalfH <= 0) continue
      const dx = plane.x - prop.x
      const dy = plane.y - prop.y
      const overlapX = pHalfW + propHalfW - Math.abs(dx)
      const overlapY = pHalfH + propHalfH - Math.abs(dy)
      if (overlapX > 0 && overlapY > 0) {
        if (overlapX < overlapY) plane.x += Math.sign(dx) * overlapX
        else plane.y += Math.sign(dy) * overlapY
        break
      }
    }
  }
  clampPlane()

  // 只有鼠标在画布内跟随时才射击，待机或重生等待期间不开火
  if (following && respawnClock <= 0) {
    fireClock += dt
    const interval = fireInterval()
    while (fireClock >= interval) {
      fireClock -= interval
      spawnBullets()
    }
  } else {
    fireClock = 0
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i]
    bullet.age += dt
    if (bullet.age >= bullet.life) {
      bullets.splice(i, 1)
      continue
    }

    // 追踪弹：朝最近渣古方向微调速度，限制最大转向避免瞬移
    if (bullet.homing > 0 && enemies.length) {
      let nearest: Enemy | null = null
      let nearestDist = Infinity
      for (const enemy of enemies) {
        const d = (enemy.x - bullet.x) ** 2 + (enemy.y - bullet.y) ** 2
        if (d < nearestDist) {
          nearestDist = d
          nearest = enemy
        }
      }
      if (nearest) {
        const desiredVx = nearest.x - bullet.x
        const desiredVy = nearest.y - bullet.y
        const desiredLen = Math.hypot(desiredVx, desiredVy) || 1
        const speed = Math.hypot(bullet.vx, bullet.vy) || 1
        const targetVx = (desiredVx / desiredLen) * speed
        const targetVy = (desiredVy / desiredLen) * speed
        const steer = Math.min(1, bullet.homing * dt)
        bullet.vx += (targetVx - bullet.vx) * steer
        bullet.vy += (targetVy - bullet.vy) * steer
      }
    }

    bullet.x += bullet.vx * dt
    bullet.y += bullet.vy * dt

    // 反弹弹：撞左右墙时反转横向速度并消耗一次反弹次数
    if (bullet.bounces > 0) {
      if (bullet.x < 1) {
        bullet.x = 1
        bullet.vx = Math.abs(bullet.vx)
        bullet.bounces -= 1
      } else if (bullet.x > width - 1) {
        bullet.x = width - 1
        bullet.vx = -Math.abs(bullet.vx)
        bullet.bounces -= 1
      }
    }

    // 超出顶部或左右飞出（非反弹弹）则移除
    if (bullet.y < -4 || bullet.x < -6 || bullet.x > width + 6) {
      bullets.splice(i, 1)
    }
  }

  // 背景装饰向下滚动，出界后在顶部重新投放，保持画面一直在动
  for (let i = props.length - 1; i >= 0; i -= 1) {
    const prop = props[i]
    prop.y += prop.speed * dt
    if (prop.y - (prop.sprite.height * speedScale) / 2 > height) {
      props.splice(i, 1)
      spawnProp()
    }
  }

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i]
    enemy.y += enemy.speed * dt
    enemy.x = clamp(
      enemy.baseX + Math.sin(enemy.phase + enemy.y * 0.12) * enemy.amp,
      enemy.halfW,
      width - enemy.halfW
    )
    if (enemy.y - enemy.halfH > height + 4) enemies.splice(i, 1)
  }

  handlePlayerCrash()

  spawnClock += dt
  if (spawnClock >= nextSpawn) {
    spawnClock = 0
    nextSpawn = 1.8 + Math.random() * 1.6
    if (enemies.length < MAX_ENEMIES) spawnEnemy()
  }

  // 掉落的 logo 缓慢下落并横摆，高达碰到就吃掉并触发一次变身
  const dropHalf = LOGO_SIZE / 2
  for (let i = drops.length - 1; i >= 0; i -= 1) {
    const drop = drops[i]
    drop.y += drop.speed * dt
    drop.x = clamp(
      drop.baseX + Math.sin(drop.phase + drop.y * 0.1) * 1.5,
      dropHalf,
      width - dropHalf
    )
    if (drop.y - dropHalf > height + 4) {
      drops.splice(i, 1)
      continue
    }
    if (
      respawnClock <= 0 &&
      Math.abs(drop.x - plane.x) <= playerWidth() / 2 + dropHalf &&
      Math.abs(drop.y - plane.y) <= playerHeight() / 2 + dropHalf
    ) {
      drops.splice(i, 1)
      transformPlayer()
    }
  }

  handleCollisions()

  // 全屏轰炸：持续在画面随机位置引发爆炸，并清除所有在场敌机
  if (bombard) {
    bombard.age += dt
    bombardClock -= dt
    if (bombardClock <= 0) {
      bombardClock = 0.06 + Math.random() * 0.12
      // 每次在 1~3 个随机位置引爆
      const hits = 1 + Math.floor(Math.random() * 3)
      for (let i = 0; i < hits; i += 1) {
        explode(Math.random() * width, Math.random() * height)
      }
    }
    // 清除全部敌机（不计入击落数、不掉落 logo，单纯清屏）
    for (let i = enemies.length - 1; i >= 0; i -= 1) {
      explode(enemies[i].x, enemies[i].y)
      enemies.splice(i, 1)
    }
    if (bombard.age >= bombard.life) bombard = null
  }

  if (burst) {
    burst.age += dt
    burst.spin += dt * 3.4
    if (burst.age >= burst.life) burst = null
  }

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i]
    particle.age += dt
    if (particle.age >= particle.life) {
      particles.splice(i, 1)
      continue
    }
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    const drag = 1 - Math.min(1, dt * 3)
    particle.vx *= drag
    particle.vy *= drag
  }
}

// 按行走时钟取当前帧，offset 用于错开不同机体的步频
const walkFrame = (offset: number) =>
  Math.floor((walkClock + offset) / WALK_STEP_TIME) % WALK_FRAMES

// 把块坐标对齐到 1 CSS 像素：像素块仍保持整数尺寸，慢速滚动不再一次跳 4px
const snapCss = (value: number) => Math.round(value * UNIT) / UNIT

// 踏步起伏：按迈步节奏（每步一次，周期 2 * WALK_STEP_TIME）做连续正弦浮动
const walkBob = (offset: number) =>
  Math.sin(((walkClock + offset) / (WALK_STEP_TIME * 2)) * Math.PI * 2) * BOB_AMPLITUDE

// 在 dx/dy/w/h 范围内挖掉 damage 个角上的方形缺口，作为被击中的损坏效果。
// bodyTop 用来跳过顶部透明/机房区域，base 是单次缺口的基础边长。
const clipDamageCorners = (
  dx: number,
  dy: number,
  w: number,
  h: number,
  damage: number,
  bodyTop: number,
  base: number
) => {
  if (!ctx) return
  const bodyH = Math.max(1, h - bodyTop)
  ctx.beginPath()
  ctx.rect(dx, dy, w, h)
  for (let level = 0; level < damage; level += 1) {
    const corner = DAMAGE_CORNERS[level % DAMAGE_CORNERS.length]
    const size = Math.min(
      Math.floor(w / 2),
      Math.floor(bodyH / 2),
      base * (1 + Math.floor(level / DAMAGE_CORNERS.length))
    )
    if (size <= 0) continue
    ctx.rect(
      dx + (corner[0] ? w - size : 0),
      dy + (corner[1] ? h - size : bodyTop),
      size,
      size
    )
  }
  // evenodd 让角上的方块变成挖空区域
  ctx.clip('evenodd')
}

const drawMech = (
  sprite: RenderSprite,
  cx: number,
  cy: number,
  frame: number,
  bob: number,
  scale: number,
  damage = 0
) => {
  if (!ctx) return
  const w = sprite.width * scale
  const h = sprite.height * scale
  const dx = snapCss(cx - w / 2)
  const dy = snapCss(cy - h / 2 + bob)
  if (damage > 0) {
    ctx.save()
    // 机体的头部约占顶部 1/4，从肩部开始削角
    clipDamageCorners(dx, dy, w, h, damage, h * 0.25, Math.max(1, Math.round(Math.min(w, h) / 7)))
  }
  ctx.drawImage(walkFrameImage(sprite, frame), dx, dy, w, h)
  if (damage > 0) ctx.restore()
}

// 逐行铺小方块画出像素圆，用作光芒中心的光晕
const pixelDisc = (cx: number, cy: number, radius: number, color: string) => {
  if (!ctx) return
  ctx.fillStyle = color
  const r = Math.max(1, Math.round(radius))
  for (let dy = -r; dy <= r; dy += 1) {
    const span = Math.round(Math.sqrt(r * r - dy * dy))
    if (span <= 0) continue
    ctx.fillRect(cx - span, cy + dy, span * 2, 1)
  }
}

const drawBurst = () => {
  if (!ctx || !burst) return
  const t = burst.age / burst.life
  // 前段快速铺开，后段渐隐
  const grow = Math.min(1, t / 0.16)
  const fade = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65
  if (fade <= 0) return

  const reach = Math.max(22, Math.min(width, height) * 0.62)
  const radius = reach * grow
  const cx = Math.round(plane.x)
  const cy = Math.round(plane.y)

  // 中心光晕
  ctx.globalAlpha = fade * 0.9
  pixelDisc(cx, cy, radius * 0.5, '#fff8dc')

  // 放射光线：内段白光、外段金色，随时间渐隐
  for (let i = 0; i < RAY_COUNT; i += 1) {
    const angle = burst.spin + (i / RAY_COUNT) * Math.PI * 2
    const cosA = Math.cos(angle)
    const sinA = Math.sin(angle)
    const length = radius * (i % 2 === 0 ? 1 : 0.68)
    for (let d = 2; d <= length; d += 1) {
      const edge = d / length
      ctx.globalAlpha = fade * (1 - edge * 0.85)
      ctx.fillStyle = edge < 0.45 ? '#fffdf4' : '#ffd859'
      const size = edge < 0.55 ? 2 : 1
      ctx.fillRect(Math.round(cx + cosA * d), Math.round(cy + sinA * d), size, size)
    }
  }

  // 向外扩散的光环
  const ringR = radius * 0.92
  const steps = Math.max(16, Math.round(ringR * 7))
  ctx.fillStyle = '#ffe9a6'
  ctx.globalAlpha = fade * 0.75
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2
    ctx.fillRect(
      Math.round(cx + Math.cos(angle) * ringR),
      Math.round(cy + Math.sin(angle) * ringR),
      1,
      1
    )
  }

  ctx.globalAlpha = 1
}

// 全屏轰炸：整个画面闪白 + 多层冲击波环 + 红色 vignette，营造震撼感
const drawBombard = () => {
  if (!ctx || !bombard) return
  const t = bombard.age / bombard.life
  // 闪白强度：开头最亮，之后周期性脉冲
  const pulse = 0.5 + 0.5 * Math.sin(bombard.age * 22)
  const flash = t < 0.12 ? 1 - t / 0.12 : pulse * 0.35 * (1 - t)
  ctx.globalAlpha = Math.max(0, flash)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  // 3 圈从中心扩散的冲击波环，错开相位
  const cx = width / 2
  const cy = height / 2
  const maxR = Math.hypot(width, height) / 2
  for (let i = 0; i < 3; i += 1) {
    const phase = ((bombard.age * 1.6 + i / 3) % 1)
    const r = phase * maxR
    const ringAlpha = (1 - phase) * 0.7 * (1 - t * 0.5)
    ctx.globalAlpha = Math.max(0, ringAlpha)
    ctx.strokeStyle = i === 1 ? '#ffd859' : '#fff2f2'
    ctx.lineWidth = 3 - i
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  // 暗角 vignette，强化中心聚焦（可通过 BOMBARD_VIGNETTE 开关）
  if (BOMBARD_VIGNETTE) {
    const grad = ctx.createRadialGradient(cx, cy, maxR * 0.3, cx, cy, maxR)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, `rgba(40,0,0,${0.5 * (1 - t)})`)
    ctx.globalAlpha = 1
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)
    ctx.globalAlpha = 1
  }
}

// TRANS-AM 文字随光芒从中心弹出：先小后大带回弹，红色发光填充 + 白色描边
const easeOutBack = (x: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
}

const drawTransformText = () => {
  const canvas = canvasRef.value
  if (!ctx || !burst || !canvas || !width || !height) return

  const t = burst.age / burst.life
  // 比光芒稍慢半拍放大，前 40% 时间完成从小到大的回弹
  const scale = 0.15 + easeOutBack(Math.min(1, t / 0.4)) * 0.85
  // 比光芒多停留一会儿再淡出
  const fade = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45
  if (fade <= 0) return

  const dpr = canvas.width / (width * UNIT)
  const sx = canvas.width / width
  const sy = canvas.height / height
  const x = plane.x * sx
  const y = plane.y * sy

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.font = `700 ${28 * scale * dpr}px ${MONO_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.globalAlpha = fade

  // 红色光晕打底
  ctx.shadowColor = 'rgba(255, 64, 56, 0.95)'
  ctx.shadowBlur = 16 * dpr
  ctx.fillStyle = '#ff3b30'
  ctx.fillText('TRANS-AM', x, y)

  // 白色描边勾出高亮边缘
  ctx.shadowBlur = 0
  ctx.lineWidth = Math.max(1, 1.1 * dpr)
  ctx.strokeStyle = '#fff2f2'
  ctx.strokeText('TRANS-AM', x, y)

  ctx.globalAlpha = 1
  ctx.setTransform(sx, 0, 0, sy, 0, 0)
}

// 按伤害等级削掉楼体的角：整块矩形减去若干个角上的方形缺口
const drawBuilding = (prop: Prop) => {
  if (!ctx) return
  const { sprite } = prop
  // 楼体尺寸随画布高度等比缩放，保持与机甲一致的屏幕占比
  const sw = sprite.width * speedScale
  const sh = sprite.height * speedScale
  const dx = snapCss(prop.x - sw / 2)
  const dy = snapCss(prop.y - sh / 2)
  const image = propImage(sprite)
  const damage = BUILDING_HP - prop.hp

  if (damage <= 0) {
    ctx.drawImage(image, dx, dy, sw, sh)
    return
  }

  const bodyH = Math.max(1, sh - BUILDING_BODY_TOP * speedScale)
  // 削角边长：每削完一圈四角就再放大一档，越打缺口越大
  const base = Math.max(1, Math.round(Math.min(sw, bodyH) / 6))
  ctx.save()
  clipDamageCorners(
    dx,
    dy,
    sw,
    sh,
    damage,
    BUILDING_BODY_TOP * speedScale,
    base
  )
  ctx.drawImage(image, dx, dy, sw, sh)
  ctx.restore()
}

// 背景装饰压在半透明色里，保证不抢机甲的视觉重心
const drawProps = () => {
  if (!ctx) return
  ctx.globalAlpha = PROP_ALPHA
  props.forEach((prop) => drawBuilding(prop))
  ctx.globalAlpha = 1
}

// 掉落的站点 logo，未加载完成前不画
const drawDrops = () => {
  if (!ctx || !logoTinted) return
  drops.forEach((drop) => {
    ctx!.drawImage(
      logoTinted!,
      snapCss(drop.x - LOGO_SIZE / 2),
      snapCss(drop.y - LOGO_SIZE / 2),
      LOGO_SIZE,
      LOGO_SIZE
    )
  })
}

const drawEnemyLabels = () => {
  const canvas = canvasRef.value
  if (!ctx || !canvas || !width || !height || !enemies.length) return
  const dpr = canvas.width / (width * UNIT)
  const sx = canvas.width / width
  const sy = canvas.height / height

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.font = `500 ${9 * dpr}px ${MONO_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = palette.label
  enemies.forEach((enemy) => {
    // 标签放在渣古头顶上方
    ctx!.fillText(enemy.name, enemy.x * sx, (enemy.y - enemy.halfH - 4) * sy)
  })
  ctx.setTransform(sx, 0, 0, sy, 0, 0)
}

const render = () => {
  if (!ctx) return
  // 全屏时用站点主题背景色填充画布，退出全屏后恢复透明
  if (isFullscreen.value) {
    ctx.fillStyle = palette.bg
    ctx.fillRect(0, 0, width, height)
  } else {
    ctx.clearRect(0, 0, width, height)
  }

  // 背景装饰（写字楼）
  drawProps()

  // 渣古：按剩余血量削掉机体的角
  enemies.forEach((enemy) => {
    const frame = walkFrame(enemy.walkOffset)
    drawMech(
      enemy.sprite,
      enemy.x,
      enemy.y,
      frame,
      walkBob(enemy.walkOffset),
      enemyScale,
      ENEMY_HP - enemy.hp
    )
  })
  drawEnemyLabels()

  // 掉落的站点 logo
  drawDrops()

  // 子弹：按各自的颜色、尺寸、形状绘制
  bullets.forEach((bullet) => {
    const cx = bullet.x
    const cy = bullet.y
    // 追踪弹拖尾：从弹尾向反方向画一段半透明渐隐条
    if (bullet.trail) {
      const speed = Math.hypot(bullet.vx, bullet.vy) || 1
      const dx = bullet.vx / speed
      const dy = bullet.vy / speed
      // 火箭弹的拖尾从尾部发出，其他弹从中心
      const tailX = bullet.shape === 'rocket' ? cx - dx * (bullet.h * 0.4) : cx
      const tailY = bullet.shape === 'rocket' ? cy - dy * (bullet.h * 0.4) : cy
      const tx = tailX - dx * bullet.h * 2.2
      const ty = tailY - dy * bullet.h * 2.2
      const grad = ctx!.createLinearGradient(tailX, tailY, tx, ty)
      grad.addColorStop(0, bullet.color)
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx!.strokeStyle = grad
      ctx!.lineWidth = bullet.w
      ctx!.lineCap = 'round'
      ctx!.beginPath()
      ctx!.moveTo(tailX, tailY)
      ctx!.lineTo(tx, ty)
      ctx!.stroke()
    }
    ctx!.fillStyle = bullet.color
    if (bullet.shape === 'round') {
      ctx!.beginPath()
      ctx!.arc(cx, cy, bullet.w / 2, 0, Math.PI * 2)
      ctx!.fill()
    } else if (bullet.shape === 'beam') {
      // 光束：主体 + 外层发光
      ctx!.globalAlpha = 0.35
      ctx!.fillRect(cx - bullet.w, cy - bullet.h / 2, bullet.w * 2, bullet.h)
      ctx!.globalAlpha = 1
      ctx!.fillRect(cx - bullet.w / 2, cy - bullet.h / 2, bullet.w, bullet.h)
    } else if (bullet.shape === 'rocket') {
      // 火箭弹：尖头朝向飞行方向，主体矩形 + 尾部三角翼
      const speed = Math.hypot(bullet.vx, bullet.vy) || 1
      const dx = bullet.vx / speed
      const dy = bullet.vy / speed
      // 垂直于飞行方向的法向量，用于计算宽度方向
      const px = -dy
      const py = dx
      const hw = bullet.w / 2
      const hh = bullet.h / 2
      // 主体：从尾部向头部延伸 hh*1.4 的矩形
      const noseX = cx + dx * hh
      const noseY = cy + dy * hh
      const tailX = cx - dx * hh * 0.8
      const tailY = cy - dy * hh * 0.8
      ctx!.beginPath()
      ctx!.moveTo(noseX, noseY)
      ctx!.lineTo(tailX + px * hw, tailY + py * hw)
      ctx!.lineTo(tailX - px * hw, tailY - py * hw)
      ctx!.closePath()
      ctx!.fill()
      // 尾部三角翼：在尾部两侧各画一个小三角
      const finLen = bullet.h * 0.45
      const finX = tailX - dx * finLen * 0.4
      const finY = tailY - dy * finLen * 0.4
      ctx!.beginPath()
      ctx!.moveTo(tailX + px * hw, tailY + py * hw)
      ctx!.lineTo(finX + px * (hw + finLen * 0.5), finY + py * (hw + finLen * 0.5))
      ctx!.lineTo(tailX, tailY)
      ctx!.closePath()
      ctx!.fill()
      ctx!.beginPath()
      ctx!.moveTo(tailX - px * hw, tailY - py * hw)
      ctx!.lineTo(finX - px * (hw + finLen * 0.5), finY - py * (hw + finLen * 0.5))
      ctx!.lineTo(tailX, tailY)
      ctx!.closePath()
      ctx!.fill()
    } else {
      ctx!.fillRect(cx - bullet.w / 2, cy - bullet.h / 2, bullet.w, bullet.h)
    }
  })

  // 爆炸粒子
  particles.forEach((particle) => {
    ctx!.globalAlpha = 1 - particle.age / particle.life
    ctx!.fillStyle = particle.color
    ctx!.fillRect(
      Math.round(particle.x - particle.size / 2),
      Math.round(particle.y - particle.size / 2),
      particle.size,
      particle.size
    )
  })
  ctx.globalAlpha = 1

  // 变身光芒
  drawBurst()

  // 全屏轰炸特效（闪白 + 冲击波 + 暗角）
  drawBombard()

  // 高达：重生等待期间不绘制，复活无敌期内闪烁
  if (respawnClock <= 0) {
    ctx.globalAlpha =
      invincibleClock > 0 && Math.floor(invincibleClock * 10) % 2 === 0 ? 0.3 : 1
    const playerFrame = walkFrame(0)
    drawMech(player, plane.x, plane.y, playerFrame, walkBob(0), playerScale)
    ctx.globalAlpha = 1
  }

  // TRANS-AM 高亮文字压在机甲与光芒之上
  drawTransformText()
}

const start = () => {
  if (raf) return
  last = performance.now()
  raf = requestAnimationFrame(loop)
}

const stop = () => {
  if (!raf) return
  cancelAnimationFrame(raf)
  raf = 0
}

const syncRunning = () => {
  if (inView && !document.hidden) start()
  else stop()
}

const loop = (now: number) => {
  raf = requestAnimationFrame(loop)
  // rAF 时间戳可能略早于 start() 里的 performance.now()，负的 dt 会让行走时钟倒走
  const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05)
  last = now
  update(dt, now)
  render()
}

const onVisibilityChange = () => syncRunning()

onMounted(() => {
  readPalette()
  resize()

  logoSource = new Image()
  logoSource.onload = tintLogo
  logoSource.src = '/logo.svg'

  resizeObserver = new ResizeObserver(() => resize())
  if (canvasRef.value) resizeObserver.observe(canvasRef.value)

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      inView = entries[0].isIntersecting
      syncRunning()
    },
    { threshold: 0 }
  )
  if (canvasRef.value) intersectionObserver.observe(canvasRef.value)

  themeObserver = new MutationObserver(readPalette)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  syncRunning()

  // 初始提示文案 2 秒后自动隐藏
  const hintTimer = window.setTimeout(() => {
    hintVisible.value = false
  }, 2000)
  onBeforeUnmount(() => window.clearTimeout(hintTimer))
})

onBeforeUnmount(() => {
  stop()
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  themeObserver?.disconnect()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  walkFrames.clear()
  propImages.clear()
  props.length = 0
  drops.length = 0
  logoSource = null
  logoTinted = null
  resizeObserver = null
  intersectionObserver = null
  themeObserver = null
})
</script>

<template>
  <div class="hero-game" ref="containerRef" aria-hidden="true">
    <canvas
      ref="canvasRef"
      class="hero-game__canvas"
      @pointermove="updatePointer"
      @pointerdown="updatePointer"
      @pointerleave="onPointerLeave"
    />
    <span class="hero-game__hint" :class="{ 'is-hidden': !hintVisible }">
      Try This Game · 连按 F 全屏
    </span>
  </div>
</template>
