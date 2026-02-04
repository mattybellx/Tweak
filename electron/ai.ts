import { app } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';

export interface AiConfig {
  engine: 'llama.cpp';
  modelPath: string;
  binaryPath: string;
  modelDownloadUrl: string;
  contextTokens: number;
  temperature: number;
  maxTokens: number;
}

export interface AiAssessment {
  available: boolean;
  status: string;
  summary: string;
  details: string;
  modelPath?: string;
  binaryPath?: string;
}

export const readConfig = (): AiConfig => {
  const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();
  const configPath = path.join(basePath, 'ai.config.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as AiConfig;
};

export interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
}

export interface DownloadResult {
  ok: boolean;
  message: string;
  modelPath: string;
}

export const downloadModel = async (
  url: string | undefined,
  onProgress?: (progress: DownloadProgress) => void
): Promise<DownloadResult> => {
  const config = readConfig();
  const targetDir = path.dirname(config.modelPath);
  fs.mkdirSync(targetDir, { recursive: true });
  const downloadUrl = url?.trim() || config.modelDownloadUrl?.trim();

  return new Promise((resolve) => {
    if (!downloadUrl) {
      resolve({ ok: false, message: 'Model URL is required.', modelPath: config.modelPath });
      return;
    }

    const request = https.get(downloadUrl, (res) => {
      if (res.statusCode !== 200) {
        resolve({
          ok: false,
          message: `Download failed (HTTP ${res.statusCode}).`,
          modelPath: config.modelPath
        });
        res.resume();
        return;
      }

      const totalBytes = Number(res.headers['content-length'] ?? 0);
      let downloadedBytes = 0;
      const fileStream = fs.createWriteStream(config.modelPath);

      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0 && onProgress) {
          onProgress({
            downloadedBytes,
            totalBytes,
            percent: Math.round((downloadedBytes / totalBytes) * 100)
          });
        }
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve({ ok: true, message: 'Model download completed.', modelPath: config.modelPath });
      });

      fileStream.on('error', (error) => {
        resolve({ ok: false, message: error.message, modelPath: config.modelPath });
      });
    });

    request.on('error', (error) => {
      resolve({ ok: false, message: error.message, modelPath: config.modelPath });
    });
  });
};

const runLlama = (config: AiConfig, prompt: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const threads = Math.max(4, Math.floor(os.cpus().length / 2));
    const args = [
      '--model',
      config.modelPath,
      '--prompt',
      prompt,
      '--n-predict',
      String(config.maxTokens),
      '--temp',
      String(config.temperature),
      '--ctx-size',
      String(config.contextTokens),
      '--threads',
      String(threads),
      '--no-display-prompt',
      '--log-disable'
    ];

    execFile(config.binaryPath, args, { timeout: 120000, windowsHide: true }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });
  });
};

export const analyzeWithLocalAi = async (input: {
  snapshot: SystemSnapshot;
  issues: Issue[];
}): Promise<AiAssessment> => {
  const config = readConfig();

  const modelExists = fs.existsSync(config.modelPath);
  const binaryExists = fs.existsSync(config.binaryPath);

  if (!modelExists || !binaryExists) {
    return {
      available: false,
      status: 'Local AI not configured',
      summary: 'Add the local model and engine to enable AI insights.',
      details: 'Place llama.exe and a 13B GGUF model at the paths in ai.config.json. The app runs fully offline once present.',
      modelPath: config.modelPath,
      binaryPath: config.binaryPath
    };
  }

  const prompt = `You are a local system health analyst. Summarize the key risks and priority actions.

Snapshot:
- OS: ${input.snapshot.os}
- CPU: ${input.snapshot.cpuModel}, Load ${input.snapshot.cpuLoad}%
- Memory: ${input.snapshot.memoryTotalGb} GB total, ${input.snapshot.memoryUsedPercent}% used
- Disks: ${input.snapshot.disks.map((d) => `${d.mount} ${d.usedPercent}%`).join(', ')}

Issues:
${input.issues.map((issue) => `- (${issue.severity}) ${issue.title}: ${issue.description}`).join('\n')}

Return:
1) One-sentence summary
2) Top 3 actions as bullets
3) Risks if ignored
`;

  try {
    const output = await runLlama(config, prompt);
    return {
      available: true,
      status: 'Local AI active',
      summary: output.split('\n').slice(0, 2).join(' ').trim() || 'AI analysis completed.',
      details: output || 'No AI output produced.',
      modelPath: config.modelPath,
      binaryPath: config.binaryPath
    };
  } catch (error) {
    return {
      available: false,
      status: 'Local AI error',
      summary: 'AI engine failed to run on this machine.',
      details: error instanceof Error ? error.message : 'Unknown error running llama.cpp.',
      modelPath: config.modelPath,
      binaryPath: config.binaryPath
    };
  }
};

type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

interface Issue {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
}

interface DiskSnapshot {
  mount: string;
  size: number;
  used: number;
  usedPercent: number;
}

interface SystemSnapshot {
  os: string;
  cpuModel: string;
  memoryTotalGb: number;
  memoryUsedPercent: number;
  cpuLoad: number;
  disks: DiskSnapshot[];
  uptimeHours: number;
}
