# Bilibili 插件

`res-downloader` 的 Bilibili 视频详情页识别插件。

## 功能

- 支持 `bilibili.com/video/BV...` 视频详情页。
- 支持直接解析详情页 HTML 中内嵌的播放数据，不依赖页面再次请求播放接口。
- 读取当前账号实际可播放的清晰度。
- 自动选择当前清晰度中的 AVC 视频轨和最高码率普通音频轨。
- 下载后通过 FFmpeg 合并为 MP4 文件。
- 支持多分 P 视频，每个分 P 显示为独立资源。
- 接管 Bilibili 的 M4S 响应，避免通用探测器重复显示视频轨、音频轨或二进制文件。
- 忽略详情页的弹幕、字幕接口和页面装饰图片，减少无关资源。

暂不处理番剧、课程、直播、动态和列表页。登录、会员、地区或其他访问限制以浏览器当前实际播放权限为准，插件不会保存 Cookie。

## 开发与校验

在 `res-downloader` 项目根目录执行：

```bash
go run main.go plugin lint ./plugins/resd-plugin-bilibili
go run main.go plugin replay ./plugins/resd-plugin-bilibili ./plugins/resd-plugin-bilibili/fixtures/video-detail.json
go run main.go plugin replay ./plugins/resd-plugin-bilibili ./plugins/resd-plugin-bilibili/fixtures/html-detail.json
go run main.go plugin pack ./plugins/resd-plugin-bilibili
```

需要 FFmpeg 6.0 或更高版本。
