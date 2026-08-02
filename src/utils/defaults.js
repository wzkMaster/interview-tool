export const defaultResumeData = {
  basicInfo: {
    name: '',
    phone: '',
    email: '',
    gender: '',
    age: '',
    blog: '',
    github: '',
    jobIntention: '',
    personalSummary: '',
    avatar: '',
  },
  education: [],
  campusExperience: [],
  skills: '',
  internship: [],
  workExperience: [],
  projectExperience: [],
  awards: [],
  customModules: [],
};

export const defaultConfig = {
  themeColor: '#0066cc',
  moduleTitleFontSize: 16,
  moduleContentFontSize: 14,
  lineHeight: 1.5,
  moduleSpacing: 24,
  pageMargin: { top: 36, bottom: 36, left: 36, right: 36 },
};

export const educationEntry = () => ({
  id: Date.now() + Math.random(),
  school: '',
  major: '',
  degree: '',
  tier: '',
  gpa: '',
  courses: '',
  startDate: '',
  endDate: '',
});

export const experienceEntry = () => ({
  id: Date.now() + Math.random(),
  company: '',
  position: '',
  department: '',
  location: '',
  startDate: '',
  endDate: '',
  contentMarkdown: '',
  descriptions: [''],
});

export const projectEntry = () => ({
  id: Date.now() + Math.random(),
  name: '',
  role: '',
  startDate: '',
  endDate: '',
  contentMarkdown: '',
  descriptions: [''],
});

export const awardEntry = () => ({
  id: Date.now() + Math.random(),
  name: '',
  level: '',
  date: '',
});

export const customModuleEntry = () => ({
  id: Date.now() + Math.random(),
  title: '',
  content: '',
});

// 公开仓库只包含虚构演示数据，避免把真实联系方式和任职经历写入源码。
export const recommendedResumeData = {
  basicInfo: {
    name: '示例候选人',
    phone: '13800000000',
    email: 'candidate@example.com',
    gender: '',
    age: '',
    blog: 'https://example.com',
    github: 'https://github.com/example',
    jobIntention: '前端开发工程师',
    personalSummary: '具备现代 Web 应用开发经验，关注工程质量、用户体验和团队协作。以下内容均为虚构演示数据。',
    avatar: '',
  },
  education: [
    {
      id: 'edu-example',
      school: '示例大学',
      major: '计算机科学与技术',
      degree: '本科',
      tier: '',
      gpa: '',
      courses: '数据结构、计算机网络、数据库系统',
      startDate: '2018-09',
      endDate: '2022-06',
    },
  ],
  campusExperience: [],
  skills: '熟悉 JavaScript、TypeScript 和 React。\n具备前端工程化、性能优化和自动化测试经验。',
  internship: [],
  workExperience: [
    {
      id: 'work-example',
      company: '示例科技有限公司',
      position: '前端开发工程师',
      department: '产品研发部',
      location: '上海',
      startDate: '2022-07',
      endDate: '至今',
      contentMarkdown: '- 负责企业级 Web 应用的功能开发与维护。\n- 推动公共组件和自动化测试建设，提升交付效率。',
      descriptions: [],
    },
  ],
  projectExperience: [
    {
      id: 'project-example',
      name: '企业管理平台（虚构示例）',
      role: '核心开发',
      startDate: '2023-03',
      endDate: '2023-09',
      contentMarkdown: '- 使用 React 构建业务模块和通用组件。\n- 优化首屏加载与交互体验，并完善异常监控。',
      descriptions: [],
    },
  ],
  awards: [],
  customModules: [],
};

export const degreeOptions = ['专科', '本科', '硕士', '博士', 'MBA', '其他'];

export const tabList = [
  { key: 'basicInfo', label: '基本信息' },
  { key: 'education', label: '教育背景' },
  { key: 'campusExperience', label: '校园经历' },
  { key: 'skills', label: '专业技能' },
  { key: 'internship', label: '实习经历' },
  { key: 'workExperience', label: '工作经历' },
  { key: 'projectExperience', label: '项目经历' },
  { key: 'awards', label: '获奖经历' },
  { key: 'customModules', label: '自定义模块' },
];
