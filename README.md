# SyncHub — 局域网文件实时同步

一套基于 **React + Express + Socket.IO** 的局域网文件实时同步工具，支持版本历史回溯、双向同步、拖拽上传，打造个人/团队局域网内的轻量级文件共享中心。

## 特性

- **实时同步**：基于 WebSocket（Socket.IO）的毫秒级文件变更推送，文件增/改/删即时同步至所有连接的客户端。
- **版本历史**：采用 SHA-256 哈希 + Git 风格对象存储（`.sync-versions/objects`），每次文件修改自动生成历史版本，支持版本回溯与还原。
- **双向同步**：支持通过浏览器 File System Access API 选定本地目录，与服务器端自动双向比对同步。
- **文件树视图**：按目录层级展示文件结构，支持搜索过滤。
- **拖拽上传**：支持拖拽文件/文件夹到上传对话框，可指定子路径。
- **跨平台客户端**：纯浏览器端应用，PC / 手机 / 平板均可访问。
- **现代化 UI**：基于 Tailwind CSS 的 Zinc 暗色主题，Lucide 图标加持。

## 技术栈

| 层级 | 技术 |
|---|---|
| 前端框架 | React 18 + Vite |
| UI 框架 | Tailwind CSS 3 |
| 图标库 | Lucide React |
| 实时通信 | Socket.IO（WebSocket + Polling fallback） |
| HTTP 客户端 | Axios |
| 后端框架 | Express 4 |
| 文件监听 | Chokidar 3 |
| 文件上传 | Multer |
| 跨域 | CORS |
| 唯一标识 | UUID |
| 后端存储 | 本地文件系统（SHA-256 去重对象存储） |

## 快速开始

### 1. 启动服务端

```bash
cd server
npm install
npm start
```

服务端默认监听 `http://0.0.0.0:3001`，共享目录为 `server/shared`（自动创建）。

**自定义共享目录：**

```bash
node index.js --dir /path/to/your/folder
# 或
node index.js /path/to/your/folder
```

### 2. 启动客户端开发服务器

```bash
cd client
npm install
npm run dev
```

开发模式下 Vite 会自动代理 `/api` 和 `/socket.io` 到 `localhost:3001`。

### 3. 生产部署

```bash
# 构建前端
cd client
npm run build

# 将 dist 目录下的产物部署到任意静态服务器，或让 Express 托管
```

## 使用指南

### 连接服务器

打开客户端页面后，在顶部地址栏输入服务器 URL（如 `http://192.168.1.100:3001`），连接成功后会显示所有已共享的文件。

### 上传文件

点击 **上传** 按钮，可以：
- 拖拽文件 / 文件夹到对话框
- 点击选择文件
- 指定子路径（如 `docs/2024/`）

### 下载文件

在文件列表中点击 **下载** 按钮即可下载对应文件。

### 版本历史

选中一个文件后，底部面板会展示该文件的所有历史版本。你可以：
- **下载** 任意历史版本
- **还原** 到某个历史版本

### 本地目录同步

点击 **本地同步** 按钮，选择一个本地文件夹后：
- 系统会轮询（每 3 秒）检测本地文件变更并自动上传
- 服务端文件变更会自动下载到本地
- 通过哈希比对防止回环同步

## API 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/files` | 获取所有文件列表及版本信息 |
| `GET` | `/api/files/download?path=xxx` | 下载指定文件 |
| `GET` | `/api/files/download-version?path=xxx&versionId=xxx` | 下载历史版本 |
| `POST` | `/api/upload` | 上传文件（multipart/form-data） |
| `DELETE` | `/api/files?path=xxx` | 删除文件 |
| `POST` | `/api/files/restore` | 还原到指定版本 |

## WebSocket 事件

| 事件 | 方向 | 说明 |
|---|---|---|
| `connected` | Server → Client | 连接成功，返回文件列表与服务端信息 |
| `files:update` | Server → Client | 文件列表更新 |
| `file:added` | Server → Client | 新文件添加 |
| `file:changed` | Server → Client | 文件内容变更 |
| `file:deleted` | Server → Client | 文件被删除 |
| `request-files` | Client → Server | 客户端主动请求刷新文件列表 |

## License

MIT