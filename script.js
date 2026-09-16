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
const DT = 1.0 / 60.0;
let authUser = supabase.auth.getUser().data;
let userName = "";
let userStatus = {
    user: "",
    name: "",
};
// JavaScript's Math.random is not seedable. Need a custom PRNG for the determinism 
class RNG {
    constructor(seed) {
        this.m = 0x80000000; // 2**31;
        this.a = 1103515245;
        this.c = 12345;
        this.state = seed;
    }
    next() {
        this.state = (this.a * this.state + this.c) % this.m;
        return this.state;
    }
}
class Blockmap {
    constructor(width, height, blockSize) {
        this.map = [];
        this.blockSize = 32;
        this.blockSize = blockSize;
        this.width = Math.floor(width / this.blockSize);
        this.height = Math.floor(height / this.blockSize);
    }
    clear() {
        for (let i = 0; i < this.width * this.height; i++) {
            this.map[i] = [];
        }
    }
    checkCollisions(block) {
        let collisions = [];
        for (let i = 0; i < this.map[block].length - 1; i++) {
            for (let j = i + 1; j < this.map[block].length; j++) {
                if (this.map[block][i].collidesWith(this.map[block][j]))
                    collisions.push([this.map[block][i], this.map[block][j]]);
            }
        }
        for (let collision of collisions) {
            collision[0].onCollideWithEntity(collision[1]);
            collision[1].onCollideWithEntity(collision[0]);
        }
    }
    checkAllCollisions() {
        for (let i = 0; i < this.width * this.height; i++)
            this.checkCollisions(i);
    }
    addEntity(e) {
        if (!e.physical)
            return;
        const x = Math.floor(e.x / this.blockSize);
        const y = Math.floor(e.y / this.blockSize);
        if (x < 0 || x >= this.width || y < 0 || y >= this.height)
            return;
        this.map[y * this.width + x].push(e);
    }
    addEntities(eList) {
        for (const entity of eList)
            this.addEntity(entity);
    }
    getEntitiesInBlock(block) {
        return this.map[block];
    }
    getEntitiesInGridCoords(x, y) {
        return this.getEntitiesInBlock(y * this.width + x);
    }
    getEntitiesInWorldCoords(x, y) {
        x = Math.floor(x / this.blockSize);
        y = Math.floor(y / this.blockSize);
        return this.getEntitiesInGridCoords(x, y);
    }
}
let blockmap;
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
        this.speed = 0;
        this.interpolated = false;
        this.visible = true;
        this.group = "";
        this.hp = 1;
        this.physical = true;
        this.x = x;
        this.y = y;
        this.iX = x;
        this.iY = y;
        this.sprite = sprite;
    }
    delete() {
        const ind = entities.indexOf(this);
        if (ind >= 0)
            entities.splice(ind, 1);
        this.onDelete();
    }
    collidesWith(other) {
        const RADIUS = 7.0;
        const dx = (other.x + 4) - (this.x + 4);
        const dy = (other.y + 4) - (this.y + 4);
        const d2 = dx * dx + dy * dy;
        return (d2 < (RADIUS * RADIUS));
    }
    distance2To(other) {
        let dx = other.x - this.x;
        let dy = other.y - this.y;
        return dx * dx + dy * dy;
    }
    directionTo(other) {
        let dx = other.x - this.x;
        let dy = other.y - this.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1) {
            const d = Math.sqrt(d2);
            dx /= d;
            dy /= d;
        }
        return [dx, dy];
    }
    die() {
    }
    damage(amt) {
        this.hp -= amt;
        if (this.hp < 0) {
            this.die();
            return true;
        }
        return false;
    }
    onDelete() {
    }
    update() {
        const len2 = this.dirX * this.dirX + this.dirY * this.dirY;
        if (len2 > 0) {
            const len = Math.sqrt(len2);
            this.dirX /= len;
            this.dirY /= len;
        }
        this.x += this.dirX * this.speed;
        this.y += this.dirY * this.speed;
        if (this.interpolated) {
            const LERP_CONSTANT = 0.2;
            this.iX += (this.x - this.iX) * LERP_CONSTANT;
            this.iY += (this.y - this.iY) * LERP_CONSTANT;
        }
        else {
            this.iX = this.x;
            this.iY = this.y;
        }
        this.checkForMapCollision();
    }
    checkForMapCollision() {
        let x = this.x + 4;
        let y = this.y + 6;
        if (x < 0 || y < 0 || x > tilemap.layers[0].width * 8 || y > tilemap.layers[0].height * 8) {
            this.onCollideWithMap(this.x, this.y, -1);
        }
    }
    draw() {
        drawSprite(this.sprite, this.iX, this.iY);
    }
    onCollideWithEntity(other) {
    }
    onCollideWithMap(x, y, tile) {
    }
}
class Player extends Entity {
    constructor(name, id) {
        super(4, 8, 8);
        this.chatText = "";
        this.chatTimer = 0;
        this.kills = 0;
        this.alive = true;
        this.group = "Players";
        this.name = name;
        this.id = id;
        this.nameTag = document.createElement("p");
        this.chatBubble = document.createElement("p");
        this.nameTag.className = "player-nametag";
        this.chatBubble.className = "hidden chat-bubble";
        this.nameTag.innerText = name;
        gameCanvasContainer.appendChild(this.nameTag);
        gameCanvasContainer.appendChild(this.chatBubble);
        this.hp = 10;
        if (id != authUser.id)
            this.interpolated = true;
    }
    onDelete() {
        gameCanvasContainer.removeChild(this.nameTag);
        gameCanvasContainer.removeChild(this.chatBubble);
        delete players[this.id];
    }
    die() {
        this.sprite = 25;
        this.alive = false;
    }
    revive() {
        this.sprite = 4;
        this.hp = 10;
        this.alive = true;
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
            if (this.alive) {
                if (input.shoot.justPressed) {
                    entities.push(new Bullet(this.id, this.x, this.y, this.dirX, this.dirY));
                    let shootMessage = new Message;
                    shootMessage.type = MessageType.PLAYER_SHOT;
                    shootMessage.data = new PlayerShotData(this.id, this.x, this.y, this.dirX, this.dirY);
                    broadcastMessage(shootMessage);
                }
            }
            else {
                const now = Math.floor(Date.now() / 1000);
                if (now % 30 == 0)
                    this.revive();
            }
            cam.moveTo(this.x, this.y);
        }
        super.update();
    }
    draw() {
        super.draw();
        let [tagX, tagY] = cam.transform(this.iX, this.iY + 8);
        let bounding = gameCanvas.getBoundingClientRect();
        this.nameTag.style.top = (tagY * 3 + bounding.top).toString();
        this.nameTag.style.left = (tagX * 3 + bounding.left).toString();
        if (this.chatTimer > 0.0) {
            [tagX, tagY] = cam.transform(this.iX + 6, this.iY - 10);
            this.chatBubble.style.top = (tagY * 3 + bounding.top).toString();
            this.chatBubble.style.left = (tagX * 3 + bounding.left).toString();
            this.chatTimer -= DT;
            if (this.chatTimer < 0.0) {
                this.chatBubble.className = "hidden chat-bubble";
            }
        }
    }
}
class ZombieSpawner extends Entity {
    constructor(x, y, time, radius) {
        super(0, x, y);
        this.everySeconds = 30;
        this.radius = 64;
        this.spawnedThisSecond = false;
        this.minZombies = 15;
        this.maxZombies = 50;
        this.visible = false;
        this.everySeconds = time;
        this.radius = radius;
    }
    newWave(seed) {
        const rng = new RNG(seed + this.radius + this.everySeconds);
        const zombieCount = (rng.next() % (this.maxZombies - this.minZombies)) + this.minZombies;
        for (let i = 0; i < zombieCount; i++) {
            const x = this.x + (rng.next() % (this.radius * 2)) - this.radius / 2;
            const y = this.y + (rng.next() % (this.radius * 2)) - this.radius / 2;
            entities.push(new Zombie(x, y, 0));
        }
    }
    update() {
        const now = Math.floor(Date.now() / 1000);
        if (now % this.everySeconds == 0) {
            if (!this.spawnedThisSecond) {
                this.newWave(now);
                this.spawnedThisSecond = true;
            }
        }
        else {
            this.spawnedThisSecond = false;
        }
    }
}
const BULLET_SPRITE = 8 * 16 + 1;
class Bullet extends Entity {
    constructor(player, x, y, dx, dy) {
        super(BULLET_SPRITE, x, y);
        this.lifetime = 2.0;
        this.group = "Bullets";
        this.dirX = dx;
        this.dirY = dy;
        this.speed = 2;
        this.player = player;
    }
    update() {
        this.lifetime -= DT;
        if (this.lifetime < 0.0) {
            this.delete();
        }
        super.update();
    }
    onCollideWithMap(x, y, tile) {
        this.delete();
    }
    onCollideWithEntity(other) {
        console.log("Bullet colliding with " + other.group);
        if (other.group == "Enemies") {
            if (other.damage(1)) {
                players[this.player].kills++;
            }
            this.delete();
        }
    }
}
class Zombie extends Entity {
    constructor(x, y, target) {
        const sprite = 9 + Math.floor(Math.random() * 5);
        super(sprite, x, y);
        this.target = 0;
        this.group = "Enemies";
        this.hp = 3;
    }
    die() {
        this.delete();
    }
    onCollideWithEntity(other) {
        let [dx, dy] = this.directionTo(other);
        switch (other.group) {
            case "Enemies":
                this.dirY -= dx;
                this.dirY -= dy;
                break;
            case "Players":
                this.dirY = dx;
                this.dirY = dy;
                this.speed = -4;
                other.damage(1);
                break;
            default:
                break;
        }
    }
    update() {
        const players = getEntitiesInGroup("Players");
        if (players.length > 0) {
            let minDist = Infinity;
            for (let i = 0; i < players.length; i++) {
                const player = players[i];
                const d = this.distance2To(player);
                if (d < minDist) {
                    minDist = d;
                    this.target = i;
                }
            }
            let target = players[this.target % players.length];
            if (!target.alive)
                return;
            let [dX, dY] = this.directionTo(target);
            this.dirX += (dX - this.dirX) * 0.2;
            this.dirY += (dY - this.dirY) * 0.2;
            this.speed += (0.6 - this.speed) * 0.2;
        }
        super.update();
    }
}
let entities = [];
let players = {};
function getEntitiesInGroup(group) {
    return entities.filter((e) => { return e.group == group; });
}
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
    blockmap.clear();
    blockmap.addEntities(entities);
    blockmap.checkAllCollisions();
    for (const entity of entities) {
        entity.update();
    }
    for (let i in input) {
        input[i].justPressed = false;
    }
}
let deathGradient = null;
function drawLoop() {
    var _a;
    if (!canvasCtx)
        return;
    canvasCtx.fillStyle = "rgb(0 0 0)";
    canvasCtx.fillRect(0, 0, 320, 240);
    if (!channel)
        return;
    update();
    drawTilemap(tilemap);
    for (const entity of entities) {
        entity.draw();
    }
    if (!((_a = players[authUser.id]) === null || _a === void 0 ? void 0 : _a.alive)) {
        canvasCtx.fillStyle = deathGradient;
        canvasCtx.fillRect(0, 0, 320, 240);
    }
}
async function load() {
    if (canvasCtx) {
        canvasCtx.imageSmoothingEnabled = false;
        tilemap = await loadTilemap();
        blockmap = new Blockmap(tilemap.layers[0].width * 8, tilemap.layers[0].height * 8, 32);
        deathGradient = canvasCtx.createRadialGradient(160, 120, 40, 160, 120, 100);
        deathGradient.addColorStop(0, "rgb(200 200 200 / 20%)");
        deathGradient.addColorStop(0.3, "rgb(80 80 80 / 50%)");
        deathGradient.addColorStop(1.0, "rgb(0 0 0 / 90%)");
    }
}
// INPUT SYSTEM 
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
function onKeyDown(key) {
    if (key.repeat)
        return;
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
window.addEventListener("keydown", onKeyDown, false);
window.addEventListener("keyup", onKeyUp, false);
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
class PlayerShotData {
    constructor(player, x, y, dx, dy) {
        this.player = player;
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
    }
}
class Message {
    constructor() {
        this.type = MessageType.CHAT_MESSAGE;
        this.data = new ChatMessageData;
    }
}
let channel = null;
function spawnPlayer(name, userID) {
    let player = new Player(name, userID);
    entities.push(player);
    players[userID] = player;
}
function deletePlayer(userID) {
    players[userID].delete();
}
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
        onPlayerMoved(message.payload);
    });
    channel.on('broadcast', { event: MessageType.PLAYER_SHOT }, (message) => {
        let shot = message.payload;
        entities.push(new Bullet(shot.player, shot.x, shot.y, shot.dx, shot.dy));
    });
    channel.on('presence', { event: 'sync' }, () => {
        var _a;
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
            deletePlayer(presence.user);
            chatNotify("Usuário " + presence.name + " saiu da sala");
        }
    });
    // @ts-ignore
    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
        for (let playerStatus of newPresences) {
            spawnPlayer(playerStatus.name, playerStatus.user);
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
        deletePlayer(player);
    }
    players = {};
    entities = [];
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
    channel.send({
        type: "broadcast",
        event: msg.type,
        payload: msg.data,
    });
}
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
async function go() {
    await load();
    window.setInterval(drawLoop, 1000 * DT);
}
go();
