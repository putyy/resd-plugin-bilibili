function stringValue(value) {
  return typeof value === "string" ? value : "";
}

function numberValue(value) {
  var parsed = Number(value);
  return isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parsePayload(body) {
  var source = String(body || "").trim();
  if (!source) return null;
  if (source.indexOf("for (;;);") === 0) source = source.slice(9).trim();
  if (source.indexOf(")]}'") === 0) {
    var newline = source.indexOf("\n");
    source = newline >= 0 ? source.slice(newline + 1) : source.slice(4);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    return null;
  }
}

function firstHeader(headers, name) {
  if (!headers || typeof headers !== "object") return "";
  var wanted = String(name || "").toLowerCase();
  var keys = Object.keys(headers);
  for (var index = 0; index < keys.length; index++) {
    if (keys[index].toLowerCase() !== wanted) continue;
    var value = headers[keys[index]];
    return Array.isArray(value) ? stringValue(value[0]) : stringValue(value);
  }
  return "";
}

function queryValue(rawUrl, name) {
  var expression = new RegExp("[?&]" + name + "=([^&#]*)", "i");
  var match = expression.exec(String(rawUrl || ""));
  if (!match) return "";
  try {
    return decodeURIComponent(match[1].replace(/\+/g, " "));
  } catch (error) {
    return match[1];
  }
}

function bvidValue(value) {
  var match = /BV[0-9A-Za-z]{10}/i.exec(String(value || ""));
  if (!match) return "";
  return "BV" + match[0].slice(2);
}

function requestBvid(request) {
  var direct = bvidValue(queryValue(request.url, "bvid"));
  if (direct) return direct;
  return bvidValue(request.url) || bvidValue(firstHeader(request.headers, "referer"));
}

function extractAssignedJSON(html, marker) {
  var source = String(html || "");
  var searchFrom = 0;
  while (searchFrom < source.length) {
    var markerIndex = source.indexOf(marker, searchFrom);
    if (markerIndex < 0) return null;
    var cursor = markerIndex + marker.length;
    while (/\s/.test(source.charAt(cursor))) cursor++;
    if (source.charAt(cursor) !== "=") {
      searchFrom = cursor;
      continue;
    }
    cursor++;
    while (/\s/.test(source.charAt(cursor))) cursor++;
    if (source.charAt(cursor) !== "{" && source.charAt(cursor) !== "[") {
      searchFrom = cursor;
      continue;
    }

    var start = cursor;
    var depth = 0;
    var quoted = false;
    var escaped = false;
    for (; cursor < source.length; cursor++) {
      var character = source.charAt(cursor);
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === "\"") quoted = false;
        continue;
      }
      if (character === "\"") quoted = true;
      else if (character === "{" || character === "[") depth++;
      else if (character === "}" || character === "]") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(source.slice(start, cursor + 1));
          } catch (error) {
            return null;
          }
        }
      }
    }
    return null;
  }
  return null;
}

function canonicalPageUrl(bvid, pageNumber) {
  if (!bvid) return "https://www.bilibili.com/";
  var url = "https://www.bilibili.com/video/" + bvid + "/";
  return pageNumber > 1 ? url + "?p=" + pageNumber : url;
}

function sourceFor(bvid, pageNumber) {
  return {pageUrl: canonicalPageUrl(bvid, pageNumber), domain: "bilibili.com"};
}

function groupKey(bvid, cid) {
  return "bilibili:" + bvid + ":" + String(cid);
}

function mediaUrlRank(rawUrl) {
  var match = /^https?:\/\/([^\/:]+)(?::([0-9]+))?/i.exec(String(rawUrl || ""));
  if (!match) return 0;
  var host = match[1].toLowerCase();
  var port = match[2] || "";
  var isBilibiliCDN = /(^|\.)bilivideo\.(com|cn)$/.test(host);
  var isMCDN = /(^|\.)mcdn\.bilivideo\.(com|cn)$/.test(host);
  if (isBilibiliCDN && !isMCDN && (!port || port === "443")) return 3;
  if (!isMCDN) return 2;
  return 1;
}

function mediaUrl(value) {
  if (!value || typeof value !== "object") return "";
  var candidates = [value.baseUrl, value.base_url, value.url];
  var backups = value.backupUrl || value.backup_url;
  if (Array.isArray(backups)) candidates = candidates.concat(backups);

  var selected = "";
  var selectedRank = 0;
  for (var index = 0; index < candidates.length; index++) {
    var candidate = stringValue(candidates[index]);
    if (!/^https?:\/\//i.test(candidate)) continue;
    var rank = mediaUrlRank(candidate);
    if (!selected || rank > selectedRank) {
      selected = candidate;
      selectedRank = rank;
    }
  }
  return selected;
}

function qualityRank(id) {
  var ranks = {
    6: 1, 16: 2, 32: 3, 64: 4, 74: 5, 80: 6,
    112: 7, 116: 8, 120: 9, 125: 10, 126: 11, 127: 12, 129: 13
  };
  return ranks[Number(id)] || Number(id) || 0;
}

function qualityLabel(id) {
  var labels = {
    6: "240P", 16: "360P", 32: "480P", 64: "720P", 74: "720P60",
    80: "1080P", 112: "1080P+", 116: "1080P60", 120: "4K",
    125: "HDR", 126: "Dolby Vision", 127: "8K", 129: "HDR Vivid"
  };
  return labels[Number(id)] || (id ? "Q" + String(id) : "");
}

function videoCodecRank(item) {
  var codecs = stringValue(item && item.codecs).toLowerCase();
  var codecid = Number(item && item.codecid);
  if (codecid === 7 || codecs.indexOf("avc") === 0) return 3;
  if (codecid === 12 || codecs.indexOf("hev") === 0 || codecs.indexOf("hvc") === 0) return 2;
  if (codecid === 13 || codecs.indexOf("av01") === 0) return 1;
  return 0;
}

function selectVideo(videos, currentQuality) {
  if (!Array.isArray(videos)) return null;
  var available = [];
  for (var index = 0; index < videos.length; index++) {
    if (mediaUrl(videos[index])) available.push(videos[index]);
  }
  if (!available.length) return null;

  var exact = [];
  if (currentQuality) {
    for (var exactIndex = 0; exactIndex < available.length; exactIndex++) {
      if (Number(available[exactIndex].id) === Number(currentQuality)) exact.push(available[exactIndex]);
    }
  }
  var candidates = exact.length ? exact : available;
  var selected = candidates[0];
  for (var candidateIndex = 1; candidateIndex < candidates.length; candidateIndex++) {
    var current = candidates[candidateIndex];
    var currentScore = qualityRank(current.id) * 1000000000000 + videoCodecRank(current) * 10000000000 + numberValue(current.bandwidth);
    var selectedScore = qualityRank(selected.id) * 1000000000000 + videoCodecRank(selected) * 10000000000 + numberValue(selected.bandwidth);
    if (currentScore > selectedScore) selected = current;
  }
  return selected;
}

function selectAudio(audios) {
  if (!Array.isArray(audios)) return null;
  var selected = null;
  for (var index = 0; index < audios.length; index++) {
    if (!mediaUrl(audios[index])) continue;
    if (!selected || numberValue(audios[index].bandwidth) > numberValue(selected.bandwidth)) selected = audios[index];
  }
  return selected;
}

function expiresAt(urls) {
  var deadline = 0;
  for (var index = 0; index < urls.length; index++) {
    var match = /[?&]deadline=([0-9]{9,12})/i.exec(String(urls[index] || ""));
    if (!match) continue;
    var value = Number(match[1]) * 1000;
    if (value > 0 && (!deadline || value < deadline)) deadline = value;
  }
  return deadline;
}

function viewResources(payload, request) {
  var data = payload && payload.data;
  if (!data || payload.code !== 0) return [];
  var bvid = bvidValue(data.bvid) || requestBvid(request);
  if (!bvid) return [];

  var pages = Array.isArray(data.pages) && data.pages.length ? data.pages : [{cid: data.cid, page: 1, part: "", duration: data.duration}];
  var result = [];
  for (var index = 0; index < pages.length; index++) {
    var page = pages[index] || {};
    var cid = String(page.cid || "");
    if (!cid) continue;
    var pageNumber = Number(page.page) || index + 1;
    var title = stringValue(data.title).trim() || "Bilibili 视频 " + bvid;
    if (pages.length > 1) {
      title += " - P" + pageNumber;
      if (stringValue(page.part).trim()) title += " " + page.part.trim();
    }
    var owner = data.owner || {};
    result.push({
      groupKey: groupKey(bvid, cid),
      kind: "media.video",
      title: title,
      coverUrl: stringValue(data.pic),
      requiredTracks: ["video", "audio"],
      capabilities: ["download"],
      metadata: {
        platform: "bilibili",
        bvid: bvid,
        aid: String(data.aid || ""),
        cid: cid,
        page: pageNumber,
        author: stringValue(owner.name),
        duration: numberValue(page.duration || data.duration)
      },
      source: sourceFor(bvid, pageNumber)
    });
  }
  return result;
}

function playResource(payload, request, pageContext) {
  var data = payload && (payload.data || payload.result);
  if (!data || payload.code !== 0 || !data.dash) return [];
  var context = pageContext || {};
  var bvid = requestBvid(request) || bvidValue(context.bvid);
  var cid = queryValue(request.url, "cid") || String(context.cid || "");
  if (!bvid || !cid) return [];

  var video = selectVideo(data.dash.video, data.quality);
  var audio = selectAudio(data.dash.audio);
  if (!video || !audio) return [];

  var videoUrl = mediaUrl(video);
  var audioUrl = mediaUrl(audio);
  var pageNumber = Number(queryValue(request.url, "p")) || Number(context.pageNumber) || 1;
  var headers = {Referer: canonicalPageUrl(bvid, pageNumber)};
  var videoMime = stringValue(video.mimeType || video.mime_type) || "video/mp4";
  var audioMime = stringValue(audio.mimeType || audio.mime_type) || "audio/mp4";
  var videoQuality = qualityLabel(video.id);
  var expiration = expiresAt([videoUrl, audioUrl]);

  return [{
    groupKey: groupKey(bvid, cid),
    kind: "media.video",
    tracks: [
      {
        id: "video",
        role: "video",
        executor: "http-file",
        url: videoUrl,
        mime: videoMime,
        extension: ".m4s",
        quality: videoQuality,
        width: numberValue(video.width),
        height: numberValue(video.height),
        bitrate: numberValue(video.bandwidth),
        codecs: stringValue(video.codecs),
        headers: headers
      },
      {
        id: "audio",
        role: "audio",
        executor: "http-file",
        url: audioUrl,
        mime: audioMime,
        extension: ".m4a",
        quality: numberValue(audio.bandwidth) ? Math.round(numberValue(audio.bandwidth) / 1000) + "K" : "",
        bitrate: numberValue(audio.bandwidth),
        codecs: stringValue(audio.codecs),
        headers: headers
      }
    ],
    requiredTracks: ["video", "audio"],
    capabilities: ["download", "preview", "open", "copy"],
    preview: {renderer: "video", mode: "range-proxy", mime: videoMime, codecs: stringValue(video.codecs), trackId: "video"},
    technical: {mime: "video/mp4", container: "mp4", codecs: [stringValue(video.codecs), stringValue(audio.codecs)].filter(Boolean).join(",")},
    lifecycle: expiration ? {expiresAt: expiration} : {},
    metadata: {
      platform: "bilibili",
      bvid: bvid,
      cid: String(cid),
      quality: videoQuality,
      videoCodec: stringValue(video.codecs),
      audioCodec: stringValue(audio.codecs)
    },
    source: sourceFor(bvid, pageNumber)
  }];
}

function pageResources(html, request) {
  var initial = extractAssignedJSON(html, "window.__INITIAL_STATE__");
  var playInfo = extractAssignedJSON(html, "window.__playinfo__");
  var videoData = initial && initial.videoData;
  if (!videoData || !playInfo) return [];

  var bvid = bvidValue(videoData.bvid) || requestBvid(request);
  var cid = String(videoData.cid || "");
  var pageNumber = 1;
  var pages = Array.isArray(videoData.pages) ? videoData.pages : [];
  for (var index = 0; index < pages.length; index++) {
    if (String((pages[index] || {}).cid || "") === cid) {
      pageNumber = Number(pages[index].page) || index + 1;
      break;
    }
  }

  var resources = viewResources({code: 0, data: videoData}, request);
  var playable = playResource(playInfo, request, {bvid: bvid, cid: cid, pageNumber: pageNumber});
  for (var playableIndex = 0; playableIndex < playable.length; playableIndex++) resources.push(playable[playableIndex]);
  return resources;
}

function isBilibiliMediaObservation(request) {
  var host = String(request.host || "").split(":")[0].toLowerCase();
  var path = String(request.path || "").toLowerCase();
  var comSuffix = ".bilivideo.com";
  var cnSuffix = ".bilivideo.cn";
  var isMediaHost = host.slice(-comSuffix.length) === comSuffix || host.slice(-cnSuffix.length) === cnSuffix;
  return isMediaHost && path.indexOf(".m4s") >= 0;
}

function isBilibiliDetailNoise(request) {
  var host = String(request.host || "").split(":")[0].toLowerCase();
  var path = String(request.path || "").toLowerCase();
  var refererBvid = bvidValue(firstHeader(request.headers, "referer"));
  if (!refererBvid) return false;
  if (host === "api.bilibili.com") {
    return path.indexOf("/x/v2/dm/") === 0 || path.indexOf("/x/v2/subtitle/") === 0;
  }
  var imageSuffix = ".hdslb.com";
  return host.slice(-imageSuffix.length) === imageSuffix && path.indexOf("/bfs/") === 0;
}

function onObservation(observation) {
  var request = observation.request || {};
  if (isBilibiliMediaObservation(request) || isBilibiliDetailNoise(request)) return {decision: "continue", handled: true};

  var response = observation.response || {};
  if (response.statusCode !== 200 || !response.body || response.truncated) return {decision: "continue"};

  var path = String(request.path || "");
  var resources = [];
  if (String(request.host || "").split(":")[0].toLowerCase() === "www.bilibili.com" && path.indexOf("/video/") === 0) {
    resources = pageResources(response.body, request);
  } else {
    var payload = parsePayload(response.body);
    if (!payload) return {decision: "continue"};
    if (path.indexOf("/x/web-interface/view") === 0) resources = viewResources(payload, request);
    else if (path.indexOf("/x/player/") === 0 && path.indexOf("playurl") >= 0) resources = playResource(payload, request);
  }
  return {decision: "continue", handled: resources.length > 0, resources: resources};
}

function createDownloadPlan(input) {
  var tracks = (input.resource || {}).tracks || [];
  var video = null;
  var audio = null;
  for (var index = 0; index < tracks.length; index++) {
    if (!video && tracks[index].role === "video") video = tracks[index];
    if (!audio && tracks[index].role === "audio") audio = tracks[index];
  }
  if (!video) return null;

  var videoInput = {
    id: video.id || "video",
    executor: video.executor || "http-file",
    url: video.url,
    headers: video.headers || {},
    extension: video.extension || ".m4s",
    processors: video.processors || []
  };
  if (!audio) {
    return {inputs: [videoInput], output: {input: videoInput.id, extension: ".mp4", mime: "video/mp4"}};
  }

  var audioInput = {
    id: audio.id || "audio",
    executor: audio.executor || "http-file",
    url: audio.url,
    headers: audio.headers || {},
    extension: audio.extension || ".m4a",
    processors: audio.processors || []
  };
  return {
    inputs: [videoInput, audioInput],
    pipeline: [{id: "muxed", executor: "builtin.media.mux", inputs: [videoInput.id, audioInput.id], options: {extension: ".mp4"}}],
    output: {input: "muxed", extension: ".mp4", mime: "video/mp4"}
  };
}

function refreshResource(input) {
  return {
    status: "recaptureRequired",
    resource: input.resource,
    message: "播放地址已过期，请重新打开对应的 Bilibili 视频详情页。"
  };
}
