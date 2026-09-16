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
const killCounter = document.getElementById("kill-counter");
const deathCounter = document.getElementById("death-counter");
const respawnTimer = document.getElementById("respawn-timer");
const DT = 1.0 / 60.0;
let authUser;
class Gamestate {
    constructor(tilemap) {
        this.entities = [];
        this.players = {};
        this.tilemap = {};
        this.valid = false;
        const worldWidth = tilemap.layers[0].width * 8;
        const worldHeight = tilemap.layers[0].height * 8;
        this.cam = new Camera();
        this.cam.setBounds(0, 0, worldWidth, worldHeight);
        this.blockmap = new Blockmap(worldWidth, worldHeight, 32);
        this.tilemap = tilemap;
        if (authUser) {
            this.valid = true;
        }
        else {
            this.valid = false;
        }
        for (const layer of tilemap.layers) {
            if (layer.objects) {
                for (const object of layer.objects) {
                    if (object.type == "ZombieSpawner") {
                        console.log(object);
                        let spawner = new ZombieSpawner(Math.floor(object.x), Math.floor(object.y), 30, 64);
                        for (const property of object.properties) {
                            if (property.name == "maxZombies")
                                spawner.maxZombies = property.value;
                            if (property.name == "minZombies")
                                spawner.minZombies = property.value;
                            if (property.name == "timer")
                                spawner.everySeconds = property.value;
                        }
                        if (object.width)
                            spawner.radiusX = Math.floor(object.width);
                        if (object.height)
                            spawner.radiusY = Math.floor(object.height);
                        this.entities.push(spawner);
                    }
                    if (object.type == "PlayerSpawn") {
                        this.entities.push(new PlayerSpawn(Math.floor(object.x), Math.floor(object.y)));
                    }
                }
            }
        }
    }
    update() {
        this.blockmap.clear();
        this.blockmap.addEntities(this.entities);
        this.blockmap.checkAllCollisions();
        for (const entity of this.entities) {
            entity.update();
        }
        for (let i in input) {
            input[i].justPressed = false;
        }
    }
    draw() {
        var _a;
        if (!canvasCtx)
            return;
        canvasCtx.fillStyle = "rgb(0 0 0)";
        canvasCtx.fillRect(0, 0, 320, 240);
        drawTilemap(this.tilemap);
        for (const entity of this.entities) {
            if (entity.visible)
                entity.draw();
        }
        if (!((_a = this.players[authUser.id]) === null || _a === void 0 ? void 0 : _a.alive)) {
            canvasCtx.fillStyle = deathGradient;
            canvasCtx.fillRect(0, 0, 320, 240);
            let now = Math.floor(Date.now() / 1000);
            let nextRespawn = now;
            nextRespawn = Math.floor(nextRespawn / 30);
            nextRespawn += 1;
            nextRespawn *= 30;
            const respawnLeft = nextRespawn - now;
            respawnTimer.innerText = "Revivendo em " + respawnLeft + " segundos.";
        }
        else {
            respawnTimer.innerText = "";
        }
    }
    loop() {
        if (!this.valid)
            return;
        this.update();
        this.draw();
    }
    getEntitiesInGroup(group) {
        return this.entities.filter((e) => { return e.group == group; });
    }
}
// JavaScript's Math.random is not seedable. Need a custom PRNG for the determinism 
class RNG {
    constructor(seed) {
        this.m = 2 ** 31;
        this.a = 1103515245;
        this.c = 12345;
        this.state = seed;
    }
    next() {
        this.state = (this.a * this.state + this.c) % this.m;
        return this.state;
    }
    nextRange(min, max) {
        const range = (max - min) + 1;
        return Math.floor(this.next() / (this.m / range)) + min;
    }
}
const gRNG = new RNG(1347319847140194);
class Blockmap {
    constructor(width, height, blockSize) {
        this.map = [];
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
class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.smooth = 0.1;
        this.minX = 0;
        this.minY = 0;
        this.maxX = 0;
        this.maxY = 0;
        this.bound = false;
    }
    setBounds(minX, minY, maxX, maxY) {
        this.minX = minX;
        this.minY = minY;
        this.maxX = maxX;
        this.maxY = maxY;
        this.bound = true;
    }
    transform(posX, posY) {
        return [Math.round(posX - this.x + 160), Math.round(posY - this.y + 120)];
    }
    moveTo(newX, newY) {
        this.x = this.x + (newX - this.x) * this.smooth;
        this.y = this.y + (newY - this.y) * this.smooth;
        if (this.bound) {
            if (this.x - 160 < this.minX)
                this.x = this.minX + 160;
            if (this.x + 160 > this.maxX)
                this.x = this.maxX - 160;
            if (this.y - 120 < this.minY)
                this.y = this.minY + 120;
            if (this.y + 120 > this.maxY)
                this.y = this.maxY - 120;
        }
    }
}
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
        this.alive = true;
        this.x = x;
        this.y = y;
        this.iX = x;
        this.iY = y;
        this.sprite = sprite;
    }
    delete() {
        const ind = gameState.entities.indexOf(this);
        if (ind >= 0)
            gameState.entities.splice(ind, 1);
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
        this.alive = false;
    }
    damage(amt) {
        this.hp -= amt;
        if (this.hp < 0) {
            if (this.alive)
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
        if (x < 0 || y < 0 || x > gameState.tilemap.layers[0].width * 8 || y > gameState.tilemap.layers[0].height * 8) {
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
        this.deaths = 0;
        this.shootX = 1;
        this.shootY = 0;
        this.nukeCooldown = 0.0;
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
        this.storeStats();
        delete gameState.players[this.id];
    }
    spawn() {
        if (this.kills > 1000)
            this.sprite = 6;
        else if (this.kills > 500)
            this.sprite = 5;
        else if (this.kills > 100)
            this.sprite = 7;
        else
            this.sprite = 4;
        this.hp = 10;
        this.alive = true;
        const spawns = gameState.getEntitiesInGroup("PlayerSpawns");
        if (spawns.length > 0) {
            const spawn = spawns[gRNG.nextRange(0, spawns.length - 1)];
            this.x = spawn.x;
            this.y = spawn.y;
        }
    }
    increaseKills() {
        this.kills++;
        if (this.id == authUser.id)
            this.updateCounts();
    }
    die() {
        this.sprite = 25;
        this.alive = false;
        this.deaths++;
        if (this.id == authUser.id)
            this.updateCounts();
    }
    updateCounts() {
        killCounter.innerText = "Você matou " + this.kills + " inimigos";
        deathCounter.innerText = "Você morreu " + this.deaths + " vezes";
    }
    revive() {
        this.spawn();
    }
    async loadInStats() {
        const { data, error } = await supabase.from("PlayerStats").select().eq("user_id", this.id);
        if (error)
            return;
        if (data.length == 0) {
            this.kills = 0;
            const { newError } = await supabase.from("PlayerStats").insert({ user_id: this.id });
            if (newError)
                console.log(newError);
        }
        else {
            this.kills = data[0].kills;
            this.deaths = data[0].deaths;
            this.updateCounts();
            if (this.kills > 1000)
                this.sprite = 6;
            else if (this.kills > 500)
                this.sprite = 5;
            else if (this.kills > 100)
                this.sprite = 7;
            else
                this.sprite = 4;
        }
    }
    async storeStats() {
        if (this.id == authUser.id) {
            const { error } = await supabase.from("PlayerStats").update({ kills: this.kills, deaths: this.deaths }).eq("user_id", this.id);
            if (error)
                console.log(error);
        }
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
                if (!input.strafe.pressed) {
                    this.shootX = dx;
                    this.shootY = dy;
                }
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
                    gameState.entities.push(new Bullet(this.id, this.x, this.y, this.shootX, this.shootY, BulletType.BULLET));
                    let shootMessage = new Message;
                    shootMessage.type = MessageType.PLAYER_SHOT;
                    shootMessage.data = new PlayerShotData(this.id, this.x, this.y, this.shootX, this.shootY, BulletType.BULLET);
                    broadcastMessage(shootMessage);
                }
                if (input.nuke.justPressed && this.nukeCooldown <= 0) {
                    for (let i = 0; i < 16; i++) {
                        const angle = i * 3.14159265 / 8;
                        const dx = Math.cos(angle);
                        const dy = Math.sin(angle);
                        gameState.entities.push(new Bullet(this.id, this.x, this.y, dx, dy, BulletType.NUKE));
                    }
                    let shootMessage = new Message;
                    shootMessage.type = MessageType.PLAYER_SHOT;
                    shootMessage.data = new PlayerShotData(this.id, this.x, this.y, this.shootX, this.shootY, BulletType.NUKE);
                    broadcastMessage(shootMessage);
                    this.nukeCooldown = 15;
                }
                if (this.nukeCooldown > 0)
                    this.nukeCooldown -= DT;
            }
            else {
                const now = Math.floor(Date.now() / 1000);
                if (now % 30 == 0)
                    this.revive();
            }
            gameState.cam.moveTo(this.x, this.y);
        }
        super.update();
    }
    draw() {
        if (this.id == authUser.id)
            drawSprite(6 * 16 + 1, this.iX + (this.shootX * 4), this.iY + (this.shootY * 4));
        super.draw();
        let [tagX, tagY] = gameState.cam.transform(this.iX, this.iY + 8);
        let bounding = gameCanvas.getBoundingClientRect();
        this.nameTag.style.top = (tagY * 3 + bounding.top).toString();
        this.nameTag.style.left = (tagX * 3 + bounding.left).toString();
        if (this.chatTimer > 0.0) {
            [tagX, tagY] = gameState.cam.transform(this.iX + 6, this.iY - 10);
            this.chatBubble.style.top = (tagY * 3 + bounding.top).toString();
            this.chatBubble.style.left = (tagX * 3 + bounding.left).toString();
            this.chatTimer -= DT;
            if (this.chatTimer < 0.0) {
                this.chatBubble.className = "hidden chat-bubble";
            }
        }
    }
}
class PlayerSpawn extends Entity {
    constructor(x, y) {
        super(0, x, y);
        this.group = "PlayerSpawns";
        this.visible = false;
        this.physical = false;
    }
}
class ZombieSpawner extends Entity {
    constructor(x, y, time, radius) {
        super(0, x, y);
        this.everySeconds = 30;
        this.radiusX = 64;
        this.radiusY = 64;
        this.spawnedThisSecond = false;
        this.minZombies = 15;
        this.maxZombies = 30;
        this.group = "ZombieSpawns";
        this.visible = false;
        this.everySeconds = time;
        this.radiusX = radius;
        this.radiusY = radius;
    }
    newWave(seed) {
        const rng = new RNG(seed + this.radiusX + this.radiusY + this.everySeconds);
        const zombieCount = rng.nextRange(this.minZombies, this.maxZombies);
        for (let i = 0; i < zombieCount; i++) {
            const x = this.x + rng.nextRange(0, this.radiusX);
            const y = this.y + rng.nextRange(0, this.radiusY);
            gameState.entities.push(new Zombie(x, y, 0));
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
const NUKE_SPRITE = 8 * 16 + 8;
var BulletType;
(function (BulletType) {
    BulletType[BulletType["BULLET"] = 0] = "BULLET";
    BulletType[BulletType["NUKE"] = 1] = "NUKE";
})(BulletType || (BulletType = {}));
class Bullet extends Entity {
    constructor(player, x, y, dx, dy, type) {
        const sprites = [NUKE_SPRITE, BULLET_SPRITE];
        super(sprites[type], x, y);
        this.lifetime = 2.0;
        this.group = "Bullets";
        this.dirX = dx;
        this.dirY = dy;
        this.speed = 2;
        this.player = player;
        this.type = type;
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
        if (other.group == "Enemies") {
            if (other.damage(1)) {
                gameState.players[this.player].increaseKills();
            }
            this.delete();
        }
    }
}
class Zombie extends Entity {
    constructor(x, y, target) {
        const sprite = 9 + gRNG.nextRange(0, 4);
        super(sprite, x, y);
        this.target = 0;
        this.group = "Enemies";
        this.hp = 2;
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
        const players = gameState.getEntitiesInGroup("Players");
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
let gameState = new Gamestate({ layers: [{ width: 1, height: 1 }] });
async function loadTilemap() {
    let res = await fetch(MAP_URL);
    return await res.json();
}
function drawSprite(spriteID, x, y) {
    if (canvasCtx) {
        const SIZE = 8;
        const sx = SIZE * (spriteID % 16);
        const sy = SIZE * Math.floor(spriteID / 16);
        let [dx, dy] = gameState.cam.transform(x, y);
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
let deathGradient = null;
async function load() {
    if (canvasCtx) {
        let tilemap = await loadTilemap();
        gameState = new Gamestate(tilemap);
        canvasCtx.imageSmoothingEnabled = false;
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
    KeyZ: "strafe",
    KeyC: "nuke"
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
    strafe: new Input(),
    nuke: new Input(),
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
    constructor(player, x, y, dx, dy, type) {
        this.player = player;
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.type = type;
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
    gameState.entities.push(player);
    gameState.players[userID] = player;
    player.loadInStats();
    player.spawn();
}
function deletePlayer(userID) {
    gameState.players[userID].delete();
}
async function joinChannel(channelName) {
    let tilemap = await loadTilemap();
    gameState = new Gamestate(tilemap);
    if (channel) {
        supabase.removeChannel(channel);
        channel = null;
    }
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
        if (shot.type == BulletType.BULLET) {
            gameState.entities.push(new Bullet(shot.player, shot.x, shot.y, shot.dx, shot.dy, shot.type));
        }
        else if (shot.type == BulletType.NUKE) {
            for (let i = 0; i < 16; i++) {
                const angle = i * 3.14159265 / 8;
                const dx = Math.cos(angle);
                const dy = Math.sin(angle);
                gameState.entities.push(new Bullet(shot.player, shot.x, shot.y, dx, dy, shot.type));
            }
        }
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
        let userStatus = {
            user: authUser.id,
            name: authUser.user_metadata.display_name
        };
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
    for (let player in gameState.players) {
        deletePlayer(player);
    }
    gameState.players = {};
    gameState.entities = [];
    gameState.valid = false;
});
function onPlayerMoved(msg) {
    if (!msg.playerID)
        return;
    gameState.players[msg.playerID].x = msg.mx;
    gameState.players[msg.playerID].y = msg.my;
}
function chatNotify(msg) {
    let p = document.createElement("p");
    p.innerText = msg;
    p.className = "room-notification";
    chatLog.appendChild(p);
}
function newChatMessage(msg) {
    if (gameState.players[msg.user]) {
        let p = document.createElement("p");
        p.innerText = gameState.players[msg.user].name + ": " + msg.text;
        chatLog.appendChild(p);
        gameState.players[msg.user].setChatText(msg.text);
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
    const userName = data.user.user_metadata.display_name;
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
    window.setInterval(() => { gameState.loop(); }, 1000 * DT);
}
go();
