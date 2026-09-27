# Bilibili Plugin

[中文](README.md) | [English](README-EN.md)

A Bilibili video detail page plugin for [res-downloader](https://github.com/putyy/res-downloader).

## Features

- Supports video detail pages at `bilibili.com/video/BV...`.
- Supports multi-part videos, with each part shown as a separate resource.
- Detects qualities available to the signed-in account and merges video and audio into an MP4 download.

## Installation

Once published, the plugin can be installed from Plugin Management in `res-downloader`. You can also download the source ZIP for the desired version and import it using the option to install from an archive.

## Notes

- Requires a configured FFmpeg installation, version 6.0 or later.
- Anime series, courses, live streams, activity feeds, and listing pages are not supported.
- Available qualities and content depend on the playback permissions of the account signed in to your browser.

## Development and Validation

Run these commands from the `res-downloader` project root:

```bash
go run main.go plugin lint ./plugins/resd-plugin-bilibili
go run main.go plugin replay ./plugins/resd-plugin-bilibili ./plugins/resd-plugin-bilibili/fixtures/video-detail.json
go run main.go plugin replay ./plugins/resd-plugin-bilibili ./plugins/resd-plugin-bilibili/fixtures/html-detail.json
go run main.go plugin pack ./plugins/resd-plugin-bilibili
```
