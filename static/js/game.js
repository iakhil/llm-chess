// Game state
let board = null;
let game = new Chess();
let $status = $('#status');
let $pgn = $('#pgn');

function onDragStart(source, piece, position, orientation) {
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
  const pgn = game.pgn();
  const model = $('#model-select').val();

  // Get API keys from local storage
  const keys = {
    openai: localStorage.getItem('openai_key'),
    anthropic: localStorage.getItem('anthropic_key'),
    gemini: localStorage.getItem('gemini_key')
  };

  // Determine which key to use based on model
  let apiKey = '';
  if (model.includes('gpt')) apiKey = keys.openai;
  else if (model.includes('claude')) apiKey = keys.anthropic;
  else if (model.includes('gemini')) apiKey = keys.gemini;

  if (!apiKey) {
    alert('Please set the API key for this model in Settings.');
    return;
  }

  $status.text('AI is thinking...');

  try {
    const response = await fetch('/api/move', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pgn: pgn,
        model: model,
        api_key: apiKey
      })
    });

    const data = await response.json();

    if (data.error) {
      alert('Error: ' + data.error);
      updateStatus();
      return;
    }

    // Parse UCI move (e.g. "e2e4", "a7a8q")
    const uci = data.move.toLowerCase();
    const from = uci.substring(0, 2);
    const to = uci.substring(2, 4);
    const promotion = uci.length > 4 ? uci.substring(4, 5) : 'q'; // Default to queen if not specified but needed, or if specified use it.

    const move = game.move({
      from: from,
      to: to,
      promotion: promotion
    });

    if (move === null) {
      console.error('AI returned illegal move:', data.move);
      alert('AI tried to make an illegal move: ' + data.move);
    } else {
      board.position(game.fen());
      updateStatus();
    }

  } catch (error) {
    console.error('Error fetching AI move:', error);
    $status.text('Error fetching AI move.');
  }
}

// Settings Modal Logic
const modal = document.getElementById('settings-modal');
const btn = document.getElementById('settings-btn');
const saveBtn = document.getElementById('save-keys-btn');

btn.onclick = function () {
  modal.classList.remove('hidden');
  // Load existing keys
  document.getElementById('openai-key').value = localStorage.getItem('openai_key') || '';
  document.getElementById('anthropic-key').value = localStorage.getItem('anthropic_key') || '';
  document.getElementById('gemini-key').value = localStorage.getItem('gemini_key') || '';
}

saveBtn.onclick = function () {
  localStorage.setItem('openai_key', document.getElementById('openai-key').value);
  localStorage.setItem('anthropic_key', document.getElementById('anthropic-key').value);
  localStorage.setItem('gemini_key', document.getElementById('gemini-key').value);
  modal.classList.add('hidden');
}

// Initialize
$(document).ready(function () {
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

  $('#start-btn').on('click', function () {
    game.reset();
    board.start();
    updateStatus();
  });

  $('#undo-btn').on('click', function () {
    game.undo();
    board.position(game.fen());
    updateStatus();
  });
});
