/**
 * recorder.js — 녹음 독립 모듈 (WBS 3.6)
 *
 * 아키텍처 결정(CLAUDE.md): 녹음과 업로드는 독립 모듈로 구현한다.
 * 플랫폼별 포맷 문제(아이폰 m4a / 그 외 webm)가 생겨도 이 파일만 교체하면 된다.
 * 화면 코드는 window.Recorder의 공개 API만 사용할 것.
 *
 * 공개 API:
 *   Recorder.isSupported()            → boolean
 *   Recorder.start()                  → Promise (마이크 권한 요청 포함)
 *   Recorder.stop()                   → Promise<{blob, mimeType, durationSec}>
 *   Recorder.cancel()                 → 녹음 파기
 *   Recorder.blobToBase64(blob)       → Promise<base64 문자열(data: 접두어 제외)>
 */
window.Recorder = (function () {
  var mediaRecorder = null, stream = null, chunks = [], startedAt = 0, mimeType = '';

  // 플랫폼별 지원 포맷 탐색 — 아이폰 사파리는 mp4, 그 외 대부분 webm
  function pickMime() {
    var candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
    for (var i = 0; i < candidates.length; i++) {
      if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
    }
    return '';
  }

  function isSupported() {
    return typeof MediaRecorder !== 'undefined' &&
      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function start() {
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      stream = s;
      chunks = [];
      mimeType = pickMime();
      mediaRecorder = mimeType ? new MediaRecorder(s, { mimeType: mimeType }) : new MediaRecorder(s);
      mimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
      mediaRecorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      mediaRecorder.start(1000); // 1초 단위 청크 — 중단돼도 데이터 보존
      startedAt = Date.now();
    });
  }

  function releaseStream() {
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
  }

  function stop() {
    return new Promise(function (resolve, reject) {
      if (!mediaRecorder) { reject(new Error('녹음 중이 아니에요')); return; }
      mediaRecorder.onstop = function () {
        var blob = new Blob(chunks, { type: mimeType });
        var durationSec = Math.round((Date.now() - startedAt) / 1000);
        releaseStream();
        mediaRecorder = null;
        resolve({ blob: blob, mimeType: mimeType, durationSec: durationSec });
      };
      try { mediaRecorder.stop(); } catch (e) { releaseStream(); reject(e); }
    });
  }

  function cancel() {
    try { if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); } catch (e) {}
    mediaRecorder = null;
    chunks = [];
    releaseStream();
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  return { isSupported: isSupported, start: start, stop: stop, cancel: cancel, blobToBase64: blobToBase64 };
})();
