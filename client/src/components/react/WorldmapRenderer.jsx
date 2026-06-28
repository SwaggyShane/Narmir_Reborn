import { REGION_META, REGION_BONUSES } from '../../utils/raceData.js';
import { escapeHtml } from '../../utils/escapeHtml.js';

function regionOpacity(race, highlightedRace, dim = '0.3') {
  if (!highlightedRace) return '1';
  return race === highlightedRace ? '1' : dim;
}

export function renderWorldMap(kingdoms, routes = [], highlightedRace = null, kingdomId = null) {
  const state = {
    kingdomId,
  };

        var W = 900,

          H = 650;

        var bg = "url(#oceanGrad)";



        // Build SVG

        var svg =

          '<svg viewBox="0 0 ' +

          W +

          " " +

          H +

          '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;border-radius:12px;box-shadow:inset 0 0 40px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5); background:#040710;">';
        // Defs - filters and gradients
        svg +=

          "<defs>" +

          '<linearGradient id="oceanGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#050a18"/><stop offset="50%" stop-color="#091225"/><stop offset="100%" stop-color="#03050c"/></linearGradient>' +

          '<radialGradient id="vignette" cx="50%" cy="50%" r="75%"><stop offset="40%" stop-color="transparent"/><stop offset="100%" stop-color="rgba(0,0,0,0.85)"/></radialGradient>' +

          '<filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +

          '<filter id="softglow"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +

          '<filter id="uiShadow"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.9"/></filter>' +

          "</defs>";



        // Background

        svg += '<rect width="' + W + '" height="' + H + '" fill="' + bg + '"/>';



        svg += '<g stroke="rgba(255,255,255,0.03)" stroke-width="1">';

        for (var gx = 0; gx < W; gx += 60)

          svg +=

            '<line x1="' + gx + '" y1="0" x2="' + gx + '" y2="' + H + '"/>';

        for (var gy = 0; gy < H; gy += 60)

          svg +=

            '<line x1="0" y1="' + gy + '" x2="' + W + '" y2="' + gy + '"/>';

        svg += "</g>";



        var rhumbs = [

          [W * 0.15, H * 0.2],

          [W * 0.85, H * 0.25],

          [W * 0.5, H * 0.85],

        ];

        rhumbs.forEach(function (pt) {

          svg +=

            '<circle cx="' +

            pt[0] +

            '" cy="' +

            pt[1] +

            '" r="800" stroke="rgba(255,255,255,0.015)" stroke-width="1" fill="none"/>';

          svg +=

            '<circle cx="' +

            pt[0] +

            '" cy="' +

            pt[1] +

            '" r="400" stroke="rgba(255,255,255,0.015)" stroke-width="1" fill="none"/>';

          for (var i = 0; i < 20; i++) {

            var a = (i * Math.PI) / 4;

            svg +=

              '<line x1="' +

              pt[0] +

              '" y1="' +

              pt[1] +

              '" x2="' +

              (pt[0] + Math.cos(a) * W) +

              '" y2="' +

              (pt[1] + Math.sin(a) * W) +

              '" stroke="rgba(255,255,255,0.02)" stroke-width="1"/>';

          }

        });



        // Draw regions as rough hexagonal territory shapes

        var regionPaths = {

          dwarf:

            "M160,150 L280,120 L360,180 L380,260 L320,350 L210,380 L140,310 Z",

          high_elf:

            "M440,80 L580,50 L680,100 L710,190 L670,280 L520,300 L410,230 Z",

          orc: "M580,320 L720,290 L810,360 L780,480 L660,540 L530,500 L510,400 Z",

          dark_elf:

            "M370,290 L480,310 L520,400 L480,510 L340,530 L290,440 L280,340 Z",

          human: "M160,400 L260,390 L310,480 L290,560 L180,580 L100,500 Z",

          dire_wolf: "M40,320 L130,300 L180,350 L150,450 L70,540 L30,460 Z",

        };



        // Region fills

        Object.entries(REGION_META).forEach(function (e) {

          var race = e[0];

          var meta = e[1];

          var path = regionPaths[race] || "";

          if (!path) return;



          // Layer 1: Deep water shelf

          svg +=

            '<path d="' +

            path +

            '" fill="none" stroke="' +

            meta.color +

            '" opacity="0.15" stroke-width="70" stroke-linejoin="round" stroke-linecap="round"/>';

          // Layer 2: Shallow water shelf

          svg +=

            '<path d="' +

            path +

            '" fill="none" stroke="' +

            meta.color +

            '" opacity="0.35" stroke-width="40" stroke-linejoin="round" stroke-linecap="round"/>';

          // Layer 3: Landmass base

          svg +=

            '<path d="' +

            path +

            '" fill="' +

            meta.color +

            '" stroke="' +

            meta.color +

            '" stroke-width="25" stroke-linejoin="round" stroke-linecap="round" fill-opacity="0.85" class="region-shape" data-race="' +

            escapeHtml(race) +

            '" style="transition:opacity 0.3s;opacity:' + regionOpacity(race, highlightedRace) + '"/>';

          // Layer 4: Inner styling/texture (border coastline)

          svg +=

            '<path d="' +

            path +

            '" fill="none" stroke="' +

            meta.stroke +

            '" stroke-width="1.5" stroke-linejoin="round" class="region-shape" data-race="' +

            escapeHtml(race) +

            '" stroke-dasharray="8 6" opacity="0.75" style="transition:opacity 0.3s;opacity:' + regionOpacity(race, highlightedRace) + '"/>';



          // Region label

          var pts = path.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g) || [];

          var xs = pts.map(function (p) {

            return parseFloat(p.split(",")[0]);

          });

          var ys = pts.map(function (p) {

            return parseFloat(p.split(",")[1]);

          });

          var cx =

            xs.reduce(function (a, b) {

              return a + b;

            }, 0) / xs.length;

          var cy =

            ys.reduce(function (a, b) {

              return a + b;

            }, 0) / ys.length;



          if (race === "orc") cy -= 15;

          if (race === "human") cx -= 20;



          svg += '<g filter="url(#uiShadow)">';

          svg +=

            '<text x="' +

            cx +

            '" y="' +

            (cy - 8) +

            '" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="22" fill="#ffffff" opacity="0.9" pointer-events="none" style="text-transform:uppercase;letter-spacing:2px;">' +

            escapeHtml(meta.name || '') +

            "</text>";

          svg +=

            '<text x="' +

            cx +

            '" y="' +

            (cy + 12) +

            '" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="12" fill="' +

            meta.stroke +

            '" opacity="0.95" pointer-events="none">' +

            escapeHtml(REGION_BONUSES[race] || "") +

            "</text>";

          svg += "</g>";

        });
        // Grid lines - subtle
        for (gx = 0; gx < W; gx += 80) {

          svg +=

            '<line x1="' +

            gx +

            '" y1="0" x2="' +

            gx +

            '" y2="' +

            H +

            '" stroke="#ffffff" stroke-width="0.3" opacity="0.04"/>';

        }

        for (gy = 0; gy < H; gy += 80) {

          svg +=

            '<line x1="0" y1="' +

            gy +

            '" x2="' +

            W +

            '" y2="' +

            gy +

            '" stroke="#ffffff" stroke-width="0.3" opacity="0.04"/>';

        }



        // Kingdom dots

        var kdCoords = {};

        var regionSeeds = {

          dwarf: [

            [220, 180],

            [280, 160],

            [330, 220],

            [300, 280],

            [240, 320],

            [180, 260],

            [260, 240],

            [200, 320],

          ],

          high_elf: [

            [500, 100],

            [580, 90],

            [640, 140],

            [660, 220],

            [600, 260],

            [480, 240],

            [540, 160],

            [580, 210],

          ],

          orc: [

            [630, 330],

            [700, 330],

            [750, 400],

            [720, 480],

            [620, 510],

            [560, 460],

            [660, 390],

            [600, 410],

          ],

          dark_elf: [

            [420, 330],

            [480, 350],

            [480, 440],

            [420, 500],

            [350, 460],

            [320, 380],

            [400, 410],

            [380, 450],

          ],

          human: [

            [200, 430],

            [240, 420],

            [280, 490],

            [240, 540],

            [150, 530],

            [140, 460],

            [210, 490],

            [180, 500],

          ],

          dire_wolf: [

            [80, 350],

            [140, 340],

            [140, 410],

            [100, 490],

            [60, 450],

            [80, 390],

            [110, 450],

            [50, 400],

          ],

        };



        kingdoms.forEach(function (k, i) {

          var seeds = regionSeeds[k.race] || [];

          var seed = seeds[i % seeds.length] || [W / 2, H / 2];

          kdCoords[k.id] = {

            x: seed[0] + (((i * 17 + 3) % 30) - 15),

            y: seed[1] + (((i * 13 + 7) % 30) - 15),

          };

        });



        // Draw Trade Route Lines

        routes.forEach(function (r) {

          var p1 = kdCoords[r.kingdom_id];

          var p2 = kdCoords[r.partner_id];

          if (p1 && p2) {

            svg +=

              '<line x1="' +

              p1.x +

              '" y1="' +

              p1.y +

              '" x2="' +

              p2.x +

              '" y2="' +

              p2.y +

              '" stroke="var(--gold)" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.4">' +

              '<animate attributeName="stroke-dashoffset" from="16" to="0" dur="2s" repeatCount="indefinite" />' +

              "</line>";

          }

        });



        var sortedKingdoms = kingdoms.slice().sort(function (a, b) {

          return b.land - a.land;

        });

        sortedKingdoms.forEach(function (k, i) {

          var coords = kdCoords[k.id] || { x: 0, y: 0 };

          var jx = coords.x;

          var jy = coords.y;

          var isMe = k.id === state.kingdomId;

          var dotColor = REGION_META[k.race]

            ? REGION_META[k.race].stroke

            : "#ffffff";

          var r = isMe

            ? 7

            : Math.max(4.5, Math.min(8, 3.5 + Math.floor(k.land / 4000)));



          svg +=

            '<circle cx="' +

            jx +

            '" cy="' +

            (jy + 2) +

            '" r="' +

            r +

            '" fill="#000" opacity="0.6"/>';



          if (isMe) {

            svg +=

              '<circle cx="' +

              jx +

              '" cy="' +

              jy +

              '" r="15" fill="none" stroke="#e8b84b" stroke-width="1.5"><animate attributeName="r" values="' +

              r +

              ';24" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.8;0" dur="2s" repeatCount="indefinite"/></circle>';

          }



          svg +=

            '<circle cx="' +

            jx +

            '" cy="' +

            jy +

            '" r="' +

            r +

            '" fill="' +

            (isMe ? "#e8b84b" : dotColor) +

            '" stroke="' +

            (isMe ? "#fff" : "#111") +

            '" stroke-width="' +

            (isMe ? 2 : 1) +

            '" class="kd-dot" data-race="' +

            k.race +

            '" data-kingdom-id="' + escapeHtml(String(k.id)) +

            '" style="cursor:pointer;transition:opacity 0.3s;opacity:' + regionOpacity(k.race, highlightedRace, '0.2') + '" filter="' +

            (isMe ? "url(#glow)" : "url(#uiShadow)") +

            '"/>';



          if (isMe || k.land > 5000 || k.rank <= 3) {

            svg +=

              '<text x="' +

              jx +

              '" y="' +

              (jy - r - 5) +

              '" text-anchor="middle" font-family="sans-serif" font-size="' +

              (isMe ? 12 : 9) +

              '" font-weight="' +

              (isMe ? 800 : 600) +

              '" fill="' +

              (isMe ? "#e8b84b" : "#fff") +

              '" filter="url(#uiShadow)" pointer-events="none">' +

              escapeHtml(k.name.slice(0, 10)) +

              "</text>";

          }

        });



        // Title

        svg +=

          '<text x="' +

          W / 2 +

          '" y="35" text-anchor="middle" font-family="Georgia,serif" font-size="18" fill="#e8b84b" filter="url(#glow)" font-weight="bold" letter-spacing="4" style="text-shadow: 0 4px 10px #000">NARMIR REBORN</text>';



        // Compass rose

        svg +=

          '<g transform="translate(' +

          (W - 90) +

          ", " +

          (H - 90) +

          ') scale(0.9)">' +

          '<circle cx="0" cy="0" r="45" fill="none" stroke="rgba(232, 184, 75, 0.4)" stroke-width="1.5" stroke-dasharray="4 4"/>' +

          '<circle cx="0" cy="0" r="35" fill="rgba(6, 8, 16, 0.5)" stroke="rgba(232, 184, 75, 0.6)" stroke-width="2"/>' +

          '<path d="M0,-30 L8,-8 L30,0 L8,8 L0,30 L-8,8 L-30,0 L-8,-8 Z" fill="rgba(232, 184, 75, 0.15)" stroke="#e8b84b" stroke-width="1"/>' +

          '<path d="M0,-30 L0,30 M-30,0 L30,0" stroke="#e8b84b" stroke-width="1.5" opacity="0.6"/>' +

          '<text x="0" y="-40" text-anchor="middle" font-family="Georgia,serif" font-size="16" fill="#e8b84b" font-weight="bold" filter="url(#glow)">N</text>' +

          "</g>";



        // Vignette over everything

        svg +=

          '<rect width="' +

          W +

          '" height="' +

          H +

          '" fill="url(#vignette)" pointer-events="none"/>';



        svg += "</svg>";

        return svg;
      }
