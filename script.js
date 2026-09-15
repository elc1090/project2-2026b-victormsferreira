// @ts-ignore Import module
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const SUPABASE_URL = "https://yduvtxtfzcgfeaehgisj.supabase.co";
const SUPABASE_KEY = "sb_publishable_4CmRmdx13Sy1TXfMHwL1zQ_ngA7IN6n";
const MAP_URL = "https://yduvtxtfzcgfeaehgisj.supabase.co/storage/v1/object/public/Assets/map.tmj";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const gameCanvas = document.getElementById("game-canvas");
const gameCanvasContainer = document.getElementById("game-canvas-container");
const canvasCtx = gameCanvas.getContext("2d");
const spritesheet = document.getElementById("tileset");
const messageBox = document.getElementById("message-box");
const chatLog = document.getElementById("chatlog");
let authUser = supabase.auth.getUser().data;
let userName = "";
let userStatus = {
    user: "",
    name: "",
};
class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.smooth = 0.1;
    }
    transform(posX, posY) {
        return [Math.round(posX - this.x + 160), Math.round(posY - this.y + 120)];
    }
    moveTo(newX, newY) {
        this.x = this.x + (newX - this.x) * this.smooth;
        this.y = this.y + (newY - this.y) * this.smooth;
    }
}
let cam = new Camera();
class Entity {
    constructor(sprite, x, y) {
        this.dirX = 1;
        this.dirY = 0;
        this.speed = 1;
        this.x = x;
        this.y = y;
        this.sprite = sprite;
    }
    update() {
        this.x += this.dirX * this.speed;
        this.y += this.dirY * this.speed;
    }
    draw() {
        drawSprite(this.sprite, this.x, this.y);
    }
}
class Player extends Entity {
    constructor(name, id) {
        super(4, 8, 8);
        this.chatText = "";
        this.chatTimer = 0;
        this.name = name;
        this.id = id;
        this.nameTag = document.createElement("p");
        this.chatBubble = document.createElement("p");
        this.nameTag.className = "player-nametag";
        this.chatBubble.className = "hidden chat-bubble";
        this.nameTag.innerText = name;
        gameCanvasContainer.appendChild(this.nameTag);
        gameCanvasContainer.appendChild(this.chatBubble);
    }
    onDelete() {
        gameCanvasContainer.removeChild(this.nameTag);
    }
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }
    setChatText(text) {
        this.chatBubble.className = "chat-bubble";
        this.chatTimer = 5.0;
        this.chatBubble.innerText = text;
    }
    update() {
        if (this.id == authUser.id) {
            let dx = 0;
            let dy = 0;
            if (input.left.pressed)
                dx -= 1.0;
            if (input.right.pressed)
                dx += 1.0;
            if (input.up.pressed)
                dy -= 1.0;
            if (input.down.pressed)
                dy += 1.0;
            let playerMoveMessage = new Message;
            playerMoveMessage.type = MessageType.PLAYER_MOVED;
            playerMoveMessage.data = new PlayerMovedData;
            if (dx != 0 || dy != 0) {
                this.dirX = dx;
                this.dirY = dy;
                this.speed = 1;
            }
            else {
                this.speed = 0;
            }
            playerMoveMessage.data.mx = this.x;
            playerMoveMessage.data.my = this.y;
            playerMoveMessage.data.playerID = authUser["id"];
            broadcastMessage(playerMoveMessage);
            cam.moveTo(this.x, this.y);
        }
        super.update();
    }
    draw() {
        super.draw();
        let [tagX, tagY] = cam.transform(this.x, this.y + 8);
        let bounding = gameCanvas.getBoundingClientRect();
        this.nameTag.style.top = (tagY * 3 + bounding.top).toString();
        this.nameTag.style.left = (tagX * 3 + bounding.left).toString();
        if (this.chatTimer > 0.0) {
            [tagX, tagY] = cam.transform(this.x + 6, this.y - 10);
            this.chatBubble.style.top = (tagY * 3 + bounding.top).toString();
            this.chatBubble.style.left = (tagX * 3 + bounding.left).toString();
            this.chatTimer -= 1 / 60.0;
            if (this.chatTimer < 0.0) {
                this.chatBubble.className = "hidden chat-bubble";
            }
        }
    }
}
const BULLET_SPRITE = 8 * 16 + 1;
class Bullet extends Entity {
    constructor(x, y, dx, dy) {
        super(BULLET_SPRITE, x, y);
        this.dirX = dx;
        this.dirY = dy;
        this.speed = 2;
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
    for (let player in players) {
        players[player].update();
    }
    for (let i in input) {
        input[i].justPressed = false;
    }
}
function drawLoop() {
    if (!canvasCtx)
        return;
    canvasCtx.fillStyle = "rgb(0 0 0)";
    canvasCtx.fillRect(0, 0, 320, 240);
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
// SUPABASE REALTIME STUFF
var MessageType;
(function (MessageType) {
    MessageType["CHAT_MESSAGE"] = "ChatMessage";
    MessageType["PLAYER_MOVED"] = "PlayerMoved";
    MessageType["PLAYER_SHOT"] = "PlayerShot";
    MessageType["ZOMBIES_SPAWN"] = "ZombiesSpawned";
})(MessageType || (MessageType = {}));
class ChatMessageData {
    constructor() {
        this.user = "";
        this.text = "";
    }
}
;
class PlayerMovedData {
    constructor() {
        this.mx = 0;
        this.my = 0;
        this.playerID = "";
    }
}
class ZombiesSpawnedData {
    constructor(x, y) {
        this.count = 1;
        this.x = x;
        this.y = y;
    }
}
class Message {
    constructor() {
        this.type = MessageType.CHAT_MESSAGE;
        this.data = new ChatMessageData;
    }
}
let channel = null;
function joinChannel(channelName) {
    if (channel) {
        supabase.removeChannel(channel);
        channel = null;
    }
    userStatus.user = authUser.id,
        userStatus.name = userName,
        channel = supabase.channel("game:rooms:" + channelName, {
            config: {
                broadcast: {
                    self: false,
                },
                private: true,
            }
        });
    channel.on('broadcast', { event: MessageType.CHAT_MESSAGE }, (message) => {
        newChatMessage(message.payload);
    });
    channel.on('broadcast', { event: MessageType.PLAYER_MOVED }, (message) => {
        console.log(message);
        onPlayerMoved(message.payload);
    });
    channel.on('presence', { event: 'sync' }, () => {
        var _a;
        let selfPlayer = players[authUser.id];
        if (selfPlayer) {
            let playerMoveMessage = new Message;
            playerMoveMessage.type = MessageType.PLAYER_MOVED;
            playerMoveMessage.data = new PlayerMovedData;
            playerMoveMessage.data.mx = selfPlayer.x;
            playerMoveMessage.data.my = selfPlayer.y;
            playerMoveMessage.data.playerID = authUser["id"];
            broadcastMessage(playerMoveMessage);
        }
        let playerList = (_a = document.getElementById("account-data")) === null || _a === void 0 ? void 0 : _a.getElementsByTagName("ul")[0];
        while (playerList.firstChild) {
            playerList.removeChild(playerList.firstChild);
        }
        const state = channel.presenceState();
        for (let key in state) {
            let presence = state[key];
            let listItem = document.createElement("li");
            listItem.innerText = presence[0].name;
            playerList.appendChild(listItem);
        }
    });
    // @ts-ignore
    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        for (let presence of leftPresences) {
            console.log(presence);
            players[presence.user].onDelete();
            delete players[presence.user];
            chatNotify("Usuário " + presence.name + " saiu da sala");
        }
    });
    // @ts-ignore
    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
        for (let playerStatus of newPresences) {
            players[playerStatus.user] = new Player(playerStatus.name, playerStatus.user);
            chatNotify("Usuário " + playerStatus.name + " entrou na sala");
        }
    });
    channel.subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
            return null;
        }
        channel.track(userStatus);
    });
    const roomJoinMenu = document.getElementById("room-container");
    const roomExitMenu = document.getElementById("room-exit");
    if (roomJoinMenu)
        roomJoinMenu.className = "hidden";
    if (roomExitMenu) {
        roomExitMenu.getElementsByTagName("p")[0].innerText = channelName;
        roomExitMenu.className = "login-screen";
    }
}
const joinChannelButton = document.getElementById("join-channel-button");
const exitChannelButton = document.getElementById("exit-channel-button");
joinChannelButton.addEventListener('click', (e) => {
    let channelName = document.getElementById("channel-name").value;
    if (channelName.length > 0) {
        joinChannel(channelName);
    }
});
exitChannelButton.addEventListener('click', (e) => {
    if (channel)
        supabase.removeChannel(channel);
    channel = null;
    const roomJoinMenu = document.getElementById("room-container");
    const roomExitMenu = document.getElementById("room-exit");
    if (roomJoinMenu)
        roomJoinMenu.className = "login-screen";
    if (roomExitMenu)
        roomExitMenu.className = "hidden";
    for (let player in players) {
        players[player].onDelete();
        delete players[player];
    }
});
function onPlayerMoved(msg) {
    if (!msg.playerID)
        return;
    players[msg.playerID].x = msg.mx;
    players[msg.playerID].y = msg.my;
}
function chatNotify(msg) {
    let p = document.createElement("p");
    p.innerText = msg;
    p.className = "room-notification";
    chatLog.appendChild(p);
}
function newChatMessage(msg) {
    if (players[msg.user]) {
        let p = document.createElement("p");
        p.innerText = players[msg.user].name + ": " + msg.text;
        chatLog.appendChild(p);
        console.log(msg);
        players[msg.user].setChatText(msg.text);
    }
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
    msg.data = new ChatMessageData;
    msg.data.user = authUser.id;
    msg.data.text = str;
    broadcastMessage(msg);
    newChatMessage(msg.data);
}
messageBox.addEventListener("keypress", function (e) {
    if (e.code == "Enter") {
        if (this.value.length > 0) {
            sendChatMessage(this.value);
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
window.addEventListener("unload", (e) => {
    if (channel)
        supabase.removeChannel(channel);
});
