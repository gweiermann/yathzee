function turnHtml() {
  const player = state.players[state.currentPlayer];
  const showDice = state.rolls > 0 || rolling;
  return `<main class="screen turn-screen">
    <header class="turn-header"><div><p class="eyebrow">${state.currentPlayer+1} von ${state.players.length}</p><h1>${esc(player.name)}</h1><p class="turn-subtitle">Du bist dran.</p></div><button id="reset-game" class="quiet-button" aria-label="Neues Spiel">${icon('reset',19)}</button></header>
    ${compactStatusHtml(player.scores)}
    <section class="dice-stage ${showDice ? '' : 'empty'} ${rolling ? 'is-rolling' : ''}">
      ${!showDice ? `<div class="pre-roll"><div class="ghost-dice">•••</div><p>Fünf Würfel. Drei Versuche.</p></div>` : `<div class="dice-row">${state.dice.map((d,i)=>dieHtml(d,i)).join('')}</div><div class="roll-meta"><span>${rolling ? 'Würfel rollen…' : `Wurf ${state.rolls}/3`}</span><span>${rolling ? '•••' : state.dice.filter(d=>d.locked).length ? `${state.dice.filter(d=>d.locked).length} gehalten` : 'Tippe Würfel zum Halten'}</span></div>`}
    </section>
    <div class="turn-actions">
      ${state.rolls===0 ? `<button id="roll" class="primary-button huge" ${rolling?'disabled':''}>5 Würfel werfen</button>` : `<div class="action-grid"><button id="choose-score" class="${state.rolls>=3 ? 'primary-button' : 'secondary-button'}" ${rolling?'disabled':''}>Wurf eintragen</button><button id="roll" class="${state.rolls<3 ? 'primary-button' : 'secondary-button'}" ${rolling||state.rolls>=3?'disabled':''}>${state.rolls>=3?'Keine Würfe mehr':'Nochmal würfeln'}</button></div>`}
    </div>
    ${drawerHtml()}
    ${confirmOverlayHtml()}
  </main>`;
}

function transitionHtml() {
  const player = state.players[state.currentPlayer];
  return `<main class="screen transition-screen"><div class="turn-announcer"><div class="announcer-die">${state.currentPlayer + 1}</div><p class="eyebrow">Als Nächstes</p><h1>${esc(player.name)}</h1><p>Du bist dran.</p></div></main>`;
}

function finalReadyHtml() {
  return `<main class="screen final-ready-screen"><div class="final-ready-inner"><div class="trophy-ring">${icon('trophy',36)}</div><p class="eyebrow">Alle Zettel voll</p><h1>Seid ihr bereit?</h1><p>Holt alle kurz an den Tisch. Die Punkte werden erst aufgedeckt, wenn ihr gemeinsam weitermacht.</p><button id="start-final-count" class="primary-button huge">Ergebnis aufdecken</button></div></main>`;
}

function revealHtml() {
  const totals = state.players.map(p=>totalFor(p.scores));
  return `<main class="screen reveal-screen"><div class="reveal-inner"><div class="trophy-ring">${icon('trophy',36)}</div><p class="eyebrow">Stifte weg</p><h1>Jetzt wird gezählt.</h1><p class="reveal-copy">Bonus, Straßen, Kniffel – alles kommt zusammen.</p><div class="reveal-list">${state.players.map((p,i)=>`<div class="reveal-row ${revealStage>i?'revealed':''}"><span>${esc(p.name)}</span><strong>${revealStage>i?totals[i]:revealTicker}</strong></div>`).join('')}</div></div></main>`;
}

function finalDrawerHtml() {
  return `${endDrawerOpen ? '<div class="drawer-backdrop" data-drawer-backdrop="final" aria-hidden="true"></div>' : ''}<aside id="final-drawer" class="score-drawer final-drawer ${endDrawerOpen ? 'open' : ''}" aria-label="End-Zettel">
    <button type="button" id="final-drawer-handle" class="drawer-handle" aria-expanded="${endDrawerOpen}"><span class="grabber"></span><span class="drawer-peek"><strong>End-Zettel</strong><small>${state.players.length} Spieler</small>${icon('chevron',18)}</span></button>
    <div class="drawer-body paper-drawer-body">
      <div class="drawer-heading"><div><p class="eyebrow">Endstand</p><h2>Kniffel-Zettel</h2></div></div>
      ${paperScoreTableHtml({ showTotals: true, selectable: false })}
      <p class="paper-sheet-hint">Wische innerhalb der Tabelle horizontal, wenn nicht alle Spieler auf den Bildschirm passen.</p>
    </div>
  </aside>`;
}

function finishedHtml() {
  const ranked = state.players.map(p=>({...p,total:totalFor(p.scores)})).sort((a,b)=>b.total-a.total);
  const max = ranked[0]?.total ?? 0;
  const tie = ranked.filter(p=>p.total===max).length>1;
  return `<main class="screen finished-screen"><header class="finish-header"><div class="winner-die">${icon('trophy',32)}</div><p class="eyebrow">Endstand</p><h1>${tie?'Unentschieden!':`${esc(ranked[0]?.name)} gewinnt.`}</h1><p>Jetzt darf der Gesamtstand endlich auf den Tisch.</p></header>
    <section class="podium-list">${ranked.map((p,i)=>`<div class="podium-row rank-${i+1}"><span class="rank">${i+1}</span><div><strong>${esc(p.name)}</strong></div><b>${p.total}</b></div>`).join('')}</section>
    <div class="bottom-action static finish-action"><button id="new-round" class="primary-button">Neue Runde</button></div>
    ${finalDrawerHtml()}
  </main>`;
}

function startReveal() {
  revealTimers.forEach(clearTimeout); revealTimers=[]; revealStage=0; revealTicker=0;
  const tick = setInterval(()=>{ revealTicker=Math.floor(Math.random()*320); render(); },70);
  revealTimers.push(tick);
  state.players.forEach((_,i)=>revealTimers.push(setTimeout(()=>{ revealStage=i+1; render(); },900+i*900)));
  revealTimers.push(setTimeout(()=>{ clearInterval(tick); state.phase='finished'; save(); render(); },1200+state.players.length*900));
}

function startTurnTransition() {
  if (transitionTimer) clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => {
    transitionTimer = null;
    state.phase = 'turn';
    save();
    render();
  }, 1050);
}

function doRoll() {
  if (rolling || state.rolls>=3) return;
  rolling=true;
  // Randomize immediately so the first roll visibly turns the placeholders into tumbling dice.
  state.dice=state.dice.map(d=>d.locked?d:{...d,value:Math.floor(Math.random()*6)+1});
  save(); render();
  let ticks=0;
  rollTimer=setInterval(()=>{
    ticks++;
    state.dice=state.dice.map(d=>d.locked?d:{...d,value:Math.floor(Math.random()*6)+1});
    save(); render();
    if(ticks>=7){ clearInterval(rollTimer); rollTimer=null; state.rolls++; rolling=false; save(); render(); }
  },85);
}

function openDrawer(mode='view') {
  drawerMode = mode;
  drawerOpen = true;
  render();
}

function chooseScore(category) {
  const player = state.players[state.currentPlayer];
  if (player.scores[category] !== null) return;
  const points = scoreDice(category, state.dice.map(d => d.value));
  const label = CATEGORIES.find(([key]) => key === category)?.[1] ?? category;
  pendingConfirm = { type: 'score', category, label, points };
  render();
}

function commitScore() {
  if (!pendingConfirm || pendingConfirm.type !== 'score') return;
  const { category, points } = pendingConfirm;
  const player = state.players[state.currentPlayer];
  if (player.scores[category] !== null) { pendingConfirm = null; render(); return; }
  player.scores[category] = points;
  player.lastSubmitted = category;
  pendingConfirm = null;
  drawerOpen=false; drawerMode='view';
  if(state.players.every(p=>allFilled(p.scores))){ state.phase='finalReady'; state.rolls=0; state.dice=freshDice(); endDrawerOpen=false; save(); render(); return; }
  state.currentPlayer=(state.currentPlayer+1)%state.players.length;
  state.phase='transition'; state.rolls=0; state.dice=freshDice(); save(); render(); startTurnTransition();
}

function resetGame(force=false) {
  if(!force && state.phase!=='setup') { pendingConfirm = { type: 'reset' }; render(); return; }
  if(rollTimer) clearInterval(rollTimer);
  if(transitionTimer) clearTimeout(transitionTimer);
  revealTimers.forEach(t=>clearTimeout(t)); revealTimers=[];
  rolling=false; drawerOpen=false; drawerMode='view'; pendingConfirm=null; endDrawerOpen=false; state=freshState(); save(); render();
}

