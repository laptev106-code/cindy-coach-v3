(function(global){
  'use strict';
  function el(tag, className){var node=document.createElement(tag);if(className)node.className=className;return node;}
  function exerciseTotalNode(input){var cell=el('div','exercise-total'),value=el('b'),label=el('span');value.textContent=String(input&&input.total!=null?input.total:0);label.textContent=String(input&&input.label||'');cell.append(value,label);return cell;}
  function lapRow(input){var row=el('div','lap-item'),main=el('div','lap-main'),badge=el('span','lap-badge'),text=el('div'),title=el('b'),total=el('small'),duration=el('span','lap-duration');badge.textContent=String(input&&input.number||0);title.textContent='Круг '+String(input&&input.number||0);total.textContent='суммарно '+String(input&&input.totalText||'0:00');duration.textContent=String(input&&input.durationText||'0:00');text.append(title,total);main.append(badge,text);row.append(main,duration);return row;}
  function metricCard(input){var card=el('article','profile-metric'),small=el('span'),bold=el('b'),note=el('small');small.textContent=String(input&&input.label||'');bold.textContent=String(input&&input.value||'');note.textContent=String(input&&input.copy||'');card.append(small,bold,note);return card;}
  function insightCard(input){var card=el('article','card profile-insight'+(input&&input.className?' '+input.className:'')),tag=el('span','eyebrow'),heading=el('b'),text=el('p');tag.textContent=String(input&&input.kicker||'');heading.textContent=String(input&&input.title||'');text.textContent=String(input&&input.copy||'');card.append(tag,heading,text);return card;}
  global.CindyPresentationLeafV3=Object.freeze({exerciseTotalNode:exerciseTotalNode,lapRow:lapRow,metricCard:metricCard,insightCard:insightCard});
})(window);
