# Tweak Diagnostics

AI-assisted desktop diagnostics app that scans system health and presents issues in a professional UI.

## Scripts

- `npm run dev` — start Electron + Vite dev server
- `npm run build` — build the desktop app
- `npm run preview` — preview the renderer build

## Features (current)

- Live system snapshot (CPU, memory, disk, OS)
- Prioritized issues list (Critical → Low)
- Memory and disk utilization charts
- Local AI assessment (offline, on-device only)

## Local AI Setup (Windows)

This app uses a local llama.cpp engine. No signup or API key required.

1) Place a high-quality GGUF model at:
	C:\ProgramData\Tweak\models\tweak-13b-q8_0.gguf
2) Place the llama.cpp binary at:
	C:\ProgramData\Tweak\bin\llama.exe
	(or use llama-cli.exe if that’s what your zip provides)
3) Adjust settings in ai.config.json if you want a different path or model.

Recommended: keep the model external (download once) to avoid a 14–16 GB installer.
The app now includes a built-in downloader. Paste a direct GGUF URL in the AI panel to fetch it.
Set a direct GGUF URL in ai.config.json (modelDownloadUrl) so the in-app Download button works without user input.

## Data Handling Rules

- All diagnostics and AI analysis run locally.
- No system data leaves the machine.
- No network calls are made by the AI engine.
- You can disable AI by removing the local model or binary.

## Next Steps

- Add continuous scan scheduling
- Surface per-process diagnostics
- Integrate AI recommendations
