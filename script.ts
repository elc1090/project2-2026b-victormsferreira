// @ts-ignore Import module
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = "https://yduvtxtfzcgfeaehgisj.supabase.co";
const SUPABASE_KEY = "sb_publishable_4CmRmdx13Sy1TXfMHwL1zQ_ngA7IN6n";
const MAP_URL = "https://yduvtxtfzcgfeaehgisj.supabase.co/storage/v1/object/public/Assets/map.tmj";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const gameCanvas = <HTMLCanvasElement>document.getElementById("game-canvas");
const gameCanvasContainer = <HTMLDivElement>document.getElementById("game-canvas-container");
const canvasCtx = gameCanvas.getContext("2d");
const spritesheet = <HTMLImageElement>document.getElementById("tileset");
const messageBox = <HTMLInputElement>document.getElementById("message-box");
const chatLog = <HTMLDivElement>document.getElementById("chatlog");
const killCounter = <HTMLParagraphElement>document.getElementById("kill-counter");
const deathCounter = <HTMLParagraphElement>document.getElementById("death-counter");
const respawnTimer = <HTMLParagraphElement>document.getElementById("respawn-timer");
const DT = 1.0 / 60.0;

let authUser : any;

class Gamestate {
  cam: Camera;
  blockmap: Blockmap;
  entities: Entity[] = [];
  players: Record<string, Player> = {};
  tilemap: any = {};
  valid: boolean = false;
  dateNow: number = 0;
  constructor(tilemap: any) {
    const worldWidth = tilemap.layers[0].width * 8;
    const worldHeight = tilemap.layers[0].height * 8;
    this.cam = new Camera();
    this.cam.setBounds(0, 0, worldWidth, worldHeight);
    this.blockmap = new Blockmap(worldWidth, worldHeight, 32);
    this.tilemap = tilemap;
    if (authUser) {
      this.valid = true;
    } else {
      this.valid = false;
    }
    for (const layer of tilemap.layers) {
      if (layer.objects) {
        for (const object of layer.objects) {
          if (object.type == "ZombieSpawner") {
            console.log(object);
            let spawner = new ZombieSpawner(Math.floor(object.x), Math.floor(object.y), 30, 64);
            for (const property of object.properties) {
              if (property.name == "maxZombies") spawner.maxZombies = property.value;
              if (property.name == "minZombies") spawner.minZombies = property.value;
              if (property.name == "timer") spawner.everySeconds = property.value;
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
    this.dateNow = Date.now();
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
    if (!canvasCtx) return;
    canvasCtx.fillStyle = "rgb(0 0 0)";
    canvasCtx.fillRect(0, 0, 320, 240);
    drawTilemap(this.tilemap);
    for (const entity of this.entities) {
      if (entity.visible) entity.draw();
    }
    if (!(this.players[authUser.id]?.alive)) {
      canvasCtx.fillStyle = deathGradient;
      canvasCtx.fillRect(0, 0, 320, 240);
      let now = Math.floor(this.dateNow / 1000);
      let nextRespawn = now;
      nextRespawn = Math.floor(nextRespawn / 30);
      nextRespawn += 1;
      nextRespawn *= 30;
      const respawnLeft = nextRespawn - now;
      respawnTimer.innerText = "Revivendo em " + respawnLeft + " segundos.";
    } else {
      respawnTimer.innerText = "";
    }
  }
  loop() {
    if (!this.valid) return;
    this.update();
    this.draw();
  }
  getEntitiesInGroup(group: string) {
    return this.entities.filter((e) => {return e.group == group});
  }
}

// JavaScript's Math.random is not seedable. Need a custom PRNG for the determinism 
class RNG {
  state: number;
  m: number = 2**31;
  a: number = 1103515245;
  c: number = 12345;

  constructor(seed: number) {
    this.state = seed;
  }
  next() {
    this.state = (this.a * this.state + this.c) % this.m;
    return this.state;
  }
  nextRange(min: number, max: number) {
    const range = (max - min) + 1;
    return Math.floor(this.next() / (this.m / range)) + min;
  }
}
const gRNG = new RNG(1347319847140194);

class Blockmap {
  map: Entity[][] = [];
  width: number;
  height: number;
  blockSize: number;
  constructor(width: number, height: number, blockSize: number) {
    this.blockSize = blockSize;
    this.width = Math.floor(width / this.blockSize);
    this.height = Math.floor(height / this.blockSize);
  }
  clear() {
    for (let i = 0; i < this.width * this.height; i++) {
      this.map[i] = [];
    }
  }
  checkCollisions(block: number) {
    let collisions : [a: Entity, b: Entity][] = [];
    for (let i = 0; i < this.map[block].length-1; i++) {
      for (let j = i+1; j < this.map[block].length; j++) {
        if (this.map[block][i].collidesWith(this.map[block][j])) 
          collisions.push([this.map[block][i], this.map[block][j]])
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
  addEntity(e: Entity) {
    if (!e.physical) return;
    const x = Math.floor(e.x / this.blockSize);
    const y = Math.floor(e.y / this.blockSize);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.map[y * this.width + x].push(e);
  }
  addEntities(eList: Entity[]) {
    for (const entity of eList)
      this.addEntity(entity);
  }
  getEntitiesInBlock(block: number) {
    return this.map[block];
  }
  getEntitiesInGridCoords(x: number, y: number) {
    return this.getEntitiesInBlock(y * this.width + x);
  }
  getEntitiesInWorldCoords(x: number, y: number) {
    x = Math.floor(x / this.blockSize);
    y = Math.floor(y / this.blockSize);
    return this.getEntitiesInGridCoords(x, y);
  }
}


class Camera {
  x: number = 0;
  y: number = 0;
  smooth: number = 0.1;
  minX: number = 0;
  minY: number = 0;
  maxX: number = 0;
  maxY: number = 0;
  bound: boolean = false;
  setBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
    this.bound = true;
  }
  transform(posX : number, posY : number): [x: number, y: number] {
    return [Math.round(posX - this.x + 160), Math.round(posY - this.y + 120)];
  }
  moveTo(newX : number, newY : number): void {
    this.x = this.x + (newX - this.x) * this.smooth;
    this.y = this.y + (newY - this.y) * this.smooth;
    if (this.bound) {
      if (this.x - 160 < this.minX) this.x = this.minX + 160;
      if (this.x + 160 > this.maxX) this.x = this.maxX - 160;
      if (this.y - 120 < this.minY) this.y = this.minY + 120;
      if (this.y + 120 > this.maxY) this.y = this.maxY - 120;
    }
  }
}

class Entity {
  x: number;
  y: number;
  iX: number;
  iY: number;
  dirX: number = 1;
  dirY: number = 0;
  speed: number = 0;
  sprite: number;
  interpolated: boolean = false;
  visible: boolean = true;
  group: string = "";
  hp: number = 1;
  physical: boolean = true;
  alive: boolean = true;
  constructor(sprite: number, x: number, y: number) {
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
  collidesWith(other: Entity): boolean {
    const RADIUS = 7.0;
    const dx: number = (other.x + 4) - (this.x + 4);
    const dy: number = (other.y + 4) - (this.y + 4);
    const d2 = dx * dx + dy * dy;
    return (d2 < (RADIUS * RADIUS));
  }
  distance2To(other: Entity): number {
    let dx = other.x - this.x;
    let dy = other.y - this.y;
    return dx * dx + dy * dy;
  }
  directionTo(other: Entity): [x: number, y: number] {
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
  damage(amt: number): boolean {
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
    if (this.checkForMapCollision())
      this.onCollideWithMap(Math.floor((this.x + 4) / 8), Math.floor((this.y + 6) / 8), 1, true);
    this.y += this.dirY * this.speed;
    if (this.checkForMapCollision())
      this.onCollideWithMap(Math.floor((this.x + 4) / 8), Math.floor((this.y + 6) / 8), 1, false);

    if (this.interpolated) {
      const LERP_CONSTANT = 0.2;
      this.iX += (this.x - this.iX) * LERP_CONSTANT;
      this.iY += (this.y - this.iY) * LERP_CONSTANT;
    } else {
      this.iX = this.x;
      this.iY = this.y;
    }
  }
  checkForMapCollision() {
    let x = this.x + 4;
    let y = this.y + 6;
    const layer: any = gameState.tilemap.layers[0]
    if (x < 0 || y < 0 || x > layer.width *8 || y > layer.height * 8) {
      return true;
    }
    let tX = Math.floor(x / 8);
    let tY = Math.floor(y / 8);
    let tile = layer.data[tY * layer.width + tX] -1;
    const TILE_SOLIDITY : boolean[] = [
      true , true , true , true , false, false, false, false, false, false, false, false, false, false, false, false,
      true , false, true , true , false, false, false, false, false, false, false, false, false, false, false, false,
      true , true , false, true , true , true , true , true , false, false, false, false, false, false, false, false,
      true , true , true , true , true , true , true , true , false, false, false, false, false, false, true , true ,
      true , true , true , true , false, false, true , true , true , true , false, true , true , true , true , true ,
      true , true , true , true , false, false, false, false, false, false, false, true , true , false, true , true ,
      false, false, false, false, false, false, false, false, false, false, false, true , true , true , true , true ,
      false, false, false, false, true , true , true , true , true , true , false, true , true , true , true , true ,
      false, false, false, false, false, false, false, false, false, false, false, true , true , true , true , true ,
      true , true , false, true , true , false, true , true , false, true , true , true , true , true , true , true ,
    ]
    if (TILE_SOLIDITY[tile]) {
      return true;
    }
    return false;
  }
  draw() {
    drawSprite(this.sprite, this.iX, this.iY);
  }
  onCollideWithEntity(other: Entity) {
  } 
  onCollideWithMap(x: number, y: number, tile: number, horizontal: boolean) {
  }
}

class Player extends Entity {
  name: string;
  id : string;
  nameTag: HTMLParagraphElement;
  chatBubble: HTMLParagraphElement;
  chatText: string = "";
  chatTimer: number = 0;
  kills: number = 0;
  deaths: number = 0;
  shootX: number = 1;
  shootY: number = 0;
  nukeCooldown: number = 0.0;
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
    else this.sprite = 4;
    this.hp = 10;
    this.alive = true;
    const spawns = gameState.getEntitiesInGroup("PlayerSpawns");
    if (spawns.length > 0) {
      const spawn = spawns[gRNG.nextRange(0, spawns.length-1)];
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
    if (error) return;
    if (data.length == 0) {
      this.kills = 0;
      const {newError} = await supabase.from("PlayerStats").insert({user_id: this.id});
      if (newError) console.log(newError);
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
      else this.sprite = 4;
    }
  }
  async storeStats() {
    if (this.id == authUser.id) {
      const {error} = await supabase.from("PlayerStats").update({kills: this.kills, deaths: this.deaths}).eq("user_id", this.id);
      if (error) console.log(error);
    }
  }
  constructor(name : string, id : string) {
    super(4, 8, 8);
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
    if (id != authUser.id) this.interpolated = true;
  }
  setPosition(x: number, y : number) {
    this.x = x;
    this.y = y;
  }
  setChatText(text: string) {
    this.chatBubble.className = "chat-bubble";
    this.chatTimer = 5.0;
    this.chatBubble.innerText = text;
  }
  onCollideWithMap(x: number, y: number, tile: number, horizontal: boolean): void {
    if (horizontal) {
      if (this.dirX > 0) this.x = x * 8 - 5;
      else if (this.dirX < 0) this.x = (x + 1) * 8 - 4;
    } else {
      if (this.dirY > 0) this.y = y * 8 - 7;
      else if (this.dirY < 0) this.y = (y + 1) * 8 - 6;
    }
  }
  update() {
    if (this.id == authUser.id) {
      let dx : number = 0;
      let dy : number = 0;
      if (input.left.pressed) dx -= 1.0;
      if (input.right.pressed) dx += 1.0;
      if (input.up.pressed) dy -= 1.0;
      if (input.down.pressed) dy += 1.0
      let playerMoveMessage : Message = new Message;
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
      } else {
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
        if (this.nukeCooldown > 0) this.nukeCooldown -= DT;
      } else {
        const now = Math.floor(gameState.dateNow / 1000);
        if (now % 30 == 0) this.revive();
      }
      gameState.cam.moveTo(this.x, this.y);
    }
    super.update();
  }
  draw() {
    if (this.id == authUser.id)
      drawSprite(6*16+1,this.iX + (this.shootX * 4), this.iY + (this.shootY * 4));
    super.draw();
    let [tagX, tagY] = gameState.cam.transform(this.iX, this.iY + 8);
    let bounding = gameCanvas.getBoundingClientRect();
    this.nameTag.style.top = (tagY * 3 + bounding.top).toString();
    this.nameTag.style.left = (tagX * 3 + bounding.left).toString();
    if (this.chatTimer > 0.0) {
      [tagX, tagY] = gameState.cam.transform(this.iX+6, this.iY - 10);
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
  constructor(x: number, y: number) {
    super(0, x, y);
    this.group = "PlayerSpawns";
    this.visible = false;
    this.physical = false;
  }
}

class ZombieSpawner extends Entity {
  everySeconds: number = 30;
  radiusX: number = 64
  radiusY: number = 64
  spawnedThisSecond: boolean = false;
  minZombies: number = 15;
  maxZombies: number = 30;
  constructor(x: number, y: number, time: number, radius: number) {
    super(0, x, y);
    this.group = "ZombieSpawns";
    this.visible = false;
    this.everySeconds = time;
    this.radiusX = radius;
    this.radiusY = radius;
  }
  newWave(seed: number) {
    const rng = new RNG(seed + this.radiusX + this.radiusY + this.everySeconds);
    const zombieCount = rng.nextRange(this.minZombies, this.maxZombies);
    for (let i = 0; i < zombieCount; i++) {
      const x = this.x + rng.nextRange(0, this.radiusX);
      const y = this.y + rng.nextRange(0, this.radiusY);
      gameState.entities.push(new Zombie(x, y, 0));
    }
  }
  update(): void {
    const now = Math.floor(gameState.dateNow / 1000)
    if (now % this.everySeconds == 0) {
      if (!this.spawnedThisSecond) {
        this.newWave(now);
        this.spawnedThisSecond = true
      }
    } else {
      this.spawnedThisSecond = false;
    }
  }
}

const BULLET_SPRITE : number = 8 * 16 + 1; 
const NUKE_SPRITE : number = 8 * 16 + 8; 
enum BulletType {
  BULLET,
  NUKE
}
class Bullet extends Entity {
  player: string;
  lifetime: number = 2.0;
  type: BulletType;
  constructor(player: string, x: number, y: number, dx: number, dy: number, type: BulletType) {
    const sprites = [NUKE_SPRITE, BULLET_SPRITE];
    super(sprites[type], x, y);
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
  onCollideWithMap(x: number, y: number, tile: number, horizontal: boolean) {
    this.delete();
  }
  onCollideWithEntity(other: Entity): void {
    if (other.group == "Enemies") {
      if (other.damage(1)) {
        gameState.players[this.player].increaseKills();
      }
      this.delete();
    }
  }
}

class Zombie extends Entity {
  target: number = 0;
  constructor(x: number, y: number, target: number) {
    const sprite = 9 + gRNG.nextRange(0, 4);
    super(sprite, x, y);
    this.group = "Enemies";
    this.hp = 2;
  }
  die() {
    this.delete();
  }
  onCollideWithEntity(other: Entity): void {
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
  onCollideWithMap(x: number, y: number, tile: number, horizontal: boolean): void {
    if (horizontal) {
      if (this.dirX > 0) this.x = x * 8 - 5;
      else if (this.dirX < 0) this.x = (x + 1) * 8 - 4;
    } else {
      if (this.dirY > 0) this.y = y * 8 - 7;
      else if (this.dirY < 0) this.y = (y + 1) * 8 - 6;
    }
  }

  update(): void {
    const players = gameState.getEntitiesInGroup("Players");
    if (players.length > 0) {
      let minDist = Infinity;
      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        const d = this.distance2To(player);
        if (player.alive && d < minDist) {
          minDist = d;
          this.target = i;
        }
      }
      if (minDist == Infinity) {
        const dX = Math.cos(gameState.dateNow / 30);
        const dY = Math.sin(gameState.dateNow / 30);
        this.dirX += (dX - this.dirX) * 0.2;
        this.dirY += (dY - this.dirY) * 0.2;
        this.speed += (0.6 - this.speed) * 0.2;

      } else {
        let target : Player = <Player>players[this.target % players.length];
        if (!target.alive) return;
        let [dX, dY] = this.directionTo(target);
        this.dirX += (dX - this.dirX) * 0.2;
        this.dirY += (dY - this.dirY) * 0.2;
        this.speed += (0.6 - this.speed) * 0.2;
      }
    }
    super.update();
  }
}

let gameState : Gamestate = new Gamestate({layers: [{width:1, height:1}]});

async function loadTilemap() {
  let res = await fetch (MAP_URL);
  return await res.json();
}

function drawSprite(spriteID: number, x: number, y: number) {
  if (canvasCtx) {
    const SIZE : number = 8;
    const sx : number = SIZE * (spriteID % 16);
    const sy : number = SIZE * Math.floor(spriteID / 16);
    let [dx, dy] = gameState.cam.transform(x, y);
    canvasCtx.drawImage(spritesheet, sx, sy, SIZE, SIZE, dx, dy, SIZE, SIZE);
  }
}

function drawTilemap(map: any) {
  for (const layer of map.layers) {
    for (let i = 0; i < layer.height; i++) {
      for (let j = 0; j < layer.width; j++) {
        let tile : number = layer.data[i * layer.width + j] - 1;
        if (tile >= 0) {
          drawSprite(tile, j * 8, i * 8);
        }
      }
    }
  }
}

let deathGradient : any = null;


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

let actions : Record<string, string> = {
  ArrowLeft: "left",
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowRight: "right",  
  KeyX: "shoot",
  KeyZ: "strafe",
  KeyC: "nuke"
}

class Input {
  pressed : boolean = false;
  justPressed : boolean = false;
}

let input : Record<string, Input> = {
  left: new Input(),
  right: new Input(),
  up: new Input(),
  down: new Input(),
  shoot: new Input(),
  strafe: new Input(),
  nuke: new Input(),
};

function onKeyDown(key: KeyboardEvent) {
  if (key.repeat) return;
  if (key.code in actions) {
    let action = actions[key.code];
    if (action in input) {
      input[action].justPressed = true;
      input[action].pressed = true;
    }
  }
}

function onKeyUp(key: KeyboardEvent) {
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

enum MessageType {
  CHAT_MESSAGE = "ChatMessage",
  PLAYER_MOVED = "PlayerMoved",
  PLAYER_SHOT = "PlayerShot",
  ZOMBIES_SPAWN = "ZombiesSpawned",
}
class  ChatMessageData {
  user: string = "";
  text: string = "";
};
class PlayerMovedData {
  mx: number = 0;
  my: number = 0;
  playerID : string = "";
}
class ZombiesSpawnedData {
  x: number;
  y: number;
  count: number = 1;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}
class PlayerShotData {
  player: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  type: BulletType;
  constructor(player: string, x: number, y: number, dx: number, dy: number, type: BulletType) {
    this.player = player;
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this.type = type;
  }  
}
type MessageData = ChatMessageData | PlayerMovedData | ZombiesSpawnedData | PlayerShotData; 
class Message {
  type: MessageType = MessageType.CHAT_MESSAGE;
  data: MessageData = new ChatMessageData;
}

let channel : any = null;


function spawnPlayer(name: string, userID: string) {
  let player = new Player(name, userID);
  gameState.entities.push(player);
  gameState.players[userID] = player;
  player.loadInStats();
  player.spawn();  
}

function deletePlayer(userID: string) {
  gameState.players[userID].delete();
}

async function joinChannel(channelName: string) {
  let tilemap = await loadTilemap();
  gameState = new Gamestate(tilemap);

  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }

  channel = supabase.channel("game:rooms:"+channelName, 
    {
      config: {
        broadcast: {
           self: false,
        },
        private: true,
  }});


  channel.on('broadcast', { event: MessageType.CHAT_MESSAGE }, (message : any) => {
    newChatMessage(message.payload);
  });

  channel.on('broadcast', { event: MessageType.PLAYER_MOVED }, (message : any) => {
    onPlayerMoved(message.payload);
  });

  channel.on('broadcast', { event: MessageType.PLAYER_SHOT }, (message : any) => {
    let shot : PlayerShotData = message.payload;
    if (shot.type == BulletType.BULLET) {
      gameState.entities.push(new Bullet(shot.player, shot.x, shot.y, shot.dx, shot.dy, shot.type));  
    } else if (shot.type == BulletType.NUKE) {
      for (let i = 0; i < 16; i++) {
        const angle = i * 3.14159265 / 8;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        gameState.entities.push(new Bullet(shot.player, shot.x, shot.y, dx, dy, shot.type));  
      }
    }
  });


  channel.on('presence', { event: 'sync' }, () => {
    let playerList = <HTMLUListElement>document.getElementById("account-data")?.getElementsByTagName("ul")[0];
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


  channel.subscribe((status : any) => {
    if (status !== 'SUBSCRIBED') {
      return null
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
const joinChannelButton = <HTMLButtonElement>document.getElementById("join-channel-button");
const exitChannelButton = <HTMLButtonElement>document.getElementById("exit-channel-button");
joinChannelButton.addEventListener('click', (e) => {
  let channelName = (<HTMLInputElement>document.getElementById("channel-name")).value;
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

function onPlayerMoved(msg: PlayerMovedData) {
  if (!msg.playerID) return;
  gameState.players[msg.playerID].x = msg.mx;
  gameState.players[msg.playerID].y = msg.my;
}

function chatNotify(msg: string) {
  let p = document.createElement("p");
  p.innerText = msg; 
  p.className = "room-notification";
  chatLog.appendChild(p);
}

function newChatMessage(msg: ChatMessageData) {
  if (gameState.players[msg.user]) {
    let p = document.createElement("p");
    p.innerText = gameState.players[msg.user].name + ": " + msg.text;
    chatLog.appendChild(p);
    gameState.players[msg.user].setChatText(msg.text);
  }
}

function broadcastMessage(msg: Message) {
  channel.send({
    type: "broadcast",
    event: msg.type,
    payload: msg.data,
  });
}




function sendChatMessage(str : string) {
  let msg : Message = new Message;
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
const authContainers : HTMLDivElement[] = [
  <HTMLDivElement>document.getElementById("auth-container"),
  <HTMLDivElement>document.getElementById("login-container"),
  <HTMLDivElement>document.getElementById("signup-container"),
  <HTMLDivElement>document.getElementById("account-data"),
];

const goToSignup = <HTMLButtonElement>document.getElementById("goto-signup-button");
const goToLogin = <HTMLButtonElement>document.getElementById("goto-login-button");
const signupCancel = <HTMLButtonElement>document.getElementById("signup-cancel");
const loginCancel = <HTMLButtonElement>document.getElementById("login-cancel");
const loginButton = <HTMLButtonElement>document.getElementById("login-button");
const signupButton = <HTMLButtonElement>document.getElementById("signup-button");
async function loggedIn() {
const { data, error } = await supabase.auth.getUser()
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


async function signUp(email: string, password: string, username: string) {
  const {data, error} = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {display_name: username}
    },
  });
  if (error) {
    alert("Tentativa de registro inválida");
  } else {
    loggedIn();
  }
}

async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });
  if (error) {
    alert("Tentativa de login inválida");
  } else {
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
  const email = (<HTMLInputElement>document.getElementById("signup-email")).value;
  const username = (<HTMLInputElement>document.getElementById("signup-username")).value;
  const password = (<HTMLInputElement>document.getElementById("signup-password")).value;
  const password2 = (<HTMLInputElement>document.getElementById("signup-confirm-password")).value;
  if (password == password2) {
    signUp(email, password, username);
  }
})
loginButton.addEventListener('click', (e) => {
  const email = (<HTMLInputElement>document.getElementById("login-email")).value;
  const password = (<HTMLInputElement>document.getElementById("login-password")).value;
  login(email, password);
})

window.addEventListener("unload", (e) => {
  if (channel)
    supabase.removeChannel(channel);
})


async function go() {
  await load();
  window.setInterval(() => {gameState.loop()}, 1000 * DT);
}
go();