// @ts-ignore Import module
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const SUPABASE_URL = "https://yduvtxtfzcgfeaehgisj.supabase.co";
const SUPABASE_KEY = "sb_publishable_4CmRmdx13Sy1TXfMHwL1zQ_ngA7IN6n";
const MAP_URL = "https://yduvtxtfzcgfeaehgisj.supabase.co/storage/v1/object/public/Assets/map.tmj";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const gameCanvas = document.getElementById("game-canvas");
const canvasCtx = gameCanvas.getContext("2d");
const spritesheet = document.getElementById("tileset");
const bmpFont = document.getElementById("font");
const messageBox = document.getElementById("message-box");
const chatLog = document.getElementById("chatlog");
let authUser = supabase.auth.getUser().data;
let userName = "";
let userStatus = {
    user: "",
    name: "",
    x: Math.floor(Math.random() * 8),
    y: Math.floor(Math.random() * 8),
};
let joinedChannel = false;
class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.smooth = 0.1;
    }
    transform(posX, posY) {
        return [posX - this.x + 160, posY - this.y + 120];
    }
    moveTo(newX, newY) {
        this.x = this.x + (newX - this.x) * this.smooth;
        this.y = this.y + (newY - this.y) * this.smooth;
    }
}
var MessageType;
(function (MessageType) {
    MessageType["CHAT_MESSAGE"] = "ChatMessage";
    MessageType["PLAYER_MOVED"] = "PlayerMoved";
})(MessageType || (MessageType = {}));
class PlayerMovedData {
    constructor() {
        this.mx = 0;
        this.my = 0;
        this.playerID = "";
    }
}
class Message {
    constructor() {
        this.type = MessageType.CHAT_MESSAGE;
        this.data = "";
    }
}
let channel = null;
let cam = new Camera();
class Player {
    constructor(name, id) {
        this.name = name;
        this.x = 8;
        this.y = 8;
        this.rx = 8;
        this.ry = 8;
        this.id = id;
        this.sprite = 4;
    }
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }
    draw() {
        this.rx = this.rx + (this.x - this.rx) * 0.1;
        this.ry = this.ry + (this.y - this.ry) * 0.1;
        drawSprite(this.sprite, this.rx, this.ry);
        drawText(this.name, this.rx, this.ry + 8);
    }
}
let players = {};
let actions = {
    ArrowLeft: "left",
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowRight: "right",
    KeyX: "shoot",
};
class Input {
    constructor() {
        this.pressed = false;
        this.justPressed = false;
    }
}
let input = {
    left: new Input(),
    right: new Input(),
    up: new Input(),
    down: new Input(),
    shoot: new Input(),
};
let tilemap;
async function loadTilemap() {
    let res = await fetch(MAP_URL);
    return await res.json();
}
function drawText(text, x, y) {
    if (canvasCtx) {
        const SIZE = 8;
        for (let i = 0; i < text.length; i++) {
            let char = text.charCodeAt(i);
            if (char > 256)
                continue;
            const sx = SIZE * (char % 16);
            const sy = SIZE * Math.floor(char / 16);
            const [dx, dy] = cam.transform(x + i * 5, y);
            canvasCtx.drawImage(bmpFont, sx, sy, SIZE, SIZE, dx, dy, SIZE, SIZE);
        }
    }
}
function drawSprite(spriteID, x, y) {
    if (canvasCtx) {
        const SIZE = 8;
        const sx = SIZE * (spriteID % 16);
        const sy = SIZE * Math.floor(spriteID / 16);
        let [dx, dy] = cam.transform(x, y);
        canvasCtx.drawImage(spritesheet, sx, sy, SIZE, SIZE, dx, dy, SIZE, SIZE);
    }
}
function drawTilemap(map) {
    for (const layer of map.layers) {
        for (let i = 0; i < layer.height; i++) {
            for (let j = 0; j < layer.width; j++) {
                let tile = layer.data[i * layer.width + j] - 1;
                if (tile >= 0) {
                    drawSprite(tile, j * 8, i * 8);
                }
            }
        }
    }
}
function update() {
    let dx = 0;
    let dy = 0;
    if (input.left.justPressed)
        dx -= 1.0;
    if (input.right.justPressed)
        dx += 1.0;
    if (input.up.justPressed)
        dy -= 1.0;
    if (input.down.justPressed)
        dy += 1.0;
    if (dx != 0 || dy != 0) {
        let playerMoveMessage = new Message;
        playerMoveMessage.type = MessageType.PLAYER_MOVED;
        playerMoveMessage.data = new PlayerMovedData;
        playerMoveMessage.data.mx = dx;
        playerMoveMessage.data.my = dy;
        playerMoveMessage.data.playerID = authUser["id"];
        broadcastMessage(playerMoveMessage);
    }
    for (let i in input) {
        input[i].justPressed = false;
    }
    let selfPlayer = players[authUser.id];
    if (selfPlayer) {
        cam.moveTo(selfPlayer.x, selfPlayer.y);
        userStatus.x = selfPlayer.x;
        userStatus.y = selfPlayer.y;
        channel.track(userStatus);
    }
}
function drawLoop() {
    canvasCtx === null || canvasCtx === void 0 ? void 0 : canvasCtx.clearRect(0, 0, 320, 240);
    if (!channel)
        return;
    update();
    drawTilemap(tilemap);
    for (let player in players) {
        players[player].draw();
    }
}
async function load() {
    if (canvasCtx) {
        canvasCtx.imageSmoothingEnabled = false;
        tilemap = await loadTilemap();
    }
}
function onKeyDown(key) {
    if (key.code in actions) {
        let action = actions[key.code];
        if (action in input) {
            input[action].justPressed = true;
            input[action].pressed = true;
        }
    }
}
function onKeyUp(key) {
    if (key.code in actions) {
        let action = actions[key.code];
        if (action in input) {
            input[action].pressed = false;
        }
    }
}
function joinChannel(channelName) {
    userStatus.user = authUser.id,
        userStatus.name = userName,
        userStatus.x = Math.floor(Math.random() * 8) * 8,
        userStatus.y = Math.floor(Math.random() * 8) * 8,
        channel = supabase.channel(channelName, {
            config: {
                broadcast: {
                    self: true,
                },
                private: true,
            }
        });
    channel.on('broadcast', { event: MessageType.CHAT_MESSAGE }, (message) => {
        console.log(message);
        newChatMessage(message.payload);
    });
    channel.on('broadcast', { event: MessageType.PLAYER_MOVED }, (message) => {
        console.log(message);
        onPlayerMoved(message.payload);
    });
    channel.on('presence', { event: 'sync' }, () => {
    });
    // @ts-ignore
    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        for (let presence of leftPresences) {
            console.log(presence);
            delete players[presence.user];
        }
    });
    // @ts-ignore
    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
        for (let playerStatus of newPresences) {
            players[playerStatus.user] = new Player(playerStatus.name, playerStatus.user);
            players[playerStatus.user].x = playerStatus.x;
            players[playerStatus.user].y = playerStatus.y;
            players[playerStatus.user].rx = playerStatus.x;
            players[playerStatus.user].ry = playerStatus.y;
        }
    });
    channel.subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
            return null;
        }
        channel.track(userStatus);
    });
}
const joinChannelButton = document.getElementById("join-channel-button");
joinChannelButton.addEventListener('click', (e) => {
    let channelName = document.getElementById("channel-name").value;
    if (channelName.length > 0) {
        joinChannel("game:rooms:" + channelName);
    }
});
function onPlayerMoved(msg) {
    players[msg.playerID].x += msg.mx * 8;
    players[msg.playerID].y += msg.my * 8;
}
function newChatMessage(msg) {
    let p = document.createElement("p");
    p.innerText = msg;
    chatLog.appendChild(p);
    console.log(msg);
}
function broadcastMessage(msg) {
    console.log("Broadcasting: ", msg);
    channel.send({
        type: "broadcast",
        event: msg.type,
        payload: msg.data,
    });
}
window.addEventListener("keydown", onKeyDown, false);
window.addEventListener("keyup", onKeyUp, false);
async function go() {
    await load();
    window.setInterval(drawLoop, 1000 / 60);
}
go();
function sendChatMessage(str) {
    let msg = new Message;
    msg.type = MessageType.CHAT_MESSAGE;
    msg.data = str;
    broadcastMessage(msg);
}
messageBox.addEventListener("keypress", function (e) {
    if (e.code == "Enter") {
        if (this.value.length > 0) {
            sendChatMessage(userName + ": " + this.value);
            this.value = "";
        }
    }
});
// AUTHENTICATION STUFF
const authContainers = [
    document.getElementById("auth-container"),
    document.getElementById("login-container"),
    document.getElementById("signup-container"),
    document.getElementById("account-data"),
];
const goToSignup = document.getElementById("goto-signup-button");
const goToLogin = document.getElementById("goto-login-button");
const signupCancel = document.getElementById("signup-cancel");
const loginCancel = document.getElementById("login-cancel");
const loginButton = document.getElementById("login-button");
const signupButton = document.getElementById("signup-button");
async function loggedIn() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
        return;
    }
    authContainers[0].className = "hidden";
    authContainers[1].className = "hidden";
    authContainers[2].className = "hidden";
    authContainers[3].className = "login-screen";
    userName = data.user.user_metadata.display_name;
    authContainers[3].getElementsByTagName("p")[0].innerText = "Logged in as " + userName;
    authUser = data.user;
}
async function signUp(email, password, username) {
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: { display_name: username }
        },
    });
    if (error) {
        alert("Tentativa de registro inválida");
        console.log(error);
    }
    else {
        loggedIn();
    }
}
async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });
    if (error) {
        alert("Tentativa de login inválida");
    }
    else {
        loggedIn();
    }
}
goToSignup.addEventListener('click', (e) => {
    authContainers[0].className = "hidden";
    authContainers[1].className = "hidden";
    authContainers[2].className = "login-screen";
});
goToLogin.addEventListener('click', (e) => {
    authContainers[0].className = "hidden";
    authContainers[1].className = "login-screen";
    authContainers[2].className = "hidden";
});
signupCancel.addEventListener('click', (e) => {
    authContainers[0].className = "login-screen";
    authContainers[1].className = "hidden";
    authContainers[2].className = "hidden";
});
loginCancel.addEventListener('click', (e) => {
    authContainers[0].className = "login-screen";
    authContainers[1].className = "hidden";
    authContainers[2].className = "hidden";
});
signupButton.addEventListener('click', (e) => {
    const email = document.getElementById("signup-email").value;
    const username = document.getElementById("signup-username").value;
    const password = document.getElementById("signup-password").value;
    const password2 = document.getElementById("signup-confirm-password").value;
    if (password == password2) {
        signUp(email, password, username);
    }
});
loginButton.addEventListener('click', (e) => {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    login(email, password);
});
//const signUpButton = <HTMLButtonElement>document.getElementById("signup-button");
//const usernameField = <HTMLInputElement>document.getElementById("username");
//const passwordField = <HTMLInputElement>document.getElementById("password");
//signUpButton.addEventListener('click', (e) => {
//  signUp(usernameField.value, passwordField.value);
//});
