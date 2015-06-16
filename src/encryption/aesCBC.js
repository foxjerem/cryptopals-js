var aes   = require('./aesECB.js');
var utils = require('../utils.js');
// Encrypt block by block
//  -> c[0] = E(k, m[0] ⨁ IV)
//  -> c[1] = E(k, m[1] ⨁ c[0])
//  -> ...
//
// Buffer, Buffer, Buffer -> Buffer
//
function encrypt(buf, bufKey, bufIv) {
  var blocks;
  var cipherBlocks;

  buf    = utils.pkcs7.pad(buf, aes.BLOCK_SIZE);
  blocks = aes.blocks(buf);

  cipherBlocks = blocks.map(function(bufM) {
    var bufC;

    bufM  = utils.xor.bytes(bufM, bufIv);
    bufC  = aes.encrypt(bufM, bufKey);
    bufIv = bufC;

    return bufC;
  });

  return Buffer.concat(cipherBlocks);
}

// Decrypt block by block
//  -> m[0] = D(k, c[0]) ⨁ IV 
//  -> m[1] = D(k, c[1]) ⨁ c[0]
//  -> ...
//
// Buffer, Buffer, Buffer -> Buffer
//
function decrypt(buf, bufKey, bufIv) {
  var blocks = aes.blocks(buf);
  var plainBlocks;
  var bufPt;

  plainBlocks = blocks.map(function(bufC) {
    var bufM = aes.decrypt(bufC, bufKey);
    
    bufM  = utils.xor.bytes(bufM, bufIv);
    bufIv = bufC;

    return bufM;
  });

  bufPt = Buffer.concat(plainBlocks);
  bufPt = utils.pkcs7.strip(bufPt, aes.BLOCK_SIZE);

  return bufPt;
}

exports.decrypt = decrypt;
exports.encrypt = encrypt;