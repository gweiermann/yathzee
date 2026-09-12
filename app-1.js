function setupHtml() {
  return `<main class="screen setup-screen">
    <header class="brand-block"><div class="brand-mark">K</div><p class="eyebrow">Zettel weg. Spannung bleibt.</p><h1>Kniffel</h1><p class="lead">Wer sitzt mit am Tisch?</p></header>
    <section class="setup-card">
      <label for="player-name">Name</label>
      <div class="name-entry"><input id="player-name" placeholder="${state.players.length ? 'Noch jemand?' : 'Dein Name'}" maxlength="24" autocomplete="off" autofocus><button id="add-player" class="icon-button add" aria-label="Spieler hinzufügen">${icon('plus',28)}</button></div>
      ${state.players.length ? `<div class="player-stack">${state.players.map((p,i)=>`<div class="player-chip"><span class="player-number">${i+1}</span><strong>${esc(p.name)}</strong><button data-remove="${p.id}" aria-label="${esc(p.name)} entfernen">${icon('x',18)}</button></div>`).join('')}</div>` : ''}
      <p class="microcopy">${icon('users',16)} Du kannst beliebig viele Namen hinzufügen.</p>
    </section>
    <div class="bottom-action"><button id="start-game" class="primary-button" ${state.players.length ? '' : 'disabled'}>Spiel starten</button></div>
  </main>`;
}

function paperScoreTableHtml({ showTotals = false, selectable = false } = {}) {
  const lowerCats = CATEGORIES.filter(([key]) => !UPPER.some(([u]) => u === key));
  const shortNames = uniquePlayerLabels();
  const highlightCurrent = !showTotals && state.phase === 'turn';
  const currentClass = index => highlightCurrent && index === state.currentPlayer ? ' current-player-column' : '';
  const playerHeads = state.players.map((player, index) => `<th class="player-head${currentClass(index)}" title="${esc(player.name)}" aria-label="${esc(player.name)}">${esc(shortNames[index])}</th>`).join('');
  const fillerHead = '<th class="paper-grid-filler paper-grid-filler-head" aria-hidden="true"></th>';
  const fillerCell = '<td class="paper-grid-filler" aria-hidden="true"></td>';

  const scoreRow = ([key, label]) => {
    const shortLabel = TABLE_LABELS[key] ?? label;
    const cells = state.players.map((player, index) => {
      const value = player.scores[key];
      const open = value === null;
      const canSelect = selectable && index === state.currentPlayer && open;
      const last = player.lastSubmitted === key;
      const content = open
        ? (canSelect ? `<button type="button" class="paper-score-entry" data-score="${key}" aria-label="${esc(label)} für ${esc(player.name)} auswählen"></button>` : '')
        : `<span class="paper-written-score ${value === 0 ? 'struck' : ''}">${value === 0 ? '—' : value}</span>`;
      return `<td class="score-cell${currentClass(index)} ${last ? 'last-submit-cell' : ''}">${content}</td>`;
    }).join('') + fillerCell;
    const rowSelectable = selectable && state.players[state.currentPlayer]?.scores[key] === null;
    return `<tr class="paper-score-row ${rowSelectable ? 'selectable-score-row' : ''}" ${rowSelectable ? `data-row-score="${key}" role="button" tabindex="0" aria-label="${esc(label)} für ${esc(state.players[state.currentPlayer]?.name ?? '')} auswählen"` : ''}><th scope="row" class="category-cell" title="${esc(label)}">${esc(shortLabel)}</th>${cells}</tr>`;
  };

  const summaryRow = (label, shortLabel, valueForPlayer, className = '') => `<tr class="paper-summary-row ${className}"><th scope="row" class="category-cell" title="${esc(label)}">${esc(shortLabel)}</th>${state.players.map((player, index) => {
    const value = valueForPlayer(player);
    const earned = label === 'Bonus ab 63' && bonusFor(player.scores) > 0;
    return `<td class="summary-cell${currentClass(index)} ${earned ? 'bonus-earned' : ''}">${value}</td>`;
  }).join('')}${fillerCell}</tr>`;

  const upperValue = player => showTotals ? upperSubtotal(player.scores) : '';
  const bonusValue = player => {
    const bonus = bonusFor(player.scores);
    if (showTotals) return bonus ? '+35' : '—';
    return bonus ? '+35' : '';
  };
  const upperTotalValue = player => showTotals ? upperSubtotal(player.scores) + bonusFor(player.scores) : '';
  const lowerValue = player => showTotals ? lowerSubtotal(player.scores) : '';
  const grandValue = player => showTotals ? totalFor(player.scores) : '';

  return `<div class="paper-table-scroll">
    <table class="paper-score-table" aria-label="Kniffel-Zettel aller Spieler">
      <thead><tr><th class="category-head">Feld</th>${playerHeads}${fillerHead}</tr></thead>
      <tbody>
        <tr class="paper-section-row"><th colspan="${state.players.length + 2}">Oben</th></tr>
        ${UPPER.map(scoreRow).join('')}
        ${summaryRow('Zwischensumme', 'Summe', upperValue)}
        ${summaryRow('Bonus ab 63', 'Bonus', bonusValue)}
        ${summaryRow('Oben gesamt', 'Oben ges.', upperTotalValue, 'strong')}
        <tr class="paper-section-row"><th colspan="${state.players.length + 2}">Unten</th></tr>
        ${lowerCats.map(scoreRow).join('')}
        ${summaryRow('Unten gesamt', 'Unten ges.', lowerValue)}
      </tbody>
      <tfoot><tr class="paper-grand-total"><th class="category-cell">Gesamt</th>${state.players.map((player, index) => `<td class="grand-cell${currentClass(index)}">${grandValue(player)}</td>`).join('')}${fillerCell}</tr></tfoot>
    </table>
  </div>`;
}

function confirmOverlayHtml() {
  if (!pendingConfirm) return '';
  if (pendingConfirm.type === 'reset') {
    return `<div class="confirm-backdrop" role="presentation"><section class="confirm-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div class="confirm-mark">↺</div>
      <p class="eyebrow">Neues Spiel</p>
      <h2 id="confirm-title">Wirklich neu anfangen?</h2>
      <p class="confirm-copy">Der aktuelle Spielstand wird gelöscht.</p>
      <div class="confirm-actions"><button type="button" id="confirm-cancel" class="secondary-button">Zurück</button><button type="button" id="confirm-accept" class="danger-button">Spiel löschen</button></div>
    </section></div>`;
  }
  const { label, points } = pendingConfirm;
  const strike = points === 0;
  return `<div class="confirm-backdrop" role="presentation"><section class="confirm-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <div class="confirm-score-box">${strike ? '—' : points}</div>
    <p class="eyebrow">${strike ? 'Feld streichen' : 'Eintragen'}</p>
    <h2 id="confirm-title">${strike ? `${esc(label)} streichen?` : `${esc(label)} eintragen?`}</h2>
    <p class="confirm-copy">${strike ? 'Dieses Feld bekommt 0 Punkte und ist danach verbraucht.' : `${points} Punkte werden auf deinem Zettel eingetragen.`}</p>
    <div class="confirm-actions"><button type="button" id="confirm-cancel" class="secondary-button">Zurück</button><button type="button" id="confirm-accept" class="primary-button">${strike ? 'Streichen' : 'Eintragen'}</button></div>
  </section></div>`;
}

function drawerHtml() {
  const selecting = drawerMode === 'score';
  const player = state.players[state.currentPlayer];
  return `${drawerOpen ? '<div class="drawer-backdrop" data-drawer-backdrop="score" aria-hidden="true"></div>' : ''}<aside id="score-drawer" class="score-drawer ${drawerOpen ? 'open' : ''} ${selecting ? 'select-mode' : ''}" aria-label="Kniffel-Zettel">
    <button type="button" id="drawer-handle" class="drawer-handle" aria-expanded="${drawerOpen}">
      <span class="grabber"></span>
      <span class="drawer-peek"><strong>Zettel</strong><small>${state.players.length} Spieler</small>${icon('chevron',18)}</span>
    </button>
    <div class="drawer-body paper-drawer-body">
      <div class="drawer-heading"><div><p class="eyebrow">Alle am Tisch</p><h2>Kniffel-Zettel</h2></div></div>
      ${selecting ? `<div class="paper-mode-line"><span><strong>Wurf eintragen:</strong> Kategoriezeile antippen – eingetragen wird bei ${esc(player.name)}.</span><button type="button" id="cancel-score" class="drawer-cancel">Fertig</button></div>` : ''}
      ${paperScoreTableHtml({ showTotals: false, selectable: selecting })}
      <p class="paper-sheet-hint">${selecting ? 'Die leeren Felder der aktuellen Spalte sind beschreibbar.' : 'Zwischen- und Gesamtsummen bleiben bis zum Ende leer. Ein erreichter Bonus wird sofort eingetragen.'}</p>
    </div>
  </aside>`;
}

