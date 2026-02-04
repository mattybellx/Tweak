import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('systemApi', {
  getSnapshot: () => ipcRenderer.invoke('system:getSnapshot'),
  getIssues: () => ipcRenderer.invoke('system:getIssues'),
  getAiAssessment: () => ipcRenderer.invoke('system:getAiAssessment'),
  downloadModel: (url?: string) => ipcRenderer.invoke('system:downloadModel', url),
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: DownloadProgress) => callback(progress);
    ipcRenderer.on('system:downloadProgress', handler);
    return () => ipcRenderer.removeListener('system:downloadProgress', handler);
  },
  openLogWindow: () => ipcRenderer.invoke('log:open'),
  writeLog: (message: string) => ipcRenderer.send('log:write', message)
});

contextBridge.exposeInMainWorld('logApi', {
  onLog: (callback: (entry: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, entry: string) => callback(entry);
    ipcRenderer.on('log:entry', handler);
    return () => ipcRenderer.removeListener('log:entry', handler);
  }
});

interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
}
