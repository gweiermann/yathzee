function bindDrawer() {
  bindBottomSheet({
    drawer: document.querySelector('#score-drawer'),
    handle: document.querySelector('#drawer-handle'),
    backdrop: document.querySelector('[data-drawer-backdrop="score"]'),
    isOpen: () => drawerOpen,
    setOpen: value => { drawerOpen = value; },
    onClose: () => { if (drawerMode === 'score') drawerMode = 'view'; }
  });
}

function bindSetup() {
  const input=document.querySelector('#player-name');
  const add=()=>{ const name=input.value.trim(); if(!name)return; state.players.push({id:(globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),name,scores:emptyScores(),lastSubmitted:null}); save(); render(); setTimeout(()=>document.querySelector('#player-name')?.focus(),0); };
  document.querySelector('#add-player')?.addEventListener('click',add);
  input?.addEventListener('keydown',e=>{if(e.key==='Enter')add();});
  document.querySelectorAll('[data-remove]').forEach(el=>el.addEventListener('click',()=>{state.players=state.players.filter(p=>p.id!==el.dataset.remove);save();render();}));
  document.querySelector('#start-game')?.addEventListener('click',()=>{ if(!state.players.length)return; state.phase='transition'; state.currentPlayer=0;state.rolls=0;state.dice=freshDice();save();render();startTurnTransition();});
}
function bindTurn() {
  document.querySelector('#reset-game')?.addEventListener('click',()=>resetGame(false));
  document.querySelector('#roll')?.addEventListener('click',doRoll);
  document.querySelector('#choose-score')?.addEventListener('click',()=>openDrawer('score'));
  document.querySelector('#cancel-score')?.addEventListener('click',()=>{drawerMode='view';drawerOpen=true;render();});
  document.querySelectorAll('[data-score]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();chooseScore(el.dataset.score);}));
  document.querySelectorAll('[data-row-score]').forEach(el=>{
    el.addEventListener('click',()=>chooseScore(el.dataset.rowScore));
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseScore(el.dataset.rowScore);}});
  });
  document.querySelectorAll('[data-quick-score]').forEach(el=>el.addEventListener('click',()=>chooseScore(el.dataset.quickScore)));
  document.querySelectorAll('[data-die]').forEach(el=>el.addEventListener('click',()=>{if(state.rolls===0||rolling)return;const i=Number(el.dataset.die);state.dice[i].locked=!state.dice[i].locked;save();render();}));
  document.querySelector('#confirm-cancel')?.addEventListener('click',()=>{pendingConfirm=null;render();});
  document.querySelector('#confirm-accept')?.addEventListener('click',()=>{ if(pendingConfirm?.type==='reset') resetGame(true); else commitScore(); });
  document.querySelector('.confirm-backdrop')?.addEventListener('click',e=>{ if(e.target===e.currentTarget){pendingConfirm=null;render();} });
  bindDrawer();
}

function bindFinalDrawer() {
  bindBottomSheet({
    drawer: document.querySelector('#final-drawer'),
    handle: document.querySelector('#final-drawer-handle'),
    backdrop: document.querySelector('[data-drawer-backdrop="final"]'),
    isOpen: () => endDrawerOpen,
    setOpen: value => { endDrawerOpen = value; }
  });
}

function render() {
  const app=document.querySelector('#app');
  if(state.phase==='setup') app.innerHTML=setupHtml();
  else if(state.phase==='transition') app.innerHTML=transitionHtml();
  else if(state.phase==='turn') app.innerHTML=turnHtml();
  else if(state.phase==='finalReady') app.innerHTML=finalReadyHtml();
  else if(state.phase==='reveal') app.innerHTML=revealHtml();
  else app.innerHTML=finishedHtml();
  if(state.phase==='setup') bindSetup();
  else if(state.phase==='turn') bindTurn();
  else if(state.phase==='finalReady') document.querySelector('#start-final-count')?.addEventListener('click',()=>{state.phase='reveal';save();render();startReveal();});
  else if(state.phase==='finished') { document.querySelector('#new-round')?.addEventListener('click',()=>resetGame(true)); bindFinalDrawer(); }
}

if(state.phase==='transition') setTimeout(startTurnTransition,0);
if(state.phase==='reveal') setTimeout(startReveal,0);
render();
