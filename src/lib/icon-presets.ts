export const presetCategories = [
  { id: 'navigation', label: '常用导航' },
  { id: 'work', label: '工作效率' },
  { id: 'development', label: '开发工具' },
  { id: 'learning', label: '学习文档' },
  { id: 'communication', label: '交流协作' },
  { id: 'media', label: '影音设计' },
  { id: 'life', label: '生活服务' },
  { id: 'nature', label: '自然健康' },
  { id: 'tools', label: '实用工具' },
] as const

export type PresetCategory = (typeof presetCategories)[number]['id']

function category<const T extends readonly (readonly [string, string, string])[]>(
  category: PresetCategory,
  entries: T,
) {
  return entries.map(([id, label, keywords]) => ({
    id: id as T[number][0],
    label,
    keywords,
    category,
  }))
}

// Store metadata separately from React components so backup validation stays lightweight.
export const presetIcons = [
  ...category('navigation', [
    ['globe', '地球', 'globe world web 网站 浏览器 互联网'],
    ['home', '主页', 'home house 首页 房子'],
    ['search', '搜索', 'search find 查找 放大镜'],
    ['star', '星标', 'star favorite 收藏 星星'],
    ['heart', '爱心', 'heart like 喜欢 关注'],
    ['bookmark', '书签', 'bookmark save 收藏 阅读'],
    ['compass', '指南针', 'compass navigation 导航 探索'],
    ['map', '地图', 'map navigation 导航 路线'],
    ['map-pin', '位置', 'map pin location 定位 地点'],
    ['link', '链接', 'link url 网址 连接'],
    ['external-link', '外部链接', 'external link open 跳转 打开'],
    ['grid', '应用网格', 'grid apps layout 应用 布局'],
    ['layout-dashboard', '仪表盘', 'layout dashboard panel 面板 控制台'],
    ['rocket', '火箭', 'rocket launch 启动 发射'],
    ['flag', '旗帜', 'flag mark 标记 目标'],
  ] as const),
  ...category('work', [
    ['briefcase', '公文包', 'briefcase work business 办公 商务'],
    ['calendar', '日历', 'calendar date 日期 日程'],
    ['calendar-check', '日程', 'calendar check schedule 计划 安排'],
    ['clock', '时钟', 'clock time 时间'],
    ['alarm-clock', '闹钟', 'alarm clock reminder 提醒'],
    ['timer', '计时器', 'timer stopwatch 番茄钟 倒计时'],
    ['list-todo', '待办清单', 'list todo task checklist 任务 待办事项'],
    ['check-circle', '完成', 'circle check done success 完成 成功'],
    ['clipboard', '剪贴板', 'clipboard copy 复制 粘贴'],
    ['clipboard-list', '任务清单', 'clipboard list task 任务 表单'],
    ['folder', '文件夹', 'folder directory 文件 目录'],
    ['folders', '文件集合', 'folders directories 分组 目录'],
    ['archive', '归档', 'archive box storage 收纳 存档'],
    ['inbox', '收件箱', 'inbox incoming 接收 收集'],
    ['target', '目标', 'target goal focus 专注 计划'],
  ] as const),
  ...category('development', [
    ['code', '代码', 'code code2 coding 编程 开发'],
    ['terminal', '终端', 'terminal console shell 命令行 控制台'],
    ['braces', '大括号', 'braces json programming 编程 代码'],
    ['bug', '调试', 'bug debug issue 错误 问题 虫子'],
    ['git-branch', '代码分支', 'git branch version 版本 分支'],
    ['git-pull-request', '合并请求', 'git pull request merge 合并 代码审查'],
    ['database', '数据库', 'database sql data 数据 存储'],
    ['server', '服务器', 'server backend host 后端 主机'],
    ['cloud', '云端', 'cloud hosting storage 云盘 云服务'],
    ['cpu', '处理器', 'cpu processor chip 芯片 硬件'],
    ['hard-drive', '硬盘', 'hard drive disk storage 磁盘 存储'],
    ['laptop', '笔记本电脑', 'laptop computer 笔记本 电脑'],
    ['monitor', '显示器', 'monitor desktop screen 桌面 屏幕 电脑'],
    ['blocks', '积木', 'blocks components plugin 组件 插件 模块'],
    ['webhook', '接口', 'webhook api integration 集成 回调'],
  ] as const),
  ...category('learning', [
    ['book', '书本', 'book open reading 阅读 教程'],
    ['book-marked', '标记书本', 'book marked reading 书籍 阅读'],
    ['library', '图书馆', 'library books 书库 资料'],
    ['graduation-cap', '学位帽', 'graduation cap education 学习 教育 大学'],
    ['school', '学校', 'school education 学习 教育'],
    ['notebook', '笔记本', 'notebook journal 笔记 日记'],
    ['notebook-pen', '记笔记', 'notebook pen notes 随手记 备忘录'],
    ['file-text', '文档', 'file text document 文本 文章'],
    ['files', '多份文档', 'files documents 文件 资料'],
    ['file-code', '代码文件', 'file code source 源码 脚本'],
    ['file-json', '数据文件', 'file json data 数据 配置'],
    ['languages', '翻译', 'languages translate 语言 英语 中文'],
    ['lightbulb', '灯泡', 'lightbulb idea 灵感 创意'],
    ['calculator', '计算器', 'calculator math 计算 数学'],
    ['brain', '大脑', 'brain ai intelligence 人工智能 思考'],
  ] as const),
  ...category('communication', [
    ['mail', '邮件', 'mail email envelope 邮箱 信封'],
    ['message-circle', '聊天', 'message circle chat 聊天 消息'],
    ['messages-square', '讨论', 'messages square chat forum 讨论 论坛'],
    ['send', '发送', 'send paper plane 纸飞机 消息'],
    ['phone', '电话', 'phone call 联系 通话'],
    ['video-call', '视频通话', 'video call meeting 会议 通话'],
    ['users', '团队', 'users team group 团队 用户 社区'],
    ['contact', '通讯录', 'contact address book 联系人 名片'],
    ['bell', '通知', 'bell notification 提醒 铃铛'],
    ['at-sign', '提及', 'at sign mention 提及 邮箱'],
    ['share', '分享', 'share forward 转发 共享'],
    ['network', '关系网络', 'network connection 组织 关系'],
    ['presentation', '演示', 'presentation slides 演讲 幻灯片'],
    ['handshake', '合作', 'handshake cooperation 合作 握手'],
    ['radio', '广播', 'radio broadcast podcast 电台 播客'],
  ] as const),
  ...category('media', [
    ['video', '电视', 'tv minimal video 视频 电视'],
    ['music', '音乐', 'music music2 audio 歌曲 音频'],
    ['headphones', '耳机', 'headphones audio 听歌 音频'],
    ['mic', '麦克风', 'mic microphone recording 录音 语音'],
    ['camera', '相机', 'camera photo 摄影 拍照'],
    ['image', '图片', 'image picture photo 照片 相册'],
    ['film', '电影', 'film movie cinema 影片 影视'],
    ['play', '播放', 'play player 视频 音乐'],
    ['palette', '调色盘', 'palette color art 颜色 美术 设计'],
    ['design', '钢笔工具', 'pen tool design vector 设计 绘图 矢量'],
    ['paintbrush', '画笔', 'paintbrush paint drawing 绘画 美术'],
    ['scissors', '剪刀', 'scissors cut editing 剪辑 裁剪'],
    ['pen-line', '书写', 'pen line write edit 写作 编辑'],
    ['wand', '魔法棒', 'wand magic effects 魔法 特效'],
    ['sparkles', '闪光', 'sparkles ai magic 人工智能 灵感'],
  ] as const),
  ...category('life', [
    ['coffee', '咖啡', 'coffee cafe break 咖啡馆 休息'],
    ['shopping-cart', '购物车', 'shopping cart buy 购物 电商'],
    ['shopping-bag', '购物袋', 'shopping bag buy 购物 商城'],
    ['store', '商店', 'store shop market 商城 店铺'],
    ['wallet', '钱包', 'wallet money finance 金钱 财务'],
    ['credit-card', '银行卡', 'credit card payment 支付 银行'],
    ['chart', '趋势图', 'chart line analytics stock 数据 统计 股票'],
    ['utensils', '餐饮', 'utensils food restaurant 美食 餐厅'],
    ['gift', '礼物', 'gift present birthday 生日 礼品'],
    ['ticket', '票券', 'ticket coupon event 优惠券 活动'],
    ['plane', '飞机', 'plane flight travel 航班 旅行'],
    ['car', '汽车', 'car drive travel 驾驶 出行'],
    ['train', '火车', 'train front railway 高铁 出行'],
    ['gamepad', '游戏', 'gamepad game controller 游戏 手柄'],
    ['bed', '住宿', 'bed hotel sleep 酒店 睡眠'],
  ] as const),
  ...category('nature', [
    ['sun', '太阳', 'sun sunny weather 阳光 天气'],
    ['moon', '月亮', 'moon night 夜晚 月球'],
    ['cloud-sun', '多云', 'cloud sun weather 天气 晴天'],
    ['cloud-rain', '下雨', 'cloud rain weather 天气 雨天'],
    ['umbrella', '雨伞', 'umbrella rain 雨天 天气'],
    ['leaf', '叶子', 'leaf nature green 自然 环保'],
    ['flower', '花朵', 'flower nature garden 自然 花园'],
    ['trees', '树林', 'trees forest nature 森林 自然'],
    ['mountain', '山峰', 'mountain hiking outdoors 户外 登山'],
    ['flame', '火焰', 'flame fire hot 热门 火'],
    ['droplet', '水滴', 'droplet water 水 喝水'],
    ['activity', '健康', 'activity health pulse 健康 心率'],
    ['dumbbell', '健身', 'dumbbell gym fitness 运动 锻炼'],
    ['bike', '自行车', 'bike cycling bicycle 骑行 运动'],
    ['smile', '笑脸', 'smile happy mood 心情 快乐'],
  ] as const),
  ...category('tools', [
    ['settings', '设置', 'settings gear 齿轮 配置'],
    ['sliders', '调节', 'sliders controls preferences 参数 调整'],
    ['wrench', '扳手', 'wrench tool repair 工具 维修'],
    ['shield', '盾牌', 'shield security privacy 安全 隐私'],
    ['lock', '锁', 'lock password security 密码 安全'],
    ['key', '钥匙', 'key password access 密码 访问'],
    ['wifi', '无线网络', 'wifi internet network 网络 连接'],
    ['bluetooth', '蓝牙', 'bluetooth wireless 无线 连接'],
    ['qr-code', '二维码', 'qr code scan 扫码'],
    ['scan-line', '扫描', 'scan line scanner 扫描仪 识别'],
    ['download', '下载', 'download save 保存 文件'],
    ['upload', '上传', 'upload import 导入 文件'],
    ['printer', '打印机', 'printer print 打印 文件'],
    ['smartphone', '手机', 'smartphone mobile phone 移动设备'],
    ['battery', '电池', 'battery power energy 电量 能源'],
  ] as const),
] as const

export type PresetIconName = (typeof presetIcons)[number]['id']
// Legacy brand IDs remain valid for existing workspaces and backups.
export const iconNames = [
  ...presetIcons.map((icon) => icon.id),
  'github',
  'figma',
  'notion',
] as const
export type IconName = (typeof iconNames)[number]

export function findPresetIcons(query: string, category: PresetCategory | 'all' = 'all') {
  const words = query.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean)
  return presetIcons.filter((icon) => {
    if (category !== 'all' && icon.category !== category) return false
    const categoryLabel = presetCategories.find((entry) => entry.id === icon.category)!.label
    const text = `${icon.id.replaceAll('-', ' ')} ${icon.label} ${icon.keywords} ${categoryLabel}`
    return words.every((word) => text.includes(word.replaceAll('-', ' ')))
  })
}

export function presetIconLabel(id: IconName) {
  return (
    presetIcons.find((icon) => icon.id === id)?.label ??
    ({ github: 'GitHub', figma: 'Figma', notion: 'Notion' } as Record<string, string>)[id]
  )
}
