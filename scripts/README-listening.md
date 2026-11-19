# Listening engine development

Node 20+; no production build step. Install development tools with `npm ci`.
On PowerShell with restricted script execution, use `npm.cmd` instead of `npm`.

- `npm test` (or `node --test`): grading/schema tests, MP3 decoding/pause checks,
  and headless Microsoft Edge integration tests. Edge must be installed;
  no Playwright browser download is needed. Profiles live in the OS temp directory
  and are removed after each run. A test-only Node server overlays the original
  fixture at the content URLs; it never writes to the content catalogue. Markdown
  libraries are served locally in this test overlay, using the same pinned versions
  as the production CDN scripts. Screenshots go to ignored `test-artifacts/`.
- `npm run check`: site links, JavaScript syntax, manifest and listening schemas.
  The content catalogue is optional until supplied by the content teammate; once
  listed, each test JSON must exist. Missing production MP3s are supported by the UI.
- `npm run audio -- content/ielts-gt/listening/gt-l-01.json`: build one test.
- `npm run audio -- --all`: build every listed test; add `--force` to regenerate.
- `npm run audio -- scripts/fixtures/sample-listening.json`: regenerate the small
  original fixture. Its four generated MP3s total less than 1 MB and are included
  solely for engine tests. They are never linked from the live catalogue.

The builder maps the seven logical voices in `assets/js/listening-core.js` to
British, Australian and American neural voices. Script pauses become exact PCM
silence before a single final encode per part: 24 kHz, mono MP3 at 48 kbps. The
builder retries synthesis twice, times out stalled requests, skips MP3s newer
than the input JSON, and replaces an output only after successful synthesis.
`FFMPEG_PATH` can point to an installed FFmpeg instead of the development binary.
When regenerating the fixture JSON with `node scripts/fixtures/make-sample.mjs`,
also regenerate its audio because the source modification time changes.

Default provider: `LISTENING_TTS=edge`, using the
[MIT-licensed msedge-tts client](https://github.com/Migushthe2nd/MsEdgeTTS).
It calls Microsoft's Edge Read Aloud service. The client licence applies to
the wrapper code; it does not grant a licence to Microsoft's service or promise
ongoing access or audio redistribution rights. Check the applicable Microsoft
service terms before publishing generated audio. The builder sends the script
text to the selected provider.

Alternative: set `LISTENING_TTS=azure`, `AZURE_SPEECH_REGION` and
`AZURE_SPEECH_KEY` in your shell, then run the same command. This uses the
[official Azure Speech REST API](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech)
and requires an Azure Speech account; its service terms and pricing apply.
The Azure path is implemented but has not been exercised without credentials.
Keys are read from environment variables and never saved or printed.

FFmpeg is a development tool, never shipped to browsers. The
[ffmpeg-static package](https://github.com/eugeneware/ffmpeg-static) is GPL-3.0-or-later;
binary licensing depends on the included build. Preserve relevant licences if
redistributing tooling binaries. Generated media does not contain the FFmpeg binary.

Styling handoff: all `.lt-*`, `.gt-*` and `.top-menu*` hooks follow the shared
specification. `assets/css/listening.css` provides wrapping, minimum touch sizes,
focus/selection and disclosure positioning while reusing Aero tokens and `.aero-btn`.
Add final visual styling using those hooks. Input feedback and transcript use
escaped text; no lesson text is interpreted as HTML. Tabs select question papers;
in exam mode they never seek or change the audio sequence. Full feedback and the
transcript are revealed per part after submission. Multi-choice sets use one
shared checkbox list, stored under their first question number.
