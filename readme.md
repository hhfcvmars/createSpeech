<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Coze 文本转语音工具

这是一个基于 React + Vite 构建的文本转语音（TTS）应用，使用 Coze API 进行语音合成。支持单个文本合成、批量导入、时间线编辑等功能。

## 功能特性

- 🎤 文本转语音合成
- 🎨 多种音色选择
- 📝 批量文本导入
- ⏱️ 时间线编辑
- 📥 音频导出
- 💾 生成历史记录

## 环境要求

- **Node.js**: 16.x 或更高版本
- **npm**: 8.x 或更高版本（或使用 yarn/pnpm）

## 安装步骤

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd createSpeech
```

### 2. 安装依赖

```bash
npm install
```

## 设置身份令牌

### 获取 Coze 身份令牌

1. 访问 [Coze 平台](https://www.coze.cn/)
2. 登录您的账号
3. 进入个人设置或 API 管理页面
4. 创建或获取您的身份令牌（Identity Token）
   - 令牌格式通常为：`pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 在应用中使用令牌

身份令牌需要在应用界面中输入：

1. 启动应用后，在界面中找到身份令牌输入框
2. 将您的 Coze 身份令牌粘贴到输入框中
3. 系统会自动验证令牌并加载可用的音色列表

**注意**：
- 令牌以 `Bearer` 方式在请求头中传递
- 请妥善保管您的令牌，不要泄露给他人
- 如果令牌失效，请重新生成并更新

## 运行应用

### 开发模式

```bash
npm run dev
```

应用将在 `http://localhost:3000` 启动。

### 预览生产构建

```bash
npm run build
npm run preview
```

## 构建部署

### 构建生产版本

```bash
npm run build
```

构建完成后，静态文件将生成在 `dist/` 目录中。

### 部署方式

#### 方式一：静态文件托管

将 `dist/` 目录中的文件部署到任何静态文件托管服务：

- **Vercel**: 
  ```bash
  npm install -g vercel
  vercel --prod
  ```

- **Netlify**: 
  - 将 `dist` 目录拖拽到 Netlify 部署界面
  - 或使用 Netlify CLI:
  ```bash
  npm install -g netlify-cli
  netlify deploy --prod --dir=dist
  ```

- **GitHub Pages**:
  1. 在 `package.json` 中添加部署脚本：
  ```json
  "scripts": {
    "deploy": "npm run build && gh-pages -d dist"
  }
  ```
  2. 安装 gh-pages: `npm install --save-dev gh-pages`
  3. 运行: `npm run deploy`

#### 方式二：传统 Web 服务器

将 `dist/` 目录中的文件上传到您的 Web 服务器（如 Nginx、Apache）即可。

**Nginx 配置示例**:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### 方式三：Docker 部署

创建 `Dockerfile`:
```dockerfile
FROM nginx:alpine
COPY dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

构建和运行:
```bash
docker build -t create-speech .
docker run -d -p 80:80 create-speech
```

## 项目结构

```
createSpeech/
├── components/          # React 组件
│   ├── AudioPlayer.tsx # 音频播放器
│   ├── BatchImport.tsx # 批量导入
│   ├── Timeline.tsx    # 时间线
│   └── VoiceSelector.tsx # 音色选择器
├── services/           # 服务层
│   ├── audioUtils.ts  # 音频工具
│   └── geminiService.ts # Coze API 服务
├── data/              # 数据文件
│   └── voices.json    # 音色列表
├── public/            # 静态资源
├── dist/              # 构建输出
├── App.tsx            # 主应用组件
├── index.tsx          # 入口文件
└── vite.config.ts     # Vite 配置
```

## API 说明

应用使用 Coze API 进行语音合成：

- **API 端点**: `https://api.coze.cn/v1/audio/speech`
- **认证方式**: Bearer Token（在请求头中传递）
- **请求格式**: JSON
- **响应格式**: WAV 音频文件

## 常见问题

### Q: 令牌验证失败怎么办？
A: 请检查：
- 令牌格式是否正确（通常以 `pat_` 开头）
- 令牌是否已过期
- 网络连接是否正常

### Q: 音色列表加载失败？
A: 请确保：
- 身份令牌已正确输入
- 令牌有足够的权限访问音色 API
- 网络可以访问 `api.coze.cn`

### Q: 构建后无法访问？
A: 请确保：
- 使用支持 SPA（单页应用）路由的服务器配置
- 所有路由都重定向到 `index.html`

## 许可证

本项目采用 [MIT 许可证](LICENSE) - 这是最宽松的开源许可证之一。

MIT 许可证允许您：
- ✅ 商业使用
- ✅ 修改代码
- ✅ 分发代码
- ✅ 私人使用
- ✅ 使用专利

**唯一要求**：保留原始许可证声明和版权信息。

有关详细信息，请参阅 [LICENSE](LICENSE) 文件。

## 贡献

欢迎提交 Issue 和 Pull Request！
