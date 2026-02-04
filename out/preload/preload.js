"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("systemApi", {
  getSnapshot: () => electron.ipcRenderer.invoke("system:getSnapshot"),
  getIssues: () => electron.ipcRenderer.invoke("system:getIssues")
});
