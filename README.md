# Interview Tool

一个运行在浏览器中的简历编辑与 AI 模拟面试工具。默认使用浏览器本地存储，也可以登录固定管理员账号，把简历、AI 模型配置和面试问答记录同步到 Supabase。

## 本地运行

```bash
npm install
npm run dev
```

## 配置 Supabase 远程存储

1. 新建 Supabase 项目，在 SQL Editor 中执行 [`supabase/setup.sql`](./supabase/setup.sql)。该表已启用 RLS，并同时校验用户 ID 与固定管理员邮箱；其他账号即使成功注册也无法访问远程数据。
2. 在 **Authentication → Users → Add user** 中创建并自动确认一个用户，并在 Auth 设置中关闭公开注册（Allow new users to sign up）：
   - Email：`wzkmaster@resume.local`（仅作为 Supabase Auth 的内部登录标识）
   - Password：填入你自己的强密码
3. 当前官方部署已内置这个项目的公开 URL 和 Publishable key。若要让 fork 连接其他 Supabase 项目，复制 `.env.example` 为 `.env.local` 并覆盖配置。不要在前端使用 `service_role` 或 secret key。
4. 重启开发服务器，点击页面右上角的“本地存储”，使用固定账号 `wzkMaster` 和第 2 步设置的密码登录。

首次登录且云端无数据时，应用会把当前设备的本地数据初始化到云端。远程模式中的后续修改会自动同步；退出后会恢复该设备原有的本地数据。

> Supabase Auth 会用 bcrypt 保存密码哈希；项目数据库和源码中不会出现明文密码。若要给其他人开通远程存储，应由管理员在 Supabase Auth 中创建账号并扩展应用的账号映射。未开通者仍可完整使用本地存储功能。

## 部署

推送到 `main` 分支后，GitHub Actions 会自动构建并部署到 GitHub Pages。

> 请勿提交真实 API Key、个人简历数据或 `.env` 文件。
