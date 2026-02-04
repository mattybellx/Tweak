import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import si from 'systeminformation';
import { analyzeWithLocalAi, downloadModel, readConfig } from './ai';

let mainWindow: BrowserWindow | null = null;
let logWindow: BrowserWindow | null = null;

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 720,
    title: 'Tweak Diagnostics',
    backgroundColor: '#0b0f1a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js')
    }
  });

  mainWindow = win;

  const devUrl = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });
};

const emitLog = (message: string) => {
  const entry = `[${new Date().toLocaleTimeString()}] ${message}`;
  mainWindow?.webContents.send('log:entry', entry);
  logWindow?.webContents.send('log:entry', entry);
};

const openLogWindow = () => {
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.focus();
    return;
  }

  logWindow = new BrowserWindow({
    width: 720,
    height: 520,
    title: 'Tweak Diagnostics Logs',
    backgroundColor: '#0a0d16',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js')
    }
  });

  logWindow.loadFile(path.join(__dirname, '../renderer/log.html'));
  logWindow.on('closed', () => {
    logWindow = null;
  });
};

const buildIssues = (snapshot: SystemSnapshot): Issue[] => {
  const issues: Issue[] = [];

  if (snapshot.cpuLoad > 90) {
    issues.push({
      id: 'cpu-load',
      severity: 'Critical',
      title: 'CPU load extremely high',
      description: `Average CPU load is ${snapshot.cpuLoad.toFixed(1)}%. This can cause stutters and instability.`,
      recommendation: 'Close heavy tasks, check startup apps, and scan for runaway processes.'
    });
  } else if (snapshot.cpuLoad > 75) {
    issues.push({
      id: 'cpu-load-warning',
      severity: 'High',
      title: 'CPU load is elevated',
      description: `Average CPU load is ${snapshot.cpuLoad.toFixed(1)}%.`,
      recommendation: 'Review background tasks and consider performance tuning.'
    });
  }

  if (snapshot.memoryUsedPercent > 90) {
    issues.push({
      id: 'memory-pressure',
      severity: 'High',
      title: 'Memory pressure detected',
      description: `Memory usage is ${snapshot.memoryUsedPercent.toFixed(1)}%.`,
      recommendation: 'Close unused apps or consider adding more RAM.'
    });
  } else if (snapshot.memoryUsedPercent > 75) {
    issues.push({
      id: 'memory-pressure-warning',
      severity: 'Medium',
      title: 'Memory usage is above normal',
      description: `Memory usage is ${snapshot.memoryUsedPercent.toFixed(1)}%.`,
      recommendation: 'Reduce background usage to keep the system responsive.'
    });
  }

  snapshot.disks.forEach((disk, index) => {
    if (disk.usedPercent > 90) {
      issues.push({
        id: `disk-${index}-critical`,
        severity: 'High',
        title: `Disk space low on ${disk.mount}`,
        description: `Disk usage is ${disk.usedPercent.toFixed(1)}% (${disk.used}/${disk.size} GB used).`,
        recommendation: 'Free up disk space or move large files to external storage.'
      });
    } else if (disk.usedPercent > 80) {
      issues.push({
        id: `disk-${index}-warning`,
        severity: 'Medium',
        title: `Disk usage rising on ${disk.mount}`,
        description: `Disk usage is ${disk.usedPercent.toFixed(1)}% (${disk.used}/${disk.size} GB used).`,
        recommendation: 'Consider cleaning temporary files and uninstalling unused apps.'
      });
    }
  });

  if (issues.length === 0) {
    issues.push({
      id: 'all-good',
      severity: 'Low',
      title: 'System health looks good',
      description: 'No critical issues detected in the current snapshot.',
      recommendation: 'Run periodic checks and keep drivers up to date.'
    });
  }

  return issues;
};

const getSystemSnapshot = async (): Promise<SystemSnapshot> => {
  const [osInfo, cpu, mem, load, disks] = await Promise.all([
    si.osInfo(),
    si.cpu(),
    si.mem(),
    si.currentLoad(),
    si.fsSize()
  ]);

  const diskInfo = disks.map((disk) => {
    const sizeGb = disk.size / (1024 ** 3);
    const usedGb = disk.used / (1024 ** 3);
    return {
      mount: disk.mount || disk.fs,
      size: Number(sizeGb.toFixed(1)),
      used: Number(usedGb.toFixed(1)),
      usedPercent: Number(disk.use.toFixed(1))
    };
  });

  const memoryUsedPercent = ((mem.total - mem.available) / mem.total) * 100;

  const computedLoad = 100 - (load.currentLoadIdle ?? 0);
  const cpuLoad = Number(
    (Number.isFinite(computedLoad) ? computedLoad : load.currentLoad ?? 0).toFixed(1)
  );

  return {
    os: `${osInfo.distro} ${osInfo.release}`,
    cpuModel: `${cpu.manufacturer} ${cpu.brand}`,
    memoryTotalGb: Number((mem.total / (1024 ** 3)).toFixed(1)),
    memoryUsedPercent: Number(memoryUsedPercent.toFixed(1)),
    cpuLoad: Math.max(0, Math.min(100, cpuLoad)),
    disks: diskInfo,
    uptimeHours: Number((osInfo.uptime / 3600).toFixed(1))
  };
};

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('system:getSnapshot', async () => getSystemSnapshot());
  ipcMain.handle('system:getIssues', async () => {
    const snapshot = await getSystemSnapshot();
    return buildIssues(snapshot);
  });
  ipcMain.handle('system:getAiAssessment', async () => {
    const snapshot = await getSystemSnapshot();
    const issues = buildIssues(snapshot);
    return analyzeWithLocalAi({ snapshot, issues });
  });
  ipcMain.handle('system:downloadModel', async (_event, url?: string) => {
    const config = readConfig();
    const result = await downloadModel(url, (progress) => {
      mainWindow?.webContents.send('system:downloadProgress', progress);
    });
    return { ...result, modelPath: config.modelPath };
  });
  ipcMain.handle('log:open', () => {
    openLogWindow();
  });
  ipcMain.on('log:write', (_event, message: string) => {
    emitLog(message);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

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
