const CARD_TYPES = [
  { key: "sun", name: "해님", symbol: "☀️" },
  { key: "moon", name: "달님", symbol: "🌙" },
  { key: "star", name: "별", symbol: "⭐" },
  { key: "cloud", name: "구름", symbol: "☁️" },
  { key: "leaf", name: "잎사귀", symbol: "🍀" },
];

const BOMB_CARD = { key: "bomb", name: "폭탄", symbol: "💣" };
const NPC_NAMES = ["루미", "도토", "미오", "하루"];

const state = {
  players: [],
  deck: [],
  currentPlayerIndex: 0,
  selectedCardIds: [],
  locked: false,
  gameStarted: false,
  gameOver: false,
  knownCards: new Map(),
  activeTimeout: null,
};

const boardEl = document.getElementById("board");
const scoreboardEl = document.getElementById("scoreboard");
const turnLabelEl = document.getElementById("turnLabel");
const messageLabelEl = document.getElementById("messageLabel");
const playerCountEl = document.getElementById("playerCount");
const characterFieldsEl = document.getElementById("characterFields");
const startGameButtonEl = document.getElementById("startGameButton");

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function delay(ms) {
  return new Promise((resolve) => {
    state.activeTimeout = window.setTimeout(resolve, ms);
  });
}

function buildCharacterFields() {
  const count = Number(playerCountEl.value);
  characterFieldsEl.innerHTML = "";

  const humanCard = document.createElement("div");
  humanCard.className = "character-card";
  humanCard.innerHTML = `
    <span class="tag">플레이어</span>
    <label for="playerHumanName">내 캐릭터 이름</label>
    <input id="playerHumanName" type="text" maxlength="12" value="나" />
  `;
  characterFieldsEl.appendChild(humanCard);

  for (let i = 1; i < count; i += 1) {
    const npcCard = document.createElement("div");
    npcCard.className = "character-card";
    npcCard.innerHTML = `
      <span class="tag">NPC ${i}</span>
      <label for="npcName${i}">NPC 이름</label>
      <input id="npcName${i}" type="text" maxlength="12" value="${NPC_NAMES[i - 1] || `NPC ${i}`}" />
    `;
    characterFieldsEl.appendChild(npcCard);
  }
}

function createDeck() {
  const cards = [];
  let idCounter = 1;

  CARD_TYPES.forEach((type) => {
    for (let i = 0; i < 4; i += 1) {
      cards.push({
        id: idCounter,
        type: type.key,
        label: type.name,
        symbol: type.symbol,
        isBomb: false,
        revealed: false,
        matched: false,
        bombed: false,
      });
      idCounter += 1;
    }
  });

  for (let i = 0; i < 5; i += 1) {
    cards.push({
      id: idCounter,
      type: BOMB_CARD.key,
      label: `${BOMB_CARD.name}`,
      symbol: BOMB_CARD.symbol,
      isBomb: true,
      revealed: false,
      matched: false,
      bombed: false,
    });
    idCounter += 1;
  }

  return shuffle(cards);
}

function startGame() {
  if (state.activeTimeout) {
    window.clearTimeout(state.activeTimeout);
  }

  const count = Number(playerCountEl.value);
  const humanName = document.getElementById("playerHumanName").value.trim() || "나";
  const players = [
    {
      id: "human",
      name: humanName,
      isHuman: true,
      score: 0,
      matches: 0,
      bombs: 0,
      memory: new Map(),
    },
  ];

  for (let i = 1; i < count; i += 1) {
    const value = document.getElementById(`npcName${i}`).value.trim();
    players.push({
      id: `npc-${i}`,
      name: value || NPC_NAMES[i - 1] || `NPC ${i}`,
      isHuman: false,
      score: 0,
      matches: 0,
      bombs: 0,
      memory: new Map(),
    });
  }

  state.players = players;
  state.deck = createDeck();
  state.currentPlayerIndex = 0;
  state.selectedCardIds = [];
  state.locked = false;
  state.gameStarted = true;
  state.gameOver = false;
  state.knownCards = new Map();

  setMessage(`${players[0].name}의 차례입니다. 카드 2장을 골라 주세요.`);
  render();
  maybeRunNpcTurn();
}

function setMessage(message) {
  messageLabelEl.textContent = message;
}

function getCurrentPlayer() {
  return state.players[state.currentPlayerIndex];
}

function render() {
  renderScoreboard();
  renderBoard();

  const currentPlayer = getCurrentPlayer();
  turnLabelEl.textContent = state.gameOver ? "게임 종료" : `${currentPlayer.name}${currentPlayer.isHuman ? " (플레이어)" : " (NPC)"}`;
}

function renderScoreboard() {
  scoreboardEl.innerHTML = "";

  state.players.forEach((player, index) => {
    const card = document.createElement("div");
    card.className = `player-card${index === state.currentPlayerIndex && !state.gameOver ? " active" : ""}${player.isHuman ? " human" : ""}`;
    card.innerHTML = `
      <h3>${player.name}</h3>
      <p class="player-role">${player.isHuman ? "실제 플레이어" : "NPC 자동 플레이"}</p>
      <p class="player-score">${player.score}점</p>
      <p class="player-detail">매칭 ${player.matches}세트 · 폭탄 ${player.bombs}장</p>
    `;
    scoreboardEl.appendChild(card);
  });
}

function renderBoard() {
  boardEl.innerHTML = "";

  state.deck.forEach((card) => {
    const button = document.createElement("button");
    const currentPlayer = getCurrentPlayer();
    const canInteract =
      state.gameStarted &&
      !state.gameOver &&
      currentPlayer?.isHuman &&
      !state.locked &&
      !card.revealed &&
      !card.matched &&
      !card.bombed &&
      state.selectedCardIds.length < 2;

    button.className = `tile${card.revealed ? " revealed" : ""}${card.matched ? " matched" : ""}${card.bombed ? " bombed" : ""}`;
    button.disabled = !canInteract;
    button.dataset.cardId = String(card.id);
    button.innerHTML = `
      <span class="tile-face tile-back" aria-hidden="true"></span>
      <span class="tile-face tile-front">
        <span>
          <div class="card-symbol">${card.symbol}</div>
          <div class="card-name">${card.label}</div>
        </span>
      </span>
    `;
    button.addEventListener("click", () => handleHumanCardClick(card.id));
    boardEl.appendChild(button);
  });
}

function rememberCard(card) {
  if (card.isBomb || card.matched || card.bombed) {
    return;
  }

  if (!state.knownCards.has(card.type)) {
    state.knownCards.set(card.type, new Set());
  }

  state.knownCards.get(card.type).add(card.id);
}

function forgetCard(card) {
  if (!state.knownCards.has(card.type)) {
    return;
  }

  state.knownCards.get(card.type).delete(card.id);
  if (state.knownCards.get(card.type).size === 0) {
    state.knownCards.delete(card.type);
  }
}

function updateKnowledgeFromSelections() {
  state.selectedCardIds.forEach((cardId) => {
    const card = state.deck.find((entry) => entry.id === cardId);
    if (card) {
      rememberCard(card);
    }
  });
}

function revealCard(cardId) {
  const card = state.deck.find((entry) => entry.id === cardId);
  if (!card || card.revealed || card.matched || card.bombed) {
    return null;
  }

  card.revealed = true;
  state.selectedCardIds.push(cardId);
  rememberCard(card);
  render();
  return card;
}

async function handleHumanCardClick(cardId) {
  const currentPlayer = getCurrentPlayer();
  if (!currentPlayer?.isHuman || state.locked || state.gameOver) {
    return;
  }

  const card = revealCard(cardId);
  if (!card) {
    return;
  }

  if (state.selectedCardIds.length === 2) {
    state.locked = true;
    await delay(850);
    await resolveTurn();
  } else if (card.isBomb) {
    state.locked = true;
    await delay(700);
    await resolveTurn();
  } else {
    setMessage(`${currentPlayer.name}님, 카드 한 장을 더 선택해 주세요.`);
  }
}

function getSelectedCards() {
  return state.selectedCardIds
    .map((cardId) => state.deck.find((card) => card.id === cardId))
    .filter(Boolean);
}

function resetSelectedCards() {
  state.selectedCardIds = [];
}

function hideCards(cards) {
  cards.forEach((card) => {
    if (!card.matched && !card.bombed) {
      card.revealed = false;
    }
  });
}

function markCardsMatched(cards) {
  cards.forEach((card) => {
    card.matched = true;
    card.revealed = true;
    forgetCard(card);
  });
}

function markBombCards(cards) {
  cards.forEach((card) => {
    if (card.isBomb) {
      card.bombed = true;
      forgetCard(card);
    }
  });
}

function nextPlayer() {
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
}

function getRemainingPlayableCards() {
  return state.deck.filter((card) => !card.matched && !card.bombed);
}

function finishGame() {
  state.gameOver = true;
  state.locked = true;

  const bestScore = Math.max(...state.players.map((player) => player.score));
  const winners = state.players.filter((player) => player.score === bestScore);
  const names = winners.map((player) => player.name).join(", ");
  const suffix = winners.length > 1 ? " 공동 승리" : " 승리";

  setMessage(`게임 종료! ${names}${suffix}입니다. 최종 점수는 ${bestScore}점입니다.`);
  render();
}

async function resolveTurn() {
  const player = getCurrentPlayer();
  const selectedCards = getSelectedCards();
  const hasBomb = selectedCards.some((card) => card.isBomb);
  const isPair =
    selectedCards.length === 2 &&
    !hasBomb &&
    selectedCards[0].type === selectedCards[1].type;

  if (hasBomb) {
    const bombCount = selectedCards.filter((card) => card.isBomb).length;
    player.score -= bombCount;
    player.bombs += bombCount;
    markBombCards(selectedCards);
    await delay(550);
    hideCards(selectedCards);
    resetSelectedCards();
    setMessage(`${player.name}님이 폭탄을 뒤집어 ${bombCount}점 감점되었습니다. 다음 플레이어로 넘어갑니다.`);
    if (getRemainingPlayableCards().length === 0) {
      finishGame();
      return;
    }
    nextPlayer();
  } else if (isPair) {
    player.score += 2;
    player.matches += 1;
    markCardsMatched(selectedCards);
    resetSelectedCards();
    setMessage(`${player.name}님이 ${selectedCards[0].label} 2장을 획득했습니다. 한 번 더 진행할 수 있습니다.`);
    if (getRemainingPlayableCards().length === 0) {
      finishGame();
      return;
    }
  } else {
    updateKnowledgeFromSelections();
    await delay(550);
    hideCards(selectedCards);
    resetSelectedCards();
    setMessage(`${player.name}님의 선택이 일치하지 않았습니다. 다음 플레이어 차례입니다.`);
    nextPlayer();
  }

  state.locked = false;
  render();
  maybeRunNpcTurn();
}

function chooseNpcCard(preferredIds = []) {
  const availableCards = state.deck.filter((card) => !card.revealed && !card.matched && !card.bombed);
  const preferred = preferredIds.find((id) => availableCards.some((card) => card.id === id));
  if (preferred) {
    return preferred;
  }

  const safeKnownPair = [...state.knownCards.values()].find((idSet) => {
    const visibleIds = [...idSet].filter((id) => availableCards.some((card) => card.id === id));
    return visibleIds.length >= 2;
  });

  if (safeKnownPair) {
    return [...safeKnownPair].find((id) => availableCards.some((card) => card.id === id)) || null;
  }

  if (availableCards.length === 0) {
    return null;
  }

  const pick = availableCards[Math.floor(Math.random() * availableCards.length)];
  return pick.id;
}

function getKnownMatchForCard(card) {
  const ids = state.knownCards.get(card.type);
  if (!ids) {
    return null;
  }

  const options = [...ids].filter((id) => id !== card.id);
  return options.find((id) => {
    const candidate = state.deck.find((entry) => entry.id === id);
    return candidate && !candidate.revealed && !candidate.matched && !candidate.bombed;
  }) || null;
}

async function runNpcTurn() {
  const player = getCurrentPlayer();
  if (!player || player.isHuman || state.gameOver) {
    return;
  }

  state.locked = true;
  setMessage(`${player.name}가 카드를 고르는 중입니다...`);
  render();
  await delay(900);

  const firstChoiceId = chooseNpcCard();
  if (firstChoiceId == null) {
    finishGame();
    return;
  }

  const firstCard = revealCard(firstChoiceId);
  await delay(850);

  if (!firstCard) {
    state.locked = false;
    return;
  }

  if (firstCard.isBomb) {
    await resolveTurn();
    return;
  }

  const secondChoiceId = getKnownMatchForCard(firstCard) || chooseNpcCard();
  if (secondChoiceId == null) {
    await resolveTurn();
    return;
  }

  revealCard(secondChoiceId);
  await delay(950);
  await resolveTurn();
}

function maybeRunNpcTurn() {
  const currentPlayer = getCurrentPlayer();
  if (currentPlayer && !currentPlayer.isHuman && !state.gameOver && !state.locked) {
    runNpcTurn();
  }
}

playerCountEl.addEventListener("change", buildCharacterFields);
startGameButtonEl.addEventListener("click", startGame);

buildCharacterFields();
render();
