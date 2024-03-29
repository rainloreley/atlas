// Modules to control application life and create native browser window
const {app, BrowserWindow, ipcMain} = require('electron')
const path = require('path')
const electron = require("electron");
const fs = require("fs");
const crypto = require("crypto");

var mainWindow = null;

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
  })

  // and load the index.html of the app.
  mainWindow.loadFile('app/index.html')

  // Open the DevTools.
  //mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

ipcMain.handle("get-video-data-foldername", async (_) => {
  const userDataFolder = electron.app.getPath("videos");
  const videoDataFolder = path.join(userDataFolder, "atlasvideos")
  if (!fs.existsSync(videoDataFolder)) {
    fs.mkdirSync(videoDataFolder);
  }
  return videoDataFolder
})

ipcMain.handle("get-all-videos", async (_) => {
  const userDataFolder = electron.app.getPath("videos");
  const videoDataFolder = path.join(userDataFolder, "atlasvideos")

  const overlayFilePath = path.join(videoDataFolder, "overlay.html")
  if (!fs.existsSync(overlayFilePath)) {
    var writeStream = fs.createWriteStream(overlayFilePath);
    writeStream.write("<p>Bearbeite overlay.html im Videoordner, um das Overlay zu ändern</p>");
    writeStream.end();
  }


  const allFiles = fs.readdirSync(videoDataFolder);
  var videos = [];
  for (var file of allFiles) {
    const fullpath = path.join(videoDataFolder, file);
    // calculate the hash that can be used as an ID by the controller
    // in case a file name changes
    const fileBuffer = fs.readFileSync(fullpath);
    const hashSum = crypto.createHash("sha1");
    hashSum.update(fileBuffer)

    const hex = hashSum.digest("hex");

    videos.push({
      "hash": hex,
      "filename": file
    });

  }

  return JSON.stringify(videos);
});

ipcMain.handle("read-overlay", async (_, args) => {
  const userDataFolder = electron.app.getPath("videos");
  const videoDataFolder = path.join(userDataFolder, "atlasvideos")
  const overlayFilePath = path.join(videoDataFolder, "overlay.html")
  try {
    const contents = fs.readFileSync(overlayFilePath, 'utf-8');
    return contents
  }
  catch {
    return "";
  }
});
