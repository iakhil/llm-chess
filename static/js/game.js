// Game state
let board = null;
let game = new Chess();
let $status = $('#status');
let $pgn = $('#pgn');
let aiIllegalMoveDetected = false;
let $illegalMoveOverlay = null;
let $illegalMoveText = null;

function startNewGame() {
  aiIllegalMoveDetected = false;
  if ($illegalMoveOverlay) {
    $illegalMoveOverlay.addClass('hidden');
  }
  game.reset();
  board.start();
  updateStatus();
}

function handleIllegalMove(move) {
  aiIllegalMoveDetected = true;
  const moveLabel = move ? move.toLowerCase() : 'unknown';
  const message = `AI tried to make an illegal move (${moveLabel}). You win!`;
  if ($illegalMoveText) {
    $illegalMoveText.text(message);
  }
  if ($illegalMoveOverlay) {
    $illegalMoveOverlay.removeClass('hidden');
  }
  $status.text(`Game over: ${message}`);
}

function onDragStart(source, piece, position, orientation) {
  if (aiIllegalMoveDetected) return false;
  // do not pick up pieces if the game is over
  if (game.game_over()) return false;

  // only pick up pieces for the side to move
  if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
    (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
    return false;
  }
}

function onDrop(source, target) {
  // see if the move is legal
  let move = game.move({
    from: source,
    to: target,
    promotion: 'q' // NOTE: always promote to a queen for example simplicity
  });

  // illegal move
  if (move === null) return 'snapback';

  updateStatus();

  // If game is not over, trigger AI move
  if (!game.game_over()) {
    makeAIMove();
  }
}

function onSnapEnd() {
  board.position(game.fen());
}

function updateStatus() {
  let status = '';

  let moveColor = 'White';
  if (game.turn() === 'b') {
    moveColor = 'Black';
  }

  // checkmate?
  if (game.in_checkmate()) {
    status = 'Game over, ' + moveColor + ' is in checkmate.';
  }

  // draw?
  else if (game.in_draw()) {
    status = 'Game over, drawn position';
  }

  // game still on
  else {
    status = moveColor + ' to move';

    // check?
    if (game.in_check()) {
      status += ', ' + moveColor + ' is in check';
    }
  }

  $status.html(status);
  $pgn.html(game.pgn());
}

async function makeAIMove() {
  if (aiIllegalMoveDetected || game.game_over()) return;
  const pgn = game.pgn();
  const model = $('#model-select').val();

  const apiKey = localStorage.getItem('openai_key');

  if (!apiKey) {
    alert('Please set the OpenAI API key in Settings.');
    return;
  }

  $status.text('AI is thinking...');

  const prompt = `You are a chess grandmaster.
PGN: ${pgn}
Analyze the position and determine the best move for the side to move.
Provide your response in JSON format with two keys: "reasoning" (string) and "move" (string, UCI format e2e4).
`;

  const payload = {
    model: model,
    messages: [
      { role: 'system', content: 'You are a chess engine. Output JSON.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' }
  };

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'OpenAI request failed');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned no content');
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('Failed to decode JSON from OpenAI response');
    }

    const uci = parsed.move?.toLowerCase();
    if (!uci) {
      throw new Error('No move returned');
    }

    const from = uci.substring(0, 2);
    const to = uci.substring(2, 4);
    const promotion = uci.length > 4 ? uci.substring(4, 5) : 'q';

    const move = game.move({ from, to, promotion });
    if (move === null) {
      console.error('AI returned illegal move:', parsed.move);
      handleIllegalMove(parsed.move);
      return;
    }

    board.position(game.fen());
    updateStatus();
  } catch (error) {
    console.error('Error fetching AI move:', error);
    $status.text('Error fetching AI move.');
    alert(`Error: ${error.message}`);
  }
}

// Settings Modal Logic
const modal = document.getElementById('settings-modal');
const btn = document.getElementById('settings-btn');
const saveBtn = document.getElementById('save-keys-btn');

btn.onclick = function () {
  modal.classList.remove('hidden');
  document.getElementById('openai-key').value = localStorage.getItem('openai_key') || '';
}

saveBtn.onclick = function () {
  localStorage.setItem('openai_key', document.getElementById('openai-key').value);
  modal.classList.add('hidden');
}

// Initialize
$(document).ready(function () {
  $illegalMoveOverlay = $('#illegal-move-overlay');
  $illegalMoveText = $('#illegal-move-text');
  let config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
  };
  // Note: We need to handle piece images. For now we can use the default wikipedia url or download them.
  // The default chessboard.js config uses a wikipedia URL if not specified, but let's see.
  // Actually, let's use the standard URL for now to avoid missing assets.
  // delete config.pieceTheme; 

  board = Chessboard('board', config);
  updateStatus();

  $('#start-btn').on('click', startNewGame);
  $('#illegal-move-newgame').on('click', startNewGame);

  $('#undo-btn').on('click', function () {
    game.undo();
    board.position(game.fen());
    updateStatus();
  });
});
