"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("systemApi", {
  getSnapshot: () => electron.ipcRenderer.invoke("system:getSnapshot"),
  getIssues: () => electron.ipcRenderer.invoke("system:getIssues"),
  getAiAssessment: () => electron.ipcRenderer.invoke("system:getAiAssessment"),
  downloadModel: (url) => electron.ipcRenderer.invoke("system:downloadModel", url),
  onDownloadProgress: (callback) => {
    const handler = (_event, progress) => callback(progress);
    electron.ipcRenderer.on("system:downloadProgress", handler);
    return () => electron.ipcRenderer.removeListener("system:downloadProgress", handler);
  },
  openLogWindow: () => electron.ipcRenderer.invoke("log:open"),
  writeLog: (message) => electron.ipcRenderer.send("log:write", message)
});
electron.contextBridge.exposeInMainWorld("logApi", {
  onLog: (callback) => {
    const handler = (_event, entry) => callback(entry);
    electron.ipcRenderer.on("log:entry", handler);
    return () => electron.ipcRenderer.removeListener("log:entry", handler);
  }
});
