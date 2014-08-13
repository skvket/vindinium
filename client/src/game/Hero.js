var PIXI = require("pixi.js");
var smoothstep = require("smoothstep");
var BezierEasing = require("bezier-easing");
var tilePIXI = require("./tilePIXI");
var loadTexture = require("./loadTexture");

var attackEasing = BezierEasing(0.0, 1.33, 0, 1);
var lifeIndicatorIncreaseEasing = BezierEasing(1, 0, 1, 1);
var lifeIndicatorDecreaseEasing = BezierEasing(0, 1, 1, 1);

function step (min, max, value) {
  var x = Math.max(0, Math.min(1, (value-min)/(max-min)));
  return x;
}

function mix (a, b, p) {
  return a + (b-a) * p;
}

var tilePIXI32 = tilePIXI(32);

var heroesTexture = loadTexture("heroes.png");

var orientations = [3, 2, 0, 1]; // N E S W

var heroTextures = [3, 2, 1, 0].map(function (p) {
  return orientations.map(function (o) {
    return tilePIXI32(heroesTexture, o, p);
  });
});
var heroCrownTextures = [3, 2, 1, 0].map(function (p) {
  return orientations.map(function (o) {
    return tilePIXI32(heroesTexture, o+5, p);
  });
});

var blinkTextures = orientations.map(function (o) {
  return tilePIXI32(heroesTexture, o, 4);
});

/*
function manhattan (a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
*/

function interpolatePosition (a, b, p) {
  return {
    x: mix(a.x, b.x, p),
    y: mix(a.y, b.y, p)
  };
}

function rgb (r, g, b) {
  /*jshint bitwise: false */
  return ~~(r) << 16 | ~~(g) << 8 | ~~(b);
}

function createHeroSprite (texture) {
  var heroSprite = new PIXI.Sprite(texture);
  heroSprite.position.x = -4;
  heroSprite.position.y = -8;
  return heroSprite;
}

function Hero (id, obj, tileSize) {
  this.id = id;
  this.tileSize = tileSize;
  PIXI.DisplayObjectContainer.call(this);
  this.lifeIndicator = new PIXI.Graphics();
  this.lifeIndicator.position.x = -5;
  this.lifeIndicator.position.y = 0;
  this.addChild(this.lifeIndicator);

  this.heroTextures = heroTextures;
  this.heroSprite = createHeroSprite(this.heroTextures[id - 1][0]);
  this.blinkSprite = createHeroSprite(blinkTextures[0]);
  this.blinkSprite.alpha = 0;

  this.addChild(this.heroSprite);
  this.addChild(this.blinkSprite);

  this.interpolationEndTime = 0;

  this.updateHero(obj);
}

Hero.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
Hero.prototype.constructor = Hero;

Hero.prototype.refreshHeroSprite = function (orientation) {
  if (this._currentOrientation === orientation && this._currentHeroTextures === this.heroTextures) return;
  this._currentHeroTextures = this.heroesTexture;
  this._currentOrientation = orientation;
  this.heroSprite.setTexture(this.heroTextures[this.id - 1][orientation]);
  this.blinkSprite.setTexture(blinkTextures[orientation]);
};

Hero.prototype.drawLifeIndicator = function (life) {
  var lpx = Math.round(this.tileSize * life / 100);
  var color = rgb(255 * smoothstep(60, 30, life), 255 * smoothstep(0, 90, life), 50);
  this.lifeIndicator.clear();
  var graphics = this.lifeIndicator;
  graphics.beginFill(color);
  graphics.drawRect(0, this.tileSize - lpx, 3, lpx);
};

Hero.prototype.setPosition = function (pos) {
  this.position.x = pos.x * this.tileSize;
  this.position.y = pos.y * this.tileSize;
};

Hero.prototype.updateHero = function (meta, interpolationTime, consecutiveTurn) {
  this.meta = meta;
  this.heroTextures = meta.winning ? heroCrownTextures : heroTextures;
  this.updatedTime = Date.now();
  this.consecutiveTurn = consecutiveTurn;
  this.interpolationTime = interpolationTime;
};

Hero.prototype.render = function () {
  var meta = this.meta;
  var t = Date.now() - this.updatedTime;

  // Some animations only make sense for consecutiveTurn
  if (meta.from && this.consecutiveTurn && this.interpolationTime) {
    var p = step(0, this.interpolationTime, t);
    var lifeIndicatorEasing = meta.from.life < meta.to.life ? lifeIndicatorIncreaseEasing : lifeIndicatorDecreaseEasing;
    this.drawLifeIndicator(mix(meta.from.life, meta.to.life, lifeIndicatorEasing(p)));
    var moveProgress = meta.attack ? attackEasing(p) : p;
    this.setPosition(meta.killed || meta.move ? interpolatePosition(meta.from.pos, meta.to.pos, moveProgress) : meta.to.pos);
    this.refreshHeroSprite(meta.orientation[Math.min(meta.orientation.length-1, Math.floor(p * meta.orientation.length))]);
  }
  else {
    this.drawLifeIndicator(meta.to.life);
    this.setPosition(meta.to.pos);
    this.refreshHeroSprite(meta.orientation[meta.orientation.length - 1]);
  }

  // Some animations can be done absolutely
  this.blinkSprite.alpha = (meta.killed || (meta.takeMine || meta.attacked) && t < 80) ? 1 : 0;
};

Hero.prototype.getTexture = function () {
  return this.heroTextures[this.id - 1][2];
};

Hero.prototype.logMeta = function (meta) {
  var logs = "Hero"+this.id+": ";
  var ignored = ["from", "to"];
  for (var k in meta) {
    if (ignored.indexOf(k) === -1) {
      if (meta[k] !== null) {
        var value = meta[k];
        var typ = typeof meta[k];
        if (typ === "object" && !(meta[k] instanceof Array))
          value = JSON.stringify(value);
        if (typ === "boolean")
          logs += (value ? k+" " : "");
        else
          logs += k+"="+value+" ";
      }
    }
  }
  return logs;
};

Hero.blinkTextures = blinkTextures;

module.exports = Hero;
