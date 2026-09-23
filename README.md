# Bilibili 插件

[中文](README.md) | [English](README-EN.md)

`res-downloader` 的 Bilibili 视频详情页识别插件。

## 功能

- 支持 `bilibili.com/video/BV...` 视频详情页。
- 支持多分 P 视频，每个分 P 显示为独立资源。
- 识别当前账号可播放的画质，将音视频合并下载为 MP4。

## 安装

发布后可在 `res-downloader` 的“插件管理”页面安装。也可以下载对应版本的源码 ZIP，通过“从压缩包安装”导入。

## 注意事项

- 需要配置 FFmpeg 6.0 或更高版本。
- 暂不支持番剧、课程、直播、动态和列表页。
- 可用画质和内容以浏览器当前账号的播放权限为准。

## 开发与校验

在 `res-downloader` 项目根目录执行：

```bash
go run main.go plugin lint ./plugins/resd-plugin-bilibili
go run main.go plugin replay ./plugins/resd-plugin-bilibili ./plugins/resd-plugin-bilibili/fixtures/video-detail.json
go run main.go plugin replay ./plugins/resd-plugin-bilibili ./plugins/resd-plugin-bilibili/fixtures/html-detail.json
go run main.go plugin pack ./plugins/resd-plugin-bilibili
```
