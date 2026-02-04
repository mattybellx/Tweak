/// <reference types="vite/client" />

declare global {
  interface Window {
    systemApi: {
      getSnapshot: () => Promise<SystemSnapshot>;
      getIssues: () => Promise<Issue[]>;
      getAiAssessment: () => Promise<AiAssessment>;
      downloadModel: (url?: string) => Promise<DownloadResult>;
      onDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void;
      openLogWindow: () => Promise<void>;
      writeLog: (message: string) => void;
    };
    logApi?: {
      onLog: (callback: (entry: string) => void) => () => void;
    };
  }
}

export {};

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

interface AiAssessment {
  available: boolean;
  status: string;
  summary: string;
  details: string;
  modelPath?: string;
  binaryPath?: string;
}

interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
}

interface DownloadResult {
  ok: boolean;
  message: string;
  modelPath: string;
}
