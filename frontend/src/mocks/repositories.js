export const mockRepositories = [
  {
    _id: 'repo_001',
    owner: 'alexchen',
    name: 'web-platform',
    status: 'READY',
    defaultBranch: 'main',
    description: 'Full-stack web application with React and Node.js',
    language: 'JavaScript',
    stars: 42,
    fileCount: 187,
    symbolCount: 523,
    updatedAt: '2026-09-01T14:30:00Z',
    createdAt: '2026-08-20T08:00:00Z',
  },
  {
    _id: 'repo_002',
    owner: 'alexchen',
    name: 'api-gateway',
    status: 'IMPORTING',
    defaultBranch: 'develop',
    description: 'Microservice API gateway with rate limiting',
    language: 'TypeScript',
    stars: 18,
    fileCount: 64,
    symbolCount: 140,
    updatedAt: '2026-09-02T16:00:00Z',
    createdAt: '2026-09-02T16:00:00Z',
  },
  {
    _id: 'repo_003',
    owner: 'alexchen',
    name: 'data-pipeline',
    status: 'FAILED',
    defaultBranch: 'main',
    description: 'ETL data pipeline for analytics',
    language: 'Python',
    stars: 7,
    fileCount: 42,
    symbolCount: 0,
    errorMessage: 'Repository clone failed: authentication expired',
    updatedAt: '2026-08-28T12:00:00Z',
    createdAt: '2026-08-28T10:00:00Z',
  },
];

export const mockGithubRepos = [
  {
    _id: 'gh_001',
    id: 1,
    full_name: 'alexchen/web-platform',
    name: 'web-platform',
    owner: {
      login: 'alexchen',
      toString() { return 'alexchen'; }
    },
    status: 'READY',
    defaultBranch: 'main',
    default_branch: 'main',
    private: false,
    description: 'Full-stack web application with React and Node.js',
    updatedAt: '2026-09-01T14:30:00Z',
    updated_at: '2026-09-01T14:30:00Z',
    language: 'JavaScript',
    stars: 42,
    stargazers_count: 42,
    fileCount: 187,
    symbolCount: 523
  },
  {
    _id: 'gh_002',
    id: 2,
    full_name: 'alexchen/api-gateway',
    name: 'api-gateway',
    owner: {
      login: 'alexchen',
      toString() { return 'alexchen'; }
    },
    status: 'IMPORTING',
    defaultBranch: 'develop',
    default_branch: 'develop',
    private: true,
    description: 'Microservice API gateway with rate limiting',
    updatedAt: '2026-09-02T16:00:00Z',
    updated_at: '2026-09-02T16:00:00Z',
    language: 'TypeScript',
    stars: 18,
    stargazers_count: 18,
    fileCount: 64,
    symbolCount: 140
  },
  {
    _id: 'gh_003',
    id: 3,
    full_name: 'alexchen/mobile-app',
    name: 'mobile-app',
    owner: {
      login: 'alexchen',
      toString() { return 'alexchen'; }
    },
    status: 'NOT_IMPORTED',
    defaultBranch: 'main',
    default_branch: 'main',
    private: false,
    description: 'React Native mobile application for iOS and Android',
    updatedAt: '2026-08-25T10:00:00Z',
    updated_at: '2026-08-25T10:00:00Z',
    language: 'JavaScript',
    stars: 31,
    stargazers_count: 31,
    fileCount: 112,
    symbolCount: 380
  },
  {
    _id: 'gh_004',
    id: 4,
    full_name: 'alexchen/ml-service',
    name: 'ml-service',
    owner: {
      login: 'alexchen',
      toString() { return 'alexchen'; }
    },
    status: 'NOT_IMPORTED',
    defaultBranch: 'main',
    default_branch: 'main',
    private: true,
    description: 'Machine learning inference service using FastAPI and PyTorch',
    updatedAt: '2026-08-20T08:00:00Z',
    updated_at: '2026-08-20T08:00:00Z',
    language: 'Python',
    stars: 12,
    stargazers_count: 12,
    fileCount: 58,
    symbolCount: 210
  },
  {
    _id: 'gh_005',
    id: 5,
    full_name: 'alexchen/design-system',
    name: 'design-system',
    owner: {
      login: 'alexchen',
      toString() { return 'alexchen'; }
    },
    status: 'NOT_IMPORTED',
    defaultBranch: 'main',
    default_branch: 'main',
    private: false,
    description: 'Shared UI component library built with Tailwind CSS and Radix UI',
    updatedAt: '2026-08-18T14:00:00Z',
    updated_at: '2026-08-18T14:00:00Z',
    language: 'JavaScript',
    stars: 56,
    stargazers_count: 56,
    fileCount: 84,
    symbolCount: 320
  },
  {
    _id: 'gh_006',
    id: 6,
    full_name: 'alexchen/infra-config',
    name: 'infra-config',
    owner: {
      login: 'alexchen',
      toString() { return 'alexchen'; }
    },
    status: 'NOT_IMPORTED',
    defaultBranch: 'main',
    default_branch: 'main',
    private: true,
    description: 'Terraform infrastructure configs and Kubernetes manifests',
    updatedAt: '2026-08-10T09:00:00Z',
    updated_at: '2026-08-10T09:00:00Z',
    language: 'HCL',
    stars: 3,
    stargazers_count: 3,
    fileCount: 35,
    symbolCount: 0
  },
];

export const mockFileTree = [
  { path: 'src/index.js', name: 'index.js', extension: '.js', size: 1240 },
  { path: 'src/App.jsx', name: 'App.jsx', extension: '.jsx', size: 2450 },
  { path: 'src/components/Header.jsx', name: 'Header.jsx', extension: '.jsx', size: 1890 },
  { path: 'src/components/Sidebar.jsx', name: 'Sidebar.jsx', extension: '.jsx', size: 2100 },
  { path: 'src/components/Button.jsx', name: 'Button.jsx', extension: '.jsx', size: 680 },
  { path: 'src/hooks/useAuth.js', name: 'useAuth.js', extension: '.js', size: 950 },
  { path: 'src/hooks/useApi.js', name: 'useApi.js', extension: '.js', size: 1200 },
  { path: 'src/services/auth.js', name: 'auth.js', extension: '.js', size: 2300 },
  { path: 'src/services/api.js', name: 'api.js', extension: '.js', size: 3100 },
  { path: 'src/utils/helpers.js', name: 'helpers.js', extension: '.js', size: 890 },
  { path: 'src/pages/Dashboard.jsx', name: 'Dashboard.jsx', extension: '.jsx', size: 4200 },
  { path: 'src/pages/Login.jsx', name: 'Login.jsx', extension: '.jsx', size: 1800 },
  { path: 'package.json', name: 'package.json', extension: '.json', size: 820 },
  { path: 'README.md', name: 'README.md', extension: '.md', size: 3400 },
  { path: 'tailwind.config.js', name: 'tailwind.config.js', extension: '.js', size: 450 },
];

export const mockSymbols = [
  { file: 'src/services/auth.js', functions: ['login', 'logout', 'refreshToken', 'verifySession'], classes: ['AuthService'] },
  { file: 'src/services/api.js', functions: ['get', 'post', 'put', 'del', 'handleError'], classes: ['ApiClient'] },
  { file: 'src/hooks/useAuth.js', functions: ['useAuth'], classes: [] },
  { file: 'src/components/Header.jsx', functions: ['Header', 'NavLink'], classes: [] },
  { file: 'src/components/Sidebar.jsx', functions: ['Sidebar', 'SidebarItem'], classes: [] },
  { file: 'src/pages/Dashboard.jsx', functions: ['Dashboard', 'StatsPanel', 'ActivityFeed'], classes: [] },
  { file: 'src/utils/helpers.js', functions: ['formatDate', 'truncate', 'debounce'], classes: [] },
];

export const mockBranches = [
  {
    name: 'main',
    isDefault: true,
    fileIndex: {
      files: mockFileTree.map(f => f.path),
      symbols: mockSymbols
    }
  },
  { name: 'develop', isDefault: false },
  { name: 'feature/auth-refactor', isDefault: false },
  { name: 'fix/rate-limiting', isDefault: false },
];

export default {
  mockRepositories,
  mockGithubRepos,
  mockBranches,
  mockFileTree,
  mockSymbols
};
