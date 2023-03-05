import Head from 'next/head'
import {Inter} from 'next/font/google'
// @ts-ignore
import {Check, ChevronDown, ChevronUp, Edit3, Monitor, Play, X, Youtube, AlertTriangle, DownloadCloud, Trash2, VideoOff, Eye, EyeOff} from "feather-icons-react";
import {FunctionComponent, useContext, useState, useEffect, useRef, ChangeEventHandler} from "react";
import {AppControlContext, NotificationCenterElementStatus} from "@/appContextProvider";
// @ts-ignore
import {v4 as uuidv4} from 'uuid';
import styles from "../styles/Home.module.css"
import { Buffer } from 'buffer';

const inter = Inter({ subsets: ['latin'] })

interface PlayingVideo {
    video: string | null,
    status: VideoStatus,
    position: number,
    pictureData: string
}

enum VideoStatus {
    none,
    loaded,
    playing,
    paused
}

export default function Home() {

    const {addNotification} = useContext(AppControlContext);

    const [serverIP, setServerIP] = useState("");
    const [ipInvalid, setIpInvalid] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    const [videoList, _setVideoList] = useState<VideoListEntry[]>([]);

    // useRef is needed here because videoList is used in an event listener of the websocket
    // event listeners pull the state of the variable on initializing, but don't update them
    // useRef bypasses this
    // functions inside the event listener (or called by it) must ust `videoListRef.current` instead of `videoList`
    const videoListRef = useRef(videoList);
    const setVideoList = (data: VideoListEntry[]) => {
        videoListRef.current = data;
        _setVideoList(data);
    }

    const [videoControlRangeValue, setVideoControlRangeValue] = useState<number | null | undefined>(null);

    const [playingVideo, _setPlayingVideo] = useState<PlayingVideo>({video: null, status: VideoStatus.none, position: 0, pictureData: ""});
    const playingVideoRef = useRef(playingVideo)
    const setPlayingVideo = (data: PlayingVideo) => {
        playingVideoRef.current = data;
        _setPlayingVideo(data);
    }

    const [videoPreviewEnabled, setVideoPreviewEnabled] = useState(true);

    const [ws, _setWS] = useState<WebSocket | null>(null);
    const wsRef = useRef(ws);
    const setWS = (data: WebSocket | null) => {
        wsRef.current = data;
        _setWS(data);
    }

    useEffect(() => {
        loadSavedAppData();
    }, []);

    const connectToServer = () => {
        if (serverIP.length === 0) {
            setIpInvalid(true);
            return;
        }

        const _ws = new WebSocket(`ws://${serverIP}:12034`);
        setWS(_ws);

        _ws.onopen = function(e) {
            setIsConnected(true);
            //loadSavedAppData();
        }

        _ws.onmessage = function(event) {
            const message = event.data.toString();
            if (message.startsWith("videoarray:")) {
                const splittedMessage = message.split(":")
                const encodedData = splittedMessage[1];
                processVideoArrayData(encodedData)
            }
            else if (message.startsWith("currenttime:")) {
                const splittedMessage = message.split(":")
                const currentTime = parseInt(splittedMessage[1]);

                const _tempPlayingVideoCopy = {... playingVideoRef.current};
                _tempPlayingVideoCopy.position = currentTime;
                setPlayingVideo(_tempPlayingVideoCopy);
            }
            else if (message.startsWith("currentframe:")) {
                const splittedMessage = message.split(":")
                const encodedData = splittedMessage[1];
                const pictureData = decodeURIComponent(atob(encodedData));

                const _tempPlayingVideoCopy = {... playingVideoRef.current};
                _tempPlayingVideoCopy.pictureData = pictureData;
                setPlayingVideo(_tempPlayingVideoCopy);
            }
            else if (message.startsWith("videoended")) {
                handleVideoEnd();
            }
        }

        _ws.onclose = function (event) {
            console.log("Connection closed")
            setIsConnected(false)
            setServerIP("")
        }

        _ws.onerror = function(error) {
            addNotification({uid: uuidv4(), text: "Konnte keine Verbindung herstellen", status: NotificationCenterElementStatus.error, dismissAt: 5000})
        }
    }

    const sendWSRequest = (command: string) => {
        if (wsRef.current !== null) {
            wsRef.current.send(command)
        }
    }

    const playVideo = (id: string) => {
        if (wsRef.current === null) return;
        const index = videoListRef.current.findIndex((e) => e.id == id);
        if (index == -1) return;
        const _video = videoListRef.current[index];
        const fileName = _video.filename;
        const encodedFileName = btoa(encodeURIComponent(fileName));
        sendWSRequest("play:" + encodedFileName)
        setPlayingVideo({video: _video.id, status: VideoStatus.playing, position: 0, pictureData: ""})
    }

    const loadSavedAppData = () => {
        if (typeof window !== "undefined") {
            const storedData = localStorage.getItem("userdata")
            if (storedData !== null) {
                const storedJSON = JSON.parse(storedData);
                setVideoList(storedJSON.videolist)
            }
        }
        else {
            console.log("Window undefined!")
        }
    }

    const saveAppData = (_videolist: VideoListEntry[] | undefined) => {
        if (typeof window !== "undefined") {
            const data = {
                videolist: _videolist ?? videoList
            }
            const stringJSON = JSON.stringify(data);
            localStorage.setItem("userdata", stringJSON);
        }
        else {
            console.log("Window undefined!")
        }
    }

    const processVideoArrayData = (base64String: string) => {
        const jsonString = decodeURIComponent(atob(base64String));
        const jsonData = JSON.parse(jsonString);

        var newVideos: VideoListEntry[] = [];

        for (var json of jsonData) {
            const _index = videoList.findIndex((e) => e.hash == json.hash);
            if (_index < 0) {
                // video doesn't already exit, adding to temporary list
                newVideos.push({
                    id: uuidv4(),
                    hash: json.hash,
                    position: videoList.length + newVideos.length,
                    filename: json.filename,
                    name: json.filename,
                    duration: json.duration,
                    isAvailable: true,
                    endingBehavior: VideoEndingAction.next
                })
            }
            else {
                // mark existing video as available on the server
                videoList[_index].isAvailable = true;
            }
        }

        // loop through all videos in videolist and mark the ones not available on the server as unavailable
        // @ts-ignore
        for (var [index, video] of videoList.entries()) {
            if (jsonData.findIndex((e: any) => e.hash == video.hash) == -1) {
                videoList[index].isAvailable = false;
            }
        }

        const _videoListCopy = [... videoList];
        const _newVideoList = _videoListCopy.concat(newVideos);
        saveAppData(_newVideoList)
        setVideoList(_newVideoList)
    }

    const toggleVideoPlayback = () => {
        if (playingVideo.video === null) return;
        if (playingVideo.status == VideoStatus.playing) {
            sendWSRequest("pause")

            const _tempPlayingVideoCopy = {... playingVideo};
            _tempPlayingVideoCopy.status = VideoStatus.paused;
            setPlayingVideo(_tempPlayingVideoCopy);
        }
        else {
            sendWSRequest("resume")
            const _tempPlayingVideoCopy = {... playingVideo};
            _tempPlayingVideoCopy.status = VideoStatus.playing;
            setPlayingVideo(_tempPlayingVideoCopy);
        }
    }

    const unloadVideo = () => {
        if (playingVideoRef.current.video === null) return;
        sendWSRequest("unload")
        const _tempPlayingVideoCopy = {... playingVideoRef.current};
        _tempPlayingVideoCopy.position = 0;
        _tempPlayingVideoCopy.status = VideoStatus.none;
        _tempPlayingVideoCopy.video = null;
        _tempPlayingVideoCopy.pictureData = "";
        setPlayingVideo(_tempPlayingVideoCopy);
    }

    const loadVideo = (id: string) => {
        if (ws === null) return;
        const index = videoList.findIndex((e) => e.id == id);
        if (index == -1) return;
        const _video = videoList[index];
        const fileName = _video.filename;
        const encodedFileName = btoa(encodeURIComponent(fileName));
        sendWSRequest("load:" + encodedFileName)
        setPlayingVideo({video: _video.id, status: VideoStatus.loaded, position: 0, pictureData: ""})
    }

    const handleVideoEnd = () => {
        console.log(playingVideoRef.current.video)
        if (playingVideoRef.current.video == null) return;
        const _index = videoListRef.current.findIndex((e) => e.id == playingVideoRef.current.video);
        console.log(_index)
        if (_index == -1) return;
        const video = videoListRef.current[_index];
        console.log(video.endingBehavior)
        switch (video.endingBehavior) {
            case VideoEndingAction.freeze:
                break;
            case VideoEndingAction.repeat:
                sendWSRequest("settime:" + 0)
                sendWSRequest("resume")

                const _tempPlayingVideoCopy = {... playingVideoRef.current};
                _tempPlayingVideoCopy.status = VideoStatus.playing;
                _tempPlayingVideoCopy.position = 0;
                setPlayingVideo(_tempPlayingVideoCopy);
                break;
            case VideoEndingAction.unload:
                unloadVideo();
                break;
            case VideoEndingAction.next:
                const _posInList = video.position;
                const nextVideoIndex = videoListRef.current.findIndex((e) => e.position == _posInList + 1);
                console.log(nextVideoIndex)
                if (nextVideoIndex == -1) break;
                const nextVideo = videoListRef.current[nextVideoIndex];
                console.log(nextVideo.id)
                playVideo(nextVideo.id)
                break;
        }
    }

    const changePositionOfVideoInList = (currentPosition: number, direction: VideoListMoveDirection) => {
        const newPosition = direction == VideoListMoveDirection.up ? currentPosition - 1 : currentPosition + 1
        const videoAtNewPositionIndex = videoListRef.current.findIndex((e) => e.position == newPosition)
        const videoAtCurrentPositionIndex = videoListRef.current.findIndex((e) => e.position == currentPosition)
        if (videoAtNewPositionIndex == -1) return;
        if (videoAtCurrentPositionIndex == -1) return;
        var _tempVideoLostCopy = [... videoListRef.current]
        _tempVideoLostCopy[videoAtCurrentPositionIndex].position = newPosition
        _tempVideoLostCopy[videoAtNewPositionIndex].position = currentPosition
        setVideoList(_tempVideoLostCopy)
    }

    const uploadFile = (event: any) => {
        ws!.send("uploadfile:" + btoa(encodeURIComponent(event.target.files[0].name)));
        const reader = new FileReader();
        //let rawData = new ArrayBuffer();
        reader.onload = (e) => {
            // @ts-ignore
            const rawData: ArrayBuffer = e.target.result;
            const bufferData = Buffer.from(rawData);
            /*const bsonData = serialize({  // whatever js Object you need
                file: bufferData,
                route: 'TRANSFER',
                action: 'FILE_UPLOAD',
            });*/
            ws!.send(bufferData);
        }

        // @ts-ignore
        reader.readAsArrayBuffer(event.target.files[0])

    }

    return (
        <>
          <Head>
            <title>Avron - Controller</title>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="icon" href="/favicon.ico" />
          </Head>
          <main className={"h-full"}>
            <div id={"frame"} className={"w-full h-full"}>
                <div id={"header"} className={"w-full h-16 border-b border-gray-600 flex items-center justify-between px-4"}>
                    <div className={"flex items-center"}>
                        <Youtube />
                        <h1 className={"mx-4 font-bold"}>Avron - Remote Video Controller</h1>
                    </div>
                    <div className={"flex items-center"}>
                        {isConnected ? <p className={"mx-4 text-gray-400"}>Connected to {serverIP}</p> : <div>
                            <button className={"h-8 bg-blue-500 rounded-xl text-white font-bold px-4"} onClick={connectToServer}>Verbinden</button>
                            <input className={`rounded-xl mx-4 px-1 ${ipInvalid ? "border border-red-500" : ""}`} placeholder={"192.168.2.10"} value={serverIP} onChange={(e) => {
                                setIpInvalid(false)
                                setServerIP(e.target.value)
                            }} />
                        </div>}
                        <div className={`w-4 h-4 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}></div>
                    </div>
                </div>
                <div id={"body"} className={`flex w-full m-8 ${styles.mainbody}`}>
                    <div id={"playlist"} style={{width: "40%"}} className={"pr-8 relative overflow-hidden"}>
                        <div className={"flex items-center mb-8"}>
                            <h1 className={"text-3xl font-bold mr-4"}>Videoliste</h1>
                            {isConnected ?                             <button title={"Videos neu laden"} onClick={() => {sendWSRequest("fetchvideos")}}><DownloadCloud /></button> : <div />}
                        </div>
                        <div className={"rounded bg-gray-900 w-full overflow-y-scroll mb-16"} style={{height: "fit-content"}}>
                            {videoList.sort((a, b) => a.position - b.position).map((video) => (
                                <VideoListCell key={video.id} video={video} arrayLength={videoList.length} playVideo={() => {
                                    playVideo(video.id)
                                }} loadVideo={() => {
                                    loadVideo(video.id)
                                }} renameVideo={(newname) => {
                                    const index = videoList.findIndex((e) => e.id == video.id);
                                    if (index > -1) {
                                        const _tempVideoListCopy = [... videoList];
                                        _tempVideoListCopy[index].name = newname
                                        setVideoList(_tempVideoListCopy)
                                        saveAppData(_tempVideoListCopy);
                                    }
                                }}
                                               deleteVideo={() => {
                                                   if (!video.isAvailable) {
                                                       const index = videoList.findIndex((e) => e.id == video.id);
                                                       const _tempVideoListCopy = [... videoList]
                                                       _tempVideoListCopy.splice(index, 1);
                                                       setVideoList(_tempVideoListCopy);
                                                       saveAppData(_tempVideoListCopy);
                                                   }
                                               }}
                                               setEndingBehavior={(behavior: VideoEndingAction) => {
                                                   const index = videoList.findIndex((e) => e.id == video.id);
                                                   if (index > -1) {
                                                       const _tempVideoListCopy = [... videoList];
                                                       _tempVideoListCopy[index].endingBehavior = behavior
                                                       setVideoList(_tempVideoListCopy)
                                                       saveAppData(_tempVideoListCopy);
                                                   }
                                               }}


                                               isPlaying={playingVideo.video !== null && playingVideo.video === video.id}
                                               changePosition={changePositionOfVideoInList}
                                />
                            ))}
                        </div>
                    </div>
                    <div id={"control"} style={{width: "60%"}} className={"pl-8"}>
                        <div className={"flex items-center"}>
                            <h1 className={"text-3xl font-bold mr-4"}>Steuerung</h1>
                            <button className={"h-full"} onClick={() => {setVideoPreviewEnabled(!videoPreviewEnabled)}}>{videoPreviewEnabled ? <EyeOff /> : <Eye />}</button>
                        </div>
                        <div id={"controlbody"} className={"flex mt-4"}>
                            <div id={"left"} style={{width: "600px"}}>
                                <div id={"videoframe"} style={{width: "600px", height: "337px"}} className={`relative flex flex-col justify-between bg-gray-800 rounded-xl ${playingVideo.status == VideoStatus.playing ? styles.playingbg : (playingVideo.status == VideoStatus.loaded || playingVideo.status == VideoStatus.paused) ? styles.loadedbg : ""}`}>
                                    <div/>
                                    {playingVideo.pictureData !== "" && videoPreviewEnabled ?
                                        <div className={"absolute flex justify-center top-0 left-0 bg-black rounded-xl"} style={{width: "600px", height: "337px"}}>
                                            <img className={"rounded-xl"} src={playingVideo.pictureData} />
                                        </div>
                                        : <div />}
                                    <div className={"flex justify-center"}>
                                        {playingVideo.status == VideoStatus.none ? <VideoOff /> : <div />}
                                    </div>
                                    <div style={{zIndex: "10"}} className={"flex justify-end"}>
                                        <div className={"m-4 bg-black rounded px-2 py-1"}>
                                            <p>{(() => {
                                                switch (playingVideo.status) {
                                                    case VideoStatus.none:
                                                        return "Kein Video geladen"
                                                    case VideoStatus.loaded:
                                                        return "Video geladen"
                                                    case VideoStatus.paused:
                                                        return "Video pausiert"
                                                    case VideoStatus.playing:
                                                        return "Video spielt"
                                                }
                                            })()}</p>
                                        </div>
                                    </div>
                                </div>
                                {playingVideo.video !== null ? <div id={"videotimecontrols"} style={{width: "600px"}}>
                                    <h1 className={"text-center mt-2 text-xl font-bold"}>{videoList.find((e) => e.id == playingVideo.video)!.name}</h1>
                                    <div className={"flex justify-between items-center"}>
                                        <p>{secondsTimeToFormattedString(videoControlRangeValue != null ? videoControlRangeValue : playingVideo.position)}</p>

                                        <input className={"w-full mx-4 h-2"} type={"range"} min={0} max={videoList.find((e) => e.id == playingVideo.video)!.duration} value={videoControlRangeValue ?? playingVideo.position} onChange={(e) => {
                                            if (typeof videoControlRangeValue != "undefined") {
                                                setVideoControlRangeValue(parseInt(e.target.value));


                                            }
                                            else {
                                                setVideoControlRangeValue(null);
                                            }
                                        }} onMouseUp={() => {
                                            // send to server
                                            if (typeof videoControlRangeValue === "number") {
                                                sendWSRequest("settime:" + videoControlRangeValue!.toFixed(0))
                                                var _playingVideoCopy = {... playingVideo}
                                                _playingVideoCopy.position = videoControlRangeValue!
                                                setPlayingVideo(_playingVideoCopy);
                                                setVideoControlRangeValue(undefined);
                                            }

                                        }} onClick={(e: any) => {
                                            if (typeof videoControlRangeValue === "number") {
                                                sendWSRequest("settime:" + videoControlRangeValue!.toFixed(0))
                                                var _playingVideoCopy = {... playingVideo}
                                                _playingVideoCopy.position = videoControlRangeValue!
                                                setPlayingVideo(_playingVideoCopy);
                                                setVideoControlRangeValue(null);
                                            }
                                        }} />

                                        <p>{secondsTimeToFormattedString(videoList.find((e) => e.id == playingVideo.video)!.duration)}</p>
                                    </div>
                                </div> : <div />}
                            </div>
                            <div id={"maincontrols"} className={`ml-4 w-full ${styles.maincontrolsgrid}`}>
                                <button disabled={playingVideo.video === null} onClick={toggleVideoPlayback} className={"px-6 py-4 h-16 bg-blue-500 rounded-xl font-bold disabled:bg-gray-600"}>
                                    {playingVideo.status == VideoStatus.playing ? "Pausieren" : "Fortsetzen"}
                                </button>
                                <button disabled={playingVideo.video === null} onClick={unloadVideo} title={"Entfernt das Video aus der aktuellen Wiedergabe, Bildschirm wird schwarz"} className={"px-6 py-4 h-16 bg-blue-500 rounded-xl font-bold disabled:bg-gray-600"}>
                                    Entladen
                                </button>

                            </div>
                        </div>
                    </div>

                </div>
            </div>
          </main>
        </>
    );
}

const secondsTimeToFormattedString = (seconds: number): string => {
    const _minutes = Math.floor(Math.floor(seconds) / 60).toLocaleString("en-US", {minimumIntegerDigits: 2})
    const _seconds = (Math.floor(seconds) - Math.floor(Math.floor(seconds) / 60) * 60).toLocaleString("en-US", {minimumIntegerDigits: 2})
    return `${_minutes}:${_seconds}`
}

interface VideoListCell_Props {
    video: VideoListEntry;
    arrayLength: number;
    playVideo: () => void;
    loadVideo: () => void;
    renameVideo: (newname: string) => void;
    deleteVideo: () => void;
    setEndingBehavior: (behavior: VideoEndingAction) => void;
    isPlaying: boolean;
    changePosition: (currentPosition: number, direction: VideoListMoveDirection) => void;
}

enum VideoListMoveDirection {
    up,
    down
}

const VideoListCell: FunctionComponent<VideoListCell_Props> = ({video, arrayLength, playVideo, loadVideo, renameVideo, deleteVideo, setEndingBehavior, isPlaying, changePosition}) => {

    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState("");
    const [moreOptionsOpened, setMoreOptionsOpened] = useState(false);

    return (
        <div className={`p-4 ${isPlaying ? "border border-yellow-600" : video.position < arrayLength - 1 ? "border-b border-gray-600" : ""} `}>
            <div className={`flex items-center justify-between`} key={video.hash}>
                <div className={"flex items-center w-3/4"}>

                    <div className={"mr-2 flex flex-col items-center justify-center content-center"}>
                        {video.position != 0 ? <button onClick={() => {changePosition(video.position, VideoListMoveDirection.up)}}><ChevronUp /></button> : <div className={"h-6"} />}
                        <div className={"h-2"} />
                        {video.position != arrayLength - 1 ? <button  onClick={() => {changePosition(video.position, VideoListMoveDirection.down)}}><ChevronDown /></button> : <div className={"h-6"}/>
                        }
                    </div>
                    <p className={"mr-4"}>{video.position + 1}</p>
                    {!video.isAvailable ? <div className={"mr-4"} title={"Video auf Server nicht verfügbar"}>
                        <AlertTriangle stroke={"red"} />
                    </div> : <p></p>}
                    <div>
                        {isEditingName ? <div className={"flex items-center"}>
                                <input className={"rounded"} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={"Video"} />
                                <button className={"mx-2"} onClick={() => {
                                    setIsEditingName(false);
                                    renameVideo(newName);
                                    video.name = newName;
                                    setNewName("");
                                }}><Check stroke={"green"} /></button>
                                <button onClick={() => {
                                    setIsEditingName(false);
                                    setNewName("");
                                }}><X stroke={"red"}/></button>
                            </div> :
                            <div className={"flex items-center"}>
                                <h1 className={"font-bold text-lg"}>{video.name}</h1>
                                <button className={"ml-2"} onClick={() => {
                                    setNewName(video.name);
                                    setIsEditingName(true);
                                }}><Edit3 size={18}/></button>
                            </div>}
                        <p className={"text-sm italic text-gray-300"}>{video.filename} - {secondsTimeToFormattedString(video.duration)}</p>
                    </div>
                </div>
                <div>
                    <button title={"Mehr Optionen"} className={"mr-3"} onClick={() => setMoreOptionsOpened(!moreOptionsOpened)}>{moreOptionsOpened ? <ChevronUp /> : <ChevronDown />}</button>
                    <button title={"Laden (ohne Auto-Play)"} className={"mr-3"} onClick={loadVideo}><Monitor stroke={"#aaa"}/></button>
                    <button title={"Direkt abspielen"} onClick={playVideo}><Play fill={"green"} stroke={"green"} /></button>
                </div>
            </div>
            {moreOptionsOpened ? <div id={"moreoptions"} className={"flex justify-end mt-2"}>
                {!video.isAvailable ? <button><Trash2 stroke={"red"} onClick={deleteVideo} /></button> : <div/>}
                <div className={"border rounded-lg border-gray-700 flex items-center text-sm"}>
                    <button className={`m-1 px-2 py-1 ${video.endingBehavior == VideoEndingAction.next ? "bg-gray-800 rounded-lg" : ""}`} onClick={() => {setEndingBehavior(VideoEndingAction.next)}}>Next</button>
                    <button className={`m-1 px-2 py-1 ${video.endingBehavior == VideoEndingAction.repeat ? "bg-gray-800 rounded-lg" : ""}`} onClick={() => {setEndingBehavior(VideoEndingAction.repeat)}}>Repeat</button>
                    <button className={`m-1 px-2 py-1 ${video.endingBehavior == VideoEndingAction.unload ? "bg-gray-800 rounded-lg" : ""}`} onClick={() => {setEndingBehavior(VideoEndingAction.unload)}}>Unload</button>
                    <button className={`m-1 px-2 py-1 ${video.endingBehavior == VideoEndingAction.freeze ? "bg-gray-800 rounded-lg" : ""}`} onClick={() => {setEndingBehavior(VideoEndingAction.freeze)}}>Freeze</button>

                </div>
            </div> : <div />}
        </div>
    )
}

interface VideoListEntry {
    id: string;
    hash: string;
    position: number;
    filename: string;
    name: string;
    duration: number;
    isAvailable: boolean;
    endingBehavior: VideoEndingAction;
}

enum VideoEndingAction {
    freeze,
    unload,
    repeat,
    next
}