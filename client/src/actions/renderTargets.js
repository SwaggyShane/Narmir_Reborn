import { gameStateManager } from '../GameStateManager.js';
import { fmt } from '../utils/fmt.js';

const RACE_ICONS = window.RACE_ICONS || {};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

export function renderTargets(list, containerId, selectFn) {
  const state = window.state || gameStateManager.getState();

        var el = document.getElementById(containerId);

        if (!el) return;

        var isSelect = el.tagName === "SELECT";



        // Filtering for attack/covert/spells: show discovered kingdoms AND mapped locations

        var disc = state.discovered_kingdoms || {};

        if (typeof disc === "string")

          try {

            disc = JSON.parse(disc);

          } catch (e) {

            disc = {};

          }



        // Start with the provided list (rankings)

        var filtered = list.filter(function (t) {

          return disc[t.id] && disc[t.id].mapped;

        });



        // ADD: Any other kingdoms in 'disc' that are mapped but NOT in the top rankings list

        Object.keys(disc).forEach(function (id) {

          var d = disc[id];

          if (

            d.mapped &&

            !filtered.find(function (f) {

              return String(f.id) === String(id);

            })

          ) {

            if (String(id) === String(state.kingdomId)) return;

            filtered.push({

              id: id,

              name: d.name || "Kingdom #" + id,

              race: d.race || "unknown",

              level: d.level || 1,

              rank: d.rank || "none",

              fighters: d.fighters || 0,

              land: d.land || 0,

              is_ai: d.is_ai || false,

              is_location: true,

            });

          }

        });



        if (

          containerId === "wsp-target-list" ||

          containerId === "wsp-target-list-w" ||

          containerId === "spell-target-list"

        ) {

          filtered.unshift({

            id: state.kingdomId,

            name: (state.kingdomName || state.name || "My Kingdom") + " (You)",

            race: state.race || "human",

            level: state.level || 1,

            rank: state.rank || "-",

            fighters: state.fighters || 0,

            land: state.land || 0,

            is_ai: false,

          });

        }



        if (!filtered.length && !isSelect) {

          el.innerHTML =

            '<div style="color:var(--text3);font-size:13px;padding:16px;text-align:center">No discovered targets found.<br><br>' +

            '<button class="btn" style="font-size:11px" onclick="switchTab(\'exploration\')">Go Explore</button></div>';

          return;

        }



        if (isSelect) {

          var options = filtered.map(function (t) {

            var label = "";

            if (t.is_location) {

              label = "Location: " + t.name;

            } else if (t.id === state.kingdomId) {

              label = "Self: " + t.name;

            } else {

              label =

                "#" +

                t.rank +

                " " +

                t.name +

                " (" +

                (t.race || "").replace("_", " ") +

                " - " +

                fmt(t.land) +

                " ac)";

            }

            return (

              '<option value="' + t.id + '">' + escapeHtml(label) + "</option>"

            );

          });

          el.innerHTML =

            '<option value="">Select Target kingdom or Location</option>' +

            options.join("");

          return;

        }



        el.innerHTML = filtered

          .map(function (t) {

            var raceIcon = RACE_ICONS[t.race] || "ðŸ‘¤";

            var aiTag = t.is_ai

              ? '<span style="font-size:10px;color:var(--text3);margin-left:4px">[AI]</span>'

              : "";

            return (

              '<div class="target-row" id="tr-' +

              containerId +

              "-" +

              t.id +

              '" onclick="' +

              selectFn +

              "(" +

              t.id +

              ",'" +

              containerId +

              "')\">" +

              '<span class="t-rank" style="width:28px;color:var(--text3);font-size:12px">#' +

              t.rank +

              "</span>" +

              '<span style="font-size:16px;flex-shrink:0">' +

              raceIcon +

              "</span>" +

              '<span class="t-name" style="flex:1;min-width:0">' +

              t.name +

              aiTag +

              '<div style="font-size:11px;color:var(--text3)">Lv ' +

              (t.level || 1) +

              " Â· " +

              (t.race || "").replace("_", " ") +

              "</div></span>" +

              '<span style="font-size:12px;color:var(--text);text-align:right;white-space:nowrap"><span style="color:var(--gold)">' +

              fmt(t.land) +

              '</span> ac<div style="color:var(--text3)">' +

              fmt(t.fighters) +

              " fighters</div></span>" +

              "</div>"

            );

          })

          .join("");

      }




