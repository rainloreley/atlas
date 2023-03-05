const { WebSocket, WebSocketServer } = require("ws");
const ip = require("ip");
const {ipcRenderer} = require("electron")
const path = require("path");
const { deserialize } = require("bson");
const fs = require("fs")

let videoFolderPath = "";
var videoplayer = document.getElementById("videoplayer");;
var wsPort = "";

var globalWebSocket;

var videoplayingUpdateInterval;

var incomingUploadFileName = "";

window.onerror = function (msg, url, lineNo, columnNo, error) {
    // ... handle error ...
    console.log(msg);

    return false;
}

videoplayer.addEventListener("ended", () =>{
    clearInterval(videoplayingUpdateInterval);
    if (globalWebSocket !== undefined) {
        globalWebSocket.send("videoended")

    }
})

window.addEventListener('DOMContentLoaded', () => {

    showConnectionWindow();

    //wsPort = Math.floor(100000 + Math.random() * 900000)
    //wsPort = wsPort.toString().substring(0, 4);

    const wss = new WebSocketServer({ port: 12034, maxPayload: 1e10 })

    console.log("Listening on " + wsPort)

    wss.on("connection", function(ws) {
        globalWebSocket = ws;
        connectionStatusChanged(ws._socket.remoteAddress, ws);
        ws.on("error", console.error);

        ws.on("message", function message(message, isBinary) {
            if (!isBinary) {
                data = message.toString();
                if (data.toString().startsWith("play:")) {
                    const splittedCommand = data.split(":")
                    const encodedFileName = splittedCommand[1];
                    const fileName = decodeURIComponent(atob(encodedFileName));
                    playVideo("file://" + path.join(videoFolderPath, fileName));
                }
                else if (data.startsWith("load:")) {
                    const splittedCommand = data.split(":")
                    const encodedFileName = splittedCommand[1];
                    const fileName = decodeURIComponent(atob(encodedFileName));
                    loadVideo("file://" + path.join(videoFolderPath, fileName));
                }
                else if (data.startsWith("uploadfile:")) {
                    const splittedCommand = data.split(":")
                    const encodedFileName = splittedCommand[1];
                    const fileName = decodeURIComponent(atob(encodedFileName));
                    incomingUploadFileName = fileName;
                }
                else if (data == "pause") {
                    pauseVideo();
                }
                else if (data == "resume") {
                    resumeVideo();
                }
                else if (data == "unload") {
                    unloadVideo();
                }
                else if (data == "fetchvideos") {
                    fetchVideoData(ws);
                }
                else if (data.toString().startsWith("settime:")) {
                    const splittedCommand = data.split(":")
                    const time = splittedCommand[1];
                    setTimeInVideo(time);
                }
            }
            else {
                if (incomingUploadFileName != "") {
                    console.log("Receiving binary file...")
                    //const dataFromClient = deserialize(message, {promoteBuffers: true}) // edited
                    fs.writeFile(
                        path.join(videoFolderPath, incomingUploadFileName),
                        message, // edited
                        'binary',
                        (err) => {
                            console.log('ERROR!!!!', err);
                        }
                    );
                }
            }
        })
    });
});

function showConnectionWindow() {
    const localiptext = document.getElementById("localip")
    const folderpathtext = document.getElementById("folderpath")
    localiptext.innerHTML = ip.address()
    ipcRenderer.invoke("get-video-data-foldername").then(result => {
        videoFolderPath = result;
        folderpathtext.innerHTML = videoFolderPath;
    })
}

function connectionStatusChanged(clientip, ws) {
    fetchVideoData(ws);
    const noconnectionwindow = document.getElementById("noconnectionwindow");
    const connectionestablishedwindow = document.getElementById("connectionestablishedwindow");
    const videoplayerwindow = document.getElementById("videoplayerwindow");
    const connectedclientiptext = document.getElementById("connectedip");
    noconnectionwindow.style.display = "none";
    connectionestablishedwindow.style.display = "flex";
    connectedclientiptext.innerHTML = "Verbunden mit: " + clientip;
    setTimeout(() => {
        connectionestablishedwindow.style.display = "none";
        videoplayerwindow.style.display = "block";
        setupVideoplayer();
    }, 1000);
}

function fetchVideoData(ws) {
    ipcRenderer.invoke("get-all-videos").then(async (result) => {
        const jsonArray = JSON.parse(result);
        var videoData = [];

        // get duration of video
        const loadVideo = file => new Promise((resolve, reject) => {
            try {
                const fullpath = path.join(videoFolderPath, file);
                let video = document.createElement('video')
                video.preload = 'metadata'

                video.onloadedmetadata = function () {
                    window.URL.revokeObjectURL(video.src)
                    var duration = video.duration
                    resolve(duration)
                }

                video.onerror = function () {
                    reject("Invalid video. Please select a video file.")
                }

                video.src = `file://${fullpath}`
            } catch (e) {
                reject(e)
            }
        })

        for (var video of jsonArray) {
            const duration = await loadVideo(video.filename)
            videoData.push({
                "hash": video.hash,
                "filename": video.filename,
                "duration": duration
            })
        }

        // package video data for transport and send it to controller
        const jsonString = JSON.stringify(videoData);
        const base64 = btoa(encodeURIComponent(jsonString));
        ws.send(`videoarray:${base64}`)
    });
}

function setupVideoplayer() {
    videoplayer.removeAttribute('controls');
    //videoplayer.requestFullscreen();
}

function loadVideo(path) {
    videoplayer.style.display = "block";
    videoplayer.src = path;
    videoplayer.load();
    setupVideoCallback();
}

function setupVideoCallback() {
    if (videoplayingUpdateInterval !== undefined) {
        clearInterval(videoplayingUpdateInterval);
    }
    videoplayingUpdateInterval = setInterval(() => {
        globalWebSocket.send("currenttime:" + videoplayer.currentTime);

        // get current frame
        var canvas = document.createElement("canvas");
        canvas.width = videoplayer.videoWidth;
        canvas.height = videoplayer.videoHeight;
        var canvasContext = canvas.getContext("2d")
        canvasContext.drawImage(videoplayer, 0, 0);
        const dataUrl = canvas.toDataURL("image/png", 0.4);
        const encodedData = btoa(encodeURIComponent(dataUrl));
        globalWebSocket.send("currentframe:" + encodedData)

    }, 500);
}

function playVideo(path) {

    try {
        videoplayer.style.display = "block";
        //videoplayer.requestFullscreen();
        console.log(path);
        videoplayer.src = path;
        videoplayer.load();
        videoplayer.play();
    }
    catch(err) {
        console.log(err);
    }
    setupVideoCallback();
}

function pauseVideo() {
    videoplayer.pause();
    clearInterval(videoplayingUpdateInterval)
}

function resumeVideo() {
    videoplayer.play();
    setupVideoCallback();
}

function setTimeInVideo(seconds) {
    videoplayer.currentTime = seconds
}

function unloadVideo() {
    videoplayer.pause();
    clearInterval(videoplayingUpdateInterval);
    videoplayer.currentTime = 0;
    videoplayer.style.display = "none";
}