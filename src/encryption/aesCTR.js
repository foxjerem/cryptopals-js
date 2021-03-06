var aes        = require('./aesECB.js');
var utils      = require('../utils.js');
var analyzers  = require('../analyzers.js');
var encryption = require('../encryption.js');

// NOTE nonce and ctr are in little-endian format
// Default nonce \x00\x00\x00\x00\x00\x00\x00\x00

// Decrypt block by block
// -> m[0] = F(k, nonce || ctr) ⨁ c[0]
// -> m[1] = F(k, nonce || ctr + 1) ⨁ c[1]
// -> .....
//
// Buffer, Buffer, Buffer -> Buffer
//
function decrypt(bufCt, bufKey) {
  var  bufNonce = new Buffer(8).fill('\x00');
  var bufCtr    = new Buffer(8).fill('\x00');
  var blocks    = aes.blocks(bufCt);
  var plainBlocks;

  plainBlocks = blocks.map(function(bufC) {
    var bufF = aes.encrypt(Buffer.concat([ bufNonce, bufCtr ]), bufKey);

    bufC   = utils.xor.bytes(bufF.slice(0, bufC.length), bufC);
    bufCtr = incrementCtr(bufCtr);

    return bufC;
  });

  return Buffer.concat(plainBlocks);
}
//
// Symmetric function E <=> D
//
//
function encrypt(bufPt, bufKey) {
  return decrypt(bufPt, bufKey);
}
//
// Buffer -> Buffer
//
function incrementCtr(bufCtr) {
  for (var i = 0; i < bufCtr.length; i++) {
    if (bufCtr[i] !== 255) {
      bufCtr[i]++;
      break;
    }
  }

  return bufCtr;
}
//
// Retrieves the keystream from an array ciphertexts encrypted under the same key and nonce
//
// Array(Buffer) -> Buffer
//
function guessKeyStream(arrCts) {
  var keySize   = maxStreamLength(arrCts);
  var keyStream = new Buffer(keySize);

  for (var keyIndex = 0; keyIndex < keySize; keyIndex++) {
    var score    = 0;
    var maxScore = 0;

    for (var c = 0; c < 255; c++) {
      score = scoreCharGuess(c, keyIndex, arrCts);

      if (score > maxScore) {
        keyStream[keyIndex] = c;
      }
    }
  }
  
  return keyStream;
}
//
// Decrypts a series of CTR encoded ciphertexts (under the same nonce)
// by modelling as a single repeat key XOR encrypted ciphertext
//
// Array(Buffer) -> Buffer
//
function statisticalDecrypt(arrCts) {
  var keySize = minStreamLength(arrCts);
  var truncatedCts;

  truncatedCts = arrCts.map(function(bufCt) {
    return bufCt.slice(0, keySize);
  });

  return encryption.repeatKeyXOR.decryptNoKey(Buffer.concat(truncatedCts));
}
//
// Edit the plaintext underlying the ciphertext input at the supplied offset
//
// Buffer, Buffer, Number, Buffer -> Buffer
//
function editCt(bufCt, bufKey, offset, bufNewPt) {
  var bufPt = decrypt(bufCt, bufKey);
  var bufRes;

  bufNewPt.copy(bufPt, offset);
  bufRes = encrypt(bufPt, bufKey);

  return bufRes;
}

exports.decrypt            = decrypt;
exports.encrypt            = encrypt;
exports.guessKeyStream     = guessKeyStream;
exports.statisticalDecrypt = statisticalDecrypt;
exports.littleEndIncrement = incrementCtr;
exports.editCt             = editCt;

// ================================================================================================
// ================================================================================================

function maxStreamLength(arrCts) {
  var maxLen = 0;

  arrCts.forEach(function(bufCt) {
    var len = bufCt.length;

    if (len > maxLen) {
      maxLen = len;
    }
  });

  return maxLen;
}

function minStreamLength(arrCts) {
  var minLen = Infinity;

  arrCts.forEach(function(bufCt) {
    var len = bufCt.length;

    if (len < minLen) {
      minLen = len;
    }
  });

  return minLen;
}

function scoreCharGuess(c, keyIndex, arrCts) {
  var score = 0;
  var charPt;
  
  arrCts.forEach(function(bufCt) {
    if (bufCt[keyIndex]){
      charPt = bufCt[keyIndex] ^ c;
      score += analyzers.textScorer.charScore(charPt);
    }
  });

  return score;
}

