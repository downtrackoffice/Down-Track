const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("downtrack", {
  download: (job) => ipcRenderer.invoke("dt:download", job),
  updateEngine: () => ipcRenderer.invoke("dt:update"),
  onProgress: (cb) => ipcRenderer.on("dt:progress", (_e, data) => cb(data)),
});
